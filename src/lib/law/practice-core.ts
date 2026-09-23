/**
 * Practice core — clients, cases (lawyers, hearings, payments), tasks and the
 * notes timeline. Written against a bare SQL tag (relative imports only) so
 * node tests drive it on PGLite with the real migrations, like
 * saas/tenancy-core.ts.
 *
 * Tenant rule: every function takes a `WorkspaceAccess` from
 * `resolveMembership` (membership + role verified in the database) and every
 * query filters by `access.workspace.id` — never by an id from the browser.
 * Ids of rows (client, case, task…) are always matched together with the
 * workspace id, so another office's id behaves exactly like an unknown one
 * (404), and the composite foreign keys in 0010 make cross-office links
 * impossible even if a query were wrong.
 */
import type { Role } from "../saas/lifecycle.ts";
import { UUID_RE, WorkspaceError, type SqlTag, type WorkspaceAccess } from "../saas/tenancy-core.ts";
import { CASE_STAGE_LABELS, type CaseStage, type CaseType, type ClientKind, type HearingStatus } from "./options.ts";
import { can, canDeleteNote, canEditTask, type Action } from "./permissions.ts";
import { PAGE_SIZE, likeEscape, plain, plainRows } from "./rows.ts";
import type { CaseFields, ClientFields } from "./schemas.ts";
import { addDays, riyadhDayStart, riyadhYmd } from "./time.ts";

export function need(access: WorkspaceAccess, action: Action): void {
  if (!can(access.role, action)) throw new WorkspaceError("role");
}

function notFound(): never {
  throw new WorkspaceError("not_found", 404);
}

function checkId(id: string): void {
  if (!UUID_RE.test(id)) notFound();
}

async function logEvent(sql: SqlTag, access: WorkspaceAccess, kind: string, detail: Record<string, unknown>) {
  await sql`
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (${access.workspace.id}, ${access.userId}, ${kind}, ${JSON.stringify(detail)}::jsonb)
  `;
}

/* ------------------------------------------------------------------------ */
/* Members (pickers)                                                         */
/* ------------------------------------------------------------------------ */

export type MemberOption = { user_id: string; name: string; role: Role };

export async function membersCore(sql: SqlTag, access: WorkspaceAccess): Promise<MemberOption[]> {
  return sql<MemberOption>`
    select m.user_id, coalesce(nullif(u.name, ''), u.email) as name, m.role
    from workspace_members m join "user" u on u.id = m.user_id
    where m.workspace_id = ${access.workspace.id}
    order by case m.role when 'owner' then 0 when 'admin' then 1 when 'lawyer' then 2 else 3 end, u.name
  `;
}

/** Throws `invalid` unless every id is a member of this office. */
async function assertMembers(sql: SqlTag, access: WorkspaceAccess, ids: string[]) {
  if (ids.length === 0) return;
  const [r] = await sql<{ n: number }>`
    select count(*)::int as n from workspace_members
    where workspace_id = ${access.workspace.id} and user_id = any(${ids}::text[])
  `;
  if ((r?.n ?? 0) !== ids.length) throw new WorkspaceError("invalid", 422);
}

async function assertClient(sql: SqlTag, access: WorkspaceAccess, clientId: string | null) {
  if (!clientId) return;
  checkId(clientId);
  const [r] = await sql<{ id: string }>`
    select id from law_clients where id = ${clientId} and workspace_id = ${access.workspace.id}
  `;
  if (!r) notFound();
}

async function assertCase(sql: SqlTag, access: WorkspaceAccess, caseId: string | null) {
  if (!caseId) return;
  checkId(caseId);
  const [r] = await sql<{ id: string }>`
    select id from law_cases where id = ${caseId} and workspace_id = ${access.workspace.id}
  `;
  if (!r) notFound();
}

export { assertCase, assertClient, assertMembers };

/* ------------------------------------------------------------------------ */
/* Clients                                                                   */
/* ------------------------------------------------------------------------ */

export type ClientRow = {
  id: string;
  kind: ClientKind;
  name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  open_cases: number;
};

export type ClientPage = { rows: ClientRow[]; total: number; page: number; pageSize: number; tags: string[] };

