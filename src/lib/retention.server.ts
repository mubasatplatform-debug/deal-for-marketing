import { getSql } from "@/lib/db";

/**
 * Enforces the privacy policy's retention promise (src/routes/privacy.tsx):
 * a request is deleted two years after it was submitted. `requests` has no
 * later activity timestamp, so `created_at` is the clock. Runs at most once per
 * process per UTC day, opportunistically from lead intake and the admin list —
 * no cron. Idempotent; a failure is logged and retried on the next call.
 * **Server-only.**
 */
const DAY_MS = 86_400_000;

const globalRef = globalThis as typeof globalThis & { __requestsPrunedDay__?: number };

export async function pruneExpiredRequests(): Promise<void> {
  const day = Math.floor(Date.now() / DAY_MS);
  if (globalRef.__requestsPrunedDay__ === day) return;
  globalRef.__requestsPrunedDay__ = day;
  try {
    const sql = await getSql();
    await sql`delete from requests where created_at < now() - interval '2 years'`;
  } catch (err) {
    globalRef.__requestsPrunedDay__ = undefined;
    console.error("[retention] pruning expired requests failed:", err);
  }
}
