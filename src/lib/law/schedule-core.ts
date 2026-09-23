/**
 * Schedule core — appointments, remote consultations, the office calendar,
 * booking settings, and the queries behind the public booking page and the
 * /meet page. Bare SQL tag, relative imports (PGLite-testable).
 *
 * Office-side functions take a `WorkspaceAccess` and filter by its verified
 * workspace id. The public functions (`public*`) are reached only through an
 * office slug (booking) or a meeting-token hash (/meet), and return nothing
 * but what those pages show.
 */
import { effectiveStatus } from "../saas/lifecycle.ts";
import { planHas } from "../saas/plans.ts";
import { UUID_RE, WorkspaceError, type SqlTag, type WorkspaceAccess } from "../saas/tenancy-core.ts";
import {
  canMoveStatus,
  type AppointmentKind,
  type AppointmentStatus,
  type ConsultMode,
} from "./options.ts";
import { can, canHostConsult } from "./permissions.ts";
import { assertCase, assertClient, assertMembers, need } from "./practice-core.ts";
import { PAGE_SIZE, likeEscape, plain, plainRows } from "./rows.ts";
import type { BookingSettingsFields } from "./schemas.ts";
import { DEFAULT_AVAILABILITY, type Availability, type Busy } from "./slots.ts";
import { hmToMinutes, minutesToHm } from "./time.ts";

function notFound(): never {
  throw new WorkspaceError("not_found", 404);
}

function checkId(id: string): void {
  if (!UUID_RE.test(id)) notFound();
}

/* ------------------------------------------------------------------------ */
/* Booking settings                                                          */
/* ------------------------------------------------------------------------ */

export type BookingSettings = {
  bookingEnabled: boolean;
  bookingModes: ConsultMode[];
  workDays: number[];
  dayStart: string;
  dayEnd: string;
  slotMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  bookingNote: string;
};

type SettingsRow = {
  booking_enabled: boolean;
  booking_modes: ConsultMode[];
  work_days: number[];
  day_start: number;
  day_end: number;
  slot_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  horizon_days: number;
  booking_note: string;
};

export const DEFAULT_SETTINGS: BookingSettings = {
  bookingEnabled: false,
  bookingModes: ["video", "in_office", "phone"],
  workDays: DEFAULT_AVAILABILITY.workDays,
  dayStart: minutesToHm(DEFAULT_AVAILABILITY.dayStart),
  dayEnd: minutesToHm(DEFAULT_AVAILABILITY.dayEnd),
  slotMinutes: DEFAULT_AVAILABILITY.slotMinutes,
  bufferMinutes: DEFAULT_AVAILABILITY.bufferMinutes,
  minNoticeMinutes: DEFAULT_AVAILABILITY.minNoticeMinutes,
  horizonDays: DEFAULT_AVAILABILITY.horizonDays,
  bookingNote: "",
};

function fromRow(r: SettingsRow | undefined): BookingSettings {
  if (!r) return DEFAULT_SETTINGS;
  return {
    bookingEnabled: r.booking_enabled,
    bookingModes: r.booking_modes,
    workDays: r.work_days.map(Number),
    dayStart: minutesToHm(Number(r.day_start)),
    dayEnd: minutesToHm(Number(r.day_end)),
    slotMinutes: Number(r.slot_minutes),
    bufferMinutes: Number(r.buffer_minutes),
    minNoticeMinutes: Number(r.min_notice_minutes),
    horizonDays: Number(r.horizon_days),
    bookingNote: r.booking_note,
  };
}

export function availabilityOf(s: BookingSettings): Availability {
  return {
    workDays: s.workDays,
    dayStart: hmToMinutes(s.dayStart),
    dayEnd: hmToMinutes(s.dayEnd),
    slotMinutes: s.slotMinutes,
    bufferMinutes: s.bufferMinutes,
    minNoticeMinutes: s.minNoticeMinutes,
    horizonDays: s.horizonDays,
  };
}

/** Modes the office may offer: video only on plans that include it. */
export function allowedModes(plan: string, modes: readonly ConsultMode[]): ConsultMode[] {
  return modes.filter((m) => m !== "video" || planHas(plan, "videoSessions"));
}

