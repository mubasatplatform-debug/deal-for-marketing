import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { wsId } from "../schemas";
import type { ArticleHit, LawRow, LawsAnswer } from "./library-core";

/**
 * «مكتبة الأنظمة» server functions — the Saudi legislation published by the
 * Ministry of Justice, searchable by every member of an office (the guard
 * still checks membership and the second factor). Browsing and search are
 * free on every plan; AI answers need `aiDrafting` and count against caps.
 */

const runner = () => import("../run.server");
const lib = () => import("./library-core");

const SEARCH_PER_USER_HOUR = 300;
const ASK_PER_USER_HOUR = 60;
const ASK_PER_OFFICE_DAY = Number(process.env.LAW_DOCAI_DAILY_CAP) || 400;

async function limit(key: string, n: number, window: number) {
  const { tryHit } = await import("@/lib/rate-limit.server");
  const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
  if (!(await tryHit(key, n, window))) throw new WorkspaceError("ai_limit", 429);
}

export const listLaws = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<LawRow[]> => {
    const { run } = await runner();
    const { listLawsCore } = await lib();
    return run(context.userId, data.workspaceId, {}, (sql) => listLawsCore(sql));
  });

export const searchLaws = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, query: z.string().trim().min(2).max(300), law: z.string().max(120).nullish() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ArticleHit[]> => {
    const { run } = await runner();
    const { searchLawsCore } = await lib();
    return run(context.userId, data.workspaceId, {}, async (sql) => {
      await limit(`law-lib:u:${context.userId}`, SEARCH_PER_USER_HOUR, 3600);
      return searchLawsCore(sql, { query: data.query, law: data.law, limit: 25 });
    });
  });

export const getLawArticles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, serial: z.string().min(3).max(64), page: z.number().int().min(1).max(100).default(1) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { run } = await runner();
    const { lawArticlesCore } = await lib();
    return run(context.userId, data.workspaceId, {}, (sql) => lawArticlesCore(sql, data.serial, data.page, 50));
  });

export const askLaws = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, question: z.string().trim().min(3).max(2000), law: z.string().max(120).nullish() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<LawsAnswer> => {
    const { run } = await runner();
    const { askLawsCore } = await lib();
    const { planHas } = await import("@/lib/saas/plans");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { answerCompleter } = await import("./ai.server");
    return run(context.userId, data.workspaceId, {}, async (sql, access) => {
      if (!planHas(access.workspace.plan, "aiDrafting")) throw new WorkspaceError("plan_feature");
      if (!process.env.LAW_AGENT_URL?.trim()) throw new WorkspaceError("ai_unavailable", 503);
      await limit(`law-lawsqa:u:${context.userId}`, ASK_PER_USER_HOUR, 3600);
      await limit(`law-docai:ws:${access.workspace.id}`, ASK_PER_OFFICE_DAY, 86_400);
      return askLawsCore(sql, data, answerCompleter);
    });
  });
