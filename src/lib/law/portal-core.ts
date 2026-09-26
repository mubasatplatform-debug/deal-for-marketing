/**
 * Client portal core — the private link an office sends to a client
 * (/portal/<token>, no account). Bare SQL tag, relative imports
 * (PGLite-testable); **server-only** (node:crypto).
 *
 * Access model, like the consultation meet link (meet-token.ts):
 *   - the token is 32 random bytes (base64url, 43 chars); only its SHA-256 is
 *     stored (`law_client_portals.token_hash`), so a leaked table cannot be
 *     replayed into links and the office sees the full URL only once;
 *   - one link per client: rotating replaces the hash (the old link dies),
 *     revoking stamps `revoked_at`;
 *   - a link resolves only while not revoked and while the office is not
 *     suspended/cancelled.
 *
 * The public view is built from an allow-list of columns: no fees, no notes,
 * no opposing-party details, no private appointment notes, and only the
 * documents the office explicitly shared with this client.
 */
import { randomBytes } from "node:crypto";
import { effectiveStatus } from "../saas/lifecycle.ts";
import { UUID_RE, WorkspaceError, type SqlTag, type WorkspaceAccess } from "../saas/tenancy-core.ts";
import { hashMeetToken, isMeetTokenShape } from "./meet-token.ts";
import type { CaseStage, ConsultMode } from "./options.ts";
import { need } from "./practice-core.ts";
import { plain, plainRows } from "./rows.ts";

/* ------------------------------------------------------------------------ */
/* Tokens                                                                    */
/* ------------------------------------------------------------------------ */

/** A fresh portal token and the hash that is stored. */
export function newPortalToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashMeetToken(token) };
}

export function hashPortalToken(token: string): string {
  return hashMeetToken(token);
}

/** Same shape as meet tokens: 43 base64url characters. */
export function isPortalTokenShape(v: unknown): v is string {
  return isMeetTokenShape(v);
}

/* ------------------------------------------------------------------------ */
/* Office side                                                               */
/* ------------------------------------------------------------------------ */

export type PortalStatus = {
  state: "none" | "active" | "revoked";
  created_at: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
};

async function assertOwnClient(sql: SqlTag, access: WorkspaceAccess, clientId: string) {
  if (!UUID_RE.test(clientId)) throw new WorkspaceError("not_found", 404);
  const [r] = await sql<{ id: string }>`
    select id from law_clients where id = ${clientId} and workspace_id = ${access.workspace.id}
  `;
  if (!r) throw new WorkspaceError("not_found", 404);
}

async function logEvent(sql: SqlTag, access: WorkspaceAccess, kind: string, detail: Record<string, unknown>) {
  await sql`
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (${access.workspace.id}, ${access.userId}, ${kind}, ${JSON.stringify(detail)}::jsonb)
  `;
}

/** The client's link state for the client page (the token itself is never readable). */
export async function portalStatusCore(sql: SqlTag, access: WorkspaceAccess, clientId: string): Promise<PortalStatus> {
  need(access, "client.view");
  await assertOwnClient(sql, access, clientId);
  const [r] = await sql<{ created_at: string; revoked_at: string | null; last_seen_at: string | null }>`
    select created_at, revoked_at, last_seen_at from law_client_portals
    where client_id = ${clientId} and workspace_id = ${access.workspace.id}
  `;
  if (!r) return { state: "none", created_at: null, revoked_at: null, last_seen_at: null };
  const p = plain<{ created_at: string; revoked_at: string | null; last_seen_at: string | null }>(r);
  return { state: p.revoked_at ? "revoked" : "active", ...p };
}

/**
 * Create the client's link, or rotate it: the stored hash is replaced, so
 * any earlier link stops working at once.
 */
export async function savePortalCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  clientId: string,
  tokenHash: string,
): Promise<void> {
  need(access, "client.portal");
  await assertOwnClient(sql, access, clientId);
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new WorkspaceError("invalid", 422);
  const rows = await sql<{ rotated: boolean }>`
    insert into law_client_portals (workspace_id, client_id, token_hash, created_by)
    values (${access.workspace.id}, ${clientId}, ${tokenHash}, ${access.userId})
    on conflict (client_id) do update
      set token_hash = excluded.token_hash, created_by = excluded.created_by, created_at = now(),
          revoked_at = null, last_seen_at = null
      where law_client_portals.workspace_id = excluded.workspace_id
    returning (xmax <> 0) as rotated
  `;
  if (!rows[0]) throw new WorkspaceError("not_found", 404);
  await logEvent(sql, access, rows[0].rotated ? "portal_rotated" : "portal_created", { client_id: clientId });
}

