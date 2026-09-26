/**
 * Tax invoices (ZATCA phase 1) on a real schema (PGLite + every migration):
 * the QR TLV known vector, per-line rounding, gap-free numbering per office,
 * the immutability trigger, credit-note limits, the missing tax profile,
 * tenant isolation and roles.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import { createCaseCore, createClientCore, deleteCaseCore, deleteClientCore } from "./practice-core.ts";
import { caseFields, clientFields } from "./schemas.ts";
import {
  computeInvoice,
  computeLine,
  getInvoiceCore,
  getTaxProfileCore,
  invoiceNumber,
  issueCreditNoteCore,
  issueInvoiceCore,
  listInvoicesCore,
  saveTaxProfileCore,
  taxProfileFields,
  tlvDecode,
  zatcaQrTlv,
  zatcaTimestamp,
  type InvoiceFields,
} from "./invoices-core.ts";

const migrationsDir = new URL("../../../migrations/", import.meta.url);

async function freshDb(): Promise<{ pg: PGlite; sql: SqlTag }> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(new URL(name, migrationsDir), "utf8"));
  }
  const tag = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return (await pg.query(text, values)).rows;
  }) as unknown as SqlTag;
  tag.query = (async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows) as SqlTag["query"];
  return { pg, sql: tag };
}

async function member(pg: PGlite, ws: string, user: string, role: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [user, `U ${user}`, `${user}@x.sa`]);
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [ws, user, role]);
}

const isCode = (code: string) => (e: unknown) => e instanceof WorkspaceError && e.code === code;

const SELLER = { legalName: "مكتب الأمانة للمحاماة", vatNumber: "310122393500003", address: "الرياض، حي العليا" };

async function setup() {
  const { pg, sql } = await freshDb();
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o', 'Owner', 'o@x.sa', true)`);
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب الأمانة", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "inv-1" });
  await member(pg, w.id, "l", "lawyer");
  await member(pg, w.id, "s", "staff");
  const owner = await resolveMembership(sql, "o", w.id, "staff", { write: true });
  const lawyer = await resolveMembership(sql, "l", w.id, "staff", { write: true });
  const staff = await resolveMembership(sql, "s", w.id, "staff", { write: true });
  const person = await createClientCore(sql, owner, clientFields.parse({ kind: "individual", name: "سارة العتيبي" }));
  const company = await createClientCore(sql, owner, clientFields.parse({ kind: "company", name: "شركة النخبة" }));
  return { pg, sql, w, owner, lawyer, staff, person, company };
}

function simple(clientId: string, over: Partial<InvoiceFields> = {}): InvoiceFields {
  return {
    clientId,
    caseId: null,
    buyerName: "سارة العتيبي",
    buyerVat: null,
    buyerAddress: null,
    notes: "",
    lines: [{ description: "أتعاب استشارة قانونية", quantity: 1, unitHalalas: 100_000, vatRate: 15, exemptionReason: null }],
    ...over,
  };
}

/* ------------------------------------------------------------------------ */
/* Pure                                                                      */
/* ------------------------------------------------------------------------ */

test("QR: the well-known ZATCA phase-1 TLV vector", () => {
  const qr = zatcaQrTlv({
    sellerName: "Bobs Records",
    vatNumber: "310122393500003",
    timestamp: zatcaTimestamp(new Date("2022-04-25T15:30:00Z")),
    totalHalalas: 100_000,
    vatHalalas: 15_000,
  });
  assert.equal(qr, "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==");
});

test("QR: lengths are UTF-8 bytes (Arabic seller name) and decode back", () => {
  const qr = zatcaQrTlv({ sellerName: "مكتب", vatNumber: "300000000000003", timestamp: "2026-09-26T09:00:00Z", totalHalalas: 115, vatHalalas: 15 });
  const bytes = Buffer.from(qr, "base64");
  assert.equal(bytes[0], 1);
  assert.equal(bytes[1], Buffer.byteLength("مكتب", "utf8"));
  assert.equal(bytes[1], 8);
  assert.deepEqual(tlvDecode(qr), { 1: "مكتب", 2: "300000000000003", 3: "2026-09-26T09:00:00Z", 4: "1.15", 5: "0.15" });
  assert.throws(() => zatcaQrTlv({ sellerName: "م".repeat(200), vatNumber: "300000000000003", timestamp: "x", totalHalalas: 1, vatHalalas: 0 }));
  assert.equal(taxProfileFields.safeParse({ ...SELLER, legalName: "م".repeat(150) }).success, false, "name > 255 bytes refused");
});

