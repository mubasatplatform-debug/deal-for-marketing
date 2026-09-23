import { createHmac } from "node:crypto";

/**
 * Pure pieces of the throttle (no app aliases), so node tests can drive them
 * against PGLite directly. The app uses them through `rate-limit.server.ts`.
 */

/** The query surface both `getSql()` and a bare PGLite wrapper satisfy. */
export type SqlTag = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

/**
 * Record a hit for `key` if fewer than `limit` landed in the last
 * `windowSeconds`; returns whether it was recorded. One call to `rate_take`
 * (migrations/0006_rate_limit_atomic.sql), which locks the key, so concurrent
 * callers can never overshoot `limit`. Hits older than a day are purged in the
 * same call, so windows longer than 86400 s are not supported.
 */
export async function reserveHit(
  sql: SqlTag,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const rows = await sql<{ ok: boolean }>`
    select rate_take(${key}::text, ${limit}::bigint, ${windowSeconds}::int) as ok
  `;
  return rows[0]?.ok === true;
}

/**
 * One-way pseudonym for a visitor IP: truncated HMAC-SHA256 under a server
 * secret. Stable per secret (so throttling works) but not reversible, and not
 * brute-forceable over the IPv4 space without the secret.
 */
export function hashVisitorIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("base64url").slice(0, 22);
}
