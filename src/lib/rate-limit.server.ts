import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";

/**
 * Postgres-backed throttle — **server-only**. Serverless instances share no
 * memory, so the counter lives in `rate_hits` (migrations/0003_leads.sql).
 * Count-then-insert is not atomic; that is fine for abuse throttling, where
 * being off by one under a burst costs nothing.
 */
export class RateLimitError extends Error {
  readonly status = 429;
  constructor() {
    super("RateLimited");
    this.name = "RateLimitError";
  }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(): string {
  const h = getRequest()?.headers;
  const forwarded = h?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return h?.get("x-real-ip")?.trim() || forwarded || "unknown";
}

/** Count recent hits for `key` without recording one. */
export async function recentHits(key: string, windowSeconds: number): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from rate_hits
    where key = ${key} and at > now() - ${windowSeconds}::int * interval '1 second'
  `;
  return rows[0]?.n ?? 0;
}

/** Record a hit for `key`, or throw `RateLimitError` once `limit` is reached. */
export async function takeHit(key: string, limit: number, windowSeconds: number): Promise<void> {
  if ((await recentHits(key, windowSeconds)) >= limit) throw new RateLimitError();
  const sql = await getSql();
  await sql`insert into rate_hits (key) values (${key})`;
  // Opportunistic pruning keeps the table small without a cron.
  if (Math.random() < 0.02) {
    await sql`delete from rate_hits where at < now() - interval '2 days'`;
  }
}
