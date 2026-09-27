import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import { uuid, wsId, ymd } from "../schemas";
import type { CaseAiKind, CaseAiRow } from "./case-ai-core";
import type { DeadlineResult, DeadlineRule } from "./deadlines-core";
import type { ArticleHit } from "./library-core";

/**
 * Case-level AI: the chronology and the hearing briefing (built in the
 * background, one current version each), and statutory deadlines computed
 * from the laws library and filed as tasks. Same guard as every practice call.
 */

const runner = () => import("../run.server");
const PER_USER_HOUR = 30;
const PER_OFFICE_DAY = Number(process.env.LAW_DRAFTS_DAILY_CAP) || 100;

async function exec<T>(userId: string, workspaceId: string, write: boolean, fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>) {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

export const getCaseAi = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, caseId: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<Partial<Record<CaseAiKind, CaseAiRow>>> => {
    const { getCaseAiCore } = await import("./case-ai-core");
    return exec(context.userId, data.workspaceId, false, (sql, access) => getCaseAiCore(sql, access, data.caseId));
  });

export const buildCaseAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, caseId: uuid, kind: z.enum(["chronology", "briefing"]) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { requestCaseAiCore } = await import("./case-ai-core");
    const { caseAiInBackground } = await import("./ai.server");
    const { planHas } = await import("@/lib/saas/plans");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { tryHit } = await import("@/lib/rate-limit.server");
    // Rebuilding reads the case; it is not a write to office data.
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
      if (!process.env.LAW_AGENT_URL?.trim()) throw new WorkspaceError("ai_unavailable", 503);
      if (
        !(await tryHit(`law-caseai:u:${context.userId}`, PER_USER_HOUR, 3600)) ||
        !(await tryHit(`law-draft:ws:${access.workspace.id}`, PER_OFFICE_DAY, 86_400))
      ) {
        throw new WorkspaceError("ai_limit", 429);
      }
      await requestCaseAiCore(sql, access, data.caseId, data.kind);
      caseAiInBackground(access, data.caseId, data.kind);
      return { ok: true as const };
    });
  });

export type DeadlinePreview = DeadlineResult & { articles: ArticleHit[] };

export const deadlineRules = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<DeadlineRule[]> => {
    const { DEADLINE_RULES } = await import("./deadlines-core");
    return exec(context.userId, data.workspaceId, false, async () => DEADLINE_RULES);
  });

export const previewDeadline = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, ruleId: z.string().max(40), start: ymd, urgent: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<DeadlinePreview> => {
    const { computeDeadline, ruleArticlesCore } = await import("./deadlines-core");
    const { riyadhYmd } = await import("../time");
    return exec(context.userId, data.workspaceId, false, async (sql) => {
      const r = computeDeadline(data.ruleId, data.start, data.urgent, riyadhYmd());
      return { ...r, articles: await ruleArticlesCore(sql, r.rule) };
    });
  });

export const fileDeadline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({ workspaceId: wsId, caseId: uuid, ruleId: z.string().max(40), start: ymd, urgent: z.boolean().default(false) })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ taskId: string; deadline: string }> => {
    const { fileDeadlineCore } = await import("./deadlines-core");
    const { riyadhYmd } = await import("../time");
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      const r = await fileDeadlineCore(sql, access, { ...data, today: riyadhYmd() });
      return { taskId: r.taskId, deadline: r.result.deadline };
    });
  });