test("totals: rounding per line, totals equal the sum of rounded lines", () => {
  // 3 × 33.33 = 99.99 → VAT 14.9985 → 15.00
  assert.deepEqual(
    [computeLine({ description: "x", quantity: 3, unitHalalas: 3333, vatRate: 15 })].map((l) => [l.line_net_halalas, l.line_vat_halalas]),
    [[9999, 1500]],
  );
  // 1.5 × 0.33 = 0.495 → 0.50 (half-up); VAT 0.075 → 0.08
  const l = computeLine({ description: "x", quantity: 1.5, unitHalalas: 33, vatRate: 15 });
  assert.equal(l.line_net_halalas, 50);
  assert.equal(l.line_vat_halalas, 8);
  // Three lines of 0.10 each: per-line VAT 0.02 (0.015 → 0.02) → 0.06, not round(0.045) = 0.05.
  const t = computeInvoice([1, 2, 3].map(() => ({ description: "x", quantity: 1, unitHalalas: 10, vatRate: 15 as const })));
  assert.equal(t.subtotal, 30);
  assert.equal(t.vat, 6);
  assert.equal(t.total, 36);
  // An exempt line carries no VAT and keeps its reason.
  const e = computeInvoice([
    { description: "أتعاب", quantity: 2, unitHalalas: 50_000, vatRate: 15 },
    { description: "رسوم حكومية", quantity: 1, unitHalalas: 20_000, vatRate: 0, exemptionReason: "رسوم حكومية خارج نطاق الضريبة" },
  ]);
  assert.deepEqual([e.subtotal, e.vat, e.total], [120_000, 15_000, 135_000]);
  assert.equal(e.lines[1].exemption_reason, "رسوم حكومية خارج نطاق الضريبة");
  assert.equal(invoiceNumber("invoice", 123), "INV-000123");
  assert.equal(invoiceNumber("credit_note", 4), "CN-000004");
});

/* ------------------------------------------------------------------------ */
/* Database                                                                  */
/* ------------------------------------------------------------------------ */

test("invoices: refused until the office sets its legal name and VAT number", async () => {
  const { sql, owner, lawyer, person } = await setup();
  await assert.rejects(issueInvoiceCore(sql, lawyer, simple(person.id)), isCode("tax_profile"));
  // Only managers set the tax profile, and the VAT number is validated.
  await assert.rejects(saveTaxProfileCore(sql, lawyer, SELLER), isCode("role"));
  await assert.rejects(saveTaxProfileCore(sql, owner, { ...SELLER, vatNumber: "210122393500003" }));
  await assert.rejects(saveTaxProfileCore(sql, owner, { ...SELLER, vatNumber: "31012239350000" }));
  const saved = await saveTaxProfileCore(sql, owner, { ...SELLER, vatNumber: "٣١٠١٢٢٣٩٣٥٠٠٠٠٣" });
  assert.equal(saved?.vat_number, "310122393500003", "Arabic-Indic digits normalized");
  assert.equal((await getTaxProfileCore(sql, lawyer))?.legal_name, SELLER.legalName);
  const r = await issueInvoiceCore(sql, lawyer, simple(person.id));
  assert.equal(r.number, "INV-000001");
});