export async function listClientsCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: { q: string; kind?: ClientKind | null; tag?: string | null; page: number },
): Promise<ClientPage> {
  need(access, "client.view");
  const ws = access.workspace.id;
  const q = f.q.trim();
  const like = `%${likeEscape(q)}%`;
  const digits = q.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, "");
  const phoneLike = digits.length >= 4 ? `%${digits.replace(/^0+/, "")}%` : null;
  const offset = (f.page - 1) * PAGE_SIZE;
  const [rows, tags] = await Promise.all([
    sql<ClientRow & { total: number }>`
      select c.id, c.kind, c.name, c.phone, c.email, c.id_number, c.notes, c.tags, c.created_at, c.updated_at,
             (select count(*)::int from law_cases k
               where k.workspace_id = c.workspace_id and k.client_id = c.id and k.stage <> 'closed') as open_cases,
             count(*) over ()::int as total
      from law_clients c
      where c.workspace_id = ${ws}
        and (${q} = '' or c.name ilike ${like} or c.email ilike ${like}
             or (${phoneLike}::text is not null and c.phone like ${phoneLike})
             or c.id_number = ${digits})
        and (${f.kind ?? null}::text is null or c.kind = ${f.kind ?? null})
        and (${f.tag ?? null}::text is null or ${f.tag ?? null} = any(c.tags))
      order by c.updated_at desc, c.id
      limit ${PAGE_SIZE} offset ${offset}
    `,
    sql<{ tag: string }>`
      select distinct t as tag from law_clients c, unnest(c.tags) t
      where c.workspace_id = ${ws} order by t limit 100
    `,
  ]);
  const total = rows[0]?.total ?? 0;
  return {
    rows: plainRows<ClientRow & { total?: number }>(rows).map(({ total: _t, ...r }) => r),
    total: Number(total),
    page: f.page,
    pageSize: PAGE_SIZE,
    tags: tags.map((t) => t.tag),
  };
}

/** Lightweight list for pickers (name search, 20 rows). */
export async function pickClientsCore(sql: SqlTag, access: WorkspaceAccess, q: string) {
  need(access, "client.view");
  const like = `%${likeEscape(q.trim())}%`;
  return sql<{ id: string; name: string; phone: string | null }>`
    select id, name, phone from law_clients
    where workspace_id = ${access.workspace.id} and (${q.trim()} = '' or name ilike ${like})
    order by updated_at desc limit 20
  `;
}

export async function createClientCore(sql: SqlTag, access: WorkspaceAccess, input: ClientFields) {
  need(access, "client.create");
  const [r] = await sql<{ id: string }>`
    with ins as (
      insert into law_clients (workspace_id, kind, name, phone, email, id_number, notes, tags, created_by)
      values (${access.workspace.id}, ${input.kind}, ${input.name}, ${input.phone}, ${input.email},
              ${input.idNumber}, ${input.notes}, ${input.tags}::text[], ${access.userId})
      returning id
    ),
    ev as (
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select ${access.workspace.id}, ${access.userId}, 'client_created', jsonb_build_object('id', id) from ins
    )
    select id from ins
  `;
  return { id: r.id };
}

export async function updateClientCore(sql: SqlTag, access: WorkspaceAccess, id: string, input: ClientFields) {
  need(access, "client.edit");
  checkId(id);
  const rows = await sql<{ id: string }>`
    update law_clients set kind = ${input.kind}, name = ${input.name}, phone = ${input.phone},
      email = ${input.email}, id_number = ${input.idNumber}, notes = ${input.notes},
      tags = ${input.tags}::text[], updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
    returning id
  `;
  if (!rows[0]) notFound();
}

export async function deleteClientCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  need(access, "client.delete");
  checkId(id);
  const ws = access.workspace.id;
  const [links] = await sql<{ n: number }>`
    select ((select count(*) from law_cases where workspace_id = ${ws} and client_id = ${id})
          + (select count(*) from law_documents where workspace_id = ${ws} and client_id = ${id}))::int as n
  `;
  if ((links?.n ?? 0) > 0) throw new WorkspaceError("has_records", 409);
  const rows = await sql<{ id: string; name: string }>`
    delete from law_clients where id = ${id} and workspace_id = ${ws} returning id, name
  `;
  if (!rows[0]) notFound();
  await logEvent(sql, access, "client_deleted", { id, name: rows[0].name });
}

