import { storageDriverFor, blobPathFor, lawBlobPathFor, type StorageDriver } from "./driver";

/**
 * Attachment byte storage — **server-only**. Two drivers behind one surface
 * (see `driver.ts`): Vercel Blob (private) when `BLOB_READ_WRITE_TOKEN` is set,
 * otherwise Postgres `bytea`. Validation, size caps and authorization happen
 * before any of this runs and are identical for both drivers.
 */

export type StoredRef =
  | { storage: "db"; data: Uint8Array; blobPath: null }
  | { storage: "blob"; data: null; blobPath: string };

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

export function activeDriver(): StorageDriver {
  return storageDriverFor(process.env);
}

/**
 * Store one file's bytes. For `db` nothing is written here — the bytes ride
 * along in the same SQL statement as the message, so both commit together.
 * For `blob` the object is uploaded first; the caller removes it with
 * `discardStored` if the database write then fails.
 */
export async function storeBytes(input: {
  requestId: number;
  fileId: string;
  name: string;
  mime: string;
  bytes: Uint8Array;
}): Promise<StoredRef> {
  return storeBytesAt(blobPathFor(input.requestId, input.fileId, input.name), input.mime, input.bytes);
}

/** Same as `storeBytes`, for a «مكتب المحامي» document (office-scoped path). */
export async function storeLawBytes(input: {
  workspaceId: string;
  fileId: string;
  name: string;
  mime: string;
  bytes: Uint8Array;
}): Promise<StoredRef> {
  return storeBytesAt(lawBlobPathFor(input.workspaceId, input.fileId, input.name), input.mime, input.bytes);
}

async function storeBytesAt(pathname: string, mime: string, bytes: Uint8Array): Promise<StoredRef> {
  const input = { mime, bytes };
  const token = blobToken();
  if (!token) return { storage: "db", data: input.bytes, blobPath: null };
  const { put } = await import("@vercel/blob");
  const res = await put(
    pathname,
    Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength),
    {
      access: "private",
      contentType: input.mime,
      addRandomSuffix: true,
      token,
    },
  );
  // The pathname (with its random suffix) is what get()/del() take.
  return { storage: "blob", data: null, blobPath: res.pathname };
}

/** Best-effort removal of blobs (failed writes, retention). Never throws. */
export async function discardStored(blobPaths: string[]): Promise<void> {
  const paths = blobPaths.filter(Boolean);
  if (paths.length === 0) return;
  const token = blobToken();
  if (!token) {
    console.error(`[files] ${paths.length} blob(s) left behind: BLOB_READ_WRITE_TOKEN is not set`);
    return;
  }
  try {
    const { del } = await import("@vercel/blob");
    // del() accepts up to 1000 pathnames per call.
    for (let i = 0; i < paths.length; i += 1000) await del(paths.slice(i, i + 1000), { token });
  } catch (err) {
    console.error("[files] deleting blobs failed:", err);
  }
}

/**
 * The bytes of a stored file as a stream for the download route, or null
 * when they are gone (e.g. a blob deleted out of band).
 */
export async function readStored(row: {
  storage: StorageDriver;
  data: Uint8Array | null;
  blob_path: string | null;
}): Promise<ReadableStream<Uint8Array> | Uint8Array | null> {
  if (row.storage === "db") return row.data ?? null;
  if (!row.blob_path) return null;
  const token = blobToken();
  if (!token) {
    console.error("[files] a blob-stored file was requested but BLOB_READ_WRITE_TOKEN is not set");
    return null;
  }
  const { get } = await import("@vercel/blob");
  // Private blobs are only readable with the store token, server-side; the
  // result streams straight through without buffering the file.
  // Paths carry a random suffix and are never overwritten, so a cached read
  // is always the right content.
  const res = await get(row.blob_path, { access: "private", token });
  if (!res || res.statusCode !== 200) return null;
  return res.stream;
}
