-- «مركز التواصل» — the office's omnichannel inbox (phase 1: web chat + AI).
--
-- Channel-agnostic: a conversation belongs to one channel ('webchat' today;
-- 'whatsapp', 'sms', 'email' and 'voice' plug in through the adapters in
-- src/lib/law/inbox-channels.ts without schema changes). Messages carry the
-- channel's own ids and delivery state in `channel_meta`.
--
-- Tenant isolation, as in 0010: every row carries `workspace_id`, the app
-- filters by the VERIFIED workspace (src/lib/law/inbox-core.ts), and child
-- rows reference their parents through composite keys `(workspace_id, id)`,
-- so a conversation can never point at another office's client or member.
--
-- A web-chat visitor is identified only by an unguessable token kept in their
-- browser; the table stores its SHA-256 (`visitor_key`), never the token.

create table if not exists law_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  channel text not null default 'webchat'
    check (channel in ('webchat', 'whatsapp', 'sms', 'email', 'voice')),
  -- 'bot': the AI first responder is handling it; 'open': waiting for the team;
  -- 'pending': the team answered and waits for the contact; 'closed'.
  status text not null default 'open' check (status in ('bot', 'open', 'pending', 'closed')),
  subject text not null default '' check (char_length(subject) <= 200),
  client_id uuid,
  contact_name text not null default '' check (char_length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[0-9]{8,15}$'),
  contact_email text check (contact_email is null or (contact_email = lower(contact_email) and char_length(contact_email) between 3 and 254)),
  assignee_id text,
  visitor_key text check (visitor_key is null or visitor_key ~ '^[0-9a-f]{64}$'),
  ai_summary text not null default '' check (char_length(ai_summary) <= 4000),
  ai_intent text check (ai_intent is null or ai_intent in ('new_consultation', 'case_followup', 'fees', 'appointment', 'other')),
  -- Inbound messages the team has not read yet (shared by the office).
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete set null (client_id),
  foreign key (workspace_id, assignee_id) references workspace_members (workspace_id, user_id)
    on delete set null (assignee_id)
);
create index if not exists law_conversations_inbox_idx on law_conversations (workspace_id, status, last_message_at desc);
create index if not exists law_conversations_recent_idx on law_conversations (workspace_id, last_message_at desc);
create index if not exists law_conversations_assignee_idx on law_conversations (workspace_id, assignee_id) where status <> 'closed';
create index if not exists law_conversations_client_idx on law_conversations (workspace_id, client_id);
create unique index if not exists law_conversations_visitor_idx on law_conversations (visitor_key) where visitor_key is not null;

create table if not exists law_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  conversation_id uuid not null,
  -- 'in': from the contact; 'out': to the contact (a member or the AI);
  -- 'note': internal, never shown to the contact; 'system': an event.
  direction text not null check (direction in ('in', 'out', 'note', 'system')),
  author_kind text not null check (author_kind in ('contact', 'member', 'ai', 'system')),
  author_id text references "user" (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  -- Channel ids / delivery state; `{"public": true}` marks a system event the
  -- contact may see.
  channel_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (direction <> 'note' or author_kind = 'member'),
  foreign key (workspace_id, conversation_id) references law_conversations (workspace_id, id) on delete cascade
);
create index if not exists law_messages_conv_idx on law_messages (conversation_id, created_at);
-- The AI first responder's daily cap per office counts these.
create index if not exists law_messages_ai_idx on law_messages (workspace_id, created_at) where author_kind = 'ai';

create table if not exists law_inbox_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  webchat_enabled boolean not null default false,
  ai_first_reply boolean not null default true,
  welcome text not null default '' check (char_length(welcome) <= 500),
  away_text text not null default '' check (char_length(away_text) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists law_quick_replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 2000),
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists law_quick_replies_ws_idx on law_quick_replies (workspace_id, title);
