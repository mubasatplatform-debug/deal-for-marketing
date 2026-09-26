import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { CHANNEL_IDS, CHANNEL_LIST, type ChannelId } from "./inbox-channels";
import { INBOX_TABS, INTENTS } from "./inbox-options";
import { memberId, uuid, wsId } from "./schemas";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import type {
  ConversationRow,
  InboxCounts,
  InboxSettings,
  Intent,
  QuickReply,
  ThreadView,
} from "./inbox-core";

/**
 * «مركز التواصل» server functions for the team. Every handler goes through
 * `run` (membership + role + read-only checked in the database); the core
 * filters every query by the verified workspace id. The AI helpers need the
 * plan's `aiDrafting` feature and count against a per-office daily cap, like
 * «مساعد المكتب», because each call spends the owner's model quota.
 */

const runner = () => import("./run.server");
const core = () => import("./inbox-core");

const INTENT_KEYS = INTENTS;
const TABS = INBOX_TABS;
const AI_DAILY_CAP = Number(process.env.LAW_AGENT_DAILY_CAP) || 300;
const AI_HOURLY_USER_CAP = 60;

const ws = z.object({ workspaceId: wsId });
const byId = z.object({ workspaceId: wsId, id: uuid });
const body = z.string().trim().min(1).max(4000);

async function exec<T>(
  userId: string,
  workspaceId: string,
  write: boolean,
  fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

export type InboxList = { rows: ConversationRow[]; counts: InboxCounts };

export const listInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        tab: z.enum(TABS).default("all"),
        channel: z.enum(CHANNEL_IDS).nullish(),
        q: z.string().trim().max(100).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<InboxList> => {
    const { listConversationsCore, countsCore } = await core();
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      const [rows, counts] = await Promise.all([
        listConversationsCore(sql, access, { tab: data.tab, channel: data.channel ?? null, q: data.q }),
        countsCore(sql, access),
      ]);
      return { rows, counts };
    });
  });

/** The nav badge: conversations waiting on the team with unread messages. */
export const inboxCounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<InboxCounts> => {
    const { countsCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => countsCore(sql, access));
  });

export const getInboxThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    byId
      .extend({ before: z.string().datetime().nullish(), since: z.string().datetime().nullish() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ThreadView> => {
    const { getConversationCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      getConversationCore(sql, access, data.id, { before: data.before ?? null, since: data.since ?? null }),
    );
  });

export const replyInbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ body }).parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { replyCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) => replyCore(sql, access, data.id, data.body));
  });

export const noteInbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ body }).parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { noteCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) => noteCore(sql, access, data.id, data.body));
  });

export const assignInbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ assigneeId: memberId.nullable() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { assignCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => assignCore(sql, access, data.id, data.assigneeId));
    return { ok: true };
  });

export const setInboxStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ status: z.enum(["open", "pending", "closed"]) }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { setStatusCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => setStatusCore(sql, access, data.id, data.status));
    return { ok: true };
  });

export const markInboxRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { markReadCore } = await core();
    await exec(context.userId, data.workspaceId, false, (sql, access) => markReadCore(sql, access, data.id));
    return { ok: true };
  });

export const linkInboxClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ clientId: uuid.nullable() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { linkClientCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => linkClientCore(sql, access, data.id, data.clientId));
    return { ok: true };
  });

export const clientFromInbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }): Promise<{ clientId: string; existed: boolean }> => {
    const { clientFromConversationCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) => clientFromConversationCore(sql, access, data.id));
  });

export const setInboxIntent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ intent: z.enum(INTENT_KEYS).nullable() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { setIntentCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => setIntentCore(sql, access, data.id, data.intent));
    return { ok: true };
  });

export type InboxAiResult =
  | { task: "summary"; summary: string }
  | { task: "suggest"; draft: string }
  | { task: "classify"; intent: Intent };

/** «لخّص» / «اقترح ردًا» / «صنّف»: a suggestion is only ever returned, never sent. */
export const inboxAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ task: z.enum(["summary", "suggest", "classify"]) }).parse(input))
  .handler(async ({ context, data }): Promise<InboxAiResult> => {
    const { summarizeCore, suggestReplyCore, classifyCore } = await core();
    const { agentLlm } = await import("./agent/llm.server");
    const { planHas } = await import("@/lib/saas/plans");
    const { tryHit } = await import("@/lib/rate-limit.server");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    return exec(context.userId, data.workspaceId, data.task !== "suggest", async (sql, access) => {
      if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
      const llm = agentLlm();
      if (!llm) throw new WorkspaceError("ai_unavailable", 503);
      if (
        !(await tryHit(`law-inbox-ai:u:${context.userId}`, AI_HOURLY_USER_CAP, 3600)) ||
        !(await tryHit(`law-inbox-ai:ws:${access.workspace.id}`, AI_DAILY_CAP, 86400))
      ) {
        throw new WorkspaceError("ai_limit", 429);
      }
      if (data.task === "summary") return { task: "summary", ...(await summarizeCore(sql, access, llm, data.id)) };
      if (data.task === "suggest") return { task: "suggest", ...(await suggestReplyCore(sql, access, llm, data.id)) };
      return { task: "classify", ...(await classifyCore(sql, access, llm, data.id)) };
    });
  });

/* ------------------------------------------------------------------------ */
/* Settings and quick replies                                                */
/* ------------------------------------------------------------------------ */

export type InboxSetup = {
  settings: InboxSettings;
  channels: { id: ChannelId; label: string; connected: boolean }[];
  /** The public page that carries the chat widget. */
  bookingUrl: string;
  ai: { configured: boolean; planAllows: boolean };
  quickReplies: QuickReply[];
};

export const getInboxSetup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<InboxSetup> => {
    const { getInboxSettingsCore, listQuickRepliesCore } = await core();
    const { planHas } = await import("@/lib/saas/plans");
    const { bookingUrlFor } = await import("./consult.server");
    return exec(context.userId, data.workspaceId, false, async (sql, access) => ({
      settings: await getInboxSettingsCore(sql, access),
      channels: CHANNEL_LIST,
      bookingUrl: bookingUrlFor(access.workspace.slug),
      ai: {
        configured: Boolean(process.env.LAW_AGENT_URL?.trim() && process.env.LAW_AGENT_TOKEN?.trim()),
        planAllows: planHas(access.workspace.plan, "aiDrafting"),
      },
      quickReplies: await listQuickRepliesCore(sql, access),
    }));
  });

export const saveInboxSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        webchatEnabled: z.boolean(),
        aiFirstReply: z.boolean(),
        welcome: z.string().trim().max(500).default(""),
        awayText: z.string().trim().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveInboxSettingsCore } = await core();
    const { workspaceId, ...settings } = data;
    await exec(context.userId, workspaceId, true, (sql, access) => saveInboxSettingsCore(sql, access, settings));
    return { ok: true };
  });

export const saveQuickReply = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        id: uuid.nullish(),
        title: z.string().trim().min(1).max(80),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { saveQuickReplyCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) =>
      saveQuickReplyCore(sql, access, { id: data.id ?? null, title: data.title, body: data.body }),
    );
  });

export const deleteQuickReply = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { deleteQuickReplyCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteQuickReplyCore(sql, access, data.id));
    return { ok: true };
  });

export const listQuickReplies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<QuickReply[]> => {
    const { listQuickRepliesCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => listQuickRepliesCore(sql, access));
  });
