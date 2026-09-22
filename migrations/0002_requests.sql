create table if not exists requests (
  id serial primary key,
  user_id text not null,
  service_slug text not null,
  service_title text not null,
  company text not null default '',
  brief text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists requests_user_id_idx on requests (user_id);
