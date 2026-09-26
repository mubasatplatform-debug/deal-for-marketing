/**
 * Sample data and the onboarding checklist for new offices — written against
 * a bare SQL tag (relative imports only) so node tests drive it on PGLite with
 * the real migrations, like practice-core.ts.
 *
 * Every row the seeder writes carries `is_demo = true` (migrations/0016), and
 * the clearer deletes ONLY such rows. Rules:
 *
 *   - Seeding is refused (`demo_exists`) while any demo row is left. The
 *     whole set goes in with ONE statement (data-modifying CTEs), so it is
 *     all-or-nothing even on a pooled connection without transactions.
 *   - Clearing is refused (`demo_in_use`) while any NON-demo row depends on
 *     a demo row — a real task, hearing, note, appointment or document on a
 *     demo case/client, or a real case filed under a demo client. Deleting
 *     would cascade into (or silently unlink) the office's own records, so
 *     the office moves or deletes those first. Automatic timeline events on a
 *     demo case (stage change, payment) inherit `is_demo` from the case, so
 *     simply trying the demo out never blocks clearing it.
 *   - Deletes run child-first (notes, tasks, hearings, appointments, cases —
 *     case lawyers cascade — then clients), each scoped by workspace and
 *     `is_demo`, so a partial failure is simply finished by clearing again.
 *   - The checklist counts real (non-demo) rows only.
 */
import { planHas } from "../saas/plans.ts";
import { WorkspaceError, type SqlTag, type WorkspaceAccess } from "../saas/tenancy-core.ts";
import type { CaseStage, CaseType, ClientKind } from "./options.ts";
import { addDays, riyadhAt, riyadhYmd, weekday } from "./time.ts";

/* ------------------------------------------------------------------------ */
/* The sample set (pure)                                                     */
/* ------------------------------------------------------------------------ */

type DemoClient = {
  id: string;
  kind: ClientKind;
  name: string;
  phone: string;
  email: string | null;
  notes: string;
  tags: string[];
};

type DemoCase = {
  id: string;
  n: number;
  title: string;
  client_id: string;
  case_type: CaseType;
  stage: CaseStage;
  court: string;
  court_case_no: string | null;
  opposing_party: string;
  description: string;
  fees_halalas: number;
  paid_halalas: number;
  opened_on: string;
};

type DemoHearing = { case_id: string; starts_at: string; duration_minutes: number; court: string; room: string };
type DemoTask = { case_id: string | null; title: string; notes: string; due_on: string; done: boolean };
type DemoAppointment = {
  kind: "appointment" | "consultation";
  mode: "video" | "in_office" | "phone";
  status: "pending" | "confirmed";
  title: string;
  client_id: string;
  case_id: string | null;
  starts_at: string;
  ends_at: string;
  location: string;
};
type DemoNote = { client_id: string | null; case_id: string | null; body: string; created_at: string };

export type DemoSet = {
  clients: DemoClient[];
  cases: DemoCase[];
  hearings: DemoHearing[];
  tasks: DemoTask[];
  appointments: DemoAppointment[];
  notes: DemoNote[];
};

/** The `k`-th Riyadh working day (Sunday–Thursday) after `ymd` (k >= 1). */
export function workingDayAfter(ymd: string, k: number): string {
  let d = ymd;
  let left = k;
  while (left > 0) {
    d = addDays(d, 1);
    const w = weekday(d);
    if (w !== 5 && w !== 6) left -= 1;
  }
  return d;
}

const iso = (ymd: string, hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return new Date(riyadhAt(ymd, h * 60 + m)).toISOString();
};

const sar = (riyals: number) => riyals * 100;

/**
 * Realistic Saudi sample data relative to `now`: hearings over the next two
 * weeks, appointments over the next working days, tasks due today and
 * overdue — all in Riyadh working hours. Names, numbers and phones are made
 * up (+9665000000xx), no real identity numbers.
 */
