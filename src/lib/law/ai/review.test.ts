/**
 * «مراجعة العقود» on a real schema (PGLite + every migration): who may review
 * and set the playbook, the office playbook and library articles reaching the
 * model, reading an unread contract first, tolerant parsing that never lets
 * the verdict be greener than the worst finding, failures recorded, and the
 * Word report body.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, type SqlTag } from "../../saas/tenancy-core.ts";
import { saveTextCore } from "./docai-core.ts";
import {
  createReviewCore,
  deleteReviewCore,
  getOfficeAiCore,
  getReviewCore,
  listReviewsCore,
  parseReview,
  reviewReportBody,
  runReviewCore,
  saveOfficeAiCore,
  STALE_REVIEW_MS,
} from "./review-core.ts";

const migrationsDir = new URL("../../../../migrations/", import.meta.url);

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

async function setup() {
  const { pg, sql } = await freshDb();
  const users: [string, string][] = [["o", "owner"], ["l", "lawyer"], ["s", "staff"]];
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o', 'U o', 'o@x.sa', true)`);
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب العقود", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "rev-1" });
  for (const [id, role] of users.slice(1)) {
    await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, `U ${id}`, `${id}@x.sa`]);
    await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [w.id, id, role]);
  }
  const doc = (
    await pg.query<{ id: string }>(
      `insert into law_documents (workspace_id, name, mime, size, storage, data) values ($1, 'عقد توريد.pdf', 'application/pdf', 4, 'db', '\\x25504446'::bytea) returning id`,
      [w.id],
    )
  ).rows[0].id;
  const sheet = (
    await pg.query<{ id: string }>(
      `insert into law_documents (workspace_id, name, mime, size, storage, data) values ($1, 'جدول.xlsx', 'application/octet-stream', 4, 'db', '\\x504b0304'::bytea) returning id`,
      [w.id],
    )
  ).rows[0].id;
  return {
    pg,
    sql,
    w,
    doc,
    sheet,
    owner: await resolveMembership(sql, "o", w.id),
    lawyer: await resolveMembership(sql, "l", w.id),
    staff: await resolveMembership(sql, "s", w.id),
  };
}

const GOOD = JSON.stringify({
  summary: "عقد توريد معدات.",
  contract_type: "عقد توريد",
  parties: ["شركة المورد", "العميل"],
  overall: "green",
  overall_reason: "متوازن غالبًا",
  clauses: [
    { title: "القانون الواجب التطبيق", page: 2, quote: "يخضع هذا العقد لقوانين ولاية ديلاوير", risk: "red", issue: "قانون أجنبي", recommendation: "اعتماد الأنظمة السعودية", suggested_text: "يخضع هذا العقد لأنظمة المملكة العربية السعودية.", refs: ["ن1", "bad"] },
    { title: "الدفع", page: 1, quote: "يسدد خلال 30 يومًا", risk: "green", issue: "", recommendation: "", suggested_text: "", refs: [] },
    { title: "", issue: "" },
  ],
  missing: [{ title: "القوة القاهرة", risk: "yellow", why: "غير منظمة", suggested_text: "…" }],
  questions: ["هل يشمل السعر الضريبة؟"],
});

test("review: parsing is tolerant, and the verdict is never greener than the worst finding", () => {
  const r = parseReview("إليك النتيجة:\n```json\n" + GOOD + "\n```");
  assert.equal(r.overall, "red", "a red clause makes the whole review red, whatever the model said");
  assert.equal(r.clauses.length, 2, "empty clauses are dropped");
  assert.deepEqual(r.clauses[0].refs, ["ن1"], "only [نN] references survive");
  assert.equal(r.clauses[1].risk, "green");
  assert.equal(parseReview(JSON.stringify({ clauses: [{ title: "x", risk: "purple" }] })).clauses[0].risk, "yellow");
  assert.throws(() => parseReview("لا يوجد"));
});

test("review: lawyers review office contracts; the office playbook and library reach the model", async () => {
  const { pg, sql, w, doc, sheet, owner, lawyer, staff } = await setup();
  await assert.rejects(createReviewCore(sql, staff, { documentId: doc, perspective: "المشتري" }), /WS:role/);
  await assert.rejects(createReviewCore(sql, lawyer, { documentId: sheet, perspective: "المشتري" }), /WS:invalid/, "a spreadsheet is not a contract");
  await assert.rejects(saveOfficeAiCore(sql, lawyer, { playbook: "x", house_style: "" }), /WS:role/, "the playbook is an admin setting");
  await saveOfficeAiCore(sql, owner, { playbook: "لا نقبل التحكيم خارج الرياض أبدًا.", house_style: "نبدأ الخطابات بـ«تحية طيبة وبعد»." });
  assert.match((await getOfficeAiCore(sql, lawyer)).playbook, /التحكيم خارج الرياض/);

  // A tiny library so the review can cite.
  await pg.query(`insert into law_library_laws (serial, name, url, type, status) values ('CT', 'نظام المعاملات المدنية', 'https://laws.moj.gov.sa/ar/legislation/CT', 'نظام', 'ساري')`);
  await pg.query(
    `insert into law_library_articles (law_serial, ord, seq, heading, text, law_name) values ('CT', 1, 'المادة الثامنة والسبعون بعد المائة', '', 'يجوز للمتعاقدين أن يحددا مقدمًا قيمة التعويض في العقد، والشرط الجزائي والتعويض الاتفاقي', 'نظام المعاملات المدنية')`,
  );

  const id = await createReviewCore(sql, lawyer, { documentId: doc, perspective: "المشتري (موكلنا)", contractType: "عقد توريد", notes: "ركز على الضمان" });
  assert.equal((await getReviewCore(sql, lawyer, id)).status, "pending");

  let reads = 0;
  let prompt = "";
  await runReviewCore(sql, lawyer, id, {
    read: async () => {
      reads += 1;
      return { status: "ready", method: "pdf", pages: ["البند الأول: الدفع خلال 30 يومًا.", "البند الخامس: يخضع هذا العقد لقوانين ولاية ديلاوير. الشرط الجزائي 50% من القيمة."] };
    },
    complete: async (m) => {
      prompt = m.map((x) => x.content).join("\n");
      return GOOD;
    },
  });
  assert.equal(reads, 1, "the unread contract is read first");
  assert.match(prompt, /لا نقبل التحكيم خارج الرياض/, "office playbook");
  assert.match(prompt, /الدليل الافتراضي/);
  assert.match(prompt, /<<< ص 2 >>>\nالبند الخامس/);
  assert.match(prompt, /ن1: نظام المعاملات المدنية — المادة الثامنة والسبعون بعد المائة/);
  assert.match(prompt, /موكّل المكتب \(الطرف الذي نحمي مصلحته\): المشتري/);

  const done = await getReviewCore(sql, lawyer, id);
  assert.equal(done.status, "ready");
  assert.equal(done.overall, "red");
  assert.equal(done.result?.articles[0].law_name, "نظام المعاملات المدنية");
  assert.equal(done.result?.pages_read, 2);
  const body = reviewReportBody(done);
  assert.match(body, /^# مراجعة عقد — عقد توريد\.pdf/);
  assert.match(body, /### 1\. القانون الواجب التطبيق — خطر مرتفع \(ص 2\)/);
  assert.match(body, /## بنود غائبة/);

  // Lists carry no findings; staff can't list.
  const list = await listReviewsCore(sql, lawyer, { documentId: doc });
  assert.equal(list.length, 1);
  assert.equal(list[0].result, null);
  await assert.rejects(listReviewsCore(sql, staff), /WS:role/);

  // The text is saved: a second review does not read again.
  const again = await createReviewCore(sql, lawyer, { documentId: doc, perspective: "المورد" });
  await runReviewCore(sql, lawyer, again, {
    read: async () => {
      reads += 1;
      return { status: "ready", method: "pdf", pages: ["x"] };
    },
    complete: async () => "ليس JSON",
  });
  assert.equal(reads, 1);
  const failed = await getReviewCore(sql, lawyer, again);
  assert.equal(failed.status, "failed", "an unusable answer is recorded as a failure");

  // A review left pending by a restart reads as failed.
  const stuck = await createReviewCore(sql, lawyer, { documentId: doc, perspective: "المشتري" });
  assert.equal((await getReviewCore(sql, lawyer, stuck, Date.now() + STALE_REVIEW_MS + 1000)).status, "failed");
  await deleteReviewCore(sql, lawyer, stuck);
  await assert.rejects(getReviewCore(sql, lawyer, stuck), /WS:not_found/);

  // Unreadable contract → failure, not a crash.
  const blank = (await pg.query<{ id: string }>(`insert into law_documents (workspace_id, name, mime, size, storage, data) values ($1, 'صورة.jpg', 'image/jpeg', 4, 'db', '\\xffd8ffe0'::bytea) returning id`, [w.id])).rows[0].id;
  await saveTextCore(sql, w.id, blank, { status: "empty", method: "ocr", pages: [] });
  const r3 = await createReviewCore(sql, lawyer, { documentId: blank, perspective: "المشتري" });
  await runReviewCore(sql, lawyer, r3, { read: async () => ({ status: "empty", method: "ocr", pages: [] }), complete: async () => GOOD });
  assert.equal((await getReviewCore(sql, lawyer, r3)).error, "unreadable");
  await pg.close();
});
