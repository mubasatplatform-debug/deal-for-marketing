/**
 * Tenancy core — the queries behind «مكتب المحامي» workspaces, written against
 * a bare SQL tag (no app aliases) so node tests drive them on PGLite with the
 * real migrations. The app reaches them through `guard.server.ts` and the
 * server functions in `workspace.ts` / `console.ts`.
 *
 * Tenant isolation rule: every function that touches one office's rows takes
 * a `WorkspaceAccess` produced by `resolveMembership` (membership + role
 * checked in the database), never a bare workspace id from the browser.
 */
import {
  effectiveStatus,
  isRole,
  roleAtLeast,
  type InviteRole,
  type Lifecycle,
  type Role,
} from "./lifecycle.ts";
import {
  INVITE_TTL_DAYS,
  MAX_OWNED_WORKSPACES,
  PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  getPlan,
  quote,
  seatLimit,
  type BillingCycle,
  type PlanId,
} from "./plans.ts";

/** The query surface both `getSql()` and a bare PGLite wrapper satisfy. */
export type SqlTag = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable error codes; the server maps them to an HTTP status and the UI to a message. */
export type WorkspaceErrorCode =
  | "forbidden"
  | "role"
  | "read_only"
  | "seat_limit"
  | "plan_too_small"
  | "already_member"
  | "last_owner"
  | "not_member"
  | "too_many"
  | "invite_invalid"
  | "invite_expired"
  | "invite_used"
  | "invite_revoked"
  | "email_mismatch"
  | "invoice_not_found"
  | "not_found"
  // Practice modules (phase 2, src/lib/law/*-core.ts)
  | "plan_feature"
  | "has_records"
  | "slot_taken"
  | "quota"
  | "invalid"
  | "window"
  | "status"
  | "slug_taken"
  | "video_unavailable"
  // Tax invoices (src/lib/law/invoices-core.ts)
  | "tax_profile"
  | "credit_exceeded"
  | "has_invoices"
  // AI assistant (src/lib/law/agent)
  | "ai_limit"
  | "ai_unavailable"
  // Two-step sign-in (src/lib/otp)
  | "otp_required"
  // Sample data (src/lib/law/demo-core.ts)
  | "demo_exists"
  | "demo_in_use"
  // Calls (src/lib/law/voice-core.ts)
  | "call_limit"
  | "voice_unavailable";

export const WORKSPACE_ERROR_PREFIX = "WS:";

export class WorkspaceError extends Error {
  code: WorkspaceErrorCode;
  status: number;
  constructor(code: WorkspaceErrorCode, status = 403) {
    super(`${WORKSPACE_ERROR_PREFIX}${code}`);
    this.name = "WorkspaceError";
    this.code = code;
    this.status = status;
  }
}

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  cr_number: string | null;
  city: string;
  team_size: string | null;
  plan: string;
  billing_cycle: BillingCycle;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
};

export type WorkspaceAccess = {
  workspace: WorkspaceRow;
  role: Role;
  userId: string;
  lifecycle: Lifecycle;
};

const WS_COLS = `w.id, w.name, w.slug, w.cr_number, w.city, w.team_size, w.plan, w.billing_cycle,
  w.status, w.trial_ends_at, w.current_period_end, w.created_at`;

function iso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function normalizeWs<T extends Record<string, unknown>>(r: T): T {
  return {
    ...r,
    trial_ends_at: iso(r.trial_ends_at),
    current_period_end: iso(r.current_period_end),
    created_at: iso(r.created_at),
  };
}

/**
 * THE tenant guard. Resolves the caller's membership of `workspaceId` in the
 * database and enforces, in order:
 *   - membership (a non-member and a non-existent office look the same: 403),
 *   - the minimum role,
 *   - read-only lifecycle for writes (suspended / cancelled offices).
 */
