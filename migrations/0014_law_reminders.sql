-- «مكتب المحامي» automatic reminders (src/lib/law/reminders-core.ts, run by
-- the cron endpoint /api/cron/reminders).
--
-- 1. Per-office switches. A missing row means both are on.
-- 2. A ledger of reminders already claimed: the primary key is the
--    idempotency key, so a reminder is never sent twice even when two runs
--    overlap (each claims with `insert … on conflict do nothing returning`
--    BEFORE sending, and deletes its claim if the send fails so it retries).
--
--    kind       'client_24h' | 'client_1h' | 'lawyer_daily'
--    ref_id     client: md5(appointment id | start epoch)::uuid — a moved
--               appointment is reminded again for its new time;
--               lawyer: md5(workspace | user | Riyadh date)::uuid.
--    recipient  the email address it went to.

create table if not exists law_reminder_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  client_consult boolean not null default true,
  lawyer_daily boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists law_reminders_sent (
  kind text not null check (kind in ('client_24h', 'client_1h', 'lawyer_daily')),
  ref_id uuid not null,
  recipient text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref_id, recipient)
);
create index if not exists law_reminders_sent_at_idx on law_reminders_sent (sent_at);
