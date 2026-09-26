/**
 * Client tax invoices — ZATCA e-invoicing PHASE 1 (generation phase).
 *
 * Covered: electronic, sequential (gap-free per office), immutable invoices;
 * corrections only through a credit note that references the original and
 * never exceeds what is left to credit; the Phase-1 QR code (base64 TLV of
 * seller name, VAT number, timestamp, total incl. VAT, VAT total).
 * NOT covered — Phase 2 «الربط مع منصة فاتورة»: UBL 2.1 XML, the
 * cryptographic stamp (CSID), the invoice hash chain, and clearance /
 * reporting through the Fatoora API.
 *
 * Written against a bare SQL tag (relative imports only) so node tests drive
 * it on PGLite with the real migrations. The pure helpers at the top
 * (totals, QR, numbering, schemas) are also used by the browser.
 *
 * Tenant rule, as in practice-core.ts: every query filters by the VERIFIED
 * `access.workspace.id`; another office's id behaves like an unknown one.
 */
import { z } from "zod";
import { UUID_RE, WorkspaceError, type SqlTag, type WorkspaceAccess } from "../saas/tenancy-core.ts";
import { can, type Action } from "./permissions.ts";
import { PAGE_SIZE, likeEscape, plain, plainRows } from "./rows.ts";

/* ------------------------------------------------------------------------ */
/* Pure: amounts, lines, totals                                              */
/* ------------------------------------------------------------------------ */

export const VAT_RATES = [15, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];
export const DEFAULT_VAT_RATE: VatRate = 15;
/** Upper bound of one document, like law_cases.fees_halalas (1 billion SAR). */
export const MAX_TOTAL_HALALAS = 100_000_000_000;
export const MAX_LINES = 50;

export type LineInput = {
  description: string;
  /** Up to 3 decimals. */
  quantity: number;
  unitHalalas: number;
  vatRate: VatRate;
  /** Required (3+ chars) for a 0% line, ignored otherwise. */
  exemptionReason?: string | null;
};

export type ComputedLine = {
  description: string;
  quantity: number;
  unit_halalas: number;
  vat_rate: VatRate;
  exemption_reason: string | null;
  line_net_halalas: number;
  line_vat_halalas: number;
};

export type Totals = { subtotal: number; vat: number; total: number };

/** Half-up division of non-negative bigints. */
function divRound(n: bigint, d: bigint): bigint {
  return (n * 2n + d) / (2n * d);
}

/** Quantity -> thousandths (integer), exact for up to 3 decimals. */
export function quantityMilli(q: number): number {
  return Math.round(q * 1000);
}

/**
 * One line: net = quantity × unit price, rounded to the halala; VAT = net ×
 * rate, rounded to the halala (rounding per line). Integer maths only.
 */
export function computeLine(l: LineInput): ComputedLine {
  const milli = BigInt(quantityMilli(l.quantity));
  const net = divRound(milli * BigInt(Math.round(l.unitHalalas)), 1000n);
  const vat = divRound(net * BigInt(l.vatRate), 100n);
  return {
    description: l.description.trim(),
    quantity: Number(milli) / 1000,
    unit_halalas: Math.round(l.unitHalalas),
    vat_rate: l.vatRate,
    exemption_reason: l.vatRate === 0 ? (l.exemptionReason?.trim() || null) : null,
    line_net_halalas: Number(net),
    line_vat_halalas: Number(vat),
  };
}

/** Lines and totals; the totals are exactly the sums of the rounded lines. */
export function computeInvoice(lines: LineInput[]): { lines: ComputedLine[] } & Totals {
  const out = lines.map(computeLine);
  const subtotal = out.reduce((s, l) => s + l.line_net_halalas, 0);
  const vat = out.reduce((s, l) => s + l.line_vat_halalas, 0);
  return { lines: out, subtotal, vat, total: subtotal + vat };
}