export type NoteRow = {
  id: string;
  kind: "note" | "event";
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  case_id: string | null;
};

export type ClientCaseRow = {
  id: string;
  ref_no: number;
  title: string;
  case_type: CaseType;
  stage: CaseStage;
  updated_at: string;
};

export type ClientDetail = {
  client: ClientRow;
  cases: ClientCaseRow[];
  notes: NoteRow[];
};

export async function getClientCore(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<ClientDetail> {
  need(access, "client.view");
  checkId(id);
  const ws = access.workspace.id;
  const [client] = await sql<ClientRow>`
    select c.id, c.kind, c.name, c.phone, c.email, c.id_number, c.notes, c.tags, c.created_at, c.updated_at,
           (select count(*)::int from law_cases k where k.workspace_id = c.workspace_id and k.client_id = c.id
              and k.stage <> 'closed') as open_cases
    from law_clients c where c.id = ${id} and c.workspace_id = ${ws}
  `;
  if (!client) notFound();
  const [cases, notes] = await Promise.all([
    sql<ClientCaseRow>`
      select id, ref_no, title, case_type, stage, updated_at from law_cases
      where workspace_id = ${ws} and client_id = ${id} order by updated_at desc limit 100
    `,
    notesFor(sql, ws, { clientId: id }),
  ]);
  return { client: plain(client), cases: plainRows(cases), notes };
}

async function notesFor(sql: SqlTag, ws: string, t: { clientId?: string; caseId?: string }) {
  const rows = await sql<NoteRow>`
    select n.id, n.kind, n.body, n.author_id, coalesce(nullif(u.name, ''), u.email) as author_name,
           n.created_at, n.case_id
    from law_notes n left join "user" u on u.id = n.author_id
    where n.workspace_id = ${ws}
      and (${t.clientId ?? null}::uuid is null or n.client_id = ${t.clientId ?? null})
      and (${t.caseId ?? null}::uuid is null or n.case_id = ${t.caseId ?? null})
    order by n.created_at desc limit 200
  `;
  return plainRows<NoteRow>(rows);
}

/* ------------------------------------------------------------------------ */
/* Notes                                                                     */
/* ------------------------------------------------------------------------ */

export async function addNoteCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  input: { clientId: string | null; caseId: string | null; body: string },
) {
  need(access, "note.create");
  await assertClient(sql, access, input.clientId);
  await assertCase(sql, access, input.caseId);
  const [r] = await sql<{ id: string }>`
    insert into law_notes (workspace_id, client_id, case_id, kind, body, author_id)
    values (${access.workspace.id}, ${input.clientId}, ${input.caseId}, 'note', ${input.body}, ${access.userId})
    returning id
  `;
  return { id: r.id };
}

export async function deleteNoteCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  checkId(id);
  const [n] = await sql<{ author_id: string | null; kind: string }>`
    select author_id, kind from law_notes where id = ${id} and workspace_id = ${access.workspace.id}
  `;
  if (!n) notFound();
  if (n.kind !== "note" || !canDeleteNote(access.role, access.userId, n.author_id)) {
    throw new WorkspaceError("role");
  }
  await sql`delete from law_notes where id = ${id} and workspace_id = ${access.workspace.id}`;
}

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

export type LawyerRef = { id: string; name: string };

export type CaseRow = {
  id: string;
  ref_no: number;
  title: string;
  case_type: CaseType;
  stage: CaseStage;
  court: string;
  court_case_no: string | null;
  opposing_party: string;
  description: string;
  client_id: string | null;
  client_name: string | null;
  /** Null for roles that may not see fees. */
  fees_halalas: number | null;
  paid_halalas: number | null;
  opened_on: string;
  closed_on: string | null;
  updated_at: string;
  created_at: string;
  next_hearing: string | null;
  lawyers: LawyerRef[];
};

export type CasePage = {
  rows: CaseRow[];
  total: number;
  page: number;
  pageSize: number;
  stages: Record<string, number>;
};

