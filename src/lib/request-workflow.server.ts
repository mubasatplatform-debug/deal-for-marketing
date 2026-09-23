import { getSql } from "@/lib/db";

/**
 * Team workflow writes on requests — **server-only**. Each change and its
 * activity-log entry are one SQL statement (data-modifying CTEs), so they
 * commit or fail together; there is no path that changes a request without
 * logging it. Callers have already checked that the actor is on the team.
 */

type Sql = Awaited<ReturnType<typeof getSql>>;
export type Via = "panel" | "api";

export type ChangeResult = { found: boolean; changed: boolean };

/**
 * Set a request's status and log it. The row is locked first, so concurrent
 * changes serialize and each logs the status it actually replaced.
 */
export async function setStatusLogged(
  sql: Sql,
  id: number,
  status: string,
  actorId: string,
  via: Via,
): Promise<ChangeResult> {
  const rows = await sql<{ found: number; changed: number }>`
    with prev as (
      select id, status from requests where id = ${id} for update
    ),
    upd as (
      update requests r set status = ${status}
      from prev
      where r.id = prev.id and prev.status is distinct from ${status}
      returning r.id, prev.status as old_status
    ),
    ev as (
      insert into request_events (request_id, actor_id, kind, from_value, to_value, via)
      select id, ${actorId}, 'status', old_status, ${status}, ${via} from upd
      returning id
    )
    select (select count(*) from prev)::int as found, (select count(*) from ev)::int as changed
  `;
  return { found: (rows[0]?.found ?? 0) > 0, changed: (rows[0]?.changed ?? 0) > 0 };
}

/** Assign (or unassign, `assigneeId` null) a request and log it. */
export async function setAssigneeLogged(
  sql: Sql,
  id: number,
  assigneeId: string | null,
  actorId: string,
  via: Via,
): Promise<ChangeResult> {
  const rows = await sql<{ found: number; changed: number }>`
    with prev as (
      select id, assignee_id from requests where id = ${id} for update
    ),
    upd as (
      update requests r set assignee_id = ${assigneeId}::text
      from prev
      where r.id = prev.id and prev.assignee_id is distinct from ${assigneeId}::text
      returning r.id, prev.assignee_id as old_assignee
    ),
    ev as (
      insert into request_events (request_id, actor_id, kind, from_value, to_value, via)
      select id, ${actorId}, 'assign', old_assignee, ${assigneeId}::text, ${via} from upd
      returning id
    )
    select (select count(*) from prev)::int as found, (select count(*) from ev)::int as changed
  `;
  return { found: (rows[0]?.found ?? 0) > 0, changed: (rows[0]?.changed ?? 0) > 0 };
}

export type NoteRow = {
  id: number;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
};

/** Add an internal note and log it. Null when the request does not exist. */
export async function addNoteLogged(
  sql: Sql,
  id: number,
  body: string,
  actorId: string,
): Promise<NoteRow | null> {
  const rows = await sql<NoteRow>`
    with req as (
      select id from requests where id = ${id}
    ),
    n as (
      insert into request_notes (request_id, author_id, body)
      select id, ${actorId}, ${body} from req
      returning id, request_id, body, created_at, author_id
    ),
    ev as (
      insert into request_events (request_id, actor_id, kind, to_value, via)
      select request_id, ${actorId}, 'note', id::text, 'panel' from n
      returning id
    )
    select n.id, n.body, n.created_at, n.author_id,
           coalesce(nullif(u.name, ''), u.email) as author_name
    from n left join "user" u on u.id = n.author_id
  `;
  return rows[0] ?? null;
}

export type EventRow = {
  id: number;
  kind: "status" | "assign" | "note";
  from_value: string | null;
  to_value: string | null;
  via: Via;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  from_name: string | null;
  to_name: string | null;
};

export type RequestActivity = { notes: NoteRow[]; events: EventRow[] };

/** Notes and history of one request, newest first. Team-only data. */
export async function requestActivity(sql: Sql, id: number): Promise<RequestActivity> {
  const [notes, events] = await Promise.all([
    sql<NoteRow>`
      select n.id, n.body, n.created_at, n.author_id,
             coalesce(nullif(u.name, ''), u.email) as author_name
      from request_notes n
      left join "user" u on u.id = n.author_id
      where n.request_id = ${id}
      order by n.id desc
      limit 200
    `,
    sql<EventRow>`
      select e.id, e.kind, e.from_value, e.to_value, e.via, e.created_at, e.actor_id,
             coalesce(nullif(a.name, ''), a.email) as actor_name,
             coalesce(nullif(fu.name, ''), fu.email) as from_name,
             coalesce(nullif(tu.name, ''), tu.email) as to_name
      from request_events e
      left join "user" a on a.id = e.actor_id
      left join "user" fu on e.kind = 'assign' and fu.id = e.from_value
      left join "user" tu on e.kind = 'assign' and tu.id = e.to_value
      where e.request_id = ${id}
      order by e.id desc
      limit 300
    `,
  ]);
  return { notes, events };
}

/** Team emails from `ADMIN_EMAILS`, lower-cased. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type TeamMember = { id: string; name: string; email: string };

/**
 * Team members who can be assigned: accounts whose email is in `ADMIN_EMAILS`,
 * signed in through Google or email/password (the same rule as `assertAdmin`).
 */
export async function teamMembers(sql: Sql): Promise<TeamMember[]> {
  const allowed = adminEmails();
  if (allowed.length === 0) return [];
  return sql<TeamMember>`
    select distinct u.id, coalesce(nullif(u.name, ''), u.email) as name, u.email
    from "user" u
    join "account" a on a."userId" = u.id
    where a."providerId" in ('grok-google', 'credential')
      and lower(u.email) = any(string_to_array(${allowed.join(",")}, ','))
    order by name
  `;
}
