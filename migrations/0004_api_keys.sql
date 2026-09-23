-- Developer platform: scoped API keys for the REST API (/api/v1) and the MCP
-- server (/api/mcp), plus a usage log the team can read.
--
-- Only a SHA-256 hash of each secret is stored; the full `deal_live_…` value is
-- shown to its owner once, at creation. `prefix` is the non-secret head of the
-- key, kept so people can tell their keys apart in the UI.

create table if not exists api_keys (
  id serial primary key,
  user_id text not null references "user"(id) on delete cascade,
  name text not null default '',
  prefix text not null unique,
  key_hash text not null unique,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_user_id_idx on api_keys (user_id, created_at desc);

-- One row per authenticated API call: REST (`method` + `target` = path) or an
-- MCP tool call (`method` = 'MCP', `target` = tool name).
create table if not exists api_audit (
  id bigserial primary key,
  key_id integer not null references api_keys(id) on delete cascade,
  at timestamptz not null default now(),
  method text not null,
  target text not null,
  status integer not null
);
create index if not exists api_audit_at_idx on api_audit (at desc);
create index if not exists api_audit_key_at_idx on api_audit (key_id, at desc);
