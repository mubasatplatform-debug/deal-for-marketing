import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { wsId, uuid } from "../schemas";
import type { AgentAction, AgentReply, AuditRow } from "./agent-core";

/**
 * «مساعد المكتب» server functions. Every call goes through `run` (membership,
 * role and read-only checked in the database). A turn needs the plan's
 * `aiDrafting` feature and counts against a per-office daily cap, because each
 * one spends the owner's model quota. Writes only ever run from
 * `confirmAgentAction`, on the arguments stored when they were proposed.
 */

const runner = () => import("../run.server");
const core = () => import("./agent-core");

/** Model turns per office per day, and per person per hour. */
const DAILY_CAP = Number(process.env.LAW_AGENT_DAILY_CAP) || 300;
const HOURLY_USER_CAP = 60;

const turnInput = z.object({
  workspaceId: wsId,
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1]?.role === "user", "last message must be the user's"),
});

export const agentTurn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => turnInput.parse(input))
  .handler(async ({ context, data }): Promise<AgentReply> => {
    const { run } = await runner();
    const { agentTurnCore } = await core();
    const { agentLlm } = await import("./llm.server");
    const { planHas } = await import("@/lib/saas/plans");
    const { tryHit } = await import("@/lib/rate-limit.server");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { riyadhYmd } = await import("../time");
    return run(context.userId, data.workspaceId, { write: false }, async (sql, access) => {
      if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
      const llm = agentLlm();
      if (!llm) throw new WorkspaceError("ai_unavailable", 503);
      if (
        !(await tryHit(`law-agent:u:${context.userId}`, HOURLY_USER_CAP, 3600)) ||
        !(await tryHit(`law-agent:ws:${access.workspace.id}`, DAILY_CAP, 86400))
      ) {
        throw new WorkspaceError("ai_limit", 429);
      }
      const [me] = await sql<{ name: string | null; email: string }>`select name, email from "user" where id = ${context.userId}`;
      return agentTurnCore(sql, access, llm, data.messages, {
        userName: me?.name?.trim() || me?.email || "",
        today: riyadhYmd(),
      });
    });
  });

export const confirmAgentAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, actionId: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<AgentAction> => {
    const { run } = await runner();
    const { confirmActionCore } = await core();
    const { action } = await run(context.userId, data.workspaceId, { write: true }, (sql, access) =>
      confirmActionCore(sql, access, data.actionId),
    );
    return action;
  });

export const cancelAgentAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, actionId: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { run } = await runner();
    const { cancelActionCore } = await core();
    await run(context.userId, data.workspaceId, { write: false }, (sql, access) =>
      cancelActionCore(sql, access, data.actionId),
    );
    return { ok: true };
  });

export const listAgentActions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<AuditRow[]> => {
    const { run } = await runner();
    const { listActionsCore } = await core();
    return run(context.userId, data.workspaceId, { write: false }, (sql, access) => listActionsCore(sql, access));
  });

/** Whether the assistant can run here (configured) — for the UI's empty state. */
export const agentStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<{ configured: boolean; planAllows: boolean }> => {
    const { run } = await runner();
    const { planHas } = await import("@/lib/saas/plans");
    return run(context.userId, data.workspaceId, { write: false }, async (_sql, access) => ({
      configured: Boolean(process.env.LAW_AGENT_URL?.trim() && process.env.LAW_AGENT_TOKEN?.trim()),
      planAllows: planHas(access.workspace.plan, "aiDrafting"),
    }));
  });
