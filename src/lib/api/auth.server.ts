import { getSql } from "@/lib/db";
import { ApiError, missingScope } from "./errors";
import { ADMIN_SCOPES, effectiveScopes, hasScope, type Scope } from "./scopes";
import { bearerFromHeader, hashApiKey, isWellFormedKey } from "./secret.server";

/**
 * Bearer API-key authentication for /api/v1 and /api/mcp — **server-only**.
 * Never reads cookies: a browser session can not ride into these endpoints,
 * so they need no CSRF defence and can allow cross-origin callers.
 */

export type ApiCaller = {
  keyId: number;
  userId: string;
  /** Scopes usable right now (team scopes only while the owner is on the team). */
  scopes: Scope[];
};

/** Requests per key per window, across REST and MCP. */
export const RATE_LIMIT = 60;
export const RATE_WINDOW_SECONDS = 60;
/** New service requests per key per hour — each one pages the team. */
export const WRITE_LIMIT = 20;
export const WRITE_WINDOW_SECONDS = 3600;

/** Failed authentications (bad/unknown/revoked keys) per client IP per window. */
export const AUTH_FAIL_LIMIT = 30;
export const AUTH_FAIL_WINDOW_SECONDS = 300;

const unauthorized = (message: string) => new ApiError(401, "unauthorized", message);

/**
 * Callers (HMAC of the IP, see `visitorId`; the raw address is never stored)
 * that recently tripped the failed-auth limit, kept per instance so a
 * blocked caller is turned away before any database work. The authoritative
 * count lives in `rate_hits` (shared across instances).
 */
const blockedIps = new Map<string, number>();

function blockedFor(ip: string): number {
  const until = blockedIps.get(ip);
  if (!until) return 0;
  const left = Math.ceil((until - Date.now()) / 1000);
  if (left <= 0) blockedIps.delete(ip);
  return Math.max(0, left);
}

const tooManyFailures = (retryAfter: number) =>
  new ApiError(429, "rate_limited", `Too many failed authentication attempts. Retry after ${retryAfter} seconds.`, {
    retryAfter,
  });

/** Count one failed authentication for this IP; throws 429 once over the limit. */
async function recordAuthFailure(ip: string, err: ApiError): Promise<never> {
  try {
    await takeRateHit(`api-authfail:${ip}`, AUTH_FAIL_LIMIT, AUTH_FAIL_WINDOW_SECONDS);
  } catch (limitErr) {
    if (limitErr instanceof ApiError && limitErr.status === 429) {
      if (blockedIps.size > 10_000) blockedIps.clear();
      blockedIps.set(ip, Date.now() + (limitErr.retryAfter ?? AUTH_FAIL_WINDOW_SECONDS) * 1000);
      throw tooManyFailures(limitErr.retryAfter ?? AUTH_FAIL_WINDOW_SECONDS);
    }
    throw limitErr;
  }
  throw err;
}

export async function authenticate(request: Request): Promise<ApiCaller> {
  const { visitorId } = await import("@/lib/rate-limit.server");
  const ip = visitorId();
  const wait = blockedFor(ip);
  if (wait) throw tooManyFailures(wait);

  const header = request.headers.get("authorization");
  const secret = bearerFromHeader(header);
  if (!secret) {
    // No credentials at all is a client bug, not a guess: not counted.
    throw unauthorized(
      header
        ? 'Malformed Authorization header. Send "Authorization: Bearer deal_live_…".'
        : 'Missing API key. Send "Authorization: Bearer deal_live_…"; create a key at /client/keys.',
    );
  }
  if (!isWellFormedKey(secret)) {
    return recordAuthFailure(
      ip,
      unauthorized("Invalid API key. Check that you copied the whole deal_live_… value."),
    );
  }

  // Lookup is by the SHA-256 of the full secret through a unique index: the
  // database never sees the secret, and no secret comparison happens in code
  // (so there is nothing to time). The key has 256 bits of entropy.
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    user_id: string;
    scopes: string[];
    revoked_at: string | Date | null;
    expires_at: string | Date | null;
  }>`select id, user_id, scopes, revoked_at, expires_at from api_keys where key_hash = ${hashApiKey(secret)} limit 1`;
  const key = rows[0];
  if (!key) {
    return recordAuthFailure(ip, unauthorized("Invalid API key. It may have been deleted; create a new one."));
  }
  const dead = key.revoked_at
    ? unauthorized("This API key was revoked. Create a new key at /client/keys.")
    : key.expires_at && new Date(key.expires_at).getTime() <= Date.now()
      ? unauthorized("This API key has expired. Create a new key at /client/keys.")
      : null;
  if (dead) {
    // Attributed to the key so the team sees a leaked, revoked key being tried.
    dead.keyId = key.id;
    return recordAuthFailure(ip, dead);
  }

  const wantsAdmin = key.scopes.some((s) => (ADMIN_SCOPES as readonly string[]).includes(s));
  const ownerIsAdmin = wantsAdmin
    ? await import("./admin.server").then((m) => m.isAdminUser(key.user_id))
    : false;

  try {
    await takeRateHit(`api:${key.id}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  } catch (err) {
    if (err instanceof ApiError) err.keyId = key.id;
    throw err;
  }

  // Coarse `last_used_at` (30 s) keeps a busy key from writing on every call.
  await sql`
    update api_keys set last_used_at = now()
    where id = ${key.id}
      and (last_used_at is null or last_used_at < now() - interval '30 seconds')
  `;

  return { keyId: key.id, userId: key.user_id, scopes: effectiveScopes(key.scopes, ownerIsAdmin) };
}

export function requireScope(caller: ApiCaller, scope: Scope): void {
  if (!hasScope(caller.scopes, scope)) throw missingScope(scope);
}

/**
 * Count a hit against `key` (shared `rate_hits` table, see
 * `rate-limit.server.ts`), or throw a 429 that says when to retry.
 */
export async function takeRateHit(key: string, limit: number, windowSeconds: number) {
  const { takeHit, RateLimitError } = await import("@/lib/rate-limit.server");
  try {
    await takeHit(key, limit, windowSeconds);
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    const sql = await getSql();
    // Fixed window: the oldest hit in the window is the next to expire.
    const rows = await sql<{ s: number | null }>`
      select ceil(extract(epoch from (min(at) + ${windowSeconds}::int * interval '1 second' - now())))::int as s
      from rate_hits
      where key = ${key} and at > now() - ${windowSeconds}::int * interval '1 second'
    `;
    const retryAfter = Math.max(1, rows[0]?.s ?? windowSeconds);
    throw new ApiError(
      429,
      "rate_limited",
      `Rate limit reached (${limit} per ${windowSeconds === 60 ? "minute" : `${windowSeconds / 3600} hour(s)`}). Retry after ${retryAfter} seconds.`,
      { retryAfter },
    );
  }
}

/** Log one authenticated call. Never throws: logging must not fail the call. */
export async function audit(keyId: number, method: string, target: string, status: number) {
  try {
    const sql = await getSql();
    await sql`
      insert into api_audit (key_id, method, target, status)
      values (${keyId}, ${method}, ${target.slice(0, 200)}, ${status})
    `;
    if (Math.random() < 0.01) {
      await sql`delete from api_audit where at < now() - interval '90 days'`;
    }
  } catch (err) {
    console.error("[api] audit write failed:", err);
  }
}
