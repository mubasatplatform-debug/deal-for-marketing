-- Leads can now arrive without an account: the form collects a contact name and
-- phone, records PDPL consent, and the team is notified on insert.
alter table requests alter column user_id drop not null;
alter table requests add column if not exists contact_name text not null default '';
alter table requests add column if not exists phone text not null default '';
alter table requests add column if not exists consent_at timestamptz;
alter table requests add column if not exists notified_at timestamptz;
create index if not exists requests_created_at_idx on requests (created_at desc);

-- Fixed-window throttle shared by every serverless instance.
create table if not exists rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_key_at_idx on rate_hits (key, at);