export function buildDemoSet(now: number, opts: { video: boolean }, uuid: () => string = () => crypto.randomUUID()): DemoSet {
  const today = riyadhYmd(now);
  const wd = (k: number) => workingDayAfter(today, k);

  const c1 = uuid();
  const c2 = uuid();
  const c3 = uuid();
  const c4 = uuid();
  const clients: DemoClient[] = [
    {
      id: c1,
      kind: "individual",
      name: "عبدالله محمد القحطاني",
      phone: "+966500000011",
      email: null,
      notes: "موظف سابق في شركة مقاولات، يطالب بمستحقات نهاية الخدمة.",
      tags: ["عمالي"],
    },
    {
      id: c2,
      kind: "company",
      name: "شركة الأفق للمقاولات",
      phone: "+966500000012",
      email: "legal@alofoq.example",
      notes: "عميل بعقد أتعاب سنوي. جهة التواصل: مدير الشؤون القانونية.",
      tags: ["شركات", "عقد سنوي"],
    },
    {
      id: c3,
      kind: "individual",
      name: "نورة سعد الدوسري",
      phone: "+966500000013",
      email: null,
      notes: "",
      tags: ["أحوال شخصية"],
    },
    {
      id: c4,
      kind: "company",
      name: "مؤسسة رواسي التجارية",
      phone: "+966500000014",
      email: "info@rawasi.example",
      notes: "مؤسسة تجزئة في حي العليا.",
      tags: ["شركات"],
    },
  ];

  const k1 = uuid();
  const k2 = uuid();
  const k3 = uuid();
  const k4 = uuid();
  const cases: DemoCase[] = [
    {
      id: k1,
      n: 1,
      title: "مطالبة بمستحقات نهاية الخدمة",
      client_id: c1,
      case_type: "labor",
      stage: "hearings",
      court: "المحكمة العمالية بالرياض",
      court_case_no: "4470019823",
      opposing_party: "شركة البناء الحديث",
      description: "مطالبة بمكافأة نهاية الخدمة وأجور ثلاثة أشهر متأخرة وبدل إجازات لم تُصرف.",
      fees_halalas: sar(15000),
      paid_halalas: sar(7500),
      opened_on: addDays(today, -40),
    },
    {
      id: k2,
      n: 2,
      title: "مطالبة بقيمة توريدات غير مسددة",
      client_id: c2,
      case_type: "commercial",
      stage: "filed",
      court: "المحكمة التجارية بالرياض",
      court_case_no: "4471102355",
      opposing_party: "مؤسسة الخليج للتوريدات",
      description: "توريد مواد بناء بقيمة 380,000 ريال بموجب أوامر شراء موقّعة، ولم يُسدَّد إلا جزء منها.",
      fees_halalas: sar(45000),
      paid_halalas: sar(15000),
      opened_on: addDays(today, -21),
    },
    {
      id: k3,
      n: 3,
      title: "دعوى نفقة وحضانة",
      client_id: c3,
      case_type: "family",
      stage: "study",
      court: "محكمة الأحوال الشخصية بالرياض",
      court_case_no: null,
      opposing_party: "",
      description: "دراسة المستندات وتجهيز صحيفة الدعوى.",
      fees_halalas: sar(12000),
      paid_halalas: sar(6000),
      opened_on: addDays(today, -7),
    },
    {
      id: k4,
      n: 4,
      title: "إخلاء عين مؤجرة ومطالبة بالأجرة",
      client_id: c4,
      case_type: "real_estate",
      stage: "hearings",
      court: "المحكمة العامة بالرياض",
      court_case_no: "4469087410",
      opposing_party: "المستأجر: مطعم النخبة",
      description: "تأخر المستأجر في سداد دفعتين من الإيجار، والمطالبة بالإخلاء وسداد المتأخرات.",
      fees_halalas: sar(18000),
      paid_halalas: sar(9000),
      opened_on: addDays(today, -60),
    },
  ];

  const hearings: DemoHearing[] = [
    { case_id: k1, starts_at: iso(wd(2), "09:00"), duration_minutes: 60, court: "المحكمة العمالية بالرياض", room: "الدائرة العمالية الثالثة" },
    { case_id: k2, starts_at: iso(wd(4), "10:30"), duration_minutes: 60, court: "المحكمة التجارية بالرياض", room: "الدائرة التجارية الخامسة" },
    { case_id: k4, starts_at: iso(wd(6), "11:00"), duration_minutes: 45, court: "المحكمة العامة بالرياض", room: "الدائرة العامة الثانية" },
    { case_id: k1, starts_at: iso(wd(9), "09:30"), duration_minutes: 60, court: "المحكمة العمالية بالرياض", room: "الدائرة العمالية الثالثة" },
  ];

  const tasks: DemoTask[] = [
    { case_id: k1, title: "تجهيز مذكرة الرد على دفوع المدعى عليه", notes: "إرفاق كشف الرواتب وشهادة الخبرة.", due_on: today, done: false },
    { case_id: k2, title: "طلب كشف حساب مصدّق من العميل", notes: "", due_on: today, done: false },
    { case_id: k4, title: "رفع صورة عقد الإيجار الموحد في ملف القضية", notes: "", due_on: addDays(today, -2), done: false },
    { case_id: k3, title: "مراجعة صك الطلاق وشهادات الميلاد", notes: "", due_on: wd(3), done: false },
    { case_id: null, title: "تجديد اشتراك المكتب في منصة ناجز", notes: "", due_on: addDays(today, -5), done: true },
  ];

  const start1 = wd(1);
  const start2 = wd(2);
  const start3 = wd(3);
  const appointments: DemoAppointment[] = [
    {
      kind: "consultation",
      mode: opts.video ? "video" : "phone",
      status: "confirmed",
      title: "استشارة في فسخ عقد توريد",
      client_id: c2,
      case_id: null,
      starts_at: iso(start1, "11:00"),
      ends_at: iso(start1, "11:30"),
      location: "",
    },
    {
      kind: "appointment",
      mode: "in_office",
      status: "confirmed",
      title: "مراجعة مستندات القضية مع العميل",
      client_id: c1,
      case_id: k1,
      starts_at: iso(start2, "13:00"),
      ends_at: iso(start2, "13:45"),
      location: "مقر المكتب",
    },
    {
      kind: "consultation",
      mode: "in_office",
      status: "pending",
      title: "استشارة في إجراءات الحضانة",
      client_id: c3,
      case_id: null,
      starts_at: iso(start3, "12:00"),
      ends_at: iso(start3, "12:30"),
      location: "مقر المكتب",
    },
  ];

  const notes: DemoNote[] = [
    {
      client_id: c1,
      case_id: k1,
      body: "حضر العميل وسلّم نسخة من عقد العمل ومسيرات الرواتب. طلب الخصم تأجيل الجلسة الماضية لتقديم مذكرة.",
      created_at: new Date(now - 3 * 86_400_000).toISOString(),
    },
    {
      client_id: c2,
      case_id: k2,
      body: "تم قيد الدعوى إلكترونيًا عبر ناجز، وبانتظار تحديد موعد الجلسة الأولى.",
      created_at: new Date(now - 86_400_000).toISOString(),
    },
  ];

  return { clients, cases, hearings, tasks, appointments, notes };
}