async function loadSettings(sql: SqlTag, ws: string): Promise<BookingSettings> {
  const [r] = await sql<SettingsRow>`
    select booking_enabled, booking_modes, work_days, day_start, day_end, slot_minutes, buffer_minutes,
           min_notice_minutes, horizon_days, booking_note
    from law_office_settings where workspace_id = ${ws}
  `;
  return fromRow(r);
}

export async function getSettingsCore(sql: SqlTag, access: WorkspaceAccess) {
  return { settings: await loadSettings(sql, access.workspace.id), slug: access.workspace.slug };
}

export async function saveSettingsCore(sql: SqlTag, access: WorkspaceAccess, s: BookingSettingsFields) {
  need(access, "settings.booking");
  const modes = s.bookingModes;
  if (modes.includes("video") && !planHas(access.workspace.plan, "videoSessions")) {
    throw new WorkspaceError("plan_feature", 402);
  }
  const ws = access.workspace.id;
  await sql`
    with up as (
      insert into law_office_settings (workspace_id, booking_enabled, booking_modes, work_days, day_start, day_end,
        slot_minutes, buffer_minutes, min_notice_minutes, horizon_days, booking_note, updated_at)
      values (${ws}, ${s.bookingEnabled}, ${modes}::text[], ${s.workDays}::smallint[], ${hmToMinutes(s.dayStart)},
        ${hmToMinutes(s.dayEnd)}, ${s.slotMinutes}, ${s.bufferMinutes}, ${s.minNoticeMinutes}, ${s.horizonDays},
        ${s.bookingNote}, now())
      on conflict (workspace_id) do update set booking_enabled = excluded.booking_enabled,
        booking_modes = excluded.booking_modes, work_days = excluded.work_days, day_start = excluded.day_start,
        day_end = excluded.day_end, slot_minutes = excluded.slot_minutes, buffer_minutes = excluded.buffer_minutes,
        min_notice_minutes = excluded.min_notice_minutes, horizon_days = excluded.horizon_days,
        booking_note = excluded.booking_note, updated_at = now()
      returning workspace_id
    )
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    select workspace_id, ${access.userId}, 'booking_settings',
           jsonb_build_object('enabled', ${s.bookingEnabled}::boolean) from up
  `;
}

export async function setSlugCore(sql: SqlTag, access: WorkspaceAccess, slug: string) {
  need(access, "settings.booking");
  if (slug === access.workspace.slug) return;
  try {
    await sql`
      with upd as (
        update workspaces set slug = ${slug}, updated_at = now() where id = ${access.workspace.id} returning id
      )
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select id, ${access.userId}, 'slug', jsonb_build_object('from', ${access.workspace.slug}::text, 'to', ${slug}::text)
      from upd
    `;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new WorkspaceError("slug_taken", 409);
    throw err;
  }
}

/* ------------------------------------------------------------------------ */
/* Appointments & consultations                                              */
/* ------------------------------------------------------------------------ */

