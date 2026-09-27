-- «مكتب المحامي» AI over the office's own files: the extracted text of each
-- document (for questions and summaries with page citations), and drafts the
-- assistant writes from a case (memos, statements of claim, notices, …).

-- One row per document once its text has been read (or found unreadable).
create table if not exists law_document_texts (
  document_id uuid primary key references law_documents (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  status text not null check (status in ('ready', 'empty', 'unsupported', 'failed')),
  -- How the text was obtained: the file's own text layer, or read by the model.
  method text check (method in ('pdf', 'docx', 'text', 'ocr')),
  -- Page texts in order (a Word file or an image is one "page").
  pages jsonb not null default '[]'::jsonb,
  chars integer not null default 0,
  error text,
  updated_at timestamptz not null default now()
);
create index if not exists law_document_texts_ws_idx on law_document_texts (workspace_id);

create table if not exists law_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  case_id uuid,
  client_id uuid,
  kind text not null check (kind in (
    'claim', 'defense_memo', 'reply_memo', 'objection', 'notice', 'fee_agreement',
    'contract', 'letter', 'legal_opinion', 'case_summary'
  )),
  title text not null check (char_length(title) between 1 and 200),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  -- The documents whose text the draft was written from.
  source_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  body text not null default '' check (char_length(body) <= 200000),
  error text,
  -- Set once saved into the office's documents as a Word file.
  document_id uuid references law_documents (id) on delete set null,
  -- The draft this one revised, if any.
  parent_id uuid references law_drafts (id) on delete set null,
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete set null (case_id),
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete set null (client_id)
);
create index if not exists law_drafts_ws_idx on law_drafts (workspace_id, created_at desc);
create index if not exists law_drafts_case_idx on law_drafts (workspace_id, case_id);
create index if not exists law_drafts_client_idx on law_drafts (workspace_id, client_id);
