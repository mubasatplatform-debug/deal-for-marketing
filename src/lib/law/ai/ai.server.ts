import { getSql } from "@/lib/db";
import { readStored } from "@/lib/files/storage.server";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import { aiComplete } from "../agent/llm.server";
import { saveTextCore, unreadDocumentsCore, type DocumentReader } from "./docai-core";
import { writeDraftCore } from "./drafts-core";
import { extractDocumentText } from "./extract.server";

/**
 * AI over office files, the moving parts — **server-only**: reading stored
 * files, the one-at-a-time background reader (scans go to the model and take
 * a while), and writing drafts after the request has answered.
 */

async function sqlTag(): Promise<SqlTag> {
  return (await getSql()) as unknown as SqlTag;
}

/** Read one stored document of `workspaceId` (bytes from Postgres or Blob). */
export function documentReader(workspaceId: string): DocumentReader {
  return async (doc) => {
    const sql = await sqlTag();
    const [row] = await sql<{ storage: "db" | "blob"; data: Uint8Array | null; blob_path: string | null }>`
      select storage, data, blob_path from law_documents where id = ${doc.id} and workspace_id = ${workspaceId}
    `;
    if (!row) return { status: "failed", method: null, pages: [], error: "missing" };
    const body = await readStored({ storage: row.storage, data: row.data, blob_path: row.blob_path });
    if (!body) return { status: "failed", method: null, pages: [], error: "unreadable" };
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
    return extractDocumentText(doc.name, doc.mime, bytes);
  };
}

/** Scans and photos are read by the model — too slow to wait for inside a question. */
export function needsOcr(name: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(name);
}

// ---------------------------------------------------------------------------
// Background reader: one file at a time per process, each file once.
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & { __docaiQueue__?: { busy: boolean; items: { ws: string; id: string }[]; seen: Set<string> } };
const queue = (g.__docaiQueue__ ??= { busy: false, items: [], seen: new Set() });

export function queueReading(workspaceId: string, ids: string[]): void {
  for (const id of ids) {
    if (queue.seen.has(id)) continue;
    queue.seen.add(id);
    queue.items.push({ ws: workspaceId, id });
  }
  void drain();
}

async function drain(): Promise<void> {
  if (queue.busy) return;
  queue.busy = true;
  try {
    for (let item = queue.items.shift(); item; item = queue.items.shift()) {
      try {
        const sql = await sqlTag();
        const [doc] = await unreadDocumentsCore(sql, item.ws, [item.id]);
        if (doc) {
          const r = await documentReader(item.ws)(doc);
          await saveTextCore(sql, item.ws, doc.id, r);
        }
      } catch (err) {
        console.error("[docai] background read failed:", err);
      } finally {
        queue.seen.delete(item.id);
      }
    }
  } finally {
    queue.busy = false;
  }
}

// ---------------------------------------------------------------------------
// Model calls
// ---------------------------------------------------------------------------

/** Answers over excerpts: a few pages of output, well inside the edge's 100 s. */
export const answerCompleter = (messages: { role: "system" | "user"; content: string }[]) =>
  aiComplete(messages, { maxTokens: 2500, timeoutMs: 85_000, temperature: 0.1 });

/** Full drafts: long output, written in the background. */
const draftCompleter = (messages: { role: "system" | "user"; content: string }[]) =>
  aiComplete(messages, { maxTokens: 8000, timeoutMs: 170_000, temperature: 0.3 });

/** Write a pending draft after the request has answered (the page polls for it). */
export function writeDraftInBackground(access: WorkspaceAccess, id: string): void {
  void (async () => {
    const sql = await sqlTag();
    await writeDraftCore(sql, access, id, draftCompleter);
  })();
}
