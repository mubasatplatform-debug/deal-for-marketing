-- «مركز الاتصال» phase 2 — outbound calls from the browser (softphone).
--
-- A member calls a Saudi number through the `deal-voice` relay (Twilio Voice).
-- Each call is one `law_calls` row, created by the app before the browser
-- dials; the relay then reports progress (status / recording) to
-- /api/voice/events, which updates the row by its id (`callId`).
--
-- Tenant isolation, as in 0010/0018: every row carries `workspace_id`, the app
-- filters by the VERIFIED workspace (src/lib/law/voice-core.ts), and the
-- client / conversation references are composite `(workspace_id, id)` keys, so
-- a call can never point at another office's client or conversation.
--
-- Recordings stay at Twilio: only the recording SID is kept here; the audio
-- is streamed through the relay on demand to members of the office.

create table if not exists law_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  -- Who placed the call.
  user_id text references "user" (id) on delete set null,
  client_id uuid,
  conversation_id uuid,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  to_phone text not null check (to_phone ~ '^\+[0-9]{8,15}$'),
  status text not null default 'queued'
    check (status in ('queued', 'initiated', 'ringing', 'in_progress', 'completed', 'busy', 'no_answer', 'failed', 'canceled')),
  -- Recording was on for this call (the office setting at dial time).
  recorded boolean not null default false,
  call_sid text check (call_sid is null or char_length(call_sid) <= 64),
  duration_sec integer not null default 0 check (duration_sec >= 0),
  recording_sid text check (recording_sid is null or char_length(recording_sid) <= 64),
  transcript text check (transcript is null or char_length(transcript) <= 60000),
  ai_summary text check (ai_summary is null or char_length(ai_summary) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete set null (client_id),
  foreign key (workspace_id, conversation_id) references law_conversations (workspace_id, id)
    on delete set null (conversation_id)
);
create index if not exists law_calls_recent_idx on law_calls (workspace_id, created_at desc);
-- The per-member hourly cap counts these.
create index if not exists law_calls_user_idx on law_calls (user_id, created_at desc);
create index if not exists law_calls_client_idx on law_calls (workspace_id, client_id);

create table if not exists law_voice_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  record_calls boolean not null default false,
  updated_at timestamptz not null default now()
);
