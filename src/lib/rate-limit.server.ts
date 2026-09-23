import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { hashVisitorIp, reserveHit } from "@/lib/rate-limit-core";

/**
 * Postgres-backed throttle — **server-only**. Serverless instances share no
 * memory, so the counter lives in `rate_hits` (migrations/0003_leads.sql).
 * Reservation is one atomic call (`rate_take`, migrations/0006), so bursts of
 * parallel requests cannot slip past a limit, and every call purges hits older
 * than a day — nothing in the table outlives 24 hours.
 */
export class RateLimitError extends Error {
  readonly status = 429;
  constructor() {
    super("RateLimited");
    this.name = "RateLimitError";
  }
}

/** Dev/preview fallback only; deploys always have BETTER_AUTH_SECRET. */
const DEV_VISITOR_SECRET = "deal-for-marketing:dev-visitor-key";

/** Best-effort client IP from the proxy headers Vercel sets. */
function clientIp(): string {
  const h = getRequest()?.headers;
  const forwarded = h?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return h?.get("x-real-ip")?.trim() || forwarded || "unknown";
}

/**
 * Throttle key for an anonymous visitor: a one-way HMAC of their IP, so the
 * raw address is never stored.
 */
export function visitorId(): string {
  return pseudonymizeIp(clientIp());
}

/** The same one-way pseudonym for an IP read elsewhere (e.g. the API's Request). */
export function pseudonymizeIp(ip: string): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim() || DEV_VISITOR_SECRET;
  return hashVisitorIp(ip, secret);
}

/** Record a hit for `key` if under `limit`; returns whether it was recorded. */
export async function tryHit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  return reserveHit(await getSql(), key, limit, windowSeconds);
}

/** Record a hit for `key`, or throw `RateLimitError` once `limit` is reached. */
export async function takeHit(key: string, limit: number, windowSeconds: number): Promise<void> {
  if (!(await tryHit(key, limit, windowSeconds))) throw new RateLimitError();
}