export async function resolveMembership(
  sql: SqlTag,
  userId: string,
  workspaceId: string,
  minRole: Role = "staff",
  opts: { write?: boolean; now?: number } = {},
): Promise<WorkspaceAccess> {
  if (!userId || typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) {
    throw new WorkspaceError("forbidden");
  }
  const rows = await sql.query<WorkspaceRow & { role: string }>(`select ${WS_COLS}, m.role from workspace_members m join workspaces w on w.id = m.workspace_id
     where m.workspace_id = $1 and m.user_id = $2 limit 1`, [workspaceId, userId]);
  const row = rows[0];
  if (!row || !isRole(row.role)) throw new WorkspaceError("forbidden");
  const role = row.role;
  if (!roleAtLeast(role, minRole)) throw new WorkspaceError("role");
  const workspace = normalizeWs(row) as WorkspaceRow & { role?: string };
  delete workspace.role;
  const lifecycle = effectiveStatus(workspace, opts.now);
  if (opts.write && lifecycle.readOnly) throw new WorkspaceError("read_only");
  return { workspace, role, userId, lifecycle };
}

export type Membership = WorkspaceRow & { role: Role; lifecycle: Lifecycle; members: number };

/** Every office the user belongs to, oldest first. */
export async function listMemberships(sql: SqlTag, userId: string, now?: number): Promise<Membership[]> {
  const rows = await sql.query<WorkspaceRow & { role: Role; members: number }>(`select ${WS_COLS}, m.role,
            (select count(*)::int from workspace_members mm where mm.workspace_id = w.id) as members
     from workspace_members m join workspaces w on w.id = m.workspace_id
     where m.user_id = $1
     order by m.created_at, w.created_at`, [userId]);
  return rows.map((r) => {
    const ws = normalizeWs(r);
    return { ...ws, lifecycle: effectiveStatus(ws, now) };
  });
}

/**
 * Which office to open: the requested one (must be a membership — else 403),
 * otherwise the stored preference if still a membership, otherwise the first.
 * Null when the user has no office yet.
 */
export async function pickActiveWorkspace(
  sql: SqlTag,
  userId: string,
  requested: string | null,
  now?: number,
): Promise<{ active: Membership | null; memberships: Membership[] }> {
  const memberships = await listMemberships(sql, userId, now);
  if (requested) {
    const hit = memberships.find((m) => m.id === requested);
    if (!hit) throw new WorkspaceError("forbidden");
    await rememberWorkspace(sql, userId, hit.id);
    return { active: hit, memberships };
  }
  if (memberships.length === 0) return { active: null, memberships };
  const [pref] = await sql<{ id: string | null }>`
    select active_workspace_id as id from workspace_user_prefs where user_id = ${userId}
  `;
  const active = memberships.find((m) => m.id === pref?.id) ?? memberships[0];
  return { active, memberships };
}

export async function rememberWorkspace(sql: SqlTag, userId: string, workspaceId: string) {
  await sql`
    insert into workspace_user_prefs (user_id, active_workspace_id, updated_at)
    values (${userId}, ${workspaceId}, now())
    on conflict (user_id) do update set active_workspace_id = excluded.active_workspace_id, updated_at = now()
  `;
}

export type NewWorkspace = {
  name: string;
  city: string;
  crNumber: string | null;
  teamSize: string | null;
  slug: string;
};

/**
 * Create an office with the caller as owner, on a TRIAL_DAYS trial of
 * TRIAL_PLAN — workspace, owner membership, preference and log in ONE
 * statement, so a failure never leaves an office without its owner.
 */
export async function createWorkspaceCore(
  sql: SqlTag,
  userId: string,
  input: NewWorkspace,
): Promise<{ id: string }> {
  const rows = await sql<{ id: string }>`
    with guard as (
      select count(*) as owned from workspace_members where user_id = ${userId} and role = 'owner'
    ),
    ws as (
      insert into workspaces (name, slug, cr_number, city, team_size, plan, status, trial_ends_at, created_by)
      select ${input.name}, ${input.slug}, ${input.crNumber}, ${input.city}, ${input.teamSize},
             ${TRIAL_PLAN}, 'trialing', now() + ${TRIAL_DAYS} * interval '1 day', ${userId}
      from guard where guard.owned < ${MAX_OWNED_WORKSPACES}
      returning id
    ),
    mem as (
      insert into workspace_members (workspace_id, user_id, role)
      select id, ${userId}, 'owner' from ws
    ),
    pref as (
      insert into workspace_user_prefs (user_id, active_workspace_id)
      select ${userId}, id from ws
      on conflict (user_id) do update set active_workspace_id = excluded.active_workspace_id, updated_at = now()
    ),
    ev as (
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select id, ${userId}, 'created', jsonb_build_object('plan', ${TRIAL_PLAN}::text, 'trial_days', ${TRIAL_DAYS}::int) from ws
    )
    select id from ws
  `;
  if (!rows[0]) throw new WorkspaceError("too_many", 429);
  return { id: rows[0].id };
}

