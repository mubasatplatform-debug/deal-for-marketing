import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  appointmentFields,
  bookingSettingsFields,
  calendarInput,
  memberId,
  slugField,
  statusInput,
  uuid,
  wsId,
  type AppointmentFields,
} from "./schemas";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import type { AppointmentRow, BookingSettings, CalendarItem, ConsultPage } from "./schedule-core";
import type { JoinInfo, ProviderId } from "./video/types";

/**
 * «مكتب المحامي» schedule server functions: the calendar, appointments and
 * consultations (status, notes, links, the lawyer's side of the video call)
 * and the office booking settings. Same guard as practice.ts: `run` checks
 * membership/role/read-only, cores filter by the verified workspace id.
 */

const runner = () => import("./run.server");
const core = () => import("./schedule-core");
const consult = () => import("./consult.server");

const byId = z.object({ workspaceId: wsId, id: uuid });

async function exec<T>(
  userId: string,
  workspaceId: string,
  write: boolean,
  fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

/* ------------------------------------------------------------------------ */
/* Calendar                                                                  */
/* ------------------------------------------------------------------------ */

export const getCalendar = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => calendarInput.parse(input))
  .handler(async ({ context, data }): Promise<CalendarItem[]> => {
    const { calendarCore } = await core();
    const { addDays, riyadhDayStart } = await import("./time");
    const from = new Date(riyadhDayStart(data.from)).toISOString();
    const to = new Date(riyadhDayStart(addDays(data.from, data.days))).toISOString();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      calendarCore(sql, access, { from, to, memberId: data.memberId }),
    );
  });

/* ------------------------------------------------------------------------ */
/* Appointments & consultations                                              */
/* ------------------------------------------------------------------------ */

export const listConsultations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        view: z.enum(["upcoming", "pending", "past", "all"]).default("upcoming"),
        q: z.string().trim().max(100).default(""),
        lawyerId: memberId.nullish(),
        page: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ConsultPage> => {
    const { listConsultationsCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      listConsultationsCore(sql, access, { view: data.view, q: data.q, lawyerId: data.lawyerId, page: data.page }),
    );
  });

export type VideoInfo = {
  /** Which provider the call uses right now. */
  provider: ProviderId;
  /** 'early' | 'open' | 'ended' against [start - 10 min, end + 30 min]. */
  window: "early" | "open" | "ended";
};

export type AppointmentView = Omit<AppointmentRow, never> & {
  private_notes: string | null;
  canHost: boolean;
  /** The client's link (/meet/<token>), for consultations. */
  meetUrl: string | null;
  video: VideoInfo | null;
};

async function times(f: Pick<AppointmentFields, "date" | "time" | "durationMinutes">) {
  const { riyadhToIso } = await import("./time");
  const startsAt = riyadhToIso(f.date, f.time);
  if (!startsAt) throw new Error("WS:invalid");
  return { startsAt, endsAt: new Date(Date.parse(startsAt) + f.durationMinutes * 60_000).toISOString() };
}

export const getAppointment = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }): Promise<AppointmentView> => {
    const { loadAppointmentCore, visibleAppointment } = await core();
    const { meetUrlFor } = await consult();
    const { providerFor } = await import("./video/index");
    const { joinWindowState } = await import("./video/types");
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      const row = await loadAppointmentCore(sql, access, data.id);
      const view = visibleAppointment(access, row);
      const video =
        row.mode === "video"
          ? { provider: providerFor(row).id, window: joinWindowState(row.starts_at, row.ends_at) }
          : null;
      return {
        ...view,
        meetUrl: row.kind === "consultation" ? meetUrlFor(row.id, row.meet_nonce) : null,
        video,
      };
    });
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const { workspaceId } = z.object({ workspaceId: wsId }).passthrough().parse(input);
    return { workspaceId, ...appointmentFields.parse(input), notify: z.object({ notify: z.boolean().default(true) }).parse(input).notify };
  })
  .handler(async ({ context, data }) => {
    const { createAppointmentCore, conflictsCore, loadAppointmentCore } = await core();
    const { newConsultIdentity, mailClient } = await consult();
    const t = await times(data);
    const ident = newConsultIdentity(data.mode);
    const isConsult = data.kind === "consultation";
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      const conflicts = await conflictsCore(sql, access, data.lawyerId, t.startsAt, t.endsAt);
      const { id } = await createAppointmentCore(sql, access, {
        id: ident.id,
        kind: data.kind,
        mode: data.mode,
        status: data.status,
        title: data.title,
        clientId: data.clientId,
        caseId: data.caseId,
        leadName: data.clientId ? null : data.leadName,
        leadPhone: data.clientId ? null : data.leadPhone,
        leadEmail: data.clientId ? null : data.leadEmail,
        lawyerId: data.lawyerId,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        location: data.location,
        videoRoom: ident.room,
        meetNonce: isConsult ? ident.nonce : null,
        meetTokenHash: isConsult ? ident.tokenHash : null,
      });
      let emailed = false;
      if (isConsult && data.status === "confirmed" && data.notify) {
        const row = await loadAppointmentCore(sql, access, id);
        emailed = await mailClient("confirmed", await clientEmail(sql, access, row), access.workspace, row);
      }
      return { id, conflicts, emailed };
    });
  });