function stripFees<T extends { fees_halalas: number | null; paid_halalas: number | null }>(
  access: WorkspaceAccess,
  r: T,
): T {
  if (can(access.role, "case.fees.view")) return r;
  return { ...r, fees_halalas: null, paid_halalas: null };
}

const CASE_SELECT = `
  select k.id, k.ref_no, k.title, k.case_type, k.stage, k.court, k.court_case_no, k.opposing_party,
         k.description, k.client_id, c.name as client_name, k.fees_halalas, k.paid_halalas,
         k.opened_on, k.closed_on, k.updated_at, k.created_at,
         (select min(h.starts_at) from law_hearings h
           where h.case_id = k.id and h.status = 'scheduled' and h.starts_at >= now()) as next_hearing,
         coalesce((select json_agg(json_build_object('id', u.id, 'name', coalesce(nullif(u.name, ''), u.email))
                                   order by u.name)
                   from law_case_lawyers cl join "user" u on u.id = cl.user_id
                   where cl.case_id = k.id), '[]'::json) as lawyers`;

export async function listCasesCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: {
    q: string;
    stage?: CaseStage | null;
    caseType?: CaseType | null;
    lawyerId?: string | null;
    clientId?: string | null;
    page: number;
  },
): Promise<CasePage> {
  need(access, "case.view");
  const ws = access.workspace.id;
  const q = f.q.trim();
  const like = `%${likeEscape(q)}%`;
  const refNo = /^\d{1,9}$/.test(q) ? Number(q) : null;
  const offset = (f.page - 1) * PAGE_SIZE;
  const clientId = f.clientId && UUID_RE.test(f.clientId) ? f.clientId : null;
  const [rows, stages] = await Promise.all([
    sql.query<CaseRow & { total: number }>(
      `${CASE_SELECT}, count(*) over ()::int as total
       from law_cases k left join law_clients c on c.id = k.client_id and c.workspace_id = k.workspace_id
       where k.workspace_id = $1
         and ($2 = '' or k.title ilike $3 or c.name ilike $3 or k.court_case_no ilike $3
              or k.opposing_party ilike $3 or k.ref_no = $4)
         and ($5::text is null or k.stage = $5)
         and ($6::text is null or k.case_type = $6)
         and ($7::text is null or exists (select 1 from law_case_lawyers cl where cl.case_id = k.id and cl.user_id = $7))
         and ($8::uuid is null or k.client_id = $8)
       order by (k.stage = 'closed'), k.updated_at desc, k.id
       limit ${PAGE_SIZE} offset $9`,
      [ws, q, like, refNo, f.stage ?? null, f.caseType ?? null, f.lawyerId ?? null, clientId, offset],
    ),
    sql<{ stage: string; n: number }>`
      select stage, count(*)::int as n from law_cases where workspace_id = ${ws} group by stage
    `,
  ]);
  return {
    rows: plainRows<CaseRow & { total?: number }>(rows).map(({ total: _t, ...r }) => stripFees(access, r)),
    total: Number(rows[0]?.total ?? 0),
    page: f.page,
    pageSize: PAGE_SIZE,
    stages: Object.fromEntries(stages.map((s) => [s.stage, Number(s.n)])),
  };
}

