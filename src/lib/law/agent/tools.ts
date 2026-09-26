import { z } from "zod";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";
import {
  addNoteCore,
  addPaymentCore,
  createCaseCore,
  createClientCore,
  createHearingCore,
  createTaskCore,
  getCaseCore,
  getClientCore,
  homeCore,
  listCasesCore,
  listClientsCore,
  listTasksCore,
  membersCore,
  reportsCore,
  setCaseStageCore,
  setTaskDoneCore,
  updateCaseCore,
  updateClientCore,
} from "../practice-core.ts";
import { calendarCore, conflictsCore, createAppointmentCore, setStatusCore } from "../schedule-core.ts";
import { APPOINTMENT_STATUSES, CASE_STAGES, CASE_TYPES, CLIENT_KINDS, MODES } from "../options.ts";
import { caseFields, clientFields, hm, taskFields, ymd } from "../schemas.ts";

/**
 * The «مكتب المحامي» agent toolbox — **server-only**, shared by the in-app
 * assistant and the office MCP server so both can do exactly the same things.
 *
 * Every tool runs through the core functions with the caller's verified
 * `WorkspaceAccess`, so the role rules (`need(...)`) and tenant isolation that
 * guard the UI guard the agent too — the model can never do more than the
 * person it acts for. Tools that change data are flagged `write`: the in-app
 * assistant asks the person to confirm each one before it runs.
 *
 * Deleting is deliberately not a tool: destructive actions stay in the UI.
 * Money crosses the tool boundary in riyals (what people say) and is stored
 * in halalas.
 */

export type ToolCtx = { sql: SqlTag; access: WorkspaceAccess };

export type AgentTool = {
  name: string;
  /** Short Arabic label for the UI (tool cards, audit log). */
  title: string;
  /** For the model. */
  description: string;
  input: z.ZodObject<z.ZodRawShape>;
  write: boolean;
  run: (ctx: ToolCtx, args: Record<string, unknown>) => Promise<unknown>;
  /** One Arabic line describing what a write will do, for the confirm card. */
  summarize?: (args: Record<string, unknown>) => string;
};

const sar = (riyals: number) => Math.round(riyals * 100);
const riyals = z.number().min(0).max(1_000_000_000);
const id = z.string().uuid();
const page = z.number().int().min(1).max(1000).optional();

async function riyadhIso(date: string, time: string): Promise<string> {
  const { riyadhToIso } = await import("../time.ts");
  const iso = riyadhToIso(date, time);
  if (!iso) throw new Error("WS:invalid");
  return iso;
}

function tool<S extends z.ZodRawShape>(def: {
  name: string;
  title: string;
  description: string;
  input: S;
  write?: boolean;
  run: (ctx: ToolCtx, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
  summarize?: (args: z.infer<z.ZodObject<S>>) => string;
}): AgentTool {
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    input: z.object(def.input) as unknown as z.ZodObject<z.ZodRawShape>,
    write: def.write ?? false,
    run: def.run as AgentTool["run"],
    summarize: def.summarize as AgentTool["summarize"],
  };
}

