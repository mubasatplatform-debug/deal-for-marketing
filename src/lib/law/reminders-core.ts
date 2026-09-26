/**
 * Automatic reminders — pure core (relative imports only, so node tests drive
 * it on PGLite with the real migrations).
 *
 * Two kinds, both found by a periodic run (the cron endpoint calls
 * reminders.server.ts every ~15 minutes):
 *
 *   client_24h / client_1h  a confirmed appointment or consultation starting
 *                           in ~24 hours / ~1 hour, emailed to its client;
 *   lawyer_daily            one morning digest per office member: today's
 *                           hearings on their cases, their appointments, and
 *                           their open tasks due today or overdue.
 *
 * Idempotency lives in `law_reminders_sent` (0014): a run CLAIMS a reminder
 * (`insert … on conflict do nothing returning`) before sending it, so two
 * overlapping runs can never both send; a failed send releases its claim so
 * the next run retries.
 *
 * Offices whose effective status is read-only (suspended / cancelled, or a
 * trial lapsed past its grace period) get nothing.
 */
import { effectiveStatus } from "../saas/lifecycle.ts";
import type { SqlTag } from "../saas/tenancy-core.ts";
import type { ConsultMode } from "./options.ts";
import { plain } from "./rows.ts";
import { addDays, riyadhDayStart, riyadhMinutes, riyadhYmd } from "./time.ts";

export type ReminderKind = "client_24h" | "client_1h" | "lawyer_daily";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Client windows, relative to the run: [from, to] around 24 h and 1 h ahead. */
export const CLIENT_WINDOWS = {
  client_24h: { from: 23 * HOUR, to: 25 * HOUR },
  client_1h: { from: 45 * MIN, to: 75 * MIN },
} as const;

/** The morning digest goes out from 07:00 Riyadh. */
export const DIGEST_FROM_HOUR = 7;
/** Items per list in one digest (the email says how many more). */
export const DIGEST_LIST_MAX = 15;

export type ClientReminderDue = {
  kind: "client_24h" | "client_1h";
  refId: string;
  recipient: string;
  appointmentId: string;
  workspaceId: string;
  officeName: string;
  officeSlug: string;
  startsAt: string;
  mode: ConsultMode;
  lawyerName: string;
  meetNonce: string | null;
};

export type DigestHearing = { startsAt: string; caseTitle: string; caseRef: number; court: string; room: string };
export type DigestAppointment = {
  startsAt: string;
  endsAt: string;
  kind: "appointment" | "consultation";
  mode: ConsultMode;
  status: "pending" | "confirmed";
  title: string;
};
export type DigestTask = { title: string; dueOn: string; overdue: boolean; caseTitle: string | null };

export type LawyerDigestDue = {
  kind: "lawyer_daily";
  refId: string;
  recipient: string;
  userId: string;
  name: string;
  workspaceId: string;
  officeName: string;
  /** Riyadh 'YYYY-MM-DD' the digest is for. */
  date: string;
  hearings: DigestHearing[];
  appointments: DigestAppointment[];
  tasks: DigestTask[];
  /** Full counts (the lists are capped at DIGEST_LIST_MAX). */
  totals: { hearings: number; appointments: number; tasks: number };
};

type WsLife = { status: string; trial_ends_at: string | Date | null; current_period_end: string | Date | null };

function active(row: WsLife, now: number): boolean {
  return !effectiveStatus(row, now).readOnly;
}

const iso = (v: unknown): string => new Date(v as string | Date).toISOString();

/* ------------------------------------------------------------------------ */
/* Client reminders                                                          */
/* ------------------------------------------------------------------------ */

/**
 * Confirmed appointments with a client email that start inside the 24 h or
 * 1 h window of `now`, in offices with `client_consult` on, not yet claimed.
 * The email is the client record's, else the lead's (like the manual
 * «إرسال تذكير»). Soonest first, at most `limit`.
 */
