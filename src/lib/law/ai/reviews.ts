import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import { uuid, wsId } from "../schemas";
import type { OfficeAi, ReviewRow } from "./review-core";

/**
 * «مراجعة العقود» and the office's AI practice profile — server functions.
 * Same guard as every practice call; reviews need the plan's `aiDrafting`
 * and count against the drafting caps (a review is as heavy as a draft).
 */

const runner = () => import("../run.server");
const core = () => import("./review-core");

const PER_USER_HOUR = 20;
const PER_OFFICE_DAY = Number(process.env.LAW_DRAFTS_DAILY_CAP) || 100;

async function exec<T>(userId: string, workspaceId: string, write: boolean, fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>) {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

export const getOfficeAi = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<OfficeAi & { canEdit: boolean; defaultPlaybook: string }> => {
    const { getOfficeAiCore, DEFAULT_PLAYBOOK } = await core();
    const { can } = await import("../permissions");
    return exec(context.userId, data.workspaceId, false, async (sql, access) => ({
      ...(await getOfficeAiCore(sql, access)),
      canEdit: can(access.role, "settings.ai"),
      defaultPlaybook: DEFAULT_PLAYBOOK,
    }));
  });

export const saveOfficeAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, playbook: z.string().max(20000), houseStyle: z.string().max(8000) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveOfficeAiCore } = await core();
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await saveOfficeAiCore(sql, access, { playbook: data.playbook, house_style: data.houseStyle });
      return { ok: true as const };
    });
  });

export const startReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        documentId: uuid,
        perspective: z.string().trim().min(2).max(200),
        contractType: z.string().max(120).default(""),
        notes: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { createReviewCore } = await core();
    const { reviewInBackground } = await import("./ai.server");
    const { planHas } = await import("@/lib/saas/plans");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { tryHit } = await import("@/lib/rate-limit.server");
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
      if (!process.env.LAW_AGENT_URL?.trim()) throw new WorkspaceError("ai_unavailable", 503);
      if (
        !(await tryHit(`law-review:u:${context.userId}`, PER_USER_HOUR, 3600)) ||
        !(await tryHit(`law-draft:ws:${access.workspace.id}`, PER_OFFICE_DAY, 86_400))
      ) {
        throw new WorkspaceError("ai_limit", 429);
      }
      const id = await createReviewCore(sql, access, data);
      reviewInBackground(access, id);
      return { id };
    });
  });

export const getReview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<ReviewRow> => {
    const { getReviewCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => getReviewCore(sql, access, data.id));
  });

export const listReviews = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, caseId: uuid.nullish(), documentId: uuid.nullish() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ReviewRow[]> => {
    const { listReviewsCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => listReviewsCore(sql, access, data));
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { deleteReviewCore } = await core();
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await deleteReviewCore(sql, access, data.id);
      return { ok: true as const };
    });
  });
