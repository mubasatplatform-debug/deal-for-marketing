-- «مكتب المحامي» as a multi-tenant SaaS — phase 1 foundation.
--
-- A workspace is one law office (the tenant). Every tenant-owned row carries
-- `workspace_id`, and phase 2 modules (appointments, clients, cases,
-- documents) must do the same. Server code reaches tenant rows only through
-- `requireWorkspace` (src/lib/saas/guard.server.ts), which checks membership
-- and role before any query runs.
--
-- Subscription state (plan, status, trial / period end) lives on the
-- workspace row. The effective status is computed on read
-- (src/lib/saas/lifecycle.ts): a lapsed trial or period turns past_due, then
-- suspended (read-only) after a grace period. Nothing here deletes data on a
-- schedule.
--
-- Multi-row invariants (seat limits, "never remove the last owner") are
-- enforced in the plpgsql functions at the bottom: each locks the workspace
-- row first, so concurrent callers of one office are serialized and each
-- reads a fresh snapshot (READ COMMITTED, one snapshot per statement).

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  -- Stable handle for later use (e.g. a sub-domain); random, never shown as a secret.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  -- Saudi commercial registration: 10 digits, optional.
  cr_number text check (cr_number is null or cr_number ~ '^[0-9]{10}$'),
  city text not null default '' check (char_length(city) <= 60),
  team_size text check (team_size is null or team_size in ('1', '2-5', '6-10', '11-25', '26+')),
  plan text not null default 'pro',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspaces_created_by_idx on workspaces (created_by);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id text not null references "user" (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'lawyer', 'staff')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on workspace_members (user_id);

-- Invites are addressed to an email and redeemed with a one-time token. Only
-- the token's SHA-256 is stored; the raw token lives in the emailed link.
create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('admin', 'lawyer', 'staff')),
  token_hash text not null unique,
  invited_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by text references "user" (id) on delete set null,
  revoked_at timestamptz
);
-- One open invite per email per office (re-inviting replaces the old link).
create unique index if not exists workspace_invites_open_idx
  on workspace_invites (workspace_id, email)
  where accepted_at is null and revoked_at is null;

-- Which office a person last opened (their preference; always re-checked
-- against membership before use).
create table if not exists workspace_user_prefs (
  user_id text primary key references "user" (id) on delete cascade,
  active_workspace_id uuid references workspaces (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Payment requests for a plan period. Not a ZATCA tax invoice: `number` is a
-- plain reference the team quotes on bank transfers. Amounts are halalas.
-- Financial records: a workspace with invoices cannot be deleted by accident.
create table if not exists workspace_invoices (
  id uuid primary key default gen_random_uuid(),
  number serial unique,
  workspace_id uuid not null references workspaces (id) on delete restrict,
  plan text not null,
  cycle text not null check (cycle in ('monthly', 'yearly')),
  subtotal integer not null check (subtotal >= 0),
  vat integer not null check (vat >= 0),
  total integer not null check (total = subtotal + vat),
  currency text not null default 'SAR',
  provider text not null check (provider in ('manual', 'moyasar')),
  provider_ref text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'failed')),
  requested_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  marked_paid_by text references "user" (id) on delete set null
);
create index if not exists workspace_invoices_ws_idx on workspace_invoices (workspace_id, created_at desc);
create index if not exists workspace_invoices_pending_idx on workspace_invoices (status) where status = 'pending';