export async function dueClientRemindersCore(sql: SqlTag, now: number, limit = 500): Promise<ClientReminderDue[]> {
  const w24 = CLIENT_WINDOWS.client_24h;
  const w1 = CLIENT_WINDOWS.client_1h;
  const rows = await sql.query<Record<string, unknown>>(
    `with c as (
       select a.id, a.workspace_id, a.mode, a.starts_at, a.meet_nonce,
              w.name as office_name, w.slug as office_slug,
              w.status, w.trial_ends_at, w.current_period_end,
              coalesce(cl.email, a.lead_email) as email,
              coalesce(u.name, '') as lawyer_name,
              case when a.starts_at >= $1::timestamptz and a.starts_at <= $2::timestamptz
                   then 'client_24h' else 'client_1h' end as kind,
              md5(a.id::text || '|' || floor(extract(epoch from a.starts_at))::bigint::text)::uuid as ref_id
       from law_appointments a
       join workspaces w on w.id = a.workspace_id
       left join law_reminder_settings s on s.workspace_id = a.workspace_id
       left join law_clients cl on cl.id = a.client_id and cl.workspace_id = a.workspace_id
       left join "user" u on u.id = a.lawyer_id
       where a.status = 'confirmed'
         and not a.is_demo
         and w.status not in ('suspended', 'cancelled')
         and coalesce(s.client_consult, true)
         and ((a.starts_at >= $1::timestamptz and a.starts_at <= $2::timestamptz)
           or (a.starts_at >= $3::timestamptz and a.starts_at <= $4::timestamptz))
     )
     select c.* from c
     where c.email is not null
       and not exists (
         select 1 from law_reminders_sent r
         where r.kind = c.kind and r.ref_id = c.ref_id and r.recipient = c.email
       )
     order by c.starts_at, c.id`,
    [
      new Date(now + w24.from).toISOString(),
      new Date(now + w24.to).toISOString(),
      new Date(now + w1.from).toISOString(),
      new Date(now + w1.to).toISOString(),
    ],
  );
  // The lifecycle check (lapsed trials) runs here, so the limit applies after
  // it: inactive offices never crowd active ones out of a run.
  return rows
    .filter((r) => active(r as unknown as WsLife, now))
    .slice(0, limit)
    .map((r) => ({
      kind: r.kind as ClientReminderDue["kind"],
      refId: String(r.ref_id),
      recipient: String(r.email),
      appointmentId: String(r.id),
      workspaceId: String(r.workspace_id),
      officeName: String(r.office_name),
      officeSlug: String(r.office_slug),
      startsAt: iso(r.starts_at),
      mode: r.mode as ConsultMode,
      lawyerName: String(r.lawyer_name ?? ""),
      meetNonce: (r.meet_nonce as string | null) ?? null,
    }));
}

/* ------------------------------------------------------------------------ */
/* Lawyer morning digest                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Members of offices with `lawyer_daily` on who have something today (Riyadh)
 * and have not had today's digest. Nothing before DIGEST_FROM_HOUR.
 */