export const AGENT_TOOLS: AgentTool[] = [
  /* ------------------------------ read -------------------------------- */
  tool({
    name: "office_overview",
    title: "نظرة على اليوم",
    description: "Today's agenda (hearings, appointments), my tasks, overdue tasks and headline counts for the office.",
    input: {},
    run: ({ sql, access }) => homeCore(sql, access),
  }),
  tool({
    name: "office_reports",
    title: "تقارير المكتب",
    description:
      "Financial and operational report: fees billed/collected/outstanding (halalas), collection rate, cases by stage, new cases per month, top clients by outstanding, hearings and appointments breakdown.",
    input: {},
    run: ({ sql, access }) => reportsCore(sql, access),
  }),
  tool({
    name: "list_members",
    title: "أعضاء الفريق",
    description: "Office members with their user_id, name and role. Use it to find a lawyer_id or assignee_id.",
    input: {},
    run: ({ sql, access }) => membersCore(sql, access),
  }),
  tool({
    name: "search_clients",
    title: "بحث في العملاء",
    description: "Search the office's clients by name, phone, email or ID number. Returns a page of clients with their id.",
    input: { query: z.string().max(100).optional(), kind: z.enum(CLIENT_KINDS).optional(), page },
    run: ({ sql, access }, a) => listClientsCore(sql, access, { q: a.query ?? "", kind: a.kind ?? null, page: a.page ?? 1 }),
  }),
  tool({
    name: "get_client",
    title: "ملف عميل",
    description: "Full client file: details, their cases and the notes timeline.",
    input: { client_id: id },
    run: ({ sql, access }, a) => getClientCore(sql, access, a.client_id),
  }),
  tool({
    name: "search_cases",
    title: "بحث في القضايا",
    description: "Search cases by title, reference number, court case number or opposing party; filter by stage or client.",
    input: {
      query: z.string().max(100).optional(),
      stage: z.enum(CASE_STAGES).optional(),
      client_id: id.optional(),
      page,
    },
    run: ({ sql, access }, a) =>
      listCasesCore(sql, access, { q: a.query ?? "", stage: a.stage ?? null, clientId: a.client_id ?? null, page: a.page ?? 1 }),
  }),
  tool({
    name: "get_case",
    title: "ملف قضية",
    description: "Full case file: details, fees (when the role may see them), lawyers, hearings, tasks and notes.",
    input: { case_id: id },
    run: ({ sql, access }, a) => getCaseCore(sql, access, a.case_id),
  }),
  tool({
    name: "list_tasks",
    title: "المهام",
    description: "Tasks: scope 'mine' (assigned to me), 'today', 'overdue' or 'all'.",
    input: { scope: z.enum(["mine", "today", "overdue", "all"]).default("mine"), include_done: z.boolean().optional() },
    run: ({ sql, access }, a) => listTasksCore(sql, access, { scope: a.scope, includeDone: a.include_done ?? false, limit: 50 }),
  }),
  tool({
    name: "list_calendar",
    title: "التقويم",
    description: "Hearings and appointments between a start date (YYYY-MM-DD, Riyadh) and a number of days (1–42).",
    input: { from: ymd, days: z.number().int().min(1).max(42).default(7) },
    run: async ({ sql, access }, a) => {
      const { addDays } = await import("../time.ts");
      return calendarCore(sql, access, { from: a.from, to: addDays(a.from, a.days) });
    },
  }),

  /* ------------------------------ write ------------------------------- */
  tool({
    name: "create_client",
    title: "إضافة عميل",
    description: "Add a new client (individual or company). Search first to avoid duplicates.",
    write: true,
    input: {
      kind: z.enum(CLIENT_KINDS).default("individual"),
      name: z.string().min(2).max(160),
      phone: z.string().max(30).optional(),
      email: z.string().max(200).optional(),
      id_number: z.string().max(20).optional(),
      notes: z.string().max(4000).optional(),
    },
    summarize: (a) => `إضافة العميل «${a.name}»${a.phone ? ` — ${a.phone}` : ""}`,
    run: ({ sql, access }, a) =>
      createClientCore(
        sql,
        access,
        clientFields.parse({ kind: a.kind, name: a.name, phone: a.phone, email: a.email, idNumber: a.id_number, notes: a.notes ?? "" }),
      ),
  }),
  tool({
    name: "update_client",
    title: "تعديل عميل",
    description: "Change some fields of an existing client. Only the fields you pass change.",
    write: true,
    input: {
      client_id: id,
      name: z.string().min(2).max(160).optional(),
      phone: z.string().max(30).optional(),
      email: z.string().max(200).optional(),
      id_number: z.string().max(20).optional(),
      notes: z.string().max(4000).optional(),
    },
    summarize: (a) => `تعديل بيانات العميل${a.name ? ` إلى «${a.name}»` : ""}`,
    run: async ({ sql, access }, a) => {
      const { client: c } = await getClientCore(sql, access, a.client_id);
      await updateClientCore(
        sql,
        access,
        a.client_id,
        clientFields.parse({
          kind: c.kind,
          name: a.name ?? c.name,
          phone: a.phone ?? c.phone ?? undefined,
          email: a.email ?? c.email ?? undefined,
          idNumber: a.id_number ?? c.id_number ?? undefined,
          notes: a.notes ?? c.notes,
          tags: c.tags,
        }),
      );
      return { ok: true, client_id: a.client_id };
    },
  }),
  tool({
    name: "create_case",
    title: "فتح قضية",
    description: "Open a new case. fees_sar is the agreed fee in Saudi riyals. lawyer_ids come from list_members.",
    write: true,
    input: {
      title: z.string().min(2).max(200),
      case_type: z.enum(CASE_TYPES),
      client_id: id.optional(),
      stage: z.enum(CASE_STAGES).optional(),
      court: z.string().max(160).optional(),
      opposing_party: z.string().max(200).optional(),
      description: z.string().max(4000).optional(),
      fees_sar: riyals.optional(),
      lawyer_ids: z.array(z.string().max(128)).max(10).optional(),
    },
    summarize: (a) => `فتح قضية «${a.title}»${a.fees_sar ? ` بأتعاب ${a.fees_sar.toLocaleString("en")} ر.س` : ""}`,
    run: ({ sql, access }, a) =>
      createCaseCore(
        sql,
        access,
        caseFields.parse({
          title: a.title,
          caseType: a.case_type,
          clientId: a.client_id ?? null,
          stage: a.stage,
          court: a.court ?? "",
          opposingParty: a.opposing_party ?? "",
          description: a.description ?? "",
          feesHalalas: a.fees_sar ? sar(a.fees_sar) : 0,
          lawyerIds: a.lawyer_ids ?? [],
        }),
      ),
  }),
  tool({
    name: "update_case",
    title: "تعديل قضية",
    description: "Change some fields of a case (title, court, court case number, opposing party, description, fee). Only the fields you pass change.",
    write: true,
    input: {
      case_id: id,
      title: z.string().min(2).max(200).optional(),
      court: z.string().max(160).optional(),
      court_case_no: z.string().max(60).optional(),
      opposing_party: z.string().max(200).optional(),
      description: z.string().max(4000).optional(),
      fees_sar: riyals.optional(),
    },
    summarize: (a) => `تعديل القضية${a.title ? ` «${a.title}»` : ""}`,
    run: async ({ sql, access }, a) => {
      const { case: k } = await getCaseCore(sql, access, a.case_id);
      await updateCaseCore(
        sql,
        access,
        a.case_id,
        caseFields.parse({
          title: a.title ?? k.title,
          clientId: k.client_id,
          caseType: k.case_type,
          stage: k.stage,
          court: a.court ?? k.court,
          courtCaseNo: a.court_case_no ?? k.court_case_no ?? undefined,
          opposingParty: a.opposing_party ?? k.opposing_party,
          description: a.description ?? k.description,
          feesHalalas: a.fees_sar !== undefined ? sar(a.fees_sar) : (k.fees_halalas ?? 0),
          paidHalalas: k.paid_halalas ?? 0,
          openedOn: k.opened_on ? String(k.opened_on).slice(0, 10) : null,
          lawyerIds: k.lawyers.map((l) => l.id),
        }),
      );
      return { ok: true, case_id: a.case_id };
    },
  }),
  tool({
    name: "set_case_stage",
    title: "نقل مرحلة القضية",
    description: "Move a case to another stage (logged on its timeline).",
    write: true,
    input: { case_id: id, stage: z.enum(CASE_STAGES) },
    summarize: (a) => `نقل القضية إلى مرحلة «${a.stage}»`,
    run: ({ sql, access }, a) => setCaseStageCore(sql, access, a.case_id, a.stage),
  }),
  tool({
    name: "record_payment",
    title: "تسجيل دفعة",
    description: "Record a fee payment received on a case, in Saudi riyals.",
    write: true,
    input: { case_id: id, amount_sar: riyals.refine((v) => v > 0, "positive") },
    summarize: (a) => `تسجيل دفعة ${a.amount_sar.toLocaleString("en")} ر.س على القضية`,
    run: ({ sql, access }, a) => addPaymentCore(sql, access, a.case_id, sar(a.amount_sar)),
  }),
  tool({
    name: "add_hearing",
    title: "إضافة جلسة",
    description: "Schedule a court hearing on a case. date YYYY-MM-DD and time HH:MM in Riyadh time.",
    write: true,
    input: {
      case_id: id,
      date: ymd,
      time: hm,
      duration_minutes: z.number().int().min(5).max(600).optional(),
      court: z.string().max(160).optional(),
      room: z.string().max(60).optional(),
    },
    summarize: (a) => `إضافة جلسة يوم ${a.date} الساعة ${a.time}`,
    run: async ({ sql, access }, a) =>
      createHearingCore(sql, access, a.case_id, {
        startsAt: await riyadhIso(a.date, a.time),
        durationMinutes: a.duration_minutes ?? 60,
        court: a.court ?? "",
        room: a.room ?? "",
        status: "scheduled",
        outcome: "",
      }),
  }),
  tool({
    name: "create_task",
    title: "إضافة مهمة",
    description: "Create a task, optionally on a case, with a due date (YYYY-MM-DD). assignee_id from list_members; defaults to the person asking.",
    write: true,
    input: {
      title: z.string().min(2).max(200),
      notes: z.string().max(2000).optional(),
      case_id: id.optional(),
      assignee_id: z.string().max(128).optional(),
      due_on: ymd.optional(),
    },
    summarize: (a) => `إضافة مهمة «${a.title}»${a.due_on ? ` مستحقة ${a.due_on}` : ""}`,
    run: ({ sql, access }, a) =>
      createTaskCore(
        sql,
        access,
        // No assignee named → the person asking owns it (it shows under «مهامي»).
        taskFields.parse({ title: a.title, notes: a.notes ?? "", caseId: a.case_id, assigneeId: a.assignee_id ?? access.userId, dueOn: a.due_on }),
      ),
  }),
  tool({
    name: "complete_task",
    title: "إنجاز مهمة",
    description: "Mark a task done (or reopen it with done=false).",
    write: true,
    input: { task_id: id, done: z.boolean().default(true) },
    summarize: (a) => (a.done ? "تعليم المهمة كمنجزة" : "إعادة فتح المهمة"),
    run: ({ sql, access }, a) => setTaskDoneCore(sql, access, a.task_id, a.done),
  }),
  tool({
    name: "add_note",
    title: "إضافة ملاحظة",
    description: "Add a note to a client's or a case's timeline.",
    write: true,
    input: { client_id: id.optional(), case_id: id.optional(), body: z.string().min(1).max(4000) },
    summarize: (a) => `إضافة ملاحظة: «${a.body.slice(0, 60)}${a.body.length > 60 ? "…" : ""}»`,
    run: ({ sql, access }, a) => {
      if (!a.client_id && !a.case_id) throw new Error("WS:invalid");
      return addNoteCore(sql, access, { clientId: a.client_id ?? null, caseId: a.case_id ?? null, body: a.body });
    },
  }),
  tool({
    name: "create_appointment",
    title: "حجز موعد",
    description:
      "Book an appointment or a consultation (video, in_office or phone) at a Riyadh date/time. A consultation needs a client_id or a lead_name. No email is sent to the client.",
    write: true,
    input: {
      kind: z.enum(["appointment", "consultation"]),
      mode: z.enum(MODES).default("in_office"),
      title: z.string().max(200).optional(),
      client_id: id.optional(),
      lead_name: z.string().max(120).optional(),
      lead_phone: z.string().max(30).optional(),
      lawyer_id: z.string().max(128).optional(),
      date: ymd,
      time: hm,
      duration_minutes: z.number().int().min(5).max(480).optional(),
    },
    summarize: (a) => `حجز ${a.kind === "consultation" ? "استشارة" : "موعد"} يوم ${a.date} الساعة ${a.time}`,
    run: async ({ sql, access }, a) => {
      if (a.kind === "consultation" && !a.client_id && !(a.lead_name && a.lead_name.length >= 2)) throw new Error("WS:invalid");
      const { newConsultIdentity } = await import("../consult.server.ts");
      const startsAt = await riyadhIso(a.date, a.time);
      const endsAt = new Date(Date.parse(startsAt) + (a.duration_minutes ?? 30) * 60_000).toISOString();
      const ident = newConsultIdentity(a.mode);
      const isConsult = a.kind === "consultation";
      const conflicts = await conflictsCore(sql, access, a.lawyer_id ?? null, startsAt, endsAt);
      const { id: apptId } = await createAppointmentCore(sql, access, {
        id: ident.id,
        kind: a.kind,
        mode: a.mode,
        status: "confirmed",
        title: a.title ?? "",
        clientId: a.client_id ?? null,
        caseId: null,
        leadName: a.client_id ? null : (a.lead_name ?? null),
        leadPhone: a.client_id ? null : (a.lead_phone ?? null),
        leadEmail: null,
        lawyerId: a.lawyer_id ?? null,
        startsAt,
        endsAt,
        location: "",
        videoRoom: ident.room,
        meetNonce: isConsult ? ident.nonce : null,
        meetTokenHash: isConsult ? ident.tokenHash : null,
      });
      return { id: apptId, conflicts };
    },
  }),
  tool({
    name: "set_appointment_status",
    title: "تحديث حالة موعد",
    description: "Change an appointment's status: confirmed, done, cancelled or no_show.",
    write: true,
    input: { appointment_id: id, status: z.enum(APPOINTMENT_STATUSES), reason: z.string().max(300).optional() },
    summarize: (a) => `تغيير حالة الموعد إلى «${a.status}»`,
    run: ({ sql, access }, a) => setStatusCore(sql, access, a.appointment_id, a.status, a.reason ?? null),
  }),
];

export const TOOL_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

/** JSON Schema for a tool's input (for OpenAI-style function calling). */
export function toolJsonSchema(t: AgentTool): Record<string, unknown> {
  const schema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** Validate then run a tool. Throws on bad input or a refused permission. */
export async function runTool(ctx: ToolCtx, name: string, rawArgs: unknown): Promise<unknown> {
  const t = TOOL_BY_NAME.get(name);
  if (!t) throw new Error(`unknown tool ${name}`);
  const args = t.input.parse(rawArgs ?? {});
  return t.run(ctx, args);
}
