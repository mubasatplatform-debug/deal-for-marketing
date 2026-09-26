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
    // In batches, so one call never holds a long delete; each batch removes
    // its Blob-stored bytes FIRST and only then the rows — if the storage
    // delete fails the rows stay and the next run retries, instead of losing
    // the paths and leaving the files behind for good.
    for (let batch = 0; batch < 20; batch += 1) {
      const expired = await sql<{ id: number }>`
        select id from requests where created_at < now() - interval '2 years'
        order by created_at limit 200
      `;
      if (!expired.length) break;
      const ids = expired.map((r) => r.id);
      const blobs = await sql<{ blob_path: string }>`
        select blob_path from request_files
        where request_id = any(${ids}::int[]) and storage = 'blob' and blob_path is not null
      `;
      if (blobs.length) {
        const { discardStored } = await import("@/lib/files/storage.server");
        await discardStored(blobs.map((b) => b.blob_path));
      }
      await sql`delete from requests where id = any(${ids}::int[])`;
      if (expired.length < 200) break;
    }
  } catch (err) {
    globalRef.__requestsPrunedDay__ = undefined;
    console.error("[retention] pruning expired requests failed:", err);
  }
}