/** The email to reach the consultation's client: the client record, else the lead's. */
async function clientEmail(sql: SqlTag, access: WorkspaceAccess, row: { client_id: string | null; lead_email: string | null }) {
  if (!row.client_id) return row.lead_email;
  const [c] = await sql<{ email: string | null }>`
    select email from law_clients where id = ${row.client_id} and workspace_id = ${access.workspace.id}
  `;
  return c?.email ?? row.lead_email;
}

export const updateAppointment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const { workspaceId, id } = byId.passthrough().parse(input);
    return { workspaceId, id, ...appointmentFields.parse(input) };
  })
  .handler(async ({ context, data }) => {
    const { updateAppointmentCore, conflictsCore } = await core();
    const { randomRoomName } = await import("./video/types");
    const t = await times(data);
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      await updateAppointmentCore(sql, access, data.id, {
        mode: data.mode,
        title: data.title,
        clientId: data.clientId,
        caseId: data.caseId,
        leadName: data.clientId ? null : data.leadName,
        leadPhone: data.clientId ? null : data.leadPhone,
        leadEmail: data.clientId ? null : data.leadEmail,
        lawyerId: data.lawyerId,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        location: data.location,
        videoRoom: data.mode === "video" ? randomRoomName() : null,
      });
      const conflicts = await conflictsCore(sql, access, data.lawyerId, t.startsAt, t.endsAt, data.id);
      return { ok: true, conflicts };
    });
  });

export const setAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    byId
      .extend({
        status: statusInput,
        reason: z.string().trim().max(300).nullish(),
        notify: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { setStatusCore, loadAppointmentCore } = await core();
    const { mailClient } = await consult();
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      const before = await loadAppointmentCore(sql, access, data.id);
      await setStatusCore(sql, access, data.id, data.status, data.reason ?? null);
      let emailed = false;
      const changed = before.status !== data.status;
      if (changed && data.notify && before.kind === "consultation") {
        const kind = data.status === "confirmed" ? "confirmed" : data.status === "cancelled" ? "cancelled" : null;
        if (kind) emailed = await mailClient(kind, await clientEmail(sql, access, before), access.workspace, before);
      }
      return { ok: true, emailed };
    });
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { deleteAppointmentCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteAppointmentCore(sql, access, data.id));
    return { ok: true };
  });

export const saveConsultNotes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ notes: z.string().max(8000) }).parse(input))
  .handler(async ({ context, data }) => {
    const { saveConsultNotesCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) =>
      saveConsultNotesCore(sql, access, data.id, data.notes),
    );
    return { ok: true };
  });

export const setExternalLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ url: z.string().max(600).nullish() }).parse(input))
  .handler(async ({ context, data }) => {
    const { setExternalUrlCore } = await core();
    const { validateExternalUrl } = await import("./video/external");
    const url = data.url ? validateExternalUrl(data.url) : null;
    if (data.url && !url) throw new Error("WS:invalid");
    await exec(context.userId, data.workspaceId, true, (sql, access) =>
      setExternalUrlCore(sql, access, data.id, url),
    );
    return { ok: true };
  });

export const rotateMeetLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { setMeetNonceCore } = await core();
    const { rotateMeet, meetUrlFor } = await consult();
    const { randomRoomName } = await import("./video/types");
    const next = rotateMeet(data.id);
    await exec(context.userId, data.workspaceId, true, (sql, access) =>
      setMeetNonceCore(sql, access, data.id, next.nonce, next.tokenHash, randomRoomName()),
    );
    return { url: meetUrlFor(data.id, next.nonce) };
  });

export const sendConsultReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { loadAppointmentCore } = await core();
    const { mailClient } = await consult();
    const { need } = await import("./practice-core");
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      need(access, "consult.manage");
      const row = await loadAppointmentCore(sql, access, data.id);
      const to = await clientEmail(sql, access, row);
      if (!to) return { emailed: false, reason: "no_email" as const };
      if (row.status !== "confirmed") return { emailed: false, reason: "status" as const };
      return { emailed: await mailClient("reminder", to, access.workspace, row), reason: null };
    });
  });

export const convertLead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { convertLeadCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) => convertLeadCore(sql, access, data.id));
  });

/* ------------------------------------------------------------------------ */
/* The lawyer's side of the video call                                       */
/* ------------------------------------------------------------------------ */

export type HostJoin = {
  workspaceId: string;
  office: string;
  title: string;
  clientName: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  window: "early" | "open" | "ended";
  join: JoinInfo | null;
  /** Why there is no join info. */
  blocked: null | "not_video" | "status" | "window" | "no_room";
  clientAdmitted: boolean;
  clientIdentity: string;
};