export async function createCaseCore(sql: SqlTag, access: WorkspaceAccess, input: CaseFields) {
  need(access, "case.create");
  await assertClient(sql, access, input.clientId);
  await assertMembers(sql, access, input.lawyerIds);
  const ws = access.workspace.id;
  const opened = input.openedOn ?? riyadhYmd();
  // ref_no is max+1 per office; a concurrent insert trips the unique key and
  // the statement is simply retried.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const [r] = await sql<{ id: string; ref_no: number }>`
        with ins as (
          insert into law_cases (workspace_id, ref_no, title, client_id, case_type, stage, court, court_case_no,
            opposing_party, description, fees_halalas, paid_halalas, opened_on, closed_on, created_by)
          select ${ws}, coalesce(max(ref_no), 0) + 1, ${input.title}, ${input.clientId}, ${input.caseType},
                 ${input.stage}, ${input.court}, ${input.courtCaseNo}, ${input.opposingParty}, ${input.description},
                 ${input.feesHalalas}, ${input.paidHalalas}, ${opened}::date,
                 case when ${input.stage} = 'closed' then ${riyadhYmd()}::date else null end, ${access.userId}
          from law_cases where workspace_id = ${ws}
          returning id, ref_no
        ),
        lw as (
          insert into law_case_lawyers (workspace_id, case_id, user_id)
          select ${ws}, ins.id, u from ins, unnest(${input.lawyerIds}::text[]) u
        ),
        ev as (
          insert into workspace_events (workspace_id, actor_id, kind, detail)
          select ${ws}, ${access.userId}, 'case_created', jsonb_build_object('id', id, 'ref', ref_no) from ins
        )
        select id, ref_no from ins
      `;
      return { id: r.id, refNo: Number(r.ref_no) };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505" && attempt < 3) continue;
      throw err;
    }
  }
}

export async function updateCaseCore(sql: SqlTag, access: WorkspaceAccess, id: string, input: CaseFields) {
  need(access, "case.edit");
  checkId(id);
  await assertClient(sql, access, input.clientId);
  await assertMembers(sql, access, input.lawyerIds);
  const ws = access.workspace.id;
  // Fees are only written by roles that can see them (the edit role already can).
  const rows = await sql<{ id: string; old_stage: CaseStage; stage: CaseStage }>`
    with upd as (
      update law_cases k set title = ${input.title}, client_id = ${input.clientId}, case_type = ${input.caseType},
        stage = ${input.stage}, court = ${input.court}, court_case_no = ${input.courtCaseNo},
        opposing_party = ${input.opposingParty}, description = ${input.description},
        fees_halalas = ${input.feesHalalas}, paid_halalas = ${input.paidHalalas},
        opened_on = coalesce(${input.openedOn}::date, k.opened_on),
        closed_on = case when ${input.stage} = 'closed' then coalesce(k.closed_on, ${riyadhYmd()}::date) else null end,
        updated_at = now()
      from (select id, stage from law_cases where id = ${id} and workspace_id = ${ws}) old
      where k.id = old.id
      returning k.id, old.stage as old_stage, k.stage
    ),
    del as (
      delete from law_case_lawyers cl using upd
      where cl.case_id = upd.id and not (cl.user_id = any(${input.lawyerIds}::text[]))
    ),
    ins as (
      insert into law_case_lawyers (workspace_id, case_id, user_id)
      select ${ws}, upd.id, u from upd, unnest(${input.lawyerIds}::text[]) u
      on conflict do nothing
    ),
    note as (
      insert into law_notes (workspace_id, case_id, kind, body, author_id)
      select ${ws}, upd.id, 'event', ${`نُقلت القضية إلى مرحلة «${CASE_STAGE_LABELS[input.stage]}»`}, ${access.userId}
      from upd where upd.old_stage <> upd.stage
    )
    select * from upd
  `;
  if (!rows[0]) notFound();
  await logEvent(sql, access, "case_updated", { id, stage: rows[0].stage });
}

export async function setCaseStageCore(sql: SqlTag, access: WorkspaceAccess, id: string, stage: CaseStage) {
  need(access, "case.edit");
  checkId(id);
  const ws = access.workspace.id;
  const rows = await sql<{ id: string; old_stage: string }>`
    with upd as (
      update law_cases k set stage = ${stage},
        closed_on = case when ${stage} = 'closed' then coalesce(k.closed_on, ${riyadhYmd()}::date) else null end,
        updated_at = now()
      from (select id, stage from law_cases where id = ${id} and workspace_id = ${ws}) old
      where k.id = old.id
      returning k.id, old.stage as old_stage
    ),
    note as (
      insert into law_notes (workspace_id, case_id, kind, body, author_id)
      select ${ws}, upd.id, 'event', ${`نُقلت القضية إلى مرحلة «${CASE_STAGE_LABELS[stage]}»`}, ${access.userId}
      from upd where upd.old_stage <> ${stage}
    )
    select * from upd
  `;
  if (!rows[0]) notFound();
  await logEvent(sql, access, "case_stage", { id, from: rows[0].old_stage, to: stage });
}

export async function addPaymentCore(sql: SqlTag, access: WorkspaceAccess, id: string, amount: number) {
  need(access, "case.edit");
  need(access, "case.fees.view");
  checkId(id);
  if (!Number.isInteger(amount) || amount <= 0) throw new WorkspaceError("invalid", 422);
  const ws = access.workspace.id;
  const riyals = (amount / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const rows = await sql<{ id: string }>`
    with upd as (
      update law_cases set paid_halalas = paid_halalas + ${amount}, updated_at = now()
      where id = ${id} and workspace_id = ${ws} and paid_halalas + ${amount} <= 100000000000
      returning id
    ),
    note as (
      insert into law_notes (workspace_id, case_id, kind, body, author_id)
      select ${ws}, upd.id, 'event', ${`سُجّلت دفعة بمبلغ ${riyals} ر.س`}, ${access.userId} from upd
    ),
    ev as (
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select ${ws}, ${access.userId}, 'case_payment', jsonb_build_object('id', upd.id, 'halalas', ${amount}::bigint) from upd
    )
    select id from upd
  `;
  if (!rows[0]) notFound();
}

export async function deleteCaseCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  need(access, "case.delete");
  checkId(id);
  const rows = await sql<{ id: string; ref_no: number; title: string }>`
    delete from law_cases where id = ${id} and workspace_id = ${access.workspace.id} returning id, ref_no, title
  `;
  if (!rows[0]) notFound();
  await logEvent(sql, access, "case_deleted", { id, ref: Number(rows[0].ref_no), title: rows[0].title });
}

export type HearingRow = {
  id: string;
  case_id: string;
  starts_at: string;
  duration_minutes: number;
  court: string;
  room: string;
  status: HearingStatus;
  outcome: string;
};

export type TaskRow = {
  id: string;
  title: string;
  notes: string;
  case_id: string | null;
  case_title: string | null;
  case_ref: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  due_on: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type CaseDetail = {
  case: CaseRow;
  hearings: HearingRow[];
  tasks: TaskRow[];
  notes: NoteRow[];
};

export async function getCaseCore(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<CaseDetail> {
  need(access, "case.view");
  checkId(id);
  const ws = access.workspace.id;
  const [row] = await sql.query<CaseRow>(
    `${CASE_SELECT}
     from law_cases k left join law_clients c on c.id = k.client_id and c.workspace_id = k.workspace_id
     where k.id = $1 and k.workspace_id = $2`,
    [id, ws],
  );
  if (!row) notFound();
  const [hearings, tasks, notes] = await Promise.all([
    sql<HearingRow>`
      select id, case_id, starts_at, duration_minutes, court, room, status, outcome
      from law_hearings where workspace_id = ${ws} and case_id = ${id} order by starts_at desc
    `,
    listTasksCore(sql, access, { scope: "all", caseId: id, includeDone: true }),
    notesFor(sql, ws, { caseId: id }),
  ]);
  return { case: stripFees(access, plain<CaseRow>(row)), hearings: plainRows(hearings), tasks, notes };
}

/* ------------------------------------------------------------------------ */
/* Hearings                                                                  */
/* ------------------------------------------------------------------------ */

export type HearingInput = {
  startsAt: string;
  durationMinutes: number;
  court: string;
  room: string;
  status: HearingStatus;
  outcome: string;
};

export async function createHearingCore(sql: SqlTag, access: WorkspaceAccess, caseId: string, h: HearingInput) {
  need(access, "hearing.manage");
  checkId(caseId);
  const ws = access.workspace.id;
  const rows = await sql<{ id: string }>`
    with ins as (
      insert into law_hearings (workspace_id, case_id, starts_at, duration_minutes, court, room, status, outcome, created_by)
      select ${ws}, k.id, ${h.startsAt}::timestamptz, ${h.durationMinutes}, ${h.court}, ${h.room}, ${h.status},
             ${h.outcome}, ${access.userId}
      from law_cases k where k.id = ${caseId} and k.workspace_id = ${ws}
      returning id, case_id
    ),
    touch as (update law_cases set updated_at = now() where id = (select case_id from ins)),
    ev as (
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select ${ws}, ${access.userId}, 'hearing_created', jsonb_build_object('id', id, 'case', case_id) from ins
    )
    select id from ins
  `;
  if (!rows[0]) notFound();
  return { id: rows[0].id };
}

export async function updateHearingCore(sql: SqlTag, access: WorkspaceAccess, id: string, h: HearingInput) {
  need(access, "hearing.manage");
  checkId(id);
  const rows = await sql<{ id: string }>`
    update law_hearings set starts_at = ${h.startsAt}::timestamptz, duration_minutes = ${h.durationMinutes},
      court = ${h.court}, room = ${h.room}, status = ${h.status}, outcome = ${h.outcome}, updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
    returning id
  `;
  if (!rows[0]) notFound();
}

export async function deleteHearingCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  need(access, "hearing.manage");
  checkId(id);
  const rows = await sql<{ id: string }>`
    delete from law_hearings where id = ${id} and workspace_id = ${access.workspace.id} returning id
  `;
  if (!rows[0]) notFound();
}

/* ------------------------------------------------------------------------ */
/* Tasks                                                                     */
/* ------------------------------------------------------------------------ */

export type TaskScope = "mine" | "all" | "overdue" | "today";

export async function listTasksCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: { scope: TaskScope; caseId?: string | null; includeDone?: boolean; limit?: number },
): Promise<TaskRow[]> {
  const ws = access.workspace.id;
  const today = riyadhYmd();
  const caseId = f.caseId && UUID_RE.test(f.caseId) ? f.caseId : null;
  const limit = Math.min(f.limit ?? 200, 500);
  const rows = await sql.query<TaskRow>(
    `select t.id, t.title, t.notes, t.case_id, k.title as case_title, k.ref_no as case_ref, t.assignee_id,
            coalesce(nullif(u.name, ''), u.email) as assignee_name, t.due_on, t.done_at, t.created_by, t.created_at
     from law_tasks t
     left join law_cases k on k.id = t.case_id and k.workspace_id = t.workspace_id
     left join "user" u on u.id = t.assignee_id
     where t.workspace_id = $1
       and ($2::uuid is null or t.case_id = $2)
       and ($3::boolean or t.done_at is null)
       and ($4 <> 'mine' or t.assignee_id = $5)
       and ($4 <> 'overdue' or (t.done_at is null and t.due_on < $6::date))
       and ($4 <> 'today' or t.due_on = $6::date)
     order by (t.done_at is not null), t.due_on nulls last, t.created_at desc
     limit ${limit}`,
    [ws, caseId, f.includeDone ?? false, f.scope, access.userId, today],
  );
  return plainRows<TaskRow>(rows);
}

export type TaskInput = {
  title: string;
  notes: string;
  caseId: string | null;
  assigneeId: string | null;
  dueOn: string | null;
};

export async function createTaskCore(sql: SqlTag, access: WorkspaceAccess, t: TaskInput) {
  need(access, "task.create");
  await assertCase(sql, access, t.caseId);
  await assertMembers(sql, access, t.assigneeId ? [t.assigneeId] : []);
  const [r] = await sql<{ id: string }>`
    insert into law_tasks (workspace_id, case_id, title, notes, assignee_id, due_on, created_by)
    values (${access.workspace.id}, ${t.caseId}, ${t.title}, ${t.notes}, ${t.assigneeId}, ${t.dueOn}::date,
            ${access.userId})
    returning id
  `;
  return { id: r.id };
}

async function loadTask(sql: SqlTag, access: WorkspaceAccess, id: string) {
  checkId(id);
  const [t] = await sql<{ created_by: string | null; assignee_id: string | null }>`
    select created_by, assignee_id from law_tasks where id = ${id} and workspace_id = ${access.workspace.id}
  `;
  if (!t) notFound();
  return t;
}

export async function updateTaskCore(sql: SqlTag, access: WorkspaceAccess, id: string, t: TaskInput) {
  const cur = await loadTask(sql, access, id);
  if (!canEditTask(access.role, access.userId, cur)) throw new WorkspaceError("role");
  await assertCase(sql, access, t.caseId);
  await assertMembers(sql, access, t.assigneeId ? [t.assigneeId] : []);
  await sql`
    update law_tasks set title = ${t.title}, notes = ${t.notes}, case_id = ${t.caseId},
      assignee_id = ${t.assigneeId}, due_on = ${t.dueOn}::date, updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
}

