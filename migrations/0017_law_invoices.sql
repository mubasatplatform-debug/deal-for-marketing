-- «مكتب المحامي» — client tax invoices, ZATCA e-invoicing PHASE 1 (generation).
--
-- What this covers: invoices are generated electronically, numbered
-- sequentially per office without gaps, never edited or deleted after issue
-- (a correction is a credit note that references the original), and carry the
-- Phase-1 QR code (base64 TLV: seller, VAT number, timestamp, total, VAT).
-- NOT covered: Phase 2 «الربط مع منصة فاتورة» (UBL XML, cryptographic stamp,
-- invoice hash chain, clearance / reporting to the Fatoora platform).
--
-- Money is halalas (bigint), like law_cases.fees_halalas. Rounding is per
-- line (src/lib/law/invoices-core.ts); the header totals are the line sums.

-- ---------------------------------------------------------------------------
-- The office's tax identity (one row per office, managers edit it)
-- ---------------------------------------------------------------------------
create table if not exists law_office_tax (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  -- The TLV length is one byte: the name must fit in 255 UTF-8 bytes.
  legal_name text not null check (char_length(legal_name) >= 2 and octet_length(legal_name) <= 255),
  -- 15 digits, starting and ending with 3 (ZATCA VAT registration number).
  vat_number text not null check (vat_number ~ '^3[0-9]{13}3$'),
  address text not null default '' check (char_length(address) <= 300),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gap-free numbering: one counter row per office, locked while issuing
-- ---------------------------------------------------------------------------
create table if not exists law_invoice_counters (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  last_seq integer not null default 0 check (last_seq >= 0)
);

-- ---------------------------------------------------------------------------
-- Invoices and credit notes (one numbering sequence for both per office —
-- shown as INV-000123 / CN-000124)
-- ---------------------------------------------------------------------------
create table if not exists law_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  seq integer not null check (seq > 0),
  kind text not null check (kind in ('invoice', 'credit_note')),
  -- simplified (B2C) unless the buyer has a VAT number (standard, B2B).
  invoice_type text not null check (invoice_type in ('simplified', 'standard')),
  original_id uuid,
  client_id uuid not null,
  case_id uuid,
  -- Seller snapshot at issue time (a later settings change never alters an
  -- issued invoice).
  seller_name text not null,
  seller_vat text not null check (seller_vat ~ '^3[0-9]{13}3$'),
  seller_address text not null default '',
  buyer_name text not null check (char_length(buyer_name) between 2 and 200),
  buyer_vat text check (buyer_vat is null or buyer_vat ~ '^3[0-9]{13}3$'),
  buyer_address text check (buyer_address is null or char_length(buyer_address) <= 300),
  issued_at timestamptz not null,
  currency text not null default 'SAR' check (currency = 'SAR'),
  subtotal_halalas bigint not null check (subtotal_halalas >= 0),
  vat_halalas bigint not null check (vat_halalas >= 0),
  total_halalas bigint not null check (total_halalas > 0 and total_halalas <= 100000000000),
  qr_tlv text not null,
  uuid text not null check (uuid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_by text references "user" (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, seq),
  unique (uuid),
  check (total_halalas = subtotal_halalas + vat_halalas),
  check ((invoice_type = 'standard') = (buyer_vat is not null)),
  check (invoice_type = 'simplified' or buyer_address is not null),
  -- A credit note names its original and a reason; an invoice has neither.
  check ((kind = 'credit_note') = (original_id is not null)),
  check (kind = 'invoice' or char_length(notes) >= 3),
  -- Issued invoices are legal records: a client or case with invoices cannot
  -- be deleted (the app says so first, see practice-core.ts).
  foreign key (workspace_id, client_id) references law_clients (workspace_id, id) on delete restrict,
  foreign key (workspace_id, case_id) references law_cases (workspace_id, id) on delete restrict,
  foreign key (workspace_id, original_id) references law_invoices (workspace_id, id) on delete restrict
);
create index if not exists law_invoices_ws_idx on law_invoices (workspace_id, seq desc);
create index if not exists law_invoices_client_idx on law_invoices (workspace_id, client_id);
create index if not exists law_invoices_original_idx on law_invoices (original_id) where original_id is not null;

create table if not exists law_invoice_lines (
  invoice_id uuid not null references law_invoices (id) on delete cascade,
  idx smallint not null check (idx between 1 and 50),
  description text not null check (char_length(description) between 2 and 300),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_halalas bigint not null check (unit_halalas >= 0),
  vat_rate smallint not null check (vat_rate in (0, 15)),
  -- A 0% line (exempt / out of scope) must say why.
  exemption_reason text check (exemption_reason is null or char_length(exemption_reason) between 3 and 300),
  line_net_halalas bigint not null check (line_net_halalas >= 0),
  line_vat_halalas bigint not null check (line_vat_halalas >= 0),
  primary key (invoice_id, idx),
  check (vat_rate = 15 or exemption_reason is not null),
  check (vat_rate = 0 or exemption_reason is null)
);

-- ---------------------------------------------------------------------------
-- Immutability: an issued invoice (every row here is issued — there are no
-- drafts) can never be updated or deleted. The only delete allowed is the
-- cascade when the office itself is removed.
-- ---------------------------------------------------------------------------
create or replace function law_invoice_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from workspaces w where w.id = old.workspace_id) then
    return old;
  end if;
  raise exception 'law invoice % is issued and cannot be changed', tg_op
    using errcode = 'P0001', hint = 'issue a credit note instead';
