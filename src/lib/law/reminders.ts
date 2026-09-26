import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { SqlTag } from "@/lib/saas/tenancy-core";
import type { ReminderSettings } from "./reminders-core";
import { wsId } from "./schemas";

/**
 * «التذكيرات التلقائية» settings: every member reads them; owners/admins of
 * an office that is not read-only change them. The sending itself runs from
 * the cron endpoint (reminders.server.ts).
 */

const core = () => import("./reminders-core");

async function db(): Promise<SqlTag> {
  const { getSql } = await import("@/lib/db");
  return (await getSql()) as unknown as SqlTag;
}

export type ReminderSettingsView = { settings: ReminderSettings; canEdit: boolean };

export const getReminderSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<ReminderSettingsView> => {
    const { requireWorkspace, withStatus } = await import("@/lib/saas/guard.server");
    const { getReminderSettingsCore } = await core();
    const access = await requireWorkspace(context.userId, data.workspaceId, "staff");
    const settings = await withStatus(async () => getReminderSettingsCore(await db(), access.workspace.id));
    const manager = access.role === "owner" || access.role === "admin";
    return { settings, canEdit: manager && !access.lifecycle.readOnly };
  });

export const saveReminderSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, clientConsult: z.boolean(), lawyerDaily: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireWorkspace, withStatus } = await import("@/lib/saas/guard.server");
    const { saveReminderSettingsCore } = await core();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin", { write: true });
    await withStatus(async () =>
      saveReminderSettingsCore(await db(), access.workspace.id, {
        clientConsult: data.clientConsult,
        lawyerDaily: data.lawyerDaily,
      }),
    );
    return { ok: true };
  });