/* ------------------------------------------------------------------------ */
/* Queries                                                                   */
/* ------------------------------------------------------------------------ */

async function hasDemo(sql: SqlTag, ws: string): Promise<boolean> {
  const [r] = await sql<{ yes: boolean }>`
    select (exists (select 1 from law_clients where workspace_id = ${ws} and is_demo)
         or exists (select 1 from law_cases where workspace_id = ${ws} and is_demo)
         or exists (select 1 from law_hearings where workspace_id = ${ws} and is_demo)
         or exists (select 1 from law_tasks where workspace_id = ${ws} and is_demo)
         or exists (select 1 from law_appointments where workspace_id = ${ws} and is_demo)
         or exists (select 1 from law_notes where workspace_id = ${ws} and is_demo)) as yes
  `;
  return Boolean(r?.yes);
}

function manager(access: WorkspaceAccess) {
  if (access.role !== "owner" && access.role !== "admin") throw new WorkspaceError("role");
}

export type SeedResult = { clients: number; cases: number; hearings: number; tasks: number; appointments: number };

export async function seedDemoCore(sql: SqlTag, access: WorkspaceAccess, now = Date.now()): Promise<SeedResult> {
  manager(access);
  const ws = access.workspace.id;
  if (await hasDemo(sql, ws)) throw new WorkspaceError("demo_exists", 409);
  const set = buildDemoSet(now, { video: planHas(access.workspace.plan, "videoSessions") });
  const j = (v: unknown) => JSON.stringify(v);
  try {
    const rows = await sql<{ n: number }>`
      with guard as (
        select w.id from workspaces w
        where w.id = ${ws}
          and not exists (select 1 from law_clients where workspace_id = ${ws} and is_demo)
          and not exists (select 1 from law_cases where workspace_id = ${ws} and is_demo)
        for update
      ),
      base as (select coalesce(max(ref_no), 0) as ref from law_cases where workspace_id = ${ws}),
      cl as (
        insert into law_clients (id, workspace_id, kind, name, phone, email, notes, tags, created_by, is_demo)
        select x.id, g.id, x.kind, x.name, x.phone, x.email, x.notes, x.tags, ${access.userId}, true
        from guard g, jsonb_to_recordset(${j(set.clients)}::jsonb)
          as x(id uuid, kind text, name text, phone text, email text, notes text, tags text[])
        returning id
      ),
      ks as (
        insert into law_cases (id, workspace_id, ref_no, title, client_id, case_type, stage, court, court_case_no,
          opposing_party, description, fees_halalas, paid_halalas, opened_on, created_by, is_demo)
        select x.id, g.id, b.ref + x.n, x.title, x.client_id, x.case_type, x.stage, x.court, x.court_case_no,
               x.opposing_party, x.description, x.fees_halalas, x.paid_halalas, x.opened_on, ${access.userId}, true
        from guard g, base b, jsonb_to_recordset(${j(set.cases)}::jsonb)
          as x(id uuid, n int, title text, client_id uuid, case_type text, stage text, court text,
               court_case_no text, opposing_party text, description text, fees_halalas bigint,
               paid_halalas bigint, opened_on date)
        returning id
      ),
      lw as (
        insert into law_case_lawyers (workspace_id, case_id, user_id)
        select g.id, x.id, ${access.userId}
        from guard g, jsonb_to_recordset(${j(set.cases)}::jsonb) as x(id uuid)
      ),
      hs as (
        insert into law_hearings (workspace_id, case_id, starts_at, duration_minutes, court, room, created_by, is_demo)
        select g.id, x.case_id, x.starts_at, x.duration_minutes, x.court, x.room, ${access.userId}, true
        from guard g, jsonb_to_recordset(${j(set.hearings)}::jsonb)
          as x(case_id uuid, starts_at timestamptz, duration_minutes smallint, court text, room text)
        returning id
      ),
      ts as (
        insert into law_tasks (workspace_id, case_id, title, notes, assignee_id, due_on, done_at, done_by, created_by, is_demo)
        select g.id, x.case_id, x.title, x.notes, ${access.userId}, x.due_on,
               case when x.done then now() end, case when x.done then ${access.userId} end, ${access.userId}, true
        from guard g, jsonb_to_recordset(${j(set.tasks)}::jsonb)
          as x(case_id uuid, title text, notes text, due_on date, done boolean)
        returning id
      ),
      ap as (
        insert into law_appointments (workspace_id, kind, mode, status, source, title, client_id, case_id, lawyer_id,
          starts_at, ends_at, location, created_by, is_demo)
        select g.id, x.kind, x.mode, x.status, 'office', x.title, x.client_id, x.case_id, ${access.userId},
               x.starts_at, x.ends_at, x.location, ${access.userId}, true
        from guard g, jsonb_to_recordset(${j(set.appointments)}::jsonb)
          as x(kind text, mode text, status text, title text, client_id uuid, case_id uuid,
               starts_at timestamptz, ends_at timestamptz, location text)
        returning id
      ),
      nt as (
        insert into law_notes (workspace_id, client_id, case_id, kind, body, author_id, created_at, is_demo)
        select g.id, x.client_id, x.case_id, 'note', x.body, ${access.userId}, x.created_at, true
        from guard g, jsonb_to_recordset(${j(set.notes)}::jsonb)
          as x(client_id uuid, case_id uuid, body text, created_at timestamptz)
      ),
      ev as (
        insert into workspace_events (workspace_id, actor_id, kind, detail)
        select g.id, ${access.userId}, 'demo_seeded', '{}'::jsonb from guard g
      )
      select (select count(*) from cl)::int as n
    `;
    if (!rows[0] || Number(rows[0].n) === 0) throw new WorkspaceError("demo_exists", 409);
  } catch (err) {
    // A concurrent seed took the same case numbers first.
    if ((err as { code?: string }).code === "23505") throw new WorkspaceError("demo_exists", 409);
    throw err;
  }
  return {
    clients: set.clients.length,
    cases: set.cases.length,
    hearings: set.hearings.length,
    tasks: set.tasks.length,
    appointments: set.appointments.length,
  };
}