export async function updateWorkspaceCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  input: { name: string; city: string; crNumber: string | null; teamSize: string | null },
) {
  await sql`
    update workspaces set name = ${input.name}, city = ${input.city}, cr_number = ${input.crNumber},
      team_size = ${input.teamSize}, updated_at = now()
    where id = ${access.workspace.id}
  `;
}

export type SeatUsage = { members: number; pending: number; used: number; limit: number };

export async function seatUsage(sql: SqlTag, workspaceId: string, planId: string): Promise<SeatUsage> {
  const [r] = await sql<{ members: number; pending: number }>`
    select
      (select count(*)::int from workspace_members where workspace_id = ${workspaceId}) as members,
      (select count(*)::int from workspace_invites
         where workspace_id = ${workspaceId} and accepted_at is null and revoked_at is null
           and expires_at > now()) as pending
  `;
  const members = r?.members ?? 0;
  const pending = r?.pending ?? 0;
  return { members, pending, used: members + pending, limit: seatLimit(planId) };
}

const INVITE_RESULT: Record<string, WorkspaceErrorCode | null> = {
  ok: null,
  seat_limit: "seat_limit",
  already_member: "already_member",
  not_found: "forbidden",
};

/** Invite by email. Needs owner/admin (checked by the caller's access). */
export async function createInviteCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  email: string,
  role: InviteRole,
  tokenHash: string,
): Promise<void> {
  if (!roleAtLeast(access.role, "admin")) throw new WorkspaceError("role");
  const [r] = await sql<{ res: string }>`
    select law_invite_create(${access.workspace.id}::uuid, ${email.trim().toLowerCase()}::text,
      ${role}::text, ${tokenHash}::text, ${access.userId}::text,
      ${seatLimit(access.workspace.plan)}::int, ${INVITE_TTL_DAYS}::int) as res
  `;
  const code = INVITE_RESULT[r?.res ?? "not_found"];
  if (code) throw new WorkspaceError(code, code === "seat_limit" ? 409 : 403);
}

export async function revokeInviteCore(sql: SqlTag, access: WorkspaceAccess, inviteId: string) {
  if (!roleAtLeast(access.role, "admin")) throw new WorkspaceError("role");
  if (!UUID_RE.test(inviteId)) throw new WorkspaceError("not_found", 404);
  const rows = await sql<{ id: string }>`
    update workspace_invites set revoked_at = now()
    where id = ${inviteId} and workspace_id = ${access.workspace.id}
      and accepted_at is null and revoked_at is null
    returning id
  `;
  if (!rows[0]) throw new WorkspaceError("not_found", 404);
}

export type InvitePreview = {
  workspaceName: string;
  email: string;
  role: InviteRole;
  inviterName: string | null;
  state: "open" | "expired" | "used" | "revoked";
  expiresAt: string;
};

/** What an invite link shows before sign-in. The token itself is the secret. */
export async function previewInviteCore(sql: SqlTag, tokenHash: string): Promise<InvitePreview | null> {
  const [r] = await sql<{
    name: string;
    email: string;
    role: InviteRole;
    inviter: string | null;
    expires_at: string | Date;
    accepted_at: string | null;
    revoked_at: string | null;
  }>`
    select w.name, i.email, i.role, coalesce(nullif(u.name, ''), u.email) as inviter,
           i.expires_at, i.accepted_at, i.revoked_at
    from workspace_invites i
    join workspaces w on w.id = i.workspace_id
    left join "user" u on u.id = i.invited_by
    where i.token_hash = ${tokenHash}
  `;
  if (!r) return null;
  const expiresAt = iso(r.expires_at) ?? "";
  const state = r.revoked_at
    ? "revoked"
    : r.accepted_at
      ? "used"
      : Date.parse(expiresAt) <= Date.now()
        ? "expired"
        : "open";
  return { workspaceName: r.name, email: r.email, role: r.role, inviterName: r.inviter, state, expiresAt };
}