test("invoices: simplified by default, standard for a company with a VAT number; QR matches the stored invoice", async () => {
  const { sql, owner, lawyer, person, company } = await setup();
  await saveTaxProfileCore(sql, owner, SELLER);
  const now = new Date("2026-09-26T09:15:42.123Z");
  const a = await issueInvoiceCore(sql, lawyer, simple(person.id), { now });
  const d = await getInvoiceCore(sql, lawyer, a.id);
  assert.equal(d.invoice.invoice_type, "simplified");
  assert.equal(d.invoice.kind, "invoice");
  assert.equal(d.invoice.total_halalas, 115_000);
  assert.equal(d.invoice.vat_halalas, 15_000);
  assert.equal(d.invoice.issued_at, "2026-09-26T09:15:42.000Z");
  assert.match(d.invoice.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(tlvDecode(d.invoice.qr_tlv), {
    1: SELLER.legalName,
    2: SELLER.vatNumber,
    3: "2026-09-26T09:15:42Z",
    4: "1150.00",
    5: "150.00",
  });
  assert.equal(d.lines.length, 1);
  assert.equal(d.lines[0].quantity, 1);
  assert.equal(d.invoice.seller_address, SELLER.address);

  // Buyer VAT number on an individual: refused. On a company: standard, address required.
  await assert.rejects(issueInvoiceCore(sql, lawyer, simple(person.id, { buyerVat: "300000000000003", buyerAddress: "جدة" })), isCode("invalid"));
  await assert.rejects(issueInvoiceCore(sql, lawyer, simple(company.id, { buyerName: "شركة النخبة", buyerVat: "300000000000003" })));
  const b = await issueInvoiceCore(
    sql,
    lawyer,
    simple(company.id, { buyerName: "شركة النخبة المحدودة", buyerVat: "300000000000003", buyerAddress: "جدة، طريق الملك" }),
  );
  const bd = await getInvoiceCore(sql, lawyer, b.id);
  assert.equal(bd.invoice.invoice_type, "standard");
  assert.equal(bd.invoice.buyer_vat, "300000000000003");

  // A 0% line needs a reason.
  await assert.rejects(
    issueInvoiceCore(sql, lawyer, simple(person.id, { lines: [{ description: "رسوم", quantity: 1, unitHalalas: 100, vatRate: 0, exemptionReason: null }] })),
  );
  // A seller change later never alters an issued invoice.
  await saveTaxProfileCore(sql, owner, { ...SELLER, legalName: "اسم جديد" });
  assert.equal((await getInvoiceCore(sql, lawyer, a.id)).invoice.seller_name, SELLER.legalName);
});

test("invoices: gap-free sequence per office, shared by invoices and credit notes, also under concurrency", async () => {
  const { pg, sql, owner, lawyer, person } = await setup();
  await saveTaxProfileCore(sql, owner, SELLER);
  const results = await Promise.all(Array.from({ length: 6 }, () => issueInvoiceCore(sql, lawyer, simple(person.id))));
  assert.deepEqual(results.map((r) => r.seq).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6]);
  // A failed issue (bad credit) does not burn a number.
  await assert.rejects(
    issueCreditNoteCore(sql, lawyer, {
      originalId: results[0].id,
      reason: "خصم متفق عليه",
      lines: [{ description: "خصم", quantity: 1, unitHalalas: 999_999_00, vatRate: 15, exemptionReason: null }],
    }),
    isCode("credit_exceeded"),
  );
  const cn = await issueCreditNoteCore(sql, lawyer, {
    originalId: results[0].id,
    reason: "خصم متفق عليه",
    lines: [{ description: "خصم", quantity: 1, unitHalalas: 10_000, vatRate: 15, exemptionReason: null }],
  });
  assert.equal(cn.seq, 7);
  assert.equal(cn.number, "CN-000007");
  const page = await listInvoicesCore(sql, lawyer, { q: "", page: 1 });
  assert.equal(page.total, 7);
  assert.equal(page.taxReady, true);
  assert.equal(page.rows[0].kind, "credit_note");
  assert.equal(page.rows[0].original_number, results[0].number);
  // Search by number.
  assert.equal((await listInvoicesCore(sql, lawyer, { q: "INV-000003", page: 1 })).rows[0]?.seq, 3);
  // The unique constraint backs the counter.
  const [{ id }] = (await pg.query<{ id: string }>(`select id from law_invoices where seq = 1`)).rows;
  await assert.rejects(pg.query(`insert into law_invoices select * from law_invoices where id = $1`, [id]));
});

test("invoices: immutable after issue (trigger), for headers and lines", async () => {
  const { pg, sql, owner, lawyer, person } = await setup();
  await saveTaxProfileCore(sql, owner, SELLER);
  const a = await issueInvoiceCore(sql, lawyer, simple(person.id));
  await assert.rejects(pg.query(`update law_invoices set total_halalas = 1, subtotal_halalas = 1, vat_halalas = 0 where id = $1`, [a.id]), /cannot be changed/);
  await assert.rejects(pg.query(`update law_invoices set notes = 'x' where id = $1`, [a.id]), /cannot be changed/);
  await assert.rejects(pg.query(`delete from law_invoices where id = $1`, [a.id]), /cannot be changed/);
  await assert.rejects(pg.query(`update law_invoice_lines set unit_halalas = 1 where invoice_id = $1`, [a.id]), /cannot be changed/);
  await assert.rejects(pg.query(`delete from law_invoice_lines where invoice_id = $1`, [a.id]), /cannot be changed/);
  const d = await getInvoiceCore(sql, lawyer, a.id);
  assert.equal(d.invoice.total_halalas, 115_000);
  assert.equal(d.lines.length, 1);
  // The client and its case stay while they have invoices (legal records).
  const k = await createCaseCore(sql, owner, caseFields.parse({ title: "قضية عمالية", clientId: person.id, caseType: "labor" }));
  await issueInvoiceCore(sql, lawyer, simple(person.id, { caseId: k.id }));
  await assert.rejects(deleteCaseCore(sql, owner, k.id), isCode("has_invoices"));
  await assert.rejects(deleteClientCore(sql, owner, person.id));
  // Removing the whole office is the one delete that cascades through.
  await pg.query(`delete from workspaces where id = $1`, [owner.workspace.id]);
  assert.equal((await pg.query(`select 1 from law_invoices`)).rows.length, 0);
  assert.equal((await pg.query(`select 1 from law_invoice_lines`)).rows.length, 0);
});