-- Append-only log of subscription and team changes (who did what, when).
create table if not exists workspace_events (
  id bigserial primary key,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  actor_id text references "user" (id) on delete set null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workspace_events_ws_idx on workspace_events (workspace_id, id desc);

-- ---------------------------------------------------------------------------
-- Invariant-keeping writes. Each returns a short status word the app maps to a
-- message: 'ok' or the reason it refused.
-- ---------------------------------------------------------------------------

-- Create (or replace) an open invite if a seat is free. Seats in use =
-- members + open (unexpired, unaccepted, unrevoked) invites. An open invite
-- for the same email is revoked first, so re-inviting never costs a seat.
create or replace function law_invite_create(
  p_ws uuid, p_email text, p_role text, p_token_hash text, p_by text,
  p_seat_limit int, p_ttl_days int
) returns text
language plpgsql volatile as $$
declare
  used int;
begin
  perform 1 from workspaces where id = p_ws for update;
  if not found then return 'not_found'; end if;
  if exists (
    select 1 from workspace_members m join "user" u on u.id = m.user_id
    where m.workspace_id = p_ws and lower(u.email) = p_email
  ) then
    return 'already_member';
  end if;
  update workspace_invites set revoked_at = now()
    where workspace_id = p_ws and email = p_email and accepted_at is null and revoked_at is null;
  select (select count(*) from workspace_members where workspace_id = p_ws)
       + (select count(*) from workspace_invites
            where workspace_id = p_ws and accepted_at is null and revoked_at is null
              and expires_at > now())
    into used;
  if used >= p_seat_limit then return 'seat_limit'; end if;
  insert into workspace_invites (workspace_id, email, role, token_hash, invited_by, expires_at)
    values (p_ws, p_email, p_role, p_token_hash, p_by, now() + p_ttl_days * interval '1 day');
  insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (p_ws, p_by, 'invite', jsonb_build_object('email', p_email, 'role', p_role));
  return 'ok';
end;
$$;

-- Redeem an invite for a signed-in user whose account email matches it.
-- The invite already holds a seat; the member count is re-checked in case the
-- plan shrank since it was sent.
create or replace function law_invite_accept(
  p_token_hash text, p_user text, p_email text, p_seat_limit_by_plan jsonb
) returns text
language plpgsql volatile as $$
declare
  inv workspace_invites%rowtype;
  ws_plan text;
  members int;
  lim int;
begin
  select * into inv from workspace_invites where token_hash = p_token_hash;
  if not found then return 'not_found'; end if;
  select plan into ws_plan from workspaces where id = inv.workspace_id for update;
  -- Re-read under the lock: a concurrent accept / revoke may have landed.
  select * into inv from workspace_invites where id = inv.id;
  if inv.revoked_at is not null then return 'revoked'; end if;
  if inv.accepted_at is not null then
    return case when inv.accepted_by = p_user then 'ok' else 'used' end;
  end if;
  if inv.expires_at <= now() then return 'expired'; end if;
  if inv.email <> lower(p_email) then return 'email_mismatch'; end if;
  if exists (select 1 from workspace_members where workspace_id = inv.workspace_id and user_id = p_user) then
    update workspace_invites set accepted_at = now(), accepted_by = p_user where id = inv.id;
    return 'ok';
  end if;
  lim := coalesce((p_seat_limit_by_plan ->> ws_plan)::int, 0);
  select count(*) into members from workspace_members where workspace_id = inv.workspace_id;
  if members >= lim then return 'seat_limit'; end if;
  insert into workspace_members (workspace_id, user_id, role) values (inv.workspace_id, p_user, inv.role);
  update workspace_invites set accepted_at = now(), accepted_by = p_user where id = inv.id;
  insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (inv.workspace_id, p_user, 'join', jsonb_build_object('role', inv.role));
  return 'ok';
end;
$$;

-- Change a member's role. Only an owner may grant or take away 'owner', and
-- the office always keeps at least one owner.
create or replace function law_member_set_role(
  p_ws uuid, p_actor text, p_actor_role text, p_target text, p_role text
) returns text
language plpgsql volatile as $$
declare
  cur text;
  owners int;
begin
  perform 1 from workspaces where id = p_ws for update;
  if not found then return 'not_found'; end if;
  select role into cur from workspace_members where workspace_id = p_ws and user_id = p_target;
  if not found then return 'not_member'; end if;
  if cur = p_role then return 'ok'; end if;
  if (cur = 'owner' or p_role = 'owner') and p_actor_role <> 'owner' then return 'forbidden'; end if;
  if cur = 'owner' then
    select count(*) into owners from workspace_members where workspace_id = p_ws and role = 'owner';
    if owners <= 1 then return 'last_owner'; end if;
  end if;
  update workspace_members set role = p_role where workspace_id = p_ws and user_id = p_target;
  insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (p_ws, p_actor, 'role', jsonb_build_object('user', p_target, 'from', cur, 'to', p_role));
  return 'ok';
end;
$$;

-- Remove a member (or leave, when actor = target). Admins cannot remove
-- owners; the last owner can never be removed.
create or replace function law_member_remove(
  p_ws uuid, p_actor text, p_actor_role text, p_target text
) returns text
language plpgsql volatile as $$
declare
  cur text;
  owners int;
begin
  perform 1 from workspaces where id = p_ws for update;
  if not found then return 'not_found'; end if;
  select role into cur from workspace_members where workspace_id = p_ws and user_id = p_target;
  if not found then return 'not_member'; end if;
  if cur = 'owner' and p_actor_role <> 'owner' then return 'forbidden'; end if;
  if cur = 'owner' then
    select count(*) into owners from workspace_members where workspace_id = p_ws and role = 'owner';
    if owners <= 1 then return 'last_owner'; end if;
  end if;
  delete from workspace_members where workspace_id = p_ws and user_id = p_target;
  insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (p_ws, p_actor, 'remove', jsonb_build_object('user', p_target, 'role', cur));
  return 'ok';
end;
$$;