const ACCEPT_RESULT: Record<string, WorkspaceErrorCode | null> = {
  ok: null,
  not_found: "invite_invalid",
  revoked: "invite_revoked",
  used: "invite_used",
  expired: "invite_expired",
  email_mismatch: "email_mismatch",
  seat_limit: "seat_limit",
};

/** Redeem an invite for the signed-in user (their verified account email). */
export async function acceptInviteCore(
  sql: SqlTag,
  userId: string,
  accountEmail: string,
  tokenHash: string,
): Promise<{ workspaceId: string }> {
  const limits = Object.fromEntries(PLANS.map((p) => [p.id, p.seats]));
  const [r] = await sql<{ res: string }>`
    select law_invite_accept(${tokenHash}::text, ${userId}::text, ${accountEmail.trim().toLowerCase()}::text,
      ${JSON.stringify(limits)}::jsonb) as res
  `;
  const code = ACCEPT_RESULT[r?.res ?? "not_found"] ?? "invite_invalid";
  if (r?.res !== "ok") throw new WorkspaceError(code, code === "seat_limit" ? 409 : 403);
  const [ws] = await sql<{ workspace_id: string }>`
    select workspace_id from workspace_invites where token_hash = ${tokenHash}
  `;
  await rememberWorkspace(sql, userId, ws.workspace_id);
  return { workspaceId: ws.workspace_id };
}

const MEMBER_RESULT: Record<string, WorkspaceErrorCode | null> = {
  ok: null,
  not_found: "forbidden",
  not_member: "not_member",
  forbidden: "role",
  last_owner: "last_owner",
};

export async function setRoleCore(sql: SqlTag, access: WorkspaceAccess, targetUserId: string, role: Role) {
  if (!roleAtLeast(access.role, "admin")) throw new WorkspaceError("role");
  const [r] = await sql<{ res: string }>`
    select law_member_set_role(${access.workspace.id}::uuid, ${access.userId}::text, ${access.role}::text,
      ${targetUserId}::text, ${role}::text) as res
  `;
  const code = MEMBER_RESULT[r?.res ?? "not_found"];
  if (code) throw new WorkspaceError(code, code === "not_member" ? 404 : 403);
}

/** Remove a member; anyone may remove themselves (leave), otherwise owner/admin. */
export async function removeMemberCore(sql: SqlTag, access: WorkspaceAccess, targetUserId: string) {
  if (targetUserId !== access.userId && !roleAtLeast(access.role, "admin")) {
    throw new WorkspaceError("role");
  }
  const [r] = await sql<{ res: string }>`
    select law_member_remove(${access.workspace.id}::uuid, ${access.userId}::text, ${access.role}::text,
      ${targetUserId}::text) as res
  `;
  const code = MEMBER_RESULT[r?.res ?? "not_found"];
  if (code) throw new WorkspaceError(code, code === "not_member" ? 404 : 403);
}

export type TeamMemberRow = {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
};

export type OpenInviteRow = {
  id: string;
  email: string;
  role: InviteRole;
  created_at: string;
  expires_at: string;
  invited_by_name: string | null;
};