export type AppointmentRow = {
  id: string;
  kind: AppointmentKind;
  mode: ConsultMode;
  status: AppointmentStatus;
  source: "office" | "booking";
  title: string;
  client_id: string | null;
  client_name: string | null;
  case_id: string | null;
  case_title: string | null;
  case_ref: number | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  lawyer_id: string | null;
  lawyer_name: string | null;
  starts_at: string;
  ends_at: string;
  location: string;
  external_url: string | null;
  has_room: boolean;
  client_admitted_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

const APPT_COLS = `a.id, a.kind, a.mode, a.status, a.source, a.title, a.client_id, c.name as client_name, a.case_id,
  k.title as case_title, k.ref_no as case_ref, a.lead_name, a.lead_phone, a.lead_email, a.lawyer_id,
  coalesce(nullif(u.name, ''), u.email) as lawyer_name, a.starts_at, a.ends_at, a.location, a.external_url,
  (a.video_room is not null) as has_room, a.client_admitted_at, a.cancel_reason, a.created_at`;

const APPT_FROM = `from law_appointments a
  left join law_clients c on c.id = a.client_id and c.workspace_id = a.workspace_id
  left join law_cases k on k.id = a.case_id and k.workspace_id = a.workspace_id
  left join "user" u on u.id = a.lawyer_id`;

const APPT_SELECT = `select ${APPT_COLS} ${APPT_FROM}`;

export type NewAppointment = {
  /** Generated by the server fn, so the meeting token can be derived before the insert. */
  id?: string;
  kind: AppointmentKind;
  mode: ConsultMode;
  status: "pending" | "confirmed";
  title: string;
  clientId: string | null;
  caseId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  lawyerId: string | null;
  startsAt: string;
  endsAt: string;
  location: string;
  /** Precomputed by the server fn (crypto lives there). */
  videoRoom: string | null;
  meetNonce: string | null;
  meetTokenHash: string | null;
};

function assertVideoAllowed(access: WorkspaceAccess, mode: ConsultMode) {
  if (mode === "video" && !planHas(access.workspace.plan, "videoSessions")) {
    throw new WorkspaceError("plan_feature", 402);
  }
}

export async function createAppointmentCore(sql: SqlTag, access: WorkspaceAccess, a: NewAppointment) {
  need(access, a.kind === "consultation" ? "consult.manage" : "appointment.manage");
  assertVideoAllowed(access, a.mode);
  await assertClient(sql, access, a.clientId);
  await assertCase(sql, access, a.caseId);
  await assertMembers(sql, access, a.lawyerId ? [a.lawyerId] : []);
  const ws = access.workspace.id;
  const [r] = await sql<{ id: string }>`
    with ins as (
      insert into law_appointments (id, workspace_id, kind, mode, status, source, title, client_id, case_id, lead_name,
        lead_phone, lead_email, lawyer_id, starts_at, ends_at, location, video_room, meet_nonce, meet_token_hash,
        created_by)
      values (coalesce(${a.id ?? null}::uuid, gen_random_uuid()), ${ws}, ${a.kind}, ${a.mode}, ${a.status}, 'office', ${a.title}, ${a.clientId}, ${a.caseId},
        ${a.leadName}, ${a.leadPhone}, ${a.leadEmail}, ${a.lawyerId}, ${a.startsAt}::timestamptz,
        ${a.endsAt}::timestamptz, ${a.location}, ${a.videoRoom}, ${a.meetNonce}, ${a.meetTokenHash},
        ${access.userId})
      returning id
    ),
    ev as (
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select ${ws}, ${access.userId}, ${a.kind === "consultation" ? "consult_created" : "appointment_created"},
             jsonb_build_object('id', id, 'mode', ${a.mode}::text) from ins
    )
    select id from ins
  `;
  return { id: r.id };
}

export type AppointmentPatch = Omit<NewAppointment, "id" | "kind" | "status" | "meetNonce" | "meetTokenHash">;

export async function updateAppointmentCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  id: string,
  a: AppointmentPatch,
) {
  checkId(id);
  const cur = await loadAppointment(sql, access, id);
  need(access, cur.kind === "consultation" ? "consult.manage" : "appointment.manage");
  assertVideoAllowed(access, a.mode);
  await assertClient(sql, access, a.clientId);
  await assertCase(sql, access, a.caseId);
  await assertMembers(sql, access, a.lawyerId ? [a.lawyerId] : []);
  await sql`
    update law_appointments set mode = ${a.mode}, title = ${a.title}, client_id = ${a.clientId},
      case_id = ${a.caseId}, lead_name = ${a.leadName}, lead_phone = ${a.leadPhone}, lead_email = ${a.leadEmail},
      lawyer_id = ${a.lawyerId}, starts_at = ${a.startsAt}::timestamptz, ends_at = ${a.endsAt}::timestamptz,
      location = ${a.location}, video_room = coalesce(video_room, ${a.videoRoom}), updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
}

/** Server-side view of one appointment (includes the secret-ish fields). */
export type AppointmentFull = AppointmentRow & {
  private_notes: string;
  video_room: string | null;
  meet_nonce: string | null;
};

async function loadAppointment(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<AppointmentFull> {
  checkId(id);
  const [r] = await sql.query<AppointmentFull>(
    `select ${APPT_COLS}, a.private_notes, a.video_room, a.meet_nonce ${APPT_FROM}
     where a.id = $1 and a.workspace_id = $2`,
    [id, access.workspace.id],
  );
  if (!r) notFound();
  return plain<AppointmentFull>(r);
}

export { loadAppointment as loadAppointmentCore };

/** What the office UI may see of one appointment. */
export function visibleAppointment(access: WorkspaceAccess, a: AppointmentFull) {
  const { private_notes, video_room: _room, meet_nonce: _nonce, ...rest } = a;
  const host = canHostConsult(access.role, access.userId, a.lawyer_id);
  return {
    ...rest,
    private_notes: host && can(access.role, "consult.notes") ? private_notes : null,
    canHost: host,
  };
}

export async function setStatusCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  id: string,
  to: AppointmentStatus,
  reason: string | null = null,
): Promise<AppointmentFull> {
  const cur = await loadAppointment(sql, access, id);
  if (to === "done" || to === "no_show") {
    need(access, "consult.outcome");
    if (cur.kind === "consultation" && !canHostConsult(access.role, access.userId, cur.lawyer_id)) {
      throw new WorkspaceError("role");
    }
  } else {
    need(access, cur.kind === "consultation" ? "consult.manage" : "appointment.manage");
  }
  if (cur.status === to) return cur;
  if (!canMoveStatus(cur.status, to)) throw new WorkspaceError("status", 409);
  await sql`
    with upd as (
      update law_appointments set status = ${to}, updated_at = now(),
        cancel_reason = case when ${to} = 'cancelled' then ${reason} else null end
      where id = ${id} and workspace_id = ${access.workspace.id} and status = ${cur.status}
      returning id
    )
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    select ${access.workspace.id}, ${access.userId}, 'appointment_status',
           jsonb_build_object('id', id, 'from', ${cur.status}::text, 'to', ${to}::text) from upd
  `;
  return { ...cur, status: to };
}

export async function deleteAppointmentCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  need(access, "appointment.delete");
  checkId(id);
  const rows = await sql<{ id: string }>`
    delete from law_appointments where id = ${id} and workspace_id = ${access.workspace.id} returning id
  `;
  if (!rows[0]) notFound();
  await sql`
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (${access.workspace.id}, ${access.userId}, 'appointment_deleted', ${JSON.stringify({ id })}::jsonb)
  `;
}

export async function saveConsultNotesCore(sql: SqlTag, access: WorkspaceAccess, id: string, notes: string) {
  const cur = await loadAppointment(sql, access, id);
  need(access, "consult.notes");
  if (!canHostConsult(access.role, access.userId, cur.lawyer_id)) throw new WorkspaceError("role");
  await sql`
    update law_appointments set private_notes = ${notes}, updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
}