end;
$$;

create or replace function law_invoice_line_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from law_invoices i where i.id = old.invoice_id) then
    return old;
  end if;
  raise exception 'law invoice line % is issued and cannot be changed', tg_op
    using errcode = 'P0001', hint = 'issue a credit note instead';
end;
$$;

drop trigger if exists law_invoices_immutable on law_invoices;
create trigger law_invoices_immutable before update or delete on law_invoices
  for each row execute function law_invoice_immutable();

drop trigger if exists law_invoice_lines_immutable on law_invoice_lines;
create trigger law_invoice_lines_immutable before update or delete on law_invoice_lines
  for each row execute function law_invoice_line_immutable();

-- ---------------------------------------------------------------------------
-- Issue an invoice or a credit note in ONE statement (getSql() runs one
-- statement at a time): lock the office counter, check the credit limit
-- under that lock, take the next number, insert header + lines, log it.
-- Any failure rolls the counter back, so numbers stay gap-free.
-- Returns ('ok', id, seq) or ('credit_exceeded' | 'original_not_found', null, null).
-- ---------------------------------------------------------------------------
create or replace function law_issue_invoice(
  p_ws uuid, p_id uuid, p_kind text, p_type text, p_original uuid, p_client uuid, p_case uuid,
  p_seller_name text, p_seller_vat text, p_seller_address text,
  p_buyer_name text, p_buyer_vat text, p_buyer_address text,
  p_issued_at timestamptz, p_subtotal bigint, p_vat bigint, p_total bigint,
  p_qr text, p_uuid text, p_notes text, p_by text, p_lines jsonb
) returns table (result text, id uuid, seq integer)
language plpgsql volatile as $$
#variable_conflict use_column
declare
  next_seq integer;
  orig_total bigint;
  credited bigint;
  ln jsonb;
  i integer := 0;
begin
  insert into law_invoice_counters (workspace_id, last_seq) values (p_ws, 0)
    on conflict (workspace_id) do nothing;
  select c.last_seq + 1 into next_seq from law_invoice_counters c where c.workspace_id = p_ws for update;

  if p_kind = 'credit_note' then
    select o.total_halalas into orig_total from law_invoices o
      where o.id = p_original and o.workspace_id = p_ws and o.kind = 'invoice' and o.client_id = p_client;
    if orig_total is null then
      result := 'original_not_found';
      return next;
      return;
    end if;
    select coalesce(sum(n.total_halalas), 0) into credited from law_invoices n
      where n.workspace_id = p_ws and n.original_id = p_original;
    if credited + p_total > orig_total then
      result := 'credit_exceeded';
      return next;
      return;
    end if;
  end if;

  update law_invoice_counters c set last_seq = next_seq where c.workspace_id = p_ws;

  insert into law_invoices (id, workspace_id, seq, kind, invoice_type, original_id, client_id, case_id,
    seller_name, seller_vat, seller_address, buyer_name, buyer_vat, buyer_address, issued_at,
    subtotal_halalas, vat_halalas, total_halalas, qr_tlv, uuid, notes, created_by)
  values (p_id, p_ws, next_seq, p_kind, p_type, p_original, p_client, p_case,
    p_seller_name, p_seller_vat, p_seller_address, p_buyer_name, p_buyer_vat, p_buyer_address, p_issued_at,
    p_subtotal, p_vat, p_total, p_qr, p_uuid, p_notes, p_by);

  for ln in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into law_invoice_lines (invoice_id, idx, description, quantity, unit_halalas, vat_rate,
      exemption_reason, line_net_halalas, line_vat_halalas)
    values (p_id, i, ln->>'description', (ln->>'quantity')::numeric, (ln->>'unit_halalas')::bigint,
      (ln->>'vat_rate')::smallint, nullif(ln->>'exemption_reason', ''),
      (ln->>'line_net_halalas')::bigint, (ln->>'line_vat_halalas')::bigint);
  end loop;

  -- The header must equal the sum of its lines.
  if (select coalesce(sum(l.line_net_halalas), 0) from law_invoice_lines l where l.invoice_id = p_id) <> p_subtotal
     or (select coalesce(sum(l.line_vat_halalas), 0) from law_invoice_lines l where l.invoice_id = p_id) <> p_vat then
    raise exception 'invoice totals do not match its lines';
  end if;

  insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (p_ws, p_by, case when p_kind = 'invoice' then 'invoice_issued' else 'credit_note_issued' end,
            jsonb_build_object('id', p_id, 'seq', next_seq, 'total', p_total));

  result := 'ok';
  id := p_id;
  seq := next_seq;
  return next;
end;
$$;