export async function revokePortalCore(sql: SqlTag, access: WorkspaceAccess, clientId: string): Promise<void> {
  need(access, "client.portal");
  await assertOwnClient(sql, access, clientId);
  const rows = await sql<{ client_id: string }>`
    update law_client_portals set revoked_at = now()
    where client_id = ${clientId} and workspace_id = ${access.workspace.id} and revoked_at is null
    returning client_id
  `;
  if (rows[0]) await logEvent(sql, access, "portal_revoked", { client_id: clientId });
}

/** Share (or stop sharing) one document with its client. Only filed-under-a-client documents. */
export async function setDocumentSharedCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  documentId: string,
  shared: boolean,
): Promise<void> {
  need(access, "client.portal");
  if (!UUID_RE.test(documentId)) throw new WorkspaceError("not_found", 404);
  const [d] = await sql<{ client_id: string | null; name: string }>`
    select client_id, name from law_documents where id = ${documentId} and workspace_id = ${access.workspace.id}
  `;
  if (!d) throw new WorkspaceError("not_found", 404);
  if (!d.client_id) throw new WorkspaceError("invalid", 422);
  await sql`
    update law_documents set shared_with_client = ${shared}
    where id = ${documentId} and workspace_id = ${access.workspace.id}
  `;
  await logEvent(sql, access, shared ? "doc_shared" : "doc_unshared", { id: documentId, name: d.name, client_id: d.client_id });
}

/* ------------------------------------------------------------------------ */
/* Public side (by token hash)                                               */
/* ------------------------------------------------------------------------ */

export type PortalSubject = {
  workspace: { id: string; name: string; city: string };
  client: { id: string; name: string };
};

/**
 * Who a link belongs to, or null: unknown hash, revoked link, or an office
 * that is suspended or cancelled all look the same.
 */
export async function resolvePortalCore(sql: SqlTag, tokenHash: string): Promise<PortalSubject | null> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
  const [r] = await sql<{
    ws_id: string;
    ws_name: string;
    ws_city: string;
    client_id: string;
    client_name: string;
    status: string;
    trial_ends_at: string | Date | null;
    current_period_end: string | Date | null;
  }>`
    select w.id as ws_id, w.name as ws_name, w.city as ws_city, c.id as client_id, c.name as client_name,
           w.status, w.trial_ends_at, w.current_period_end
    from law_client_portals p
    join workspaces w on w.id = p.workspace_id
    join law_clients c on c.id = p.client_id and c.workspace_id = p.workspace_id
    where p.token_hash = ${tokenHash}
      and p.revoked_at is null
      and w.status not in ('suspended', 'cancelled')
  `;
  // A lapsed office past its grace period is read-only for its own team; its
  // client links go dark the same way a suspended office's do.
  if (!r || effectiveStatus(r).readOnly) return null;
  return {
    workspace: { id: r.ws_id, name: r.ws_name, city: r.ws_city },
    client: { id: r.client_id, name: r.client_name },
  };
}

export type PortalCase = {
  id: string;
  ref_no: number;
  title: string;
  stage: CaseStage;
  court: string;
  next_hearing_at: string | null;
};

export type PortalHearing = {
  id: string;
  starts_at: string;
  court: string;
  room: string;
  status: "scheduled" | "postponed";
  case_ref: number;
  case_title: string;
};

export type PortalAppointment = {
  id: string;
  kind: "appointment" | "consultation";
  mode: ConsultMode;
  status: "pending" | "confirmed";
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  lawyer_name: string | null;
  /** The client's meeting page for a video consultation, when it has one. */
  meet_url: string | null;
};

export type PortalDocument = { id: string; name: string; size: number; created_at: string };

export type PortalView = {
  office: { name: string; city: string };
  client: { name: string };
  cases: PortalCase[];
  hearings: PortalHearing[];
  appointments: PortalAppointment[];
  documents: PortalDocument[];
};

/**
 * Everything the portal page shows, or null for a dead link. Built from an
 * allow-list of columns; `meetUrl` turns an appointment's nonce into its
 * meeting link (server-side, consult.server.ts) so the nonce never leaves.
 */