export async function dueLawyerDigestsCore(sql: SqlTag, now: number, limit = 500): Promise<LawyerDigestDue[]> {
  if (riyadhMinutes(now) < DIGEST_FROM_HOUR * 60) return [];
  const ymd = riyadhYmd(now);
  const from = new Date(riyadhDayStart(ymd)).toISOString();
  const to = new Date(riyadhDayStart(addDays(ymd, 1))).toISOString();

  // Members still waiting for today's digest ($1 = Riyadh date).
  const eligible = `
    eligible as (
      select m.workspace_id, m.user_id, u.email, u.name,
             w.name as office_name, w.status, w.trial_ends_at, w.current_period_end,
             md5(m.workspace_id::text || '|' || m.user_id || '|' || $1::text)::uuid as ref_id
      from workspace_members m
      join workspaces w on w.id = m.workspace_id
      join "user" u on u.id = m.user_id
      left join law_reminder_settings s on s.workspace_id = m.workspace_id
      where coalesce(s.lawyer_daily, true)
        and w.status not in ('suspended', 'cancelled')
        and u.email is not null and u.email <> ''
        and not exists (
          select 1 from law_reminders_sent r
          where r.kind = 'lawyer_daily'
            and r.ref_id = md5(m.workspace_id::text || '|' || m.user_id || '|' || $1::text)::uuid
            and r.recipient = u.email
        )
    )`;

  const [members, hearings, appts, tasks] = await Promise.all([
    sql.query<Record<string, unknown>>(`with ${eligible} select * from eligible`, [ymd]),
    sql.query<Record<string, unknown>>(
      `with ${eligible}
       select e.workspace_id, e.user_id, h.starts_at, h.court, h.room, c.title as case_title, c.ref_no
       from eligible e
       join law_case_lawyers cl on cl.workspace_id = e.workspace_id and cl.user_id = e.user_id
       join law_hearings h on h.case_id = cl.case_id and h.workspace_id = e.workspace_id
       join law_cases c on c.id = h.case_id and c.workspace_id = e.workspace_id
       where h.status = 'scheduled' and not h.is_demo and h.starts_at >= $2::timestamptz and h.starts_at < $3::timestamptz
       order by h.starts_at`,
      [ymd, from, to],
    ),
    sql.query<Record<string, unknown>>(
      `with ${eligible}
       select e.workspace_id, e.user_id, a.starts_at, a.ends_at, a.kind, a.mode, a.status,
              coalesce(nullif(a.title, ''), cl.name, a.lead_name, '') as title
       from eligible e
       join law_appointments a on a.workspace_id = e.workspace_id and a.lawyer_id = e.user_id
       left join law_clients cl on cl.id = a.client_id and cl.workspace_id = a.workspace_id
       where a.status in ('pending', 'confirmed') and not a.is_demo
         and a.starts_at >= $2::timestamptz and a.starts_at < $3::timestamptz
       order by a.starts_at`,
      [ymd, from, to],
    ),
    sql.query<Record<string, unknown>>(
      `with ${eligible}
       select e.workspace_id, e.user_id, t.title, t.due_on::text as due_on, c.title as case_title
       from eligible e
       join law_tasks t on t.workspace_id = e.workspace_id and t.assignee_id = e.user_id
       left join law_cases c on c.id = t.case_id and c.workspace_id = t.workspace_id
       where t.done_at is null and not t.is_demo and t.due_on is not null and t.due_on <= $2::date
       order by t.due_on, t.created_at`,
      [ymd, ymd],
    ),
  ]);

  const key = (r: Record<string, unknown>) => `${String(r.workspace_id)}|${String(r.user_id)}`;
  const by = <T>(rows: Record<string, unknown>[], map: (r: Record<string, unknown>) => T) => {
    const out = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      const list = out.get(k) ?? [];
      list.push(map(r));
      out.set(k, list);
    }
    return out;
  };
  const H = by<DigestHearing>(hearings, (r) => ({
    startsAt: iso(r.starts_at),
    caseTitle: String(r.case_title),
    caseRef: Number(r.ref_no),
    court: String(r.court ?? ""),
    room: String(r.room ?? ""),
  }));
  const A = by<DigestAppointment>(appts, (r) => ({
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    kind: r.kind as DigestAppointment["kind"],
    mode: r.mode as ConsultMode,
    status: r.status as DigestAppointment["status"],
    title: String(r.title ?? ""),
  }));
  const T = by<DigestTask>(tasks, (r) => ({
    title: String(r.title),
    dueOn: String(r.due_on),
    overdue: String(r.due_on) < ymd,
    caseTitle: (r.case_title as string | null) ?? null,
  }));

  const out: LawyerDigestDue[] = [];
  for (const m of members) {
    if (!active(m as unknown as WsLife, now)) continue;
    const k = key(m);
    const h = H.get(k) ?? [];
    const a = A.get(k) ?? [];
    const t = T.get(k) ?? [];
    if (h.length + a.length + t.length === 0) continue;
    out.push({
      kind: "lawyer_daily",
      refId: String(m.ref_id),
      recipient: String(m.email),
      userId: String(m.user_id),
      name: String(m.name ?? ""),
      workspaceId: String(m.workspace_id),
      officeName: String(m.office_name),
      date: ymd,
      hearings: h.slice(0, DIGEST_LIST_MAX),
      appointments: a.slice(0, DIGEST_LIST_MAX),
      tasks: t.slice(0, DIGEST_LIST_MAX),
      totals: { hearings: h.length, appointments: a.length, tasks: t.length },
    });
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Claims                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Claim one reminder. True only for the run whose insert landed — call it
 * BEFORE sending, and send only on true.
 */
export async function markSentCore(sql: SqlTag, kind: ReminderKind, refId: string, recipient: string): Promise<boolean> {
  const rows = await sql`
    insert into law_reminders_sent (kind, ref_id, recipient)
    values (${kind}, ${refId}::uuid, ${recipient})
    on conflict do nothing
    returning ref_id
  `;
  return rows.length === 1;
}

/** Release a claim whose send failed, so the next run retries it. */
export async function unmarkSentCore(sql: SqlTag, kind: ReminderKind, refId: string, recipient: string): Promise<void> {
  await sql`
    delete from law_reminders_sent
    where kind = ${kind} and ref_id = ${refId}::uuid and recipient = ${recipient}
  `;
}

/* ------------------------------------------------------------------------ */
/* One run                                                                   */
/* ------------------------------------------------------------------------ */

export type ReminderSenders = {
  client: (r: ClientReminderDue) => Promise<boolean>;
  digest: (d: LawyerDigestDue) => Promise<boolean>;
};

export type ReminderCounts = { client24: number; client1: number; digests: number; failed: number };

/** Emails per run, so one run stays well inside a serverless time limit. */
export const RUN_CAP = 200;

/**
 * Find what is due, claim each item, send it, and release the claim of any
 * send that failed (so the next run retries). Sends one at a time; stops at
 * `cap` attempted sends — the rest waits for the next run.
 */
export async function processRemindersCore(
  sql: SqlTag,
  now: number,
  send: ReminderSenders,
  cap: number = RUN_CAP,
): Promise<ReminderCounts> {
  const counts: ReminderCounts = { client24: 0, client1: 0, digests: 0, failed: 0 };
  let budget = cap;

  const attempt = async (kind: ReminderKind, refId: string, to: string, fn: () => Promise<boolean>) => {
    if (budget <= 0) return false;
    if (!(await markSentCore(sql, kind, refId, to))) return false; // another run has it
    budget -= 1;
    let ok = false;
    try {
      ok = await fn();
    } catch {
      ok = false;
    }
    if (!ok) {
      counts.failed += 1;
      await unmarkSentCore(sql, kind, refId, to);
    }
    return ok;
  };

  for (const r of await dueClientRemindersCore(sql, now, cap)) {
    if (budget <= 0) break;
    if (await attempt(r.kind, r.refId, r.recipient, () => send.client(r))) {
      if (r.kind === "client_24h") counts.client24 += 1;
      else counts.client1 += 1;
    }
  }
  if (budget > 0) {
    for (const d of await dueLawyerDigestsCore(sql, now, budget)) {
      if (budget <= 0) break;
      if (await attempt(d.kind, d.refId, d.recipient, () => send.digest(d))) counts.digests += 1;
    }
  }
  // Claims only matter for the day or two a reminder can be due; keep the
  // table from growing forever.
  await sql`delete from law_reminders_sent where sent_at < ${new Date(now - 30 * 86_400_000).toISOString()}::timestamptz`;
  return counts;
}

/* ------------------------------------------------------------------------ */
/* Office settings                                                           */
/* ------------------------------------------------------------------------ */

export type ReminderSettings = { clientConsult: boolean; lawyerDaily: boolean };

export async function getReminderSettingsCore(sql: SqlTag, workspaceId: string): Promise<ReminderSettings> {
  const [r] = await sql<{ client_consult: boolean; lawyer_daily: boolean }>`
    select client_consult, lawyer_daily from law_reminder_settings where workspace_id = ${workspaceId}
  `;
  return plain({ clientConsult: r?.client_consult ?? true, lawyerDaily: r?.lawyer_daily ?? true });
}

export async function saveReminderSettingsCore(sql: SqlTag, workspaceId: string, s: ReminderSettings): Promise<void> {
  await sql`
    insert into law_reminder_settings (workspace_id, client_consult, lawyer_daily, updated_at)
    values (${workspaceId}, ${s.clientConsult}, ${s.lawyerDaily}, now())
    on conflict (workspace_id) do update
      set client_consult = excluded.client_consult,
          lawyer_daily = excluded.lawyer_daily,
          updated_at = now()
  `;
}
