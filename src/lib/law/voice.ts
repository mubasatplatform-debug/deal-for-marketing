import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { uuid, wsId } from "./schemas";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import type { Role } from "@/lib/saas/lifecycle";
import type { CallPage } from "./voice-core";

/**
 * «مركز الاتصال» server functions. Every handler goes through `run`
 * (`requireWorkspace`: membership, role, read-only and the second factor,
 * checked in the database); the core filters every query by the verified
 * workspace id. Calling needs the relay configured and the plan's
 * `aiDrafting` feature (like «مساعد المكتب»: it spends the office's quota).
 * The dial signature is computed here — the signing secret never leaves the
 * server.
 */

const runner = () => import("./run.server");
const core = () => import("./voice-core");
const server = () => import("./voice.server");

const AI_DAILY_CAP = Number(process.env.LAW_AGENT_DAILY_CAP) || 300;
const AI_HOURLY_USER_CAP = 60;

const ws = z.object({ workspaceId: wsId });

async function exec<T>(
  userId: string,
  workspaceId: string,
  opts: { write: boolean; minRole?: Role },
  fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const { run } = await runner();
  return run(userId, workspaceId, opts, fn);
}

/** Calls are possible for this office: relay configured and the plan includes it. */
async function assertVoice(access: WorkspaceAccess): Promise<void> {
  const { planHas } = await import("@/lib/saas/plans");
  const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
  const { voiceConfigured } = await server();
  if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
  if (!voiceConfigured()) throw new WorkspaceError("voice_unavailable", 503);
}

export type VoiceSetup = {
  /** The relay is configured on this deployment. */
  configured: boolean;
  /** The office's plan includes calls and AI summaries. */
  planAllows: boolean;
  /** The AI model behind summaries is configured. */
  aiConfigured: boolean;
  recordCalls: boolean;
  /** This member may change the voice settings. */
  canManage: boolean;
};

export const getVoiceSetup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<VoiceSetup> => {
    const { getVoiceSettingsCore, canManageVoice } = await core();
    const { voiceConfigured } = await server();
    const { planHas } = await import("@/lib/saas/plans");
    return exec(context.userId, data.workspaceId, { write: false }, async (sql, access) => ({
      configured: voiceConfigured(),
      planAllows: planHas(access.workspace.plan, "aiDrafting"),
      aiConfigured: Boolean(process.env.LAW_AGENT_URL?.trim() && process.env.LAW_AGENT_TOKEN?.trim()),
      recordCalls: (await getVoiceSettingsCore(sql, access)).recordCalls,
      canManage: canManageVoice(access.role),
    }));
  });

/** A short-lived Twilio Voice access token (outgoing only) for this member's browser. */
export const getVoiceToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<{ token: string; ttl: number }> => {
    const { relayToken } = await server();
    return exec(context.userId, data.workspaceId, { write: true }, async (_sql, access) => {
      await assertVoice(access);
      return relayToken(context.userId);
    });
  });

export type StartedCall = { callId: string; to: string; rec: "1" | "0"; sig: string };

/** Record the call and sign its dial parameters; the browser then connects with them. */
export const startCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        to: z.string().trim().min(3).max(32),
        clientId: uuid.nullish(),
        conversationId: uuid.nullish(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<StartedCall> => {
    const { createCallCore } = await core();
    const { dialSignature } = await server();
    return exec(context.userId, data.workspaceId, { write: true }, async (sql, access) => {
      await assertVoice(access);
      const call = await createCallCore(sql, access, {
        to: data.to,
        clientId: data.clientId ?? null,
        conversationId: data.conversationId ?? null,
      });
      const rec = call.recorded ? "1" : "0";
      return { callId: call.id, to: call.to, rec, sig: dialSignature(call.id, call.to, rec) };
    });
  });

export const listCalls = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        page: z.number().int().min(1).max(10_000).default(1),
        mine: z.boolean().default(false),
        clientId: uuid.nullish(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<CallPage> => {
    const { listCallsCore } = await core();
    return exec(context.userId, data.workspaceId, { write: false }, (sql, access) =>
      listCallsCore(sql, access, { page: data.page, mine: data.mine, clientId: data.clientId ?? null }),
    );
  });

/** «لخّص المكالمة»: transcribe through the relay if needed, then an Arabic summary. */
export const summarizeCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, callId: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<{ summary: string }> => {
    const { summarizeCallCore } = await core();
    const { agentLlm } = await import("./agent/llm.server");
    const { planHas } = await import("@/lib/saas/plans");
    const { tryHit } = await import("@/lib/rate-limit.server");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { relayTranscribe, voiceConfigured } = await server();
    return exec(context.userId, data.workspaceId, { write: true }, async (sql, access) => {
      if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
      const llm = agentLlm();
      if (!llm || !voiceConfigured()) throw new WorkspaceError("ai_unavailable", 503);
      if (
        !(await tryHit(`law-voice-ai:u:${context.userId}`, AI_HOURLY_USER_CAP, 3600)) ||
        !(await tryHit(`law-voice-ai:ws:${access.workspace.id}`, AI_DAILY_CAP, 86400))
      ) {
        throw new WorkspaceError("ai_limit", 429);
      }
      return summarizeCallCore(sql, access, data.callId, { llm, transcribe: relayTranscribe });
    });
  });

export const saveVoiceSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, recordCalls: z.boolean() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveVoiceSettingsCore } = await core();
    await exec(context.userId, data.workspaceId, { write: true, minRole: "admin" }, (sql, access) =>
      saveVoiceSettingsCore(sql, access, { recordCalls: data.recordCalls }),
    );
    return { ok: true };
  });