/** Non-demo rows that hang off demo rows (clearing would delete or unlink them). */
export async function demoBlockersCore(sql: SqlTag, access: WorkspaceAccess): Promise<number> {
  const ws = access.workspace.id;
  const [r] = await sql<{ n: number }>`
    with dk as (select id from law_cases where workspace_id = ${ws} and is_demo),
         dc as (select id from law_clients where workspace_id = ${ws} and is_demo)
    select (
      (select count(*) from law_cases where workspace_id = ${ws} and not is_demo and client_id in (select id from dc))
    + (select count(*) from law_tasks where workspace_id = ${ws} and not is_demo and case_id in (select id from dk))
    + (select count(*) from law_hearings where workspace_id = ${ws} and not is_demo and case_id in (select id from dk))
    + (select count(*) from law_notes where workspace_id = ${ws} and not is_demo
         and (case_id in (select id from dk) or client_id in (select id from dc)))
    + (select count(*) from law_appointments where workspace_id = ${ws} and not is_demo
         and (case_id in (select id from dk) or client_id in (select id from dc)))
    + (select count(*) from law_documents where workspace_id = ${ws}
         and (case_id in (select id from dk) or client_id in (select id from dc)))
    )::int as n
  `;
  return Number(r?.n ?? 0);
}

export type ClearResult = { clients: number; cases: number };

