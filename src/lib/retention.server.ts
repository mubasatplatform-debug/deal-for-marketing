import { getSql } from "@/lib/db";

/**
 * Enforces the privacy policy's retention promise (src/routes/privacy.tsx):
 * a request is deleted two years after it was submitted, together with its
 * thread messages and attachments (cascade; Blob-stored bytes explicitly). `requests` has no
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
    // Blob-stored attachments live outside the database: collect their paths
    // before the cascade removes the rows, then delete them (best effort).
    const blobs = await sql<{ blob_path: string }>`
      select f.blob_path from request_files f
      join requests r on r.id = f.request_id
      where r.created_at < now() - interval '2 years'
        and f.storage = 'blob' and f.blob_path is not null
    `;
    await sql`delete from requests where created_at < now() - interval '2 years'`;
    if (blobs.length) {
      const { discardStored } = await import("@/lib/files/storage.server");
      await discardStored(blobs.map((b) => b.blob_path));
    }
  } catch (err) {
    globalRef.__requestsPrunedDay__ = undefined;
    console.error("[retention] pruning expired requests failed:", err);
  }
}