export async function setExternalUrlCore(sql: SqlTag, access: WorkspaceAccess, id: string, url: string | null) {
  const cur = await loadAppointment(sql, access, id);
  if (!canHostConsult(access.role, access.userId, cur.lawyer_id)) throw new WorkspaceError("role");
  assertVideoAllowed(access, "video");
  await sql`
    update law_appointments set external_url = ${url}, updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
}

/** Give the consultation a (new) meeting link: the old link stops working. */
export async function setMeetNonceCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  id: string,
  nonce: string,
  tokenHash: string,
  room: string | null,
) {
  const cur = await loadAppointment(sql, access, id);
  need(access, "consult.manage");
  await sql`
    update law_appointments set meet_nonce = ${nonce}, meet_token_hash = ${tokenHash},
      video_room = coalesce(video_room, ${room}), updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
  return cur;
}

/** The lawyer let the client in from the waiting room. */
export async function admitCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  const cur = await loadAppointment(sql, access, id);
  if (!canHostConsult(access.role, access.userId, cur.lawyer_id)) throw new WorkspaceError("role");
  await sql`
    update law_appointments set client_admitted_at = coalesce(client_admitted_at, now()), updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
  return cur;
}

/** Save a booking lead as a client (or link an existing one with the same phone). */
export async function convertLeadCore(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<{ clientId: string }> {
  need(access, "client.create");
  const cur = await loadAppointment(sql, access, id);
  if (cur.client_id) return { clientId: cur.client_id };
  if (!cur.lead_name) throw new WorkspaceError("invalid", 422);
  const ws = access.workspace.id;
  const [r] = await sql<{ id: string }>`
    with existing as (
      select id from law_clients
      where workspace_id = ${ws} and ${cur.lead_phone}::text is not null and phone = ${cur.lead_phone}
      order by created_at limit 1
    ),
    ins as (
      insert into law_clients (workspace_id, kind, name, phone, email, created_by)
      select ${ws}, 'individual', ${cur.lead_name}, ${cur.lead_phone}, ${cur.lead_email}, ${access.userId}
      where not exists (select 1 from existing)
      returning id
    ),
    picked as (select id from existing union all select id from ins),
    upd as (
      update law_appointments set client_id = (select id from picked limit 1), updated_at = now()
      where id = ${id} and workspace_id = ${ws}
    )
    select id from picked limit 1
  `;
  return { clientId: r.id };
}

export type ConsultPage = { rows: AppointmentRow[]; total: number; page: number; pageSize: number; pending: number };

export async function listConsultationsCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: { view: "upcoming" | "pending" | "past" | "all"; q: string; lawyerId?: string | null; page: number },
): Promise<ConsultPage> {
  need(access, "appointment.view");
  const ws = access.workspace.id;
  const q = f.q.trim();
  const like = `%${likeEscape(q)}%`;
  const offset = (f.page - 1) * PAGE_SIZE;
  const [rows, [p]] = await Promise.all([
    sql.query<AppointmentRow & { total: number }>(
      `select ${APPT_COLS}, count(*) over ()::int as total ${APPT_FROM}
       where a.workspace_id = $1 and a.kind = 'consultation'
         and ($2 = '' or a.title ilike $3 or c.name ilike $3 or a.lead_name ilike $3)
         and ($4::text is null or a.lawyer_id = $4)
         and case $5
               when 'upcoming' then a.ends_at >= now() and a.status in ('pending', 'confirmed')
               when 'pending' then a.status = 'pending'
               when 'past' then a.ends_at < now() or a.status in ('done', 'no_show', 'cancelled')
               else true end
       order by case when $5 = 'past' then -extract(epoch from a.starts_at) else extract(epoch from a.starts_at) end
       limit ${PAGE_SIZE} offset $6`,
      [ws, q, like, f.lawyerId ?? null, f.view, offset],
    ),
    sql<{ n: number }>`
      select count(*)::int as n from law_appointments
      where workspace_id = ${ws} and kind = 'consultation' and status = 'pending'
    `,
  ]);
  return {
    rows: plainRows<AppointmentRow & { total?: number }>(rows).map(({ total: _t, ...r }) => r),
    total: Number(rows[0]?.total ?? 0),
    page: f.page,
    pageSize: PAGE_SIZE,
    pending: Number(p?.n ?? 0),
  };
}

/** Appointments of a client (profile page). */
export async function clientAppointmentsCore(sql: SqlTag, access: WorkspaceAccess, clientId: string) {
  need(access, "appointment.view");
  checkId(clientId);
  const rows = await sql.query<AppointmentRow>(
    `${APPT_SELECT} where a.workspace_id = $1 and a.client_id = $2 order by a.starts_at desc limit 100`,
    [access.workspace.id, clientId],
  );
  return plainRows<AppointmentRow>(rows);
}

/** Other commitments of `lawyerId` overlapping [start, end) — a warning, not a block. */
export async function conflictsCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  lawyerId: string | null,
  startsAt: string,
  endsAt: string,
  excludeId: string | null = null,
): Promise<number> {
  if (!lawyerId) return 0;
  const [r] = await sql<{ n: number }>`
    select (
      (select count(*) from law_appointments a
        where a.workspace_id = ${access.workspace.id} and a.lawyer_id = ${lawyerId}
          and a.status in ('pending', 'confirmed') and (${excludeId}::uuid is null or a.id <> ${excludeId})
          and a.starts_at < ${endsAt}::timestamptz and a.ends_at > ${startsAt}::timestamptz)
      + (select count(*) from law_hearings h join law_case_lawyers cl on cl.case_id = h.case_id
        where h.workspace_id = ${access.workspace.id} and cl.user_id = ${lawyerId} and h.status = 'scheduled'
          and h.starts_at < ${endsAt}::timestamptz
          and h.starts_at + make_interval(mins => h.duration_minutes) > ${startsAt}::timestamptz)
    )::int as n
  `;
  return Number(r?.n ?? 0);
}

/* ------------------------------------------------------------------------ */
/* Calendar                                                                  */
/* ------------------------------------------------------------------------ */

export type CalendarItem = {
  id: string;
  type: "hearing" | "appointment" | "consultation";
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  mode: ConsultMode | null;
  client_name: string | null;
  case_id: string | null;
  case_ref: number | null;
  member_ids: string[];
  location: string;
};

export async function calendarCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: { from: string; to: string; memberId?: string | null },
): Promise<CalendarItem[]> {
  need(access, "appointment.view");
  const ws = access.workspace.id;
  const member = f.memberId ?? null;
  const rows = await sql<CalendarItem>`
    select * from (
      select a.id, a.kind as type,
             coalesce(nullif(a.title, ''), coalesce(c.name, a.lead_name, '')) as title,
             a.starts_at, a.ends_at, a.status, a.mode, coalesce(c.name, a.lead_name) as client_name,
             a.case_id, k.ref_no as case_ref,
             case when a.lawyer_id is null then '{}'::text[] else array[a.lawyer_id] end as member_ids,
             a.location
      from law_appointments a
      left join law_clients c on c.id = a.client_id and c.workspace_id = a.workspace_id
      left join law_cases k on k.id = a.case_id and k.workspace_id = a.workspace_id
      where a.workspace_id = ${ws} and a.status <> 'cancelled'
        and a.starts_at < ${f.to}::timestamptz and a.ends_at > ${f.from}::timestamptz
        and (${member}::text is null or a.lawyer_id = ${member})
      union all
      select h.id, 'hearing' as type, k.title, h.starts_at,
             h.starts_at + make_interval(mins => h.duration_minutes) as ends_at, h.status, null::text as mode,
             c.name as client_name, k.id as case_id, k.ref_no as case_ref,
             coalesce((select array_agg(cl.user_id) from law_case_lawyers cl where cl.case_id = k.id), '{}'::text[]),
             trim(both ' ' from h.court || ' ' || h.room) as location
      from law_hearings h
      join law_cases k on k.id = h.case_id and k.workspace_id = h.workspace_id
      left join law_clients c on c.id = k.client_id and c.workspace_id = k.workspace_id
      where h.workspace_id = ${ws} and h.status <> 'cancelled'
        and h.starts_at < ${f.to}::timestamptz
        and h.starts_at + make_interval(mins => h.duration_minutes) > ${f.from}::timestamptz
        and (${member}::text is null
             or exists (select 1 from law_case_lawyers cl where cl.case_id = k.id and cl.user_id = ${member}))
    ) x order by starts_at
  `;
  return plainRows<CalendarItem>(rows);
}

/* ------------------------------------------------------------------------ */
/* Public: booking page                                                      */
/* ------------------------------------------------------------------------ */

export type PublicOffice = {
  id: string;
  name: string;
  city: string;
  slug: string;
  plan: string;
  settings: BookingSettings;
  modes: ConsultMode[];
  lawyers: { id: string; name: string }[];
  /** Booking is on and the office is not read-only. */
  open: boolean;
};

/** The office behind a booking slug, or null. Only public-safe fields. */
export async function publicOfficeCore(sql: SqlTag, slug: string, now = Date.now()): Promise<PublicOffice | null> {
  const [w] = await sql<{
    id: string;
    name: string;
    city: string;
    slug: string;
    plan: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  }>`
    select id, name, city, slug, plan, status, trial_ends_at, current_period_end from workspaces where slug = ${slug}
  `;
  if (!w) return null;
  const settings = await loadSettings(sql, w.id);
  const lawyers = await sql<{ id: string; name: string }>`
    select m.user_id as id, coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) as name
    from workspace_members m join "user" u on u.id = m.user_id
    where m.workspace_id = ${w.id} and m.role in ('owner', 'admin', 'lawyer')
    order by case m.role when 'lawyer' then 0 when 'owner' then 1 else 2 end, m.created_at
  `;
  const lifecycle = effectiveStatus(w, now);
  const modes = allowedModes(w.plan, settings.bookingModes);
  return {
    id: w.id,
    name: w.name,
    city: w.city,
    slug: w.slug,
    plan: w.plan,
    settings,
    modes,
    lawyers,
    open: settings.bookingEnabled && !lifecycle.readOnly && modes.length > 0 && lawyers.length > 0,
  };
}

/** Busy time of `lawyerIds` between two instants (pending/confirmed + scheduled hearings). */
export async function busyCore(
  sql: SqlTag,
  workspaceId: string,
  lawyerIds: string[],
  fromIso: string,
  toIso: string,
): Promise<Busy[]> {
  if (lawyerIds.length === 0) return [];
  const rows = await sql<{ lawyer_id: string; starts_at: string | Date; ends_at: string | Date }>`
    select a.lawyer_id, a.starts_at, a.ends_at from law_appointments a
    where a.workspace_id = ${workspaceId} and a.lawyer_id = any(${lawyerIds}::text[])
      and a.status in ('pending', 'confirmed')
      and a.starts_at < ${toIso}::timestamptz and a.ends_at > ${fromIso}::timestamptz
    union all
    select cl.user_id, h.starts_at, h.starts_at + make_interval(mins => h.duration_minutes)
    from law_hearings h join law_case_lawyers cl on cl.case_id = h.case_id
    where h.workspace_id = ${workspaceId} and cl.user_id = any(${lawyerIds}::text[]) and h.status = 'scheduled'
      and h.starts_at < ${toIso}::timestamptz
      and h.starts_at + make_interval(mins => h.duration_minutes) > ${fromIso}::timestamptz
  `;
  return rows.map((r) => ({
    lawyerId: r.lawyer_id,
    start: new Date(r.starts_at).getTime(),
    end: new Date(r.ends_at).getTime(),
  }));
}

/** Reserve a slot atomically (law_book_slot). Null when every candidate got busy. */
export async function bookSlotCore(
  sql: SqlTag,
  input: {
    id: string;
    workspaceId: string;
    candidates: string[];
    mode: ConsultMode;
    startsAt: string;
    endsAt: string;
    bufferMinutes: number;
    topic: string;
    name: string;
    phone: string;
    email: string | null;
    clientId: string | null;
    room: string | null;
    nonce: string;
    tokenHash: string;
  },
): Promise<{ id: string; lawyerId: string } | null> {
  const [r] = await sql<{ id: string | null; lawyer_id: string | null }>`
    select * from law_book_slot(${input.id}::uuid, ${input.workspaceId}::uuid, ${input.candidates}::text[], ${input.mode}::text,
      ${input.startsAt}::timestamptz, ${input.endsAt}::timestamptz, ${input.bufferMinutes}::int, ${input.topic}::text,
      ${input.name}::text, ${input.phone}::text, ${input.email}::text, ${input.clientId}::uuid, ${input.room}::text,
      ${input.nonce}::text, ${input.tokenHash}::text)
  `;
  return r?.id && r.lawyer_id ? { id: r.id, lawyerId: r.lawyer_id } : null;
}

/** Emails of the office's owners/admins (+ the assigned lawyer) for new-booking notices. */
export async function officeNotifyEmailsCore(sql: SqlTag, workspaceId: string, lawyerId: string | null) {
  const rows = await sql<{ email: string }>`
    select distinct u.email from workspace_members m join "user" u on u.id = m.user_id
    where m.workspace_id = ${workspaceId} and (m.role in ('owner', 'admin') or m.user_id = ${lawyerId})
      and u.email is not null and u.email <> ''
  `;
  return rows.map((r) => r.email);
}

/* ------------------------------------------------------------------------ */
/* Public: /meet/<token>                                                     */
/* ------------------------------------------------------------------------ */

export type MeetRow = {
  id: string;
  workspace_id: string;
  office_name: string;
  office_slug: string;
  office_plan: string;
  kind: AppointmentKind;
  mode: ConsultMode;
  status: AppointmentStatus;
  title: string;
  client_name: string | null;
  lawyer_id: string | null;
  lawyer_name: string | null;
  starts_at: string;
  ends_at: string;
  location: string;
  external_url: string | null;
  video_room: string | null;
  meet_nonce: string | null;
  client_admitted_at: string | null;
};

export async function meetByHashCore(sql: SqlTag, tokenHash: string): Promise<MeetRow | null> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
  const [r] = await sql<MeetRow>`
    select a.id, a.workspace_id, w.name as office_name, w.slug as office_slug, w.plan as office_plan, a.kind,
           a.mode, a.status, a.title,
           -- An online booking shows only what the booker typed, never office data.
           case when a.source = 'booking' then a.lead_name else coalesce(c.name, a.lead_name) end as client_name, a.lawyer_id,
           coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) as lawyer_name, a.starts_at, a.ends_at,
           a.location, a.external_url, a.video_room, a.meet_nonce, a.client_admitted_at
    from law_appointments a
    join workspaces w on w.id = a.workspace_id
    left join law_clients c on c.id = a.client_id and c.workspace_id = a.workspace_id
    left join "user" u on u.id = a.lawyer_id
    where a.meet_token_hash = ${tokenHash}
  `;
  return r ? plain<MeetRow>(r) : null;
}
