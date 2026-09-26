-- Client portal: a private link the office sends to a client (no account),
-- where the client sees their cases, upcoming hearings/appointments and the
-- documents the office chose to share (src/lib/law/portal-core.ts).
--
-- The link is /portal/<token>, a random 32-byte base64url token. Only its
-- SHA-256 is stored, so the full link is shown once (on creation/rotation).
-- One link per client: rotating replaces the hash (the old link stops
-- working); revoking stamps revoked_at.

create table if not exists law_client_portals (
  workspace_id uuid not null,
  client_id uuid not null,
  token_hash text unique not null,
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  primary key (client_id),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete cascade
);
create index if not exists law_client_portals_ws_idx on law_client_portals (workspace_id);

-- Documents are private to the office unless explicitly shared with their client.
alter table law_documents add column if not exists shared_with_client boolean not null default false;
