-- «مراجعة العقود» and the office's practice profile.
--
-- law_office_ai: what an office tells the assistant once and every AI skill
-- reads — its negotiation playbook (positions on liability, payment terms,
-- jurisdiction…) and its house drafting style.
create table if not exists law_office_ai (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  playbook text not null default '' check (char_length(playbook) <= 20000),
  house_style text not null default '' check (char_length(house_style) <= 8000),
  updated_by text references "user" (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- One review of one contract (an office document), clause by clause, from
-- one side's point of view. Written in the background; `result` holds the
-- structured findings (see src/lib/law/ai/review-core.ts).
create table if not exists law_contract_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  document_id uuid references law_documents (id) on delete set null,
  document_name text not null check (char_length(document_name) between 1 and 200),
  case_id uuid,
  client_id uuid,
  -- Whose interests the review protects, in the lawyer's words.
  perspective text not null check (char_length(perspective) between 2 and 200),
  contract_type text not null default '' check (char_length(contract_type) <= 120),
  notes text not null default '' check (char_length(notes) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  overall text check (overall in ('green', 'yellow', 'red')),
  result jsonb,
  error text,
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete set null (case_id),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete set null (client_id)
);
create index if not exists law_contract_reviews_ws_idx on law_contract_reviews (workspace_id, created_at desc);
create index if not exists law_contract_reviews_doc_idx on law_contract_reviews (document_id);
create index if not exists law_contract_reviews_case_idx on law_contract_reviews (workspace_id, case_id);
