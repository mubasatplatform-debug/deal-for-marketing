import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { CASE_STAGES } from "./options";
import {
  caseFields,
  caseListInput,
  clientFields,
  clientListInput,
  hearingFields,
  noteFields,
  taskFields,
  uuid,
  wsId,
} from "./schemas";
import type { AppointmentRow } from "./schedule-core";
import type { DocumentRow } from "./documents-core";
import type {
  CaseDetail,
  CasePage,
  ClientDetail,
  ClientPage,
  HomeView,
  MemberOption,
  TaskRow,
} from "./practice-core";

/**
 * «مكتب المحامي» practice server functions: clients, cases, hearings, tasks,
 * notes and the home dashboard. Every handler goes through `run`
 * (run.server.ts): membership + role + read-only checked in the database,
 * then the core queries filter by the verified workspace id. Server-only
 * modules are imported inside handlers so they never reach the browser.
 */

const runner = () => import("./run.server");
const core = () => import("./practice-core");

const ws = z.object({ workspaceId: wsId });
const byId = z.object({ workspaceId: wsId, id: uuid });

async function exec<T>(
  userId: string,
  workspaceId: string,
  write: boolean,
  fn: (sql: import("@/lib/saas/tenancy-core").SqlTag, access: import("@/lib/saas/tenancy-core").WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

/* ------------------------------------------------------------------------ */
/* Home & members                                                            */
/* ------------------------------------------------------------------------ */

export const getLawHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<HomeView> => {
    const { homeCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => homeCore(sql, access));
  });

export const getLawMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<MemberOption[]> => {
    const { membersCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => membersCore(sql, access));
  });

/* ------------------------------------------------------------------------ */
/* Clients                                                                   */
/* ------------------------------------------------------------------------ */

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => clientListInput.parse(input))
  .handler(async ({ context, data }): Promise<ClientPage> => {
    const { listClientsCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      listClientsCore(sql, access, { q: data.q, kind: data.kind, tag: data.tag, page: data.page }),
    );
  });

export const pickClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, q: z.string().max(100).default("") }).parse(input))
  .handler(async ({ context, data }) => {
    const { pickClientsCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => pickClientsCore(sql, access, data.q));
  });

export type ClientProfile = ClientDetail & { appointments: AppointmentRow[]; documents: DocumentRow[] };

export const getClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }): Promise<ClientProfile> => {
    const { getClientCore } = await core();
    const { clientAppointmentsCore } = await import("./schedule-core");
    const { documentsForCore } = await import("./documents-core");
    const { can } = await import("./permissions");
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      const detail = await getClientCore(sql, access, data.id);
      const [appointments, documents] = await Promise.all([
        clientAppointmentsCore(sql, access, data.id),
        can(access.role, "document.view") ? documentsForCore(sql, access, { clientId: data.id }) : [],
      ]);
      return { ...detail, appointments, documents };
    });
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => clientFields.extend({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }) => {
    const { createClientCore } = await core();
    const { workspaceId, ...fields } = data;
    return exec(context.userId, workspaceId, true, (sql, access) => createClientCore(sql, access, fields));
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => clientFields.extend({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { updateClientCore } = await core();
    const { workspaceId, id, ...fields } = data;
    await exec(context.userId, workspaceId, true, (sql, access) => updateClientCore(sql, access, id, fields));
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { deleteClientCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteClientCore(sql, access, data.id));
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

export const listCases = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => caseListInput.parse(input))
  .handler(async ({ context, data }): Promise<CasePage> => {
    const { listCasesCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      listCasesCore(sql, access, {
        q: data.q,
        stage: data.stage,
        caseType: data.caseType,
        lawyerId: data.lawyerId,
        clientId: data.clientId,
        page: data.page,
      }),
    );
  });

export type CaseProfile = CaseDetail & { documents: DocumentRow[]; appointments: AppointmentRow[] };

export const getCase = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }): Promise<CaseProfile> => {
    const { getCaseCore } = await core();
    const { documentsForCore } = await import("./documents-core");
    return exec(context.userId, data.workspaceId, false, async (sql, access) => {
      const detail = await getCaseCore(sql, access, data.id);
      const documents = await documentsForCore(sql, access, { caseId: data.id });
      const appointments = await caseAppointments(sql, access.workspace.id, data.id);
      return { ...detail, documents, appointments };
    });
  });