export async function teamCore(sql: SqlTag, access: WorkspaceAccess) {
  const wsId = access.workspace.id;
  const [members, invites, seats] = await Promise.all([
    sql<TeamMemberRow>`
      select m.user_id, u.name, u.email, m.role, m.created_at
      from workspace_members m join "user" u on u.id = m.user_id
      where m.workspace_id = ${wsId}
      order by case m.role when 'owner' then 0 when 'admin' then 1 when 'lawyer' then 2 else 3 end, m.created_at
    `,
    // Staff and lawyers see who is on the team, not the pending invite list.
    roleAtLeast(access.role, "admin")
      ? sql<OpenInviteRow>`
          select i.id, i.email, i.role, i.created_at, i.expires_at,
                 coalesce(nullif(u.name, ''), u.email) as invited_by_name
          from workspace_invites i left join "user" u on u.id = i.invited_by
          where i.workspace_id = ${wsId} and i.accepted_at is null and i.revoked_at is null
            and i.expires_at > now()
          order by i.created_at desc
        `
      : Promise.resolve([] as OpenInviteRow[]),
    seatUsage(sql, wsId, access.workspace.plan),
  ]);
  return {
    members: members.map((m) => ({ ...m, created_at: iso(m.created_at) ?? "" })),
    invites: invites.map((i) => ({
      ...i,
      created_at: iso(i.created_at) ?? "",
      expires_at: iso(i.expires_at) ?? "",
    })),
    seats,
  };
}

/* ------------------------------------------------------------------------ */
/* Billing                                                                   */
/* ------------------------------------------------------------------------ */

export type InvoiceRow = {
  id: string;
  number: number;
  workspace_id: string;
  plan: PlanId;
  cycle: BillingCycle;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  provider: "manual" | "moyasar" | "edfapay";
  provider_ref: string | null;
  status: "pending" | "paid" | "cancelled" | "failed";
  created_at: string;
  paid_at: string | null;
};

const INVOICE_COLS = `id, number, workspace_id, plan, cycle, subtotal, vat, total, currency, provider,
  provider_ref, status, created_at, paid_at`;

function normalizeInvoice(r: InvoiceRow): InvoiceRow {
  return { ...r, created_at: iso(r.created_at) ?? "", paid_at: iso(r.paid_at) };
}

export async function listInvoicesCore(sql: SqlTag, workspaceId: string): Promise<InvoiceRow[]> {
  const rows = await sql.query<InvoiceRow>(`select ${INVOICE_COLS} from workspace_invoices where workspace_id = $1 order by created_at desc limit 50`, [workspaceId]);
  return rows.map(normalizeInvoice);
}

/**
 * A pending payment request for a plan period. A still-pending request for
 * the same plan, cycle and provider is reused, so double clicks and retries
 * never pile up duplicates; other pending requests of the office are
 * cancelled (only one open request at a time).
 */
export async function createInvoiceCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  planId: PlanId,
  cycle: BillingCycle,
  provider: "manual" | "moyasar" | "edfapay",
): Promise<{ invoice: InvoiceRow; reused: boolean }> {
  if (!roleAtLeast(access.role, "admin")) throw new WorkspaceError("role");
  const q = quote(planId, cycle);
  const wsId = access.workspace.id;
  // A smaller plan must still fit the team: seats are only checked on invite,
  // so a downgrade would otherwise keep every member above the new limit.
  const seats = await seatUsage(sql, wsId, planId);
  if (seats.used > seats.limit) throw new WorkspaceError("plan_too_small", 409);
  // Only reuse a request that never reached a payment page: once the provider
  // has issued one, a second checkout gets its own invoice, so a payment made
  // on the first page can never be orphaned by a new provider reference.
  const existing = await sql.query<InvoiceRow>(`select ${INVOICE_COLS} from workspace_invoices
     where workspace_id = $1 and status = 'pending' and plan = $2 and cycle = $3 and provider = $4
       and total = $5 and provider_ref is null and created_at > now() - interval '7 days'
     order by created_at desc limit 1`, [wsId, planId, cycle, provider, q.total]);
  if (existing[0]) return { invoice: normalizeInvoice(existing[0]), reused: true };
  const rows = await sql.query<InvoiceRow>(`with cancel as (
       update workspace_invoices set status = 'cancelled'
       where workspace_id = $1 and status = 'pending'
     ),
     ins as (
       insert into workspace_invoices (workspace_id, plan, cycle, subtotal, vat, total, currency, provider, requested_by)
       values ($1, $2, $3, $4, $5, $6, 'SAR', $7, $8)
       returning ${INVOICE_COLS}
     ),
     ev as (
       insert into workspace_events (workspace_id, actor_id, kind, detail)
       select workspace_id, $8, 'checkout', jsonb_build_object('invoice', number, 'plan', plan, 'cycle', cycle, 'provider', provider)
       from ins
     )
     select * from ins`, [wsId, planId, cycle, q.subtotal, q.vat, q.total, provider, access.userId]);
  return { invoice: normalizeInvoice(rows[0]), reused: false };
}