export async function setTaskDoneCore(sql: SqlTag, access: WorkspaceAccess, id: string, done: boolean) {
  need(access, "task.complete");
  checkId(id);
  const rows = await sql<{ id: string }>`
    update law_tasks set
      done_at = case when ${done} then coalesce(done_at, now()) else null end,
      done_by = case when ${done} then ${access.userId} else null end,
      updated_at = now()
    where id = ${id} and workspace_id = ${access.workspace.id}
    returning id
  `;
  if (!rows[0]) notFound();
}

export async function deleteTaskCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  const cur = await loadTask(sql, access, id);
  if (!(can(access.role, "task.delete") || cur.created_by === access.userId)) throw new WorkspaceError("role");
  await sql`delete from law_tasks where id = ${id} and workspace_id = ${access.workspace.id}`;
}

/* ------------------------------------------------------------------------ */
/* Home dashboard                                                            */
/* ------------------------------------------------------------------------ */

export type AgendaItem = {
  id: string;
  type: "hearing" | "appointment" | "consultation";
  title: string;
  starts_at: string;
  ends_at: string;
  mode: string | null;
  status: string;
  case_id: string | null;
  client_name: string | null;
  lawyer_name: string | null;
};

export type HomeView = {
  today: string;
  agenda: AgendaItem[];
  myTasks: TaskRow[];
  overdue: TaskRow[];
  counts: { openCases: number; clients: number; pendingConsults: number; weekHearings: number };
};