export async function clearDemoCore(sql: SqlTag, access: WorkspaceAccess): Promise<ClearResult> {
  manager(access);
  const ws = access.workspace.id;
  if ((await demoBlockersCore(sql, access)) > 0) throw new WorkspaceError("demo_in_use", 409);
  await sql`delete from law_notes where workspace_id = ${ws} and is_demo`;
  await sql`delete from law_tasks where workspace_id = ${ws} and is_demo`;
  await sql`delete from law_hearings where workspace_id = ${ws} and is_demo`;
  await sql`delete from law_appointments where workspace_id = ${ws} and is_demo`;
  // Case lawyers go with their case (on delete cascade). The guard in the
  // statement keeps a case with a real child that appeared meanwhile.
  const cases = await sql<{ id: string }>`
    delete from law_cases k where k.workspace_id = ${ws} and k.is_demo
      and not exists (select 1 from law_tasks t where t.case_id = k.id and not t.is_demo)
      and not exists (select 1 from law_hearings h where h.case_id = k.id and not h.is_demo)
      and not exists (select 1 from law_notes n where n.case_id = k.id and not n.is_demo)
      and not exists (select 1 from law_appointments a where a.case_id = k.id and not a.is_demo)
      and not exists (select 1 from law_documents d where d.case_id = k.id)
    returning id
  `;
  const clients = await sql<{ id: string }>`
    delete from law_clients c where c.workspace_id = ${ws} and c.is_demo
      and not exists (select 1 from law_cases k where k.client_id = c.id and k.workspace_id = c.workspace_id)
      and not exists (select 1 from law_notes n where n.client_id = c.id and not n.is_demo)
      and not exists (select 1 from law_appointments a where a.client_id = c.id and not a.is_demo)
      and not exists (select 1 from law_documents d where d.client_id = c.id)
    returning id
  `;
  await sql`
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (${ws}, ${access.userId}, 'demo_cleared',
            jsonb_build_object('clients', ${clients.length}::int, 'cases', ${cases.length}::int))
  `;
  return { clients: clients.length, cases: cases.length };
}

/* ------------------------------------------------------------------------ */
/* Onboarding checklist                                                      */
/* ------------------------------------------------------------------------ */

export type OnboardingState = {
  steps: {
    office: boolean;
    booking: boolean;
    client: boolean;
    case: boolean;
    team: boolean;
    twoStep: boolean;
  };
  hasDemo: boolean;
  /** Any real (non-demo) client or case — the demo offer only shows without. */
  hasRealData: boolean;
};

export async function onboardingCore(sql: SqlTag, access: WorkspaceAccess): Promise<OnboardingState> {
  const ws = access.workspace.id;
  const [[r], demo] = await Promise.all([
    sql<{
      office: boolean;
      booking: boolean;
      client: boolean;
      case: boolean;
      team: boolean;
      two_step: boolean;
    }>`
      select
        exists (select 1 from workspaces where id = ${ws} and city <> '' and cr_number is not null) as office,
        coalesce((select booking_enabled from law_office_settings where workspace_id = ${ws}), false) as booking,
        exists (select 1 from law_clients where workspace_id = ${ws} and not is_demo) as client,
        exists (select 1 from law_cases where workspace_id = ${ws} and not is_demo) as "case",
        ((select count(*) from workspace_members where workspace_id = ${ws}) > 1
          or exists (select 1 from workspace_invites where workspace_id = ${ws} and revoked_at is null)) as team,
        exists (select 1 from user_whatsapp_2fa where user_id = ${access.userId}) as two_step
    `,
    hasDemo(sql, ws),
  ]);
  const steps = {
    office: Boolean(r?.office),
    booking: Boolean(r?.booking),
    client: Boolean(r?.client),
    case: Boolean(r?.case),
    team: Boolean(r?.team),
    twoStep: Boolean(r?.two_step),
  };
  return { steps, hasDemo: demo, hasRealData: steps.client || steps.case };
}