export const getHostJoin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: uuid, workspaceId: wsId.nullish() }).parse(input))
  .handler(async ({ context, data }): Promise<HostJoin> => {
    const { loadAppointmentCore } = await core();
    const { providerFor, roomOf } = await import("./video/index");
    const { joinWindowState } = await import("./video/types");
    const { canHostConsult } = await import("./permissions");
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { getSql } = await import("@/lib/db");
    // The call page opens from a bare consultation link: find its office,
    // then verify membership exactly like any other request.
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const sql = await getSql();
      const [r] = await sql<{ workspace_id: string }>`
        select a.workspace_id from law_appointments a
        join workspace_members m on m.workspace_id = a.workspace_id and m.user_id = ${context.userId}
        where a.id = ${data.id}
      `;
      if (!r) throw new WorkspaceError("not_found", 404);
      workspaceId = r.workspace_id;
    }
    return exec(context.userId, workspaceId, false, async (sql, access) => {
      const row = await loadAppointmentCore(sql, access, data.id);
      if (!canHostConsult(access.role, access.userId, row.lawyer_id)) throw new WorkspaceError("role");
      const window = joinWindowState(row.starts_at, row.ends_at);
      const base = {
        workspaceId: access.workspace.id,
        office: access.workspace.name,
        title: row.title,
        clientName: row.client_name ?? row.lead_name,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        window,
        clientAdmitted: Boolean(row.client_admitted_at),
        clientIdentity: `client:${row.id}`,
      };
      if (row.mode !== "video") return { ...base, join: null, blocked: "not_video" as const };
      if (row.status !== "confirmed") return { ...base, join: null, blocked: "status" as const };
      if (window !== "open") return { ...base, join: null, blocked: "window" as const };
      const provider = providerFor(row);
      const room = roomOf(provider, row);
      if (!room) return { ...base, join: null, blocked: "no_room" as const };
      const [me] = await sql<{ name: string }>`
        select coalesce(nullif(name, ''), email) as name from "user" where id = ${access.userId}
      `;
      const join = await provider.joinUrl(
        room,
        { role: "host", identity: `lawyer:${access.userId}`, name: me?.name ?? "المحامي", admitted: true },
        { endsAt: row.ends_at },
      );
      // Minting a LiveKit token is a join; link providers just hand out a URL.
      if (join.kind === "embed") {
        await sql`
          insert into workspace_events (workspace_id, actor_id, kind, detail)
          values (${access.workspace.id}, ${access.userId}, 'consult_join',
                  ${JSON.stringify({ id: row.id, role: "host", provider: provider.id })}::jsonb)
        `;
      }
      return { ...base, join, blocked: null };
    });
  });

/** Let the waiting client in (records it, then upgrades the live participant). */
export const admitClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { admitCore } = await core();
    const { providerFor, roomOf } = await import("./video/index");
    return exec(context.userId, data.workspaceId, true, async (sql, access) => {
      const row = await admitCore(sql, access, data.id);
      const provider = providerFor(row);
      const room = roomOf(provider, row);
      let live = false;
      if (room && provider.admit) {
        try {
          live = await provider.admit(room, `client:${row.id}`);
        } catch (err) {
          console.error("[law] admitting the client failed:", err);
          throw new Error("WS:video_unavailable");
        }
      }
      await sql`
        insert into workspace_events (workspace_id, actor_id, kind, detail)
        values (${access.workspace.id}, ${access.userId}, 'consult_admit', ${JSON.stringify({ id: row.id, live })}::jsonb)
      `;
      return { ok: true, live };
    });
  });

/* ------------------------------------------------------------------------ */
/* Booking settings                                                          */
/* ------------------------------------------------------------------------ */

export type BookingSettingsView = {
  settings: BookingSettings;
  slug: string;
  bookingUrl: string;
  planVideo: boolean;
  provider: "livekit" | "jitsi";
  canEdit: boolean;
};

export const getBookingSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<BookingSettingsView> => {
    const { getSettingsCore } = await core();
    const { bookingUrlFor } = await consult();
    const { planHas } = await import("@/lib/saas/plans");
    const { activeProviderId } = await import("./video/index");
    const { can } = await import("./permissions");
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      const s = await getSettingsCore(sql, access);
      return {
        ...s,
        bookingUrl: bookingUrlFor(s.slug),
        planVideo: planHas(access.workspace.plan, "videoSessions"),
        provider: activeProviderId(),
        canEdit: can(access.role, "settings.booking") && !access.lifecycle.readOnly,
      };
    });
  });

export const saveBookingSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const { workspaceId } = z.object({ workspaceId: wsId }).passthrough().parse(input);
    return { workspaceId, ...bookingSettingsFields.parse(input) };
  })
  .handler(async ({ context, data }) => {
    const { saveSettingsCore } = await core();
    const { workspaceId, ...s } = data;
    await exec(context.userId, workspaceId, true, (sql, access) => saveSettingsCore(sql, access, s));
    return { ok: true };
  });

export const setOfficeSlug = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, slug: slugField }).parse(input))
  .handler(async ({ context, data }) => {
    const { setSlugCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => setSlugCore(sql, access, data.slug));
    return { ok: true };
  });