export async function homeCore(sql: SqlTag, access: WorkspaceAccess): Promise<HomeView> {
  const ws = access.workspace.id;
  const today = riyadhYmd();
  const from = new Date(riyadhDayStart(today)).toISOString();
  const to = new Date(riyadhDayStart(addDays(today, 1))).toISOString();
  const weekEnd = new Date(riyadhDayStart(addDays(today, 7))).toISOString();
  const [agenda, myTasks, overdue, [counts]] = await Promise.all([
    sql<AgendaItem>`
      select * from (
        select h.id, 'hearing' as type, k.title, h.starts_at,
               h.starts_at + make_interval(mins => h.duration_minutes) as ends_at, null::text as mode,
               h.status, k.id as case_id, c.name as client_name, null::text as lawyer_name
        from law_hearings h
        join law_cases k on k.id = h.case_id and k.workspace_id = h.workspace_id
        left join law_clients c on c.id = k.client_id and c.workspace_id = k.workspace_id
        where h.workspace_id = ${ws} and h.starts_at >= ${from}::timestamptz and h.starts_at < ${to}::timestamptz
          and h.status <> 'cancelled'
        union all
        select a.id, a.kind as type,
               coalesce(nullif(a.title, ''), '') as title, a.starts_at, a.ends_at, a.mode, a.status, a.case_id,
               coalesce(c.name, a.lead_name) as client_name, coalesce(nullif(u.name, ''), u.email) as lawyer_name
        from law_appointments a
        left join law_clients c on c.id = a.client_id and c.workspace_id = a.workspace_id
        left join "user" u on u.id = a.lawyer_id
        where a.workspace_id = ${ws} and a.starts_at >= ${from}::timestamptz and a.starts_at < ${to}::timestamptz
          and a.status in ('pending', 'confirmed', 'done')
      ) x order by starts_at
    `,
    listTasksCore(sql, access, { scope: "mine", limit: 8 }),
    listTasksCore(sql, access, { scope: "overdue", limit: 8 }),
    sql<HomeView["counts"]>`
      select
        (select count(*)::int from law_cases where workspace_id = ${ws} and stage <> 'closed') as "openCases",
        (select count(*)::int from law_clients where workspace_id = ${ws}) as clients,
        (select count(*)::int from law_appointments where workspace_id = ${ws} and status = 'pending'
           and starts_at >= now()) as "pendingConsults",
        (select count(*)::int from law_hearings where workspace_id = ${ws} and status = 'scheduled'
           and starts_at >= ${from}::timestamptz and starts_at < ${weekEnd}::timestamptz) as "weekHearings"
    `,
  ]);
  return {
    today,
    agenda: plainRows<AgendaItem>(agenda),
    myTasks,
    overdue,
    counts: plain(counts),
  };
}

