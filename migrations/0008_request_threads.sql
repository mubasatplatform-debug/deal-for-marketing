-- Conversation thread on each request between its customer (requests.user_id)
-- and the team, with file attachments, per-side read markers and email
-- throttling.
--
-- Unlike request_notes (team-only), thread messages ARE shown to the
-- customer. Both tables cascade with their request, so the two-year retention
-- job (src/lib/retention.server.ts) removes a request's thread and files with
-- it (and deletes Blob-stored bytes first).

create table if not exists request_messages (
  id serial primary key,
  request_id integer not null references requests (id) on delete cascade,
  -- Authors who lose their account leave their messages behind, unattributed.
  author_id text references "user" (id) on delete set null,
  role text not null check (role in ('client', 'team')),
  -- May be empty only when the message carries files (enforced server-side).
  body text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists request_messages_request_idx on request_messages (request_id, id);

-- Attachment bytes live either here (storage 'db', `data`) or in a private
-- Vercel Blob store (storage 'blob', `blob_path`); see src/lib/files/driver.ts.
-- `mime` is derived server-side from the extension after a magic-byte check,
-- never taken from the browser.
create table if not exists request_files (
  id uuid primary key default gen_random_uuid(),
  request_id integer not null references requests (id) on delete cascade,
  message_id integer not null references request_messages (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  mime text not null,
  size integer not null check (size between 1 and 10485760),
  sha256 text not null check (char_length(sha256) = 64),
  storage text not null default 'db' check (storage in ('db', 'blob')),
  data bytea,
  blob_path text,
  uploaded_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (storage = 'db' and data is not null and blob_path is null)
    or (storage = 'blob' and data is null and blob_path is not null)
  )
);
create index if not exists request_files_request_idx on request_files (request_id);
create index if not exists request_files_message_idx on request_files (message_id);

-- Read markers: the highest message id each side has seen (0 = none), and
-- when each side was last emailed about new messages (10-minute throttle).
alter table requests add column if not exists client_read_msg_id integer not null default 0;
alter table requests add column if not exists team_read_msg_id integer not null default 0;
alter table requests add column if not exists client_notified_at timestamptz;
alter table requests add column if not exists team_notified_at timestamptz;