/**
 * Whether a provider-side payment for this invoice can still settle it: a
 * pending invoice, or one a later checkout cancelled after its payment page
 * was issued (the payer may have completed that page anyway).
 */
export function invoiceSettleable(invoice: Pick<InvoiceRow, "status" | "provider_ref">): boolean {
  return invoice.status === "pending" || (invoice.status === "cancelled" && invoice.provider_ref !== null);
}

export async function setInvoiceProviderRef(sql: SqlTag, invoiceId: string, ref: string) {
  await sql`update workspace_invoices set provider_ref = ${ref} where id = ${invoiceId} and status = 'pending'`;
}

/**
 * Mark a pending invoice paid and extend the office — one statement, so the
 * payment and the activation can never disagree. The new period runs from the
 * later of now and the current period end (paying early never loses days).
 * Returns null when the invoice is not payable (already paid, cancelled, or
 * unknown) — the call is idempotent.
 *
 * `providerVerified`: the payment provider itself confirmed this invoice was
 * paid. Such an invoice is settled even if a later checkout cancelled it —
 * the money was taken, so the office must get its period.
 */
export async function markInvoicePaidCore(
  sql: SqlTag,
  invoiceId: string,
  actorId: string | null,
  opts: { providerVerified?: boolean } = {},
): Promise<{ workspaceId: string; periodEnd: string } | null> {
  if (!UUID_RE.test(invoiceId)) return null;
  const settleCancelled = opts.providerVerified === true;
  const rows = await sql<{ id: string; current_period_end: string | Date }>`
    with inv as (
      update workspace_invoices set status = 'paid', paid_at = now(), marked_paid_by = ${actorId}
      where id = ${invoiceId}
        and (status = 'pending' or (${settleCancelled} and status = 'cancelled' and provider_ref is not null))
      returning workspace_id, plan, cycle, number
    ),
    ws as (
      update workspaces w set
        plan = inv.plan,
        billing_cycle = inv.cycle,
        status = 'active',
        current_period_end = greatest(
          case when w.status in ('active', 'past_due') then coalesce(w.current_period_end, now()) else now() end,
          now()
        ) + case when inv.cycle = 'yearly' then interval '1 year' else interval '1 month' end,
        updated_at = now()
      from inv where w.id = inv.workspace_id
      returning w.id, w.current_period_end
    ),
    ev as (
      insert into workspace_events (workspace_id, actor_id, kind, detail)
      select inv.workspace_id, ${actorId}, 'paid', jsonb_build_object('invoice', inv.number, 'plan', inv.plan, 'cycle', inv.cycle)
      from inv
    )
    select id, current_period_end from ws
  `;
  const r = rows[0];
  return r ? { workspaceId: r.id, periodEnd: iso(r.current_period_end) ?? "" } : null;
}

/* ------------------------------------------------------------------------ */
/* DEAL team console (callers must pass assertAdmin first)                   */
/* ------------------------------------------------------------------------ */

export type ConsoleWorkspace = WorkspaceRow & {
  owner_email: string | null;
  owner_name: string | null;
  members: number;
  pending_invites: number;
  pending_invoices: number;
  lifecycle: Lifecycle;
  seat_limit: number;
};

