import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { uuid, wsId } from "./schemas";
import type { DocumentPage, Folder } from "./documents-core";

/**
 * «مكتب المحامي» documents — listing, folders and delete as server
 * functions; upload and download are HTTP routes (multipart / streamed
 * bytes, see documents-routes.server.ts). Same guard as every practice call.
 */

/** Per-file limit for office documents (scanned contracts run large). */
export const LAW_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const LAW_MAX_FILES = 10;

const runner = () => import("./run.server");
const core = () => import("./documents-core");

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        q: z.string().trim().max(100).default(""),
        clientId: uuid.nullish(),
        caseId: uuid.nullish(),
        unfiled: z.boolean().default(false),
        page: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<DocumentPage> => {
    const { run } = await runner();
    const { listDocumentsCore } = await core();
    return run(context.userId, data.workspaceId, {}, (sql, access) =>
      listDocumentsCore(sql, access, {
        q: data.q,
        clientId: data.clientId,
        caseId: data.caseId,
        unfiled: data.unfiled,
        page: data.page,
      }),
    );
  });

export const getDocumentFolders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<{ folders: Folder[]; unfiled: number; total: number }> => {
    const { run } = await runner();
    const { foldersCore } = await core();
    return run(context.userId, data.workspaceId, {}, (sql, access) => foldersCore(sql, access));
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { run } = await runner();
    const { deleteDocumentCore } = await core();
    const blobPath = await run(context.userId, data.workspaceId, { write: true }, (sql, access) =>
      deleteDocumentCore(sql, access, data.id),
    );
    if (blobPath) {
      const { discardStored } = await import("@/lib/files/storage.server");
      await discardStored([blobPath]);
    }
    return { ok: true };
  });
