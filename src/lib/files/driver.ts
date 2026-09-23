/**
 * Which store holds attachment bytes — pure, so it is unit-testable.
 *
 * - `blob`: Vercel Blob (private store), when `BLOB_READ_WRITE_TOKEN` is set.
 * - `db`:   a `bytea` column in Postgres (`request_files.data`) otherwise —
 *           dev, previews and any deploy without a Blob store.
 *
 * Each row records the driver it was written with, so reads always go to the
 * right store even after the token is added or removed.
 */
export type StorageDriver = "db" | "blob";

export function storageDriverFor(env: Record<string, string | undefined>): StorageDriver {
  return env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "db";
}

/**
 * Blob pathname for a stored file. `safeName` is already sanitized; the
 * request and file ids keep paths unique and let a request's files be found
 * by prefix. The display name lives in the database; the path keeps an
 * ASCII-only copy so no store or URL layer has to handle other scripts.
 */
export function blobPathFor(requestId: number, fileId: string, safeName: string): string {
  const ascii = safeName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_") || "file";
  return `requests/${requestId}/${fileId}/${ascii}`;
}