export async function portalViewCore(
  sql: SqlTag,
  tokenHash: string,
  opts: { now?: number; meetUrl?: (appointmentId: string, nonce: string) => string | null } = {},
): Promise<PortalView | null> {
  const subject = await resolvePortalCore(sql, tokenHash);
  if (!subject) return null;
  const ws = subject.workspace.id;
  const client = subject.client.id;
  const now = new Date(opts.now ?? Date.now()).toISOString();

  const [cases, hearings, appointments, documents] = await Promise.all([
    sql<PortalCase>`
      select k.id, k.ref_no, k.title, k.stage, k.court,
             (select min(h.starts_at) from law_hearings h
               where h.case_id = k.id and h.workspace_id = k.workspace_id
                 and h.status in ('scheduled', 'postponed') and h.starts_at >= ${now}) as next_hearing_at
      from law_cases k
      where k.workspace_id = ${ws} and k.client_id = ${client}
      order by (k.stage = 'closed'), k.updated_at desc
      limit 100
    `,
    sql<PortalHearing>`
      select h.id, h.starts_at, h.court, h.room, h.status, k.ref_no as case_ref, k.title as case_title
      from law_hearings h
      join law_cases k on k.id = h.case_id and k.workspace_id = h.workspace_id
      where h.workspace_id = ${ws} and k.client_id = ${client}
        and h.status in ('scheduled', 'postponed') and h.starts_at >= ${now}
      order by h.starts_at
      limit 50
    `,
    sql<Omit<PortalAppointment, "meet_url"> & { meet_nonce: string | null }>`
      select a.id, a.kind, a.mode, a.status, a.title, a.starts_at, a.ends_at,
             case when a.mode = 'in_office' then a.location else '' end as location,
             coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) as lawyer_name, a.meet_nonce
      from law_appointments a
      left join "user" u on u.id = a.lawyer_id
      where a.workspace_id = ${ws} and a.client_id = ${client}
        and a.status in ('pending', 'confirmed') and a.ends_at >= ${now}
      order by a.starts_at
      limit 50
    `,
    sql<PortalDocument>`
      select id, name, size, created_at from law_documents
      where workspace_id = ${ws} and client_id = ${client} and shared_with_client
      order by created_at desc, id
      limit 200
    `,
  ]);

  return {
    office: { name: subject.workspace.name, city: subject.workspace.city },
    client: { name: subject.client.name },
    cases: plainRows<PortalCase>(cases).map((c) => ({
      id: c.id,
      ref_no: Number(c.ref_no),
      title: c.title,
      stage: c.stage,
      court: c.court,
      next_hearing_at: c.next_hearing_at,
    })),
    hearings: plainRows<PortalHearing>(hearings).map((h) => ({
      id: h.id,
      starts_at: h.starts_at,
      court: h.court,
      room: h.room,
      status: h.status,
      case_ref: Number(h.case_ref),
      case_title: h.case_title,
    })),
    appointments: plainRows<Omit<PortalAppointment, "meet_url"> & { meet_nonce: string | null }>(appointments).map((a) => ({
      id: a.id,
      kind: a.kind,
      mode: a.mode,
      status: a.status,
      title: a.title,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      location: a.location,
      lawyer_name: a.lawyer_name,
      meet_url: a.mode === "video" && a.meet_nonce && opts.meetUrl ? opts.meetUrl(a.id, a.meet_nonce) : null,
    })),
    documents: plainRows<PortalDocument>(documents).map((d) => ({
      id: d.id,
      name: d.name,
      size: Number(d.size),
      created_at: d.created_at,
    })),
  };
}

/** Stamp "last opened" (at most every five minutes per link). */
export async function touchPortalCore(sql: SqlTag, tokenHash: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) return;
  await sql`
    update law_client_portals set last_seen_at = now()
    where token_hash = ${tokenHash} and revoked_at is null
      and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
  `;
}

export type PortalFile = {
  id: string;
  name: string;
  size: number;
  storage: "db" | "blob";
  blob_path: string | null;
  data: Uint8Array | null;
};

/**
 * A document for download through the portal: only when the link is live,
 * the document is filed under THIS client of THIS office, and it is shared.
 */
export async function portalDocumentCore(sql: SqlTag, tokenHash: string, documentId: string): Promise<PortalFile | null> {
  if (!UUID_RE.test(documentId)) return null;
  const subject = await resolvePortalCore(sql, tokenHash);
  if (!subject) return null;
  const [r] = await sql<PortalFile>`
    select id, name, size, storage, blob_path, data from law_documents
    where id = ${documentId} and workspace_id = ${subject.workspace.id}
      and client_id = ${subject.client.id} and shared_with_client
  `;
  if (!r) return null;
  return { id: r.id, name: r.name, size: Number(r.size), storage: r.storage, blob_path: r.blob_path, data: r.data ?? null };
}