/** Halalas -> "1000.00" (the QR / machine format: no separators). */
export function halalasToAmount(h: number): string {
  const n = Math.round(h);
  const neg = n < 0 ? "-" : "";
  const a = Math.abs(n);
  return `${neg}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------------ */
/* Pure: the Phase-1 QR code (TLV, base64)                                   */
/* ------------------------------------------------------------------------ */

/** ISO 8601 in UTC without milliseconds: 2022-04-25T15:30:00Z. */
export function zatcaTimestamp(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Tag-Length-Value: 1 byte tag, 1 byte length (UTF-8 bytes), the value. */
export function tlvEncode(fields: [tag: number, value: string][]): Uint8Array {
  const enc = new TextEncoder();
  const parts: number[] = [];
  for (const [tag, value] of fields) {
    const v = enc.encode(value);
    if (v.length > 255) throw new RangeError(`TLV value for tag ${tag} exceeds 255 bytes`);
    parts.push(tag, v.length, ...v);
  }
  return Uint8Array.from(parts);
}

/** Decode a base64 TLV back to { tag: value } (tests and the print page). */
export function tlvDecode(base64: string): Record<number, string> {
  const bin = atob(base64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const dec = new TextDecoder();
  const out: Record<number, string> = {};
  let i = 0;
  while (i + 1 < bytes.length) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    out[tag] = dec.decode(bytes.slice(i + 2, i + 2 + len));
    i += 2 + len;
  }
  return out;
}

/**
 * The ZATCA Phase-1 QR payload: base64 of TLV with
 *   1 seller name, 2 VAT registration number, 3 timestamp (ISO 8601),
 *   4 invoice total incl. VAT, 5 VAT total.
 */
export function zatcaQrTlv(f: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalHalalas: number;
  vatHalalas: number;
}): string {
  return bytesToBase64(
    tlvEncode([
      [1, f.sellerName],
      [2, f.vatNumber],
      [3, f.timestamp],
      [4, halalasToAmount(f.totalHalalas)],
      [5, halalasToAmount(f.vatHalalas)],
    ]),
  );
}

/* ------------------------------------------------------------------------ */
/* Pure: numbering, labels                                                   */
/* ------------------------------------------------------------------------ */

export type InvoiceKind = "invoice" | "credit_note";
export type InvoiceType = "simplified" | "standard";

/** INV-000123 / CN-000124 (one sequence per office for both kinds). */
export function invoiceNumber(kind: InvoiceKind, seq: number): string {
  return `${kind === "invoice" ? "INV" : "CN"}-${String(seq).padStart(6, "0")}`;
}

export const INVOICE_TITLES: Record<InvoiceKind, Record<InvoiceType, { ar: string; en: string }>> = {
  invoice: {
    simplified: { ar: "فاتورة ضريبية مبسطة", en: "Simplified Tax Invoice" },
    standard: { ar: "فاتورة ضريبية", en: "Tax Invoice" },
  },
  credit_note: {
    simplified: { ar: "إشعار دائن للفاتورة الضريبية المبسطة", en: "Simplified Tax Invoice Credit Note" },
    standard: { ar: "إشعار دائن للفاتورة الضريبية", en: "Tax Invoice Credit Note" },
  },
};

export const VAT_NUMBER_RE = /^3[0-9]{13}3$/;

/* ------------------------------------------------------------------------ */
/* Input schemas (server parse is the one that counts)                       */
/* ------------------------------------------------------------------------ */

const latin = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export const vatNumberField = z
  .string()
  .transform((v) => latin(v).replace(/[\s-]/g, ""))
  .pipe(z.string().regex(VAT_NUMBER_RE, "vat"));

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const taxProfileFields = z.object({
  legalName: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .refine((v) => utf8Bytes(v) <= 255, "too_long"),
  vatNumber: vatNumberField,
  address: z.string().trim().max(300).default(""),
});
export type TaxProfileFields = z.infer<typeof taxProfileFields>;

export const invoiceLineFields = z
  .object({
    description: z.string().trim().min(2).max(300),
    quantity: z
      .number()
      .positive()
      .max(100_000)
      .refine((q) => Math.abs(q * 1000 - Math.round(q * 1000)) < 1e-6, "decimals"),
    unitHalalas: z.number().int().min(0).max(MAX_TOTAL_HALALAS),
    vatRate: z.union([z.literal(15), z.literal(0)]),
    exemptionReason: optText(300),
  })
  .refine((l) => l.vatRate === 15 || (l.exemptionReason?.length ?? 0) >= 3, {
    message: "exemption_reason",
    path: ["exemptionReason"],
  });

const linesField = z.array(invoiceLineFields).min(1).max(MAX_LINES);

export const invoiceFields = z
  .object({
    clientId: z.string().uuid(),
    caseId: z.string().uuid().nullish(),
    buyerName: z.string().trim().min(2).max(200),
    buyerVat: z
      .string()
      .nullish()
      .transform((v) => (v ? latin(v).replace(/[\s-]/g, "") : null))
      .pipe(z.string().regex(VAT_NUMBER_RE, "vat").nullable()),
    buyerAddress: optText(300),
    notes: z.string().trim().max(1000).default(""),
    lines: linesField,
  })
  .refine((v) => !v.buyerVat || Boolean(v.buyerAddress), { message: "buyer_address", path: ["buyerAddress"] });
export type InvoiceFields = z.infer<typeof invoiceFields>;

export const creditNoteFields = z.object({
  originalId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
  lines: linesField,
});
export type CreditNoteFields = z.infer<typeof creditNoteFields>;

/* ------------------------------------------------------------------------ */
/* Queries                                                                   */
/* ------------------------------------------------------------------------ */

function need(access: WorkspaceAccess, action: Action): void {
  if (!can(access.role, action)) throw new WorkspaceError("role");
}

function notFound(): never {
  throw new WorkspaceError("not_found", 404);
}

function checkId(id: string | null | undefined): void {
  if (!id || !UUID_RE.test(id)) notFound();
}

export type TaxProfile = { legal_name: string; vat_number: string; address: string; updated_at: string };

async function loadTaxProfile(sql: SqlTag, ws: string): Promise<TaxProfile | null> {
  const [r] = await sql<TaxProfile>`
    select legal_name, vat_number, address, updated_at from law_office_tax where workspace_id = ${ws}
  `;
  return r ? plain<TaxProfile>(r) : null;
}

export async function getTaxProfileCore(sql: SqlTag, access: WorkspaceAccess): Promise<TaxProfile | null> {
  if (!can(access.role, "invoice.view") && !can(access.role, "settings.tax")) throw new WorkspaceError("role");
  return loadTaxProfile(sql, access.workspace.id);
}

export async function saveTaxProfileCore(sql: SqlTag, access: WorkspaceAccess, input: TaxProfileFields) {
  need(access, "settings.tax");
  const f = taxProfileFields.parse(input);
  await sql`
    insert into law_office_tax (workspace_id, legal_name, vat_number, address, updated_at)
    values (${access.workspace.id}, ${f.legalName}, ${f.vatNumber}, ${f.address}, now())
    on conflict (workspace_id) do update set legal_name = excluded.legal_name,
      vat_number = excluded.vat_number, address = excluded.address, updated_at = now()
  `;
  await sql`
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (${access.workspace.id}, ${access.userId}, 'tax_profile_saved', ${JSON.stringify({ vat: f.vatNumber })}::jsonb)
  `;
  return loadTaxProfile(sql, access.workspace.id);
}

export type InvoiceRow = {
  id: string;
  seq: number;
  number: string;
  kind: InvoiceKind;
  invoice_type: InvoiceType;
  issued_at: string;
  client_id: string;
  buyer_name: string;
  subtotal_halalas: number;
  vat_halalas: number;
  total_halalas: number;
  original_id: string | null;
  original_number: string | null;
};

export type InvoicePage = {
  rows: InvoiceRow[];
  total: number;
  page: number;
  pageSize: number;
  taxReady: boolean;
};

const ROW_COLS = `i.id, i.seq, i.kind, i.invoice_type, i.issued_at, i.client_id, i.buyer_name,
  i.subtotal_halalas::float8 as subtotal_halalas, i.vat_halalas::float8 as vat_halalas,
  i.total_halalas::float8 as total_halalas, i.original_id, o.seq as original_seq`;

function toRow(r: Record<string, unknown>): InvoiceRow {
  const x = plain<Omit<InvoiceRow, "number" | "original_number"> & { original_seq: number | null; total?: number }>(r);
  const { original_seq, total: _t, ...rest } = x;
  return {
    ...rest,
    seq: Number(rest.seq),
    number: invoiceNumber(rest.kind, Number(rest.seq)),
    original_number: original_seq ? invoiceNumber("invoice", Number(original_seq)) : null,
  };
}

export async function listInvoicesCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: { q: string; clientId?: string | null; page: number },
): Promise<InvoicePage> {
  need(access, "invoice.view");
  const ws = access.workspace.id;
  const q = latin(f.q.trim());
  const like = `%${likeEscape(q)}%`;
  const seqQ = /^(?:inv|cn)?-?0*(\d{1,9})$/i.exec(q)?.[1] ?? null;
  const clientId = f.clientId && UUID_RE.test(f.clientId) ? f.clientId : null;
  const offset = (f.page - 1) * PAGE_SIZE;
  const [rows, tax] = await Promise.all([
    sql.query<Record<string, unknown>>(
      `select ${ROW_COLS}, count(*) over ()::int as total
       from law_invoices i
       left join law_invoices o on o.id = i.original_id and o.workspace_id = i.workspace_id
       where i.workspace_id = $1
         and ($2 = '' or i.buyer_name ilike $3 or ($4::int is not null and i.seq = $4::int))
         and ($5::uuid is null or i.client_id = $5::uuid)
       order by i.seq desc
       limit ${PAGE_SIZE} offset ${offset}`,
      [ws, q, like, seqQ, clientId],
    ),
    loadTaxProfile(sql, ws),
  ]);
  return {
    rows: rows.map(toRow),
    total: Number((rows[0] as { total?: number } | undefined)?.total ?? 0),
    page: f.page,
    pageSize: PAGE_SIZE,
    taxReady: tax !== null,
  };
}

export type InvoiceLineRow = ComputedLine & { idx: number };

export type InvoiceDetail = {
  invoice: InvoiceRow & {
    uuid: string;
    case_id: string | null;
    seller_name: string;
    seller_vat: string;
    seller_address: string;
    buyer_vat: string | null;
    buyer_address: string | null;
    currency: "SAR";
    qr_tlv: string;
    notes: string;
    created_at: string;
    created_by_name: string | null;
  };
  lines: InvoiceLineRow[];
  caseRef: { id: string; ref_no: number; title: string } | null;
  creditNotes: { id: string; number: string; issued_at: string; total_halalas: number }[];
  /** For an invoice: what is left to credit (total − credit notes). 0 for a credit note. */
  creditable: number;
  canIssue: boolean;
};

export async function getInvoiceCore(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<InvoiceDetail> {
  need(access, "invoice.view");
  checkId(id);
  const ws = access.workspace.id;
  const [head] = await sql.query<Record<string, unknown>>(
    `select ${ROW_COLS}, i.uuid, i.case_id, i.seller_name, i.seller_vat, i.seller_address, i.buyer_vat,
            i.buyer_address, i.currency, i.qr_tlv, i.notes, i.created_at,
            coalesce(nullif(u.name, ''), u.email) as created_by_name
     from law_invoices i
     left join law_invoices o on o.id = i.original_id and o.workspace_id = i.workspace_id
     left join "user" u on u.id = i.created_by
     where i.id = $1 and i.workspace_id = $2`,
    [id, ws],
  );
  if (!head) notFound();
  const invoice = { ...(plain<Record<string, unknown>>(head) as object), ...toRow(head) } as InvoiceDetail["invoice"];
  const [lines, credits, caseRows] = await Promise.all([
    sql<Record<string, unknown>>`
      select idx, description, quantity::float8 as quantity, unit_halalas::float8 as unit_halalas, vat_rate,
             exemption_reason, line_net_halalas::float8 as line_net_halalas,
             line_vat_halalas::float8 as line_vat_halalas
      from law_invoice_lines where invoice_id = ${id} order by idx
    `,
    sql<Record<string, unknown>>`
      select id, seq, issued_at, total_halalas::float8 as total_halalas from law_invoices
      where workspace_id = ${ws} and original_id = ${id} order by seq
    `,
    invoice.case_id
      ? sql<{ id: string; ref_no: number; title: string }>`
          select id, ref_no, title from law_cases where id = ${invoice.case_id} and workspace_id = ${ws}
        `
      : Promise.resolve([]),
  ]);
  const creditNotes = plainRows<{ id: string; seq: number; issued_at: string; total_halalas: number }>(credits).map((c) => ({
    id: c.id,
    number: invoiceNumber("credit_note", Number(c.seq)),
    issued_at: c.issued_at,
    total_halalas: Number(c.total_halalas),
  }));
  const credited = creditNotes.reduce((s, c) => s + c.total_halalas, 0);
  return {
    invoice,
    lines: plainRows<InvoiceLineRow>(lines).map((l) => ({ ...l, vat_rate: Number(l.vat_rate) as VatRate })),
    caseRef: caseRows[0] ? plain<{ id: string; ref_no: number; title: string }>(caseRows[0]) : null,
    creditNotes,
    creditable: invoice.kind === "invoice" ? Math.max(0, invoice.total_halalas - credited) : 0,
    canIssue: can(access.role, "invoice.issue") && !access.lifecycle.readOnly,
  };
}

export type InvoiceClient = {
  id: string;
  name: string;
  kind: "individual" | "company";
  cases: { id: string; ref_no: number; title: string }[];
};

/** A client for the new-invoice form: its kind (standard invoice) and cases (optional link). */
export async function invoiceClientCore(sql: SqlTag, access: WorkspaceAccess, clientId: string): Promise<InvoiceClient> {
  need(access, "invoice.view");
  checkId(clientId);
  const ws = access.workspace.id;
  const [client] = await sql<{ id: string; name: string; kind: "individual" | "company" }>`
    select id, name, kind from law_clients where id = ${clientId} and workspace_id = ${ws}
  `;
  if (!client) notFound();
  const cases = await sql<{ id: string; ref_no: number; title: string }>`
    select id, ref_no, title from law_cases
    where workspace_id = ${ws} and client_id = ${clientId}
    order by updated_at desc limit 100
  `;
  return { ...client, cases: plainRows<{ id: string; ref_no: number; title: string }>(cases) };
}

type IssueResult = { id: string; seq: number; number: string };

async function callIssue(
  sql: SqlTag,
  access: WorkspaceAccess,
  d: {
    id: string;
    kind: InvoiceKind;
    type: InvoiceType;
    originalId: string | null;
    clientId: string;
    caseId: string | null;
    seller: TaxProfile;
    buyerName: string;
    buyerVat: string | null;
    buyerAddress: string | null;
    issuedAt: string;
    computed: ReturnType<typeof computeInvoice>;
    qr: string;
    notes: string;
  },
): Promise<IssueResult> {
  const c = d.computed;
  const lines = c.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity.toFixed(3),
    unit_halalas: l.unit_halalas,
    vat_rate: l.vat_rate,
    exemption_reason: l.exemption_reason ?? "",
    line_net_halalas: l.line_net_halalas,
    line_vat_halalas: l.line_vat_halalas,
  }));
  const [r] = await sql<{ result: string; id: string | null; seq: number | null }>`
    select result, id, seq from law_issue_invoice(
      ${access.workspace.id}::uuid, ${d.id}::uuid, ${d.kind}::text, ${d.type}::text, ${d.originalId}::uuid,
      ${d.clientId}::uuid, ${d.caseId}::uuid,
      ${d.seller.legal_name}::text, ${d.seller.vat_number}::text, ${d.seller.address}::text,
      ${d.buyerName}::text, ${d.buyerVat}::text, ${d.buyerAddress}::text,
      ${d.issuedAt}::timestamptz, ${c.subtotal}::bigint, ${c.vat}::bigint, ${c.total}::bigint,
      ${d.qr}::text, ${crypto.randomUUID()}::text, ${d.notes}::text, ${access.userId}::text,
      ${JSON.stringify(lines)}::jsonb
    )
  `;
  if (!r || r.result === "original_not_found") notFound();
  if (r.result === "credit_exceeded") throw new WorkspaceError("credit_exceeded", 409);
  if (r.result !== "ok" || !r.id || !r.seq) throw new WorkspaceError("invalid", 422);
  const seq = Number(r.seq);
  return { id: r.id, seq, number: invoiceNumber(d.kind, seq) };
}

function checkTotals(c: Totals) {
  if (c.total <= 0 || c.total > MAX_TOTAL_HALALAS) throw new WorkspaceError("invalid", 422);
}

async function requireTaxProfile(sql: SqlTag, ws: string): Promise<TaxProfile> {
  const seller = await loadTaxProfile(sql, ws);
  if (!seller || !VAT_NUMBER_RE.test(seller.vat_number) || seller.legal_name.trim().length < 2) {
    throw new WorkspaceError("tax_profile", 409);
  }
  return seller;
}

/**
 * Issue a tax invoice to a client. Simplified (B2C) by default; standard
 * (B2B) when the client is a company and a buyer VAT number is given.
 * Refused while the office has no legal name / VAT number.
 */
export async function issueInvoiceCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  input: InvoiceFields,
  opts: { now?: Date } = {},
): Promise<IssueResult> {
  need(access, "invoice.issue");
  const f = invoiceFields.parse(input);
  const ws = access.workspace.id;
  const seller = await requireTaxProfile(sql, ws);

  const [client] = await sql<{ id: string; kind: string }>`
    select id, kind from law_clients where id = ${f.clientId} and workspace_id = ${ws}
  `;
  if (!client) notFound();
  if (f.caseId) {
    const [k] = await sql<{ client_id: string | null }>`
      select client_id from law_cases where id = ${f.caseId} and workspace_id = ${ws}
    `;
    if (!k) notFound();
    if (k.client_id !== f.clientId) throw new WorkspaceError("invalid", 422);
  }
  if (f.buyerVat && client.kind !== "company") throw new WorkspaceError("invalid", 422);

  const computed = computeInvoice(f.lines);
  checkTotals(computed);
  const issuedAt = zatcaTimestamp(opts.now ?? new Date());
  const qr = zatcaQrTlv({
    sellerName: seller.legal_name,
    vatNumber: seller.vat_number,
    timestamp: issuedAt,
    totalHalalas: computed.total,
    vatHalalas: computed.vat,
  });
  return callIssue(sql, access, {
    id: crypto.randomUUID(),
    kind: "invoice",
    type: f.buyerVat ? "standard" : "simplified",
    originalId: null,
    clientId: f.clientId,
    caseId: f.caseId ?? null,
    seller,
    buyerName: f.buyerName,
    buyerVat: f.buyerVat,
    buyerAddress: f.buyerAddress,
    issuedAt,
    computed,
    qr,
    notes: f.notes,
  });
}

/**
 * Issue a credit note against an invoice of this office. Its total (incl.
 * VAT) may not exceed what is left to credit on the original — checked in
 * the database under the office's numbering lock, so two concurrent credit
 * notes cannot over-credit.
 */
export async function issueCreditNoteCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  input: CreditNoteFields,
  opts: { now?: Date } = {},
): Promise<IssueResult> {
  need(access, "invoice.issue");
  const f = creditNoteFields.parse(input);
  const ws = access.workspace.id;
  const seller = await requireTaxProfile(sql, ws);
  const [orig] = await sql<{
    id: string;
    kind: InvoiceKind;
    invoice_type: InvoiceType;
    client_id: string;
    case_id: string | null;
    buyer_name: string;
    buyer_vat: string | null;
    buyer_address: string | null;
  }>`
    select id, kind, invoice_type, client_id, case_id, buyer_name, buyer_vat, buyer_address
    from law_invoices where id = ${f.originalId} and workspace_id = ${ws}
  `;
  if (!orig || orig.kind !== "invoice") notFound();
  const computed = computeInvoice(f.lines);
  checkTotals(computed);
  const issuedAt = zatcaTimestamp(opts.now ?? new Date());
  const qr = zatcaQrTlv({
    sellerName: seller.legal_name,
    vatNumber: seller.vat_number,
    timestamp: issuedAt,
    totalHalalas: computed.total,
    vatHalalas: computed.vat,
  });
  return callIssue(sql, access, {
    id: crypto.randomUUID(),
    kind: "credit_note",
    type: orig.invoice_type,
    originalId: orig.id,
    clientId: orig.client_id,
    caseId: orig.case_id,
    seller,
    buyerName: orig.buyer_name,
    buyerVat: orig.buyer_vat,
    buyerAddress: orig.buyer_address,
    issuedAt,
    computed,
    qr,
    notes: f.reason,
  });
}
