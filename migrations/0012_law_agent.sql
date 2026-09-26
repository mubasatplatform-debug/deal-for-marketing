-- «مكتب المحامي» AI assistant — one row per action the assistant (in-app) or
-- an external agent (MCP) proposed or ran on an office's data.
--
--   * In-app, a write is stored as 'pending' with the exact validated
--     arguments; only the person who asked can confirm it, and confirming runs
--     THOSE arguments (the browser never re-sends them).
--   * Over MCP, writes run directly (the external client owns confirmation)
--     and are logged here as 'done' / 'failed'.
--
-- It doubles as the office's audit log of everything AI did.
create table if not exists law_agent_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id text not null,
  source text not null check (source in ('assistant', 'mcp')),
  tool text not null check (char_length(tool) between 1 and 64),
  args jsonb not null default '{}'::jsonb,
  summary text not null default '' check (char_length(summary) <= 400),
  status text not null check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  result jsonb,
  error text check (error is null or char_length(error) <= 400),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  foreign key (workspace_id, user_id) references workspace_members (workspace_id, user_id) on delete cascade
);

create index if not exists law_agent_actions_ws_idx on law_agent_actions (workspace_id, created_at desc);
create index if not exists law_agent_actions_pending_idx on law_agent_actions (workspace_id, user_id) where status = 'pending';