export async function consoleListCore(sql: SqlTag, now?: number): Promise<ConsoleWorkspace[]> {
  const rows = await sql.query<WorkspaceRow & {
    owner_email: string | null;
    owner_name: string | null;
    members: number;
    pending_invites: number;
    pending_invoices: number;
  }>(`select ${WS_COLS},
       (select u.email from workspace_members m join "user" u on u.id = m.user_id
          where m.workspace_id = w.id and m.role = 'owner' order by m.created_at limit 1) as owner_email,
       (select u.name from workspace_members m join "user" u on u.id = m.user_id
          where m.workspace_id = w.id and m.role = 'owner' order by m.created_at limit 1) as owner_name,
       (select count(*)::int from workspace_members m where m.workspace_id = w.id) as members,
       (select count(*)::int from workspace_invites i where i.workspace_id = w.id
          and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) as pending_invites,
       (select count(*)::int from workspace_invoices v where v.workspace_id = w.id and v.status = 'pending') as pending_invoices
     from workspaces w
     order by w.created_at desc
     limit 1000`, []);
  return rows.map((r) => {
    const ws = normalizeWs(r);
    return { ...ws, lifecycle: effectiveStatus(ws, now), seat_limit: seatLimit(ws.plan) };
  });
}

export type ConsoleInvoice = InvoiceRow & { workspace_name: string; requested_by_email: string | null };

export async function consolePendingInvoicesCore(sql: SqlTag): Promise<ConsoleInvoice[]> {
  const rows = await sql<ConsoleInvoice>`
    select v.id, v.number, v.workspace_id, v.plan, v.cycle, v.subtotal, v.vat, v.total, v.currency,
           v.provider, v.provider_ref, v.status, v.created_at, v.paid_at,
           w.name as workspace_name, u.email as requested_by_email
    from workspace_invoices v
    join workspaces w on w.id = v.workspace_id
    left join "user" u on u.id = v.requested_by
    where v.status = 'pending'
    order by v.created_at desc
    limit 200
  `;
  return rows.map((r) => ({ ...normalizeInvoice(r), workspace_name: r.workspace_name, requested_by_email: r.requested_by_email }));
}

async function consoleUpdate(rows: Promise<{ id: string }[]>) {
  const r = await rows;
  if (!r[0]) throw new WorkspaceError("not_found", 404);
}

/** Activate on a plan until `periodEnd` (manual deals, bank transfers). */
export async function consoleActivateCore(
  sql: SqlTag,
  actorId: string,
  workspaceId: string,
  planId: PlanId,
  cycle: BillingCycle,
  periodEnd: string,
) {
  getPlan(planId);
  await consoleUpdate(
    sql<{ id: string }>`
      with ws as (
        update workspaces set plan = ${planId}, billing_cycle = ${cycle}, status = 'active',
          current_period_end = ${periodEnd}::timestamptz, updated_at = now()
        where id = ${workspaceId} returning id
      ),
      ev as (
        insert into workspace_events (workspace_id, actor_id, kind, detail)
        select id, ${actorId}, 'activate', jsonb_build_object('plan', ${planId}::text, 'cycle', ${cycle}::text, 'until', ${periodEnd}::text) from ws
      )
      select id from ws
    `,
  );
}

/** Put the office (back) on trial for `days` more days from the later of now and its trial end. */
export async function consoleExtendTrialCore(sql: SqlTag, actorId: string, workspaceId: string, days: number) {
  await consoleUpdate(
    sql<{ id: string }>`
      with ws as (
        update workspaces set status = 'trialing',
          trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + ${days} * interval '1 day',
          updated_at = now()
        where id = ${workspaceId} returning id
      ),
      ev as (
        insert into workspace_events (workspace_id, actor_id, kind, detail)
        select id, ${actorId}, 'extend_trial', jsonb_build_object('days', ${days}::int) from ws
      )
      select id from ws
    `,
  );
}

export async function consoleSuspendCore(sql: SqlTag, actorId: string, workspaceId: string) {
  await consoleUpdate(
    sql<{ id: string }>`
      with ws as (
        update workspaces set status = 'suspended', updated_at = now()
        where id = ${workspaceId} returning id
      ),
      ev as (
        insert into workspace_events (workspace_id, actor_id, kind, detail)
        select id, ${actorId}, 'suspend', '{}'::jsonb from ws
      )
      select id from ws
    `,
  );
}
