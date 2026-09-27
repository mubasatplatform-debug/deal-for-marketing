import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import { uuid, wsId } from "../schemas";
import type { AskResult, SourceDoc } from "./docai-core";
import type { DraftKind, DraftRow } from "./drafts-core";

/**
 * «اسأل ملفات القضية» and «صياغة المستندات» server functions. Every handler
 * goes through `run` (membership, role, read-only and the second factor, in
 * the database); the cores filter every query by the verified office. Both
 * need the plan's `aiDrafting` feature and the model relay, and count against
 * per-member, per-office and deployment-wide daily caps.
 */

const runner = () => import("../run.server");
const docai = () => import("./docai-core");
const drafts = () => import("./drafts-core");
const server = () => import("./ai.server");

const ASK_PER_USER_HOUR = 60;
const ASK_PER_OFFICE_DAY = Number(process.env.LAW_DOCAI_DAILY_CAP) || 400;
const DRAFTS_PER_USER_HOUR = 20;
const DRAFTS_PER_OFFICE_DAY = Number(process.env.LAW_DRAFTS_DAILY_CAP) || 100;

const DRAFT_KINDS = [
  "claim",
  "defense_memo",
  "reply_memo",
  "objection",
  "notice",
  "fee_agreement",
  "contract",
  "letter",
  "legal_opinion",
  "case_summary",
] as const satisfies readonly DraftKind[];

async function exec<T>(
  userId: string,
  workspaceId: string,
  write: boolean,
  fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

/** The plan includes AI and the model is configured. */
async function assertAi(access: WorkspaceAccess) {
  const { planHas } = await import("@/lib/saas/plans");
  const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
  if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
  if (!process.env.LAW_AGENT_URL?.trim() || !process.env.LAW_AGENT_TOKEN?.trim()) throw new WorkspaceError("ai_unavailable", 503);
}

async function cap(keys: [string, number, number][]) {
  const { tryHit } = await import("@/lib/rate-limit.server");
  const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
  for (const [key, limit, window] of keys) {
    if (!(await tryHit(key, limit, window))) throw new WorkspaceError("ai_limit", 429);
  }
}

const target = z
  .object({
    workspaceId: wsId,
    caseId: uuid.nullish(),
    clientId: uuid.nullish(),
    documentIds: z.array(uuid).max(40).nullish(),
  })
  .refine((v) => Boolean(v.caseId || v.clientId || v.documentIds?.length), "target");

export type FilesStatus = { docs: SourceDoc[]; aiAvailable: boolean; canDraft: boolean };

/** The files a case/client has and whether each has been read (for the panel). */
export const getFilesStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => target.parse(input))
  .handler(async ({ context, data }): Promise<FilesStatus> => {
    const { sourcesCore, readable } = await docai();
    const { planHas } = await import("@/lib/saas/plans");
    const { can } = await import("../permissions");
    const { queueReading } = await server();
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      const docs = await sourcesCore(sql, access, data);
      const aiAvailable =
        planHas(access.workspace.plan, "aiDrafting") && Boolean(process.env.LAW_AGENT_URL?.trim() && process.env.LAW_AGENT_TOKEN?.trim());
      // Start reading anything new so the next question finds it ready.
      if (aiAvailable) {
        const unread = docs.filter((d) => d.text_status === null && readable(d.name)).map((d) => d.id);
        if (unread.length) queueReading(access.workspace.id, unread);
      }
      return { docs, aiAvailable, canDraft: can(access.role, "draft.manage") };
    });
  });

export const askDocuments = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        caseId: uuid.nullish(),
        clientId: uuid.nullish(),
        documentIds: z.array(uuid).max(40).nullish(),
        question: z.string().trim().min(2).max(2000),
      })
      .refine((v) => Boolean(v.caseId || v.clientId || v.documentIds?.length), "target")
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<AskResult> => {
    const { askDocumentsCore } = await docai();
    const { answerCompleter, documentReader, needsOcr, queueReading } = await server();
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      await assertAi(access);
      await cap([
        [`law-docai:u:${context.userId}`, ASK_PER_USER_HOUR, 3600],
        [`law-docai:ws:${access.workspace.id}`, ASK_PER_OFFICE_DAY, 86_400],
      ]);
      return askDocumentsCore(sql, access, data, {
        complete: answerCompleter,
        read: documentReader(access.workspace.id),
        queue: (ids) => queueReading(access.workspace.id, ids),
        needsOcr,
      });
    });
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, caseId: uuid.nullish(), clientId: uuid.nullish() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<DraftRow[]> => {
    const { listDraftsCore } = await drafts();
    return exec(context.userId, data.workspaceId, false, (sql, access) => listDraftsCore(sql, access, data));
  });

