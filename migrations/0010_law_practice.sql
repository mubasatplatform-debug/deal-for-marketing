-- «مكتب المحامي» phase 2 — the practice modules: clients, cases (with
-- lawyers, hearings, tasks and a notes timeline), appointments and remote
-- consultations, online booking, and documents.
--
-- Tenant isolation is enforced twice:
--   1. in the app — every server function passes `requireWorkspace` and every
--      query filters by the VERIFIED workspace id (src/lib/law/*-core.ts);
--   2. in the schema — child rows reference their parents through COMPOSITE
--      keys `(workspace_id, id)`, so a case can never point at another
--      office's client, a task can never be assigned to someone outside the
--      office, and so on, whatever the app sends.
--
-- Money is halalas (bigint). Times are timestamptz; the UI shows Asia/Riyadh.
-- `getSql()` runs one statement at a time, so multi-row invariants (no double
-- booking, the storage quota) live in plpgsql functions at the bottom that
-- lock the workspace row first, like 0009.

-- ---------------------------------------------------------------------------
-- Office booking + availability (one row per workspace, created on first save)
-- ---------------------------------------------------------------------------
create table if not exists law_office_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  booking_enabled boolean not null default false,
  booking_modes text[] not null default '{video,in_office,phone}'
    check (cardinality(booking_modes) between 1 and 3
           and booking_modes <@ array['video', 'in_office', 'phone']::text[]),
  -- 0 = Sunday … 6 = Saturday (Riyadh calendar days).
  work_days smallint[] not null default '{0,1,2,3,4}'
    check (cardinality(work_days) between 1 and 7 and work_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- Minutes after Riyadh midnight.
  day_start smallint not null default 540 check (day_start between 0 and 1425),
  day_end smallint not null default 1020 check (day_end between 15 and 1440),
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 20, 30, 45, 60, 90, 120)),
  buffer_minutes smallint not null default 10 check (buffer_minutes between 0 and 120),
  min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 20160),
  horizon_days smallint not null default 21 check (horizon_days between 1 and 90),
  booking_note text not null default '' check (char_length(booking_note) <= 500),
  updated_at timestamptz not null default now(),
  check (day_end > day_start)
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists law_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  kind text not null default 'individual' check (kind in ('individual', 'company')),
  name text not null check (char_length(name) between 2 and 160),
  -- E.164 (normalized by src/lib/phone.ts).
  phone text check (phone is null or phone ~ '^\+[0-9]{8,15}$'),
  email text check (email is null or (email = lower(email) and char_length(email) between 3 and 254)),
  -- National id / iqama (individual) or commercial registration (company): 10 digits.
  id_number text check (id_number is null or id_number ~ '^[0-9]{10}$'),
  notes text not null default '' check (char_length(notes) <= 4000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index if not exists law_clients_ws_idx on law_clients (workspace_id, created_at desc);
create index if not exists law_clients_phone_idx on law_clients (workspace_id, phone);

-- ---------------------------------------------------------------------------
-- Cases
-- ---------------------------------------------------------------------------
create table if not exists law_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  -- The office's own file number, 1, 2, 3… per office.
  ref_no integer not null check (ref_no > 0),
  title text not null check (char_length(title) between 2 and 200),
  client_id uuid,
  case_type text not null default 'general'
    check (case_type in ('commercial', 'labor', 'family', 'criminal', 'administrative', 'real_estate', 'general')),
  stage text not null default 'consultation'
    check (stage in ('consultation', 'study', 'filed', 'hearings', 'judgment', 'enforcement', 'closed')),
  court text not null default '' check (char_length(court) <= 160),
  court_case_no text check (court_case_no is null or char_length(court_case_no) between 1 and 60),
  opposing_party text not null default '' check (char_length(opposing_party) <= 200),
  description text not null default '' check (char_length(description) <= 4000),
  fees_halalas bigint not null default 0 check (fees_halalas between 0 and 100000000000),
  paid_halalas bigint not null default 0 check (paid_halalas between 0 and 100000000000),
  opened_on date not null default ((now() at time zone 'Asia/Riyadh')::date),
  closed_on date,
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, ref_no),
  -- A client with cases cannot be deleted (legal records).
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete restrict
);
create index if not exists law_cases_ws_idx on law_cases (workspace_id, updated_at desc);
create index if not exists law_cases_client_idx on law_cases (workspace_id, client_id);

-- Assigned lawyers: members of the SAME office (composite FK), removed with
-- the membership.
create table if not exists law_case_lawyers (
  workspace_id uuid not null,
  case_id uuid not null,
  user_id text not null,
  primary key (case_id, user_id),
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id) references workspace_members (workspace_id, user_id) on delete cascade
);
create index if not exists law_case_lawyers_user_idx on law_case_lawyers (workspace_id, user_id);

create table if not exists law_hearings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  case_id uuid not null,
  starts_at timestamptz not null,
  duration_minutes smallint not null default 60 check (duration_minutes between 5 and 600),
  court text not null default '' check (char_length(court) <= 160),
  room text not null default '' check (char_length(room) <= 60),
  status text not null default 'scheduled' check (status in ('scheduled', 'held', 'postponed', 'cancelled')),
  outcome text not null default '' check (char_length(outcome) <= 4000),
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete cascade
);
create index if not exists law_hearings_ws_idx on law_hearings (workspace_id, starts_at);
create index if not exists law_hearings_case_idx on law_hearings (case_id, starts_at);

-- ---------------------------------------------------------------------------
-- Tasks (on a case, or standalone)
-- ---------------------------------------------------------------------------
create table if not exists law_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  case_id uuid,
  title text not null check (char_length(title) between 2 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  assignee_id text,
  due_on date,
  done_at timestamptz,
  done_by text references "user" (id) on delete set null,
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete cascade,
  foreign key (workspace_id, assignee_id) references workspace_members (workspace_id, user_id)
    on delete set null (assignee_id)
);
create index if not exists law_tasks_open_idx on law_tasks (workspace_id, due_on) where done_at is null;
create index if not exists law_tasks_assignee_idx on law_tasks (workspace_id, assignee_id) where done_at is null;
create index if not exists law_tasks_case_idx on law_tasks (case_id);

-- ---------------------------------------------------------------------------
-- Appointments and consultations (a consultation is an appointment with a
-- mode, a client or lead, and a lawyer)
-- ---------------------------------------------------------------------------
create table if not exists law_appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  kind text not null default 'appointment' check (kind in ('appointment', 'consultation')),
  mode text not null default 'in_office' check (mode in ('video', 'in_office', 'phone')),
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'done', 'cancelled', 'no_show')),
  -- 'booking': the public booking page; 'office': a member added it.
  source text not null default 'office' check (source in ('office', 'booking')),
  title text not null default '' check (char_length(title) <= 200),
  client_id uuid,
  case_id uuid,
  -- A booking from someone who is not a client yet (a lead).
  lead_name text check (lead_name is null or char_length(lead_name) between 2 and 120),
  lead_phone text check (lead_phone is null or lead_phone ~ '^\+[0-9]{8,15}$'),
  lead_email text check (lead_email is null or (lead_email = lower(lead_email) and char_length(lead_email) between 3 and 254)),
  lawyer_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '' check (char_length(location) <= 200),
  -- Lawyer-only notes after the call.
  private_notes text not null default '' check (char_length(private_notes) <= 8000),
  -- Unguessable room name for the video provider (LiveKit / Jitsi).
  video_room text check (video_room is null or video_room ~ '^[a-z0-9-]{20,80}$'),
  -- A lawyer-supplied Zoom / Meet / Teams link (host allow-list in the app).
  external_url text check (external_url is null or (external_url ~ '^https://' and char_length(external_url) <= 500)),
  -- The client's meeting link: /meet/<token>. The token is derived from
  -- (id, meet_nonce) with a server secret; only its SHA-256 is stored, and a
  -- new nonce revokes the old link.
  meet_nonce text,
  meet_token_hash text unique,
  -- The lawyer let the client in from the waiting room.
  client_admitted_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours'),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete set null (client_id),
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete set null (case_id),
  foreign key (workspace_id, lawyer_id) references workspace_members (workspace_id, user_id)
    on delete set null (lawyer_id)
);
create index if not exists law_appointments_ws_idx on law_appointments (workspace_id, starts_at);
create index if not exists law_appointments_lawyer_idx on law_appointments (workspace_id, lawyer_id, starts_at);
create index if not exists law_appointments_client_idx on law_appointments (workspace_id, client_id);
create index if not exists law_appointments_pending_idx on law_appointments (workspace_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Documents (bytes in Postgres or a private Vercel Blob — src/lib/files)
-- ---------------------------------------------------------------------------
create table if not exists law_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  client_id uuid,
  case_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  mime text not null,
  size bigint not null check (size > 0),
  storage text not null check (storage in ('db', 'blob')),
  data bytea,
  blob_path text,
  uploaded_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((storage = 'db' and data is not null) or (storage = 'blob' and blob_path is not null)),
  -- A client with documents cannot be deleted; deleting a case keeps its
  -- files under the client.
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete restrict,
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete set null (case_id)
);
create index if not exists law_documents_ws_idx on law_documents (workspace_id, created_at desc);
create index if not exists law_documents_client_idx on law_documents (workspace_id, client_id);
create index if not exists law_documents_case_idx on law_documents (workspace_id, case_id);

-- ---------------------------------------------------------------------------
-- Notes timeline on a client or a case ('event' rows are written by the app,
-- e.g. a stage change)
-- ---------------------------------------------------------------------------
create table if not exists law_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  client_id uuid,
  case_id uuid,
  kind text not null default 'note' check (kind in ('note', 'event')),
  body text not null check (char_length(body) between 1 and 4000),
  author_id text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  check (client_id is not null or case_id is not null),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete cascade,
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete cascade
);
create index if not exists law_notes_client_idx on law_notes (workspace_id, client_id, created_at desc);
create index if not exists law_notes_case_idx on law_notes (workspace_id, case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Invariant-keeping writes
-- ---------------------------------------------------------------------------

-- Is `p_user` busy between p_start and p_end, widened by p_buffer minutes on
-- both sides? Counts pending/confirmed appointments assigned to them and
-- scheduled hearings of the cases they are assigned to.
create or replace function law_member_busy(
  p_ws uuid, p_user text, p_start timestamptz, p_end timestamptz, p_buffer int
) returns boolean
language sql stable as $$
  select exists (
    select 1 from law_appointments a
    where a.workspace_id = p_ws and a.lawyer_id = p_user
      and a.status in ('pending', 'confirmed')
      and a.starts_at < p_end + make_interval(mins => p_buffer)
      and a.ends_at > p_start - make_interval(mins => p_buffer)
  ) or exists (
    select 1 from law_hearings h
    join law_case_lawyers cl on cl.case_id = h.case_id and cl.user_id = p_user
    where h.workspace_id = p_ws and h.status = 'scheduled'
      and h.starts_at < p_end + make_interval(mins => p_buffer)
      and h.starts_at + make_interval(mins => h.duration_minutes) > p_start - make_interval(mins => p_buffer)
  );
$$;

-- A public booking: lock the office, give the slot to the first candidate
-- lawyer who is still free (re-checked under the lock, so two visitors can
-- never get the same lawyer at the same time), insert a pending consultation
-- and log it. Returns the new id and the lawyer, or no row when the slot was
-- taken meanwhile.
create or replace function law_book_slot(
  p_id uuid, p_ws uuid, p_candidates text[], p_mode text, p_start timestamptz, p_end timestamptz, p_buffer int,
  p_title text, p_lead_name text, p_lead_phone text, p_lead_email text, p_client uuid,
  p_room text, p_nonce text, p_token_hash text
) returns table (id uuid, lawyer_id text)
language plpgsql volatile as $$
#variable_conflict use_column
declare
  cand text;
  new_id uuid;
begin
  perform 1 from workspaces w where w.id = p_ws for update;
  if not found then return; end if;
  foreach cand in array p_candidates loop
    if exists (select 1 from workspace_members m where m.workspace_id = p_ws and m.user_id = cand)
       and not law_member_busy(p_ws, cand, p_start, p_end, p_buffer) then
      insert into law_appointments (id, workspace_id, kind, mode, status, source, title, client_id,
        lead_name, lead_phone, lead_email, lawyer_id, starts_at, ends_at, video_room, meet_nonce, meet_token_hash)
      values (p_id, p_ws, 'consultation', p_mode, 'pending', 'booking', p_title, p_client,
        p_lead_name, p_lead_phone, p_lead_email, cand, p_start, p_end, p_room, p_nonce, p_token_hash)
      returning law_appointments.id into new_id;
      insert into workspace_events (workspace_id, actor_id, kind, detail)
        values (p_ws, null, 'consult_booked',
                jsonb_build_object('id', new_id, 'mode', p_mode, 'lawyer', cand, 'starts_at', p_start));
      id := new_id;
      lawyer_id := cand;
      return next;
      return;
    end if;
  end loop;
  return;
end;
$$;

-- Store a document if the office stays within its storage quota (bytes),
-- checked under the office lock. Returns 'ok' or 'quota'.
create or replace function law_document_insert(
  p_ws uuid, p_id uuid, p_client uuid, p_case uuid, p_name text, p_mime text, p_size bigint,
  p_storage text, p_data bytea, p_blob text, p_by text, p_quota bigint
) returns text
language plpgsql volatile as $$
declare
  used bigint;
begin
  perform 1 from workspaces where id = p_ws for update;
  if not found then return 'not_found'; end if;
  select coalesce(sum(size), 0) into used from law_documents where workspace_id = p_ws;
  if used + p_size > p_quota then return 'quota'; end if;
  insert into law_documents (id, workspace_id, client_id, case_id, name, mime, size, storage, data, blob_path, uploaded_by)
    values (p_id, p_ws, p_client, p_case, p_name, p_mime, p_size, p_storage, p_data, p_blob, p_by);
  insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (p_ws, p_by, 'doc_upload', jsonb_build_object('id', p_id, 'name', p_name, 'size', p_size));
  return 'ok';
end;
$$;
