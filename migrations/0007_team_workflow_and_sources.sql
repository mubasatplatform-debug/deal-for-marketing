-- Team workflow on requests (assignee, internal notes, activity log) and
-- first-touch lead source tracking.
--
-- Child rows cascade with their request, so the two-year retention job
-- (src/lib/retention.server.ts) removes a request's notes and history with it.
-- Team members who lose their account leave their notes and history behind,
-- unattributed (set null), and a request assigned to them becomes unassigned.

-- Who on the team owns the request. Unassigned by default.
alter table requests add column if not exists assignee_id text
  references "user" (id) on delete set null;
create index if not exists requests_assignee_id_idx on requests (assignee_id);

-- First-touch attribution captured in the visitor's browser, validated and
-- normalized server-side. `source` is one of: snapchat, instagram, tiktok, x,
-- google, whatsapp, linkedin, direct, other (null: unknown / older requests).
alter table requests add column if not exists source text;
alter table requests add column if not exists utm_source text;
alter table requests add column if not exists utm_medium text;
alter table requests add column if not exists utm_campaign text;
alter table requests add column if not exists referrer_host text;
alter table requests add column if not exists landing_path text;

-- Team-only notes. Never selected by client-facing reads (/client, the
-- customer REST/MCP API).
create table if not exists request_notes (
  id serial primary key,
  request_id integer not null references requests (id) on delete cascade,
  author_id text references "user" (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists request_notes_request_idx on request_notes (request_id, id desc);

-- Append-only activity log: written in the same statement as the change it
-- records. kind: 'status' (from/to status), 'assign' (from/to user id, null =
-- unassigned), 'note' (to_value = note id). via: 'panel' or 'api'.
create table if not exists request_events (
  id serial primary key,
  request_id integer not null references requests (id) on delete cascade,
  actor_id text references "user" (id) on delete set null,
  kind text not null check (kind in ('status', 'assign', 'note')),
  from_value text,
  to_value text,
  via text not null default 'panel' check (via in ('panel', 'api')),
  created_at timestamptz not null default now()
);
create index if not exists request_events_request_idx on request_events (request_id, id desc);
