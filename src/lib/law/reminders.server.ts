import { getSql } from "@/lib/db";
import { sendClientReminderEmail, sendLawyerDigestEmail } from "@/lib/mail.server";
import { publicOrigin } from "@/lib/saas/guard.server";
import type { SqlTag } from "@/lib/saas/tenancy-core";
import { meetUrlFor } from "./consult.server";
import { processRemindersCore, RUN_CAP, type ReminderCounts } from "./reminders-core";

/**
 * Automatic reminders — **server-only**. Called by POST /api/cron/reminders
 * (an external scheduler, every ~15 minutes). Claims, then sends, at most
 * RUN_CAP emails per run; see reminders-core.ts for the rules.
 */
export async function runReminders(now: number = Date.now()): Promise<ReminderCounts> {
  const sql = (await getSql()) as unknown as SqlTag;
  const origin = publicOrigin();
  return processRemindersCore(
    sql,
    now,
    {
      client: (r) =>
        sendClientReminderEmail({
          to: r.recipient,
          window: r.kind === "client_1h" ? "1h" : "24h",
          office: r.officeName,
          lawyer: r.lawyerName,
          when: r.startsAt,
          mode: r.mode,
          url: meetUrlFor(r.appointmentId, r.meetNonce),
        }),
      digest: (d) =>
        sendLawyerDigestEmail({
          to: d.recipient,
          name: d.name,
          office: d.officeName,
          date: d.date,
          url: `${origin}/app`,
          hearings: d.hearings,
          appointments: d.appointments,
          tasks: d.tasks,
          totals: d.totals,
        }),
    },
    RUN_CAP,
  );
}