test("credit notes: reference an invoice of the office and never exceed what is left", async () => {
  const { sql, owner, lawyer, person } = await setup();
  await saveTaxProfileCore(sql, owner, SELLER);
  const a = await issueInvoiceCore(sql, lawyer, simple(person.id)); // 1,150.00 incl. VAT
  const line = (unitHalalas: number) => [{ description: "إشعار", quantity: 1, unitHalalas, vatRate: 15 as const, exemptionReason: null }];
  const c1 = await issueCreditNoteCore(sql, lawyer, { originalId: a.id, reason: "خصم", lines: line(60_000) }); // 690.00
  let d = await getInvoiceCore(sql, lawyer, a.id);
  assert.equal(d.creditable, 115_000 - 69_000);
  assert.equal(d.creditNotes[0]?.id, c1.id);
  // 460.00 left: 400 + 60 VAT = 460 fits exactly; one halala more does not.
  await assert.rejects(issueCreditNoteCore(sql, lawyer, { originalId: a.id, reason: "خصم", lines: line(40_001) }), isCode("credit_exceeded"));
  await issueCreditNoteCore(sql, lawyer, { originalId: a.id, reason: "خصم", lines: line(40_000) });
  d = await getInvoiceCore(sql, lawyer, a.id);
  assert.equal(d.creditable, 0);
  // Two concurrent credits on a fresh invoice: only one fits.
  const b = await issueInvoiceCore(sql, lawyer, simple(person.id));
  const settled = await Promise.allSettled([
    issueCreditNoteCore(sql, lawyer, { originalId: b.id, reason: "إلغاء", lines: line(100_000) }),
    issueCreditNoteCore(sql, lawyer, { originalId: b.id, reason: "إلغاء", lines: line(100_000) }),
  ]);
  assert.equal(settled.filter((s) => s.status === "fulfilled").length, 1);
  // A credit note cannot be credited, and a reason is required.
  await assert.rejects(issueCreditNoteCore(sql, lawyer, { originalId: c1.id, reason: "خصم", lines: line(1) }), isCode("not_found"));
  await assert.rejects(issueCreditNoteCore(sql, lawyer, { originalId: a.id, reason: "", lines: line(1) }));
  const cd = await getInvoiceCore(sql, lawyer, c1.id);
  assert.equal(cd.invoice.kind, "credit_note");
  assert.equal(cd.invoice.original_number, "INV-000001");
  assert.equal(cd.invoice.notes, "خصم");
});

test("invoices: another office's ids behave like unknown ones", async () => {
  const { pg, sql, owner, lawyer, person } = await setup();
  await saveTaxProfileCore(sql, owner, SELLER);
  const a = await issueInvoiceCore(sql, lawyer, simple(person.id));

  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o2', 'Other', 'o2@x.sa', true)`);
  const w2 = await createWorkspaceCore(sql, "o2", { name: "مكتب آخر", city: "جدة", crNumber: null, teamSize: "2-5", slug: "inv-2" });
  const other = await resolveMembership(sql, "o2", w2.id, "staff", { write: true });
  await saveTaxProfileCore(sql, other, { ...SELLER, vatNumber: "300000000000003" });

  assert.equal((await listInvoicesCore(sql, other, { q: "", page: 1 })).total, 0);
  await assert.rejects(getInvoiceCore(sql, other, a.id), isCode("not_found"));
  await assert.rejects(issueInvoiceCore(sql, other, simple(person.id)), isCode("not_found"));
  await assert.rejects(
    issueCreditNoteCore(sql, other, { originalId: a.id, reason: "خصم", lines: [{ description: "x1", quantity: 1, unitHalalas: 1, vatRate: 15, exemptionReason: null }] }),
    isCode("not_found"),
  );
  // Each office numbers from 1.
  const otherClient = await createClientCore(sql, other, clientFields.parse({ kind: "individual", name: "عميل آخر" }));
  const b = await issueInvoiceCore(sql, other, simple(otherClient.id));
  assert.equal(b.number, "INV-000001");
});

test("invoices: roles — staff cannot list or issue; a read-only office cannot issue", async () => {
  const { sql, owner, staff, lawyer, person } = await setup();
  await saveTaxProfileCore(sql, owner, SELLER);
  await assert.rejects(listInvoicesCore(sql, staff, { q: "", page: 1 }), isCode("role"));
  await assert.rejects(issueInvoiceCore(sql, staff, simple(person.id)), isCode("role"));
  const a = await issueInvoiceCore(sql, lawyer, simple(person.id));
  await assert.rejects(getInvoiceCore(sql, staff, a.id), isCode("role"));
  await assert.rejects(getTaxProfileCore(sql, staff), isCode("role"));
  const ro = { ...lawyer, lifecycle: { ...lawyer.lifecycle, readOnly: true } };
  assert.equal((await getInvoiceCore(sql, ro, a.id)).canIssue, false);
});