async function caseAppointments(sql: import("@/lib/saas/tenancy-core").SqlTag, workspaceId: string, caseId: string) {
  const { plainRows } = await import("./rows");
  const rows = await sql<AppointmentRow>`
    select a.id, a.kind, a.mode, a.status, a.source, a.title, a.client_id, null::text as client_name, a.case_id,
           null::text as case_title, null::int as case_ref, a.lead_name, null::text as lead_phone, null::text as lead_email,
           a.lawyer_id, coalesce(nullif(u.name, ''), u.email) as lawyer_name, a.starts_at, a.ends_at, a.location,
           a.external_url, (a.video_room is not null) as has_room, a.client_admitted_at, a.cancel_reason, a.created_at
    from law_appointments a left join "user" u on u.id = a.lawyer_id
    where a.workspace_id = ${workspaceId} and a.case_id = ${caseId}
    order by a.starts_at desc limit 50
  `;
  return plainRows<AppointmentRow>(rows);
}

export const createCase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => caseFields.extend({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }) => {
    const { createCaseCore } = await core();
    const { workspaceId, ...fields } = data;
    return exec(context.userId, workspaceId, true, (sql, access) => createCaseCore(sql, access, fields));
  });

export const updateCase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => caseFields.extend({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { updateCaseCore } = await core();
    const { workspaceId, id, ...fields } = data;
    await exec(context.userId, workspaceId, true, (sql, access) => updateCaseCore(sql, access, id, fields));
    return { ok: true };
  });

export const setCaseStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ stage: z.enum(CASE_STAGES) }).parse(input))
  .handler(async ({ context, data }) => {
    const { setCaseStageCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) =>
      setCaseStageCore(sql, access, data.id, data.stage),
    );
    return { ok: true };
  });

export const addCasePayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    byId.extend({ amountHalalas: z.number().int().min(1).max(100_000_000_000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { addPaymentCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) =>
      addPaymentCore(sql, access, data.id, data.amountHalalas),
    );
    return { ok: true };
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { deleteCaseCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteCaseCore(sql, access, data.id));
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Hearings                                                                  */
/* ------------------------------------------------------------------------ */

async function hearingInput(h: z.infer<typeof hearingFields>) {
  const { riyadhToIso } = await import("./time");
  const startsAt = riyadhToIso(h.date, h.time);
  if (!startsAt) throw new Error("WS:invalid");
  return {
    startsAt,
    durationMinutes: h.durationMinutes,
    court: h.court,
    room: h.room,
    status: h.status,
    outcome: h.outcome,
  };
}

export const createHearing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => hearingFields.extend({ workspaceId: wsId, caseId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { createHearingCore } = await core();
    const h = await hearingInput(data);
    return exec(context.userId, data.workspaceId, true, (sql, access) =>
      createHearingCore(sql, access, data.caseId, h),
    );
  });

export const updateHearing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => hearingFields.extend({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { updateHearingCore } = await core();
    const h = await hearingInput(data);
    await exec(context.userId, data.workspaceId, true, (sql, access) => updateHearingCore(sql, access, data.id, h));
    return { ok: true };
  });

export const deleteHearing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { deleteHearingCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteHearingCore(sql, access, data.id));
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Tasks                                                                     */
/* ------------------------------------------------------------------------ */

export const listTasks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        scope: z.enum(["mine", "all", "overdue", "today"]).default("mine"),
        includeDone: z.boolean().default(false),
        caseId: uuid.nullish(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<TaskRow[]> => {
    const { listTasksCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      listTasksCore(sql, access, { scope: data.scope, includeDone: data.includeDone, caseId: data.caseId }),
    );
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => taskFields.extend({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }) => {
    const { createTaskCore } = await core();
    const { workspaceId, ...t } = data;
    return exec(context.userId, workspaceId, true, (sql, access) => createTaskCore(sql, access, t));
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => taskFields.extend({ workspaceId: wsId, id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { updateTaskCore } = await core();
    const { workspaceId, id, ...t } = data;
    await exec(context.userId, workspaceId, true, (sql, access) => updateTaskCore(sql, access, id, t));
    return { ok: true };
  });

export const setTaskDone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.extend({ done: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { setTaskDoneCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) =>
      setTaskDoneCore(sql, access, data.id, data.done),
    );
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { deleteTaskCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteTaskCore(sql, access, data.id));
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Notes                                                                     */
/* ------------------------------------------------------------------------ */

export const addNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ workspaceId: wsId }).passthrough().parse(input);
    return { workspaceId: parsed.workspaceId, ...noteFields.parse(input) };
  })
  .handler(async ({ context, data }) => {
    const { addNoteCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) =>
      addNoteCore(sql, access, { clientId: data.clientId, caseId: data.caseId, body: data.body }),
    );
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byId.parse(input))
  .handler(async ({ context, data }) => {
    const { deleteNoteCore } = await core();
    await exec(context.userId, data.workspaceId, true, (sql, access) => deleteNoteCore(sql, access, data.id));
    return { ok: true };
  });