export const getDraft = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<DraftRow> => {
    const { getDraftCore } = await drafts();
    return exec(context.userId, data.workspaceId, false, (sql, access) => getDraftCore(sql, access, data.id));
  });

export const startDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        kind: z.enum(DRAFT_KINDS),
        caseId: uuid.nullish(),
        clientId: uuid.nullish(),
        instructions: z.string().max(4000).default(""),
        sourceIds: z.array(uuid).max(20).default([]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { createDraftCore } = await drafts();
    const { writeDraftInBackground } = await server();
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await assertAi(access);
      await cap([
        [`law-draft:u:${context.userId}`, DRAFTS_PER_USER_HOUR, 3600],
        [`law-draft:ws:${access.workspace.id}`, DRAFTS_PER_OFFICE_DAY, 86_400],
      ]);
      const id = await createDraftCore(sql, access, data);
      writeDraftInBackground(access, id);
      return { id };
    });
  });

/** A new version of a draft, rewritten with the lawyer's instructions. */
export const reviseDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, id: uuid, instructions: z.string().trim().min(3).max(4000) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { createDraftCore, getDraftCore } = await drafts();
    const { writeDraftInBackground } = await server();
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await assertAi(access);
      const prev = await getDraftCore(sql, access, data.id);
      if (prev.status !== "ready" || !prev.body.trim()) throw new WorkspaceError("status", 409);
      await cap([
        [`law-draft:u:${context.userId}`, DRAFTS_PER_USER_HOUR, 3600],
        [`law-draft:ws:${access.workspace.id}`, DRAFTS_PER_OFFICE_DAY, 86_400],
      ]);
      const id = await createDraftCore(sql, access, {
        kind: prev.kind,
        caseId: prev.case_id,
        clientId: prev.client_id,
        instructions: data.instructions,
        sourceIds: prev.source_ids,
        parentId: prev.id,
      });
      writeDraftInBackground(access, id);
      return { id };
    });
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid, body: z.string().max(200_000) }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveDraftBodyCore } = await drafts();
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await saveDraftBodyCore(sql, access, data.id, data.body);
      return { ok: true as const };
    });
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { deleteDraftCore } = await drafts();
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await deleteDraftCore(sql, access, data.id);
      return { ok: true as const };
    });
  });

/** Save the draft as a Word file in the office's documents (under its case/client). */
export const saveDraftToDocuments = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<{ documentId: string }> => {
    const { getDraftCore, markDraftSavedCore, draftFileName } = await drafts();
    const { draftToDocx } = await import("./docx.server");
    const { storeLawBytes, discardStored } = await import("@/lib/files/storage.server");
    const { insertDocumentCore, resolveTarget } = await import("../documents-core");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { randomUUID } = await import("node:crypto");
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      const d = await getDraftCore(sql, access, data.id);
      if (d.status !== "ready" || !d.body.trim()) throw new WorkspaceError("status", 409);
      const bytes = await draftToDocx(d.body, { title: d.title, office: access.workspace.name });
      const target = await resolveTarget(sql, access, d.client_id, d.case_id);
      const id = randomUUID();
      const name = draftFileName(d.title);
      const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const stored = await storeLawBytes({ workspaceId: access.workspace.id, fileId: id, name, mime, bytes });
      try {
        await insertDocumentCore(sql, access, {
          id,
          clientId: target.clientId,
          caseId: target.caseId,
          name,
          mime,
          size: bytes.byteLength,
          storage: stored.storage,
          data: stored.data,
          blobPath: stored.blobPath,
        });
      } catch (err) {
        if (stored.blobPath) await discardStored([stored.blobPath]);
        throw err;
      }
      await markDraftSavedCore(sql, access, d.id, id);
      return { documentId: id };
    });
  });
