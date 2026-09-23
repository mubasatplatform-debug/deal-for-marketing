import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ADMIN_FORBIDDEN, assertAdmin } from "@/lib/admin";
import { PLAN_IDS } from "./plans";
import type { ConsoleInvoice, ConsoleWorkspace } from "./tenancy-core";

/**
 * DEAL team console for «مكتب المحامي» subscribers (/admin/law). Every
 * function is team-only via `assertAdmin` (ADMIN_EMAILS), and acts across
 * offices on purpose — that is the console's job. Each change is logged in
 * workspace_events with the team member's id.
 */

export { ADMIN_FORBIDDEN };

const core = () => import("./tenancy-core");

async function teamOnly(userId: string) {
  try {
    await assertAdmin(userId);
  } catch (err) {
    (await import("./guard.server")).setStatus(403);
    throw err;
  }
}

export type ConsoleOverview = {
  workspaces: ConsoleWorkspace[];
  invoices: ConsoleInvoice[];
  now: number;
};

export const consoleOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ConsoleOverview> => {
    await teamOnly(context.userId);
    const { consoleListCore, consolePendingInvoicesCore } = await core();
    const sql = await getSql();
    const [workspaces, invoices] = await Promise.all([consoleListCore(sql), consolePendingInvoicesCore(sql)]);
    return { workspaces, invoices, now: Date.now() };
  });

const wsOnly = z.object({ workspaceId: z.string().uuid() });

async function run(fn: () => Promise<unknown>) {
  const { withStatus } = await import("./guard.server");
  await withStatus(async () => {
    await fn();
  });
  return { ok: true };
}

export const consoleActivate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    wsOnly
      .extend({
        plan: z.enum(PLAN_IDS),
        cycle: z.enum(["monthly", "yearly"]),
        /** 'YYYY-MM-DD'; access runs to the end of that day (Riyadh). */
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .refine((d) => Date.parse(`${d.until}T23:59:59+03:00`) > Date.now(), "until must be in the future")
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await teamOnly(context.userId);
    const { consoleActivateCore } = await core();
    const sql = await getSql();
    const until = new Date(`${data.until}T23:59:59+03:00`).toISOString();
    return run(() => consoleActivateCore(sql, context.userId, data.workspaceId, data.plan, data.cycle, until));
  });

export const consoleExtendTrial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => wsOnly.extend({ days: z.number().int().min(1).max(90) }).parse(input))
  .handler(async ({ context, data }) => {
    await teamOnly(context.userId);
    const { consoleExtendTrialCore } = await core();
    const sql = await getSql();
    return run(() => consoleExtendTrialCore(sql, context.userId, data.workspaceId, data.days));
  });

export const consoleSuspend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => wsOnly.parse(input))
  .handler(async ({ context, data }) => {
    await teamOnly(context.userId);
    const { consoleSuspendCore } = await core();
    const sql = await getSql();
    return run(() => consoleSuspendCore(sql, context.userId, data.workspaceId));
  });

export const consoleMarkPaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await teamOnly(context.userId);
    const { markInvoicePaidCore } = await core();
    const res = await markInvoicePaidCore(await getSql(), data.invoiceId, context.userId);
    if (!res) {
      (await import("./guard.server")).setStatus(409);
      throw new Error("WS:invoice_not_found");
    }
    return { ok: true, periodEnd: res.periodEnd };
  });
