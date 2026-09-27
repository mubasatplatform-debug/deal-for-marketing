/**
 * Case AI on a real schema (PGLite + every migration): statutory deadlines
 * (start day excluded, urgent periods, weekend roll-over, filed as a task
 * with the article), the chronology (sorted, sourced, sources scoped to the
 * case) and the hearing briefing (lawyers only; files and laws reach the
 * model), with failures recorded.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, type SqlTag } from "../../saas/tenancy-core.ts";
import { getCaseAiCore, parseChronology, requestCaseAiCore, runCaseAiCore, type BriefingResult, type ChronologyResult } from "./case-ai-core.ts";
import { computeDeadline, fileDeadlineCore, ruleArticlesCore, RULE_BY_ID } from "./deadlines-core.ts";
import { saveTextCore } from "./docai-core.ts";

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
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o', 'U o', 'o@x.sa', true)`);
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب القضايا", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "case-ai-1" });
  for (const [id, role] of [["l", "lawyer"], ["s", "staff"]]) {
    await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, `U ${id}`, `${id}@x.sa`]);
    await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [w.id, id, role]);
  }
  const k = (
    await pg.query<{ id: string }>(
      `insert into law_cases (workspace_id, ref_no, title, court, opposing_party, description) values ($1, 1, 'مطالبة بأجرة', 'المحكمة العامة بالرياض', 'مطعم النخبة', 'تأخر سداد الإيجار') returning id`,
      [w.id],
    )
  ).rows[0].id;
  const other = (await pg.query<{ id: string }>(`insert into law_cases (workspace_id, ref_no, title) values ($1, 2, 'قضية أخرى') returning id`, [w.id])).rows[0].id;
  const doc = async (caseId: string, name: string) =>
    (
      await pg.query<{ id: string }>(
        `insert into law_documents (workspace_id, case_id, name, mime, size, storage, data) values ($1, $2, $3, 'application/pdf', 4, 'db', '\\x25504446'::bytea) returning id`,
        [w.id, caseId, name],
      )
    ).rows[0].id;
  const lease = await doc(k, "عقد الإيجار.pdf");
  const otherDoc = await doc(other, "سري.pdf");
  await saveTextCore(sql, w.id, lease, { status: "ready", method: "pdf", pages: ["أبرم العقد بتاريخ 2024-01-01 لمدة سنة.", "تأخر المستأجر عن سداد دفعة 2024-07-01."] });
  await saveTextCore(sql, w.id, otherDoc, { status: "ready", method: "pdf", pages: ["نص سري من قضية أخرى"] });
  await pg.query(`insert into law_library_laws (serial, name, url, type, status) values ('P', 'نظام المرافعات الشرعية', 'https://laws.moj.gov.sa/ar/legislation/P', 'نظام', 'ساري')`);
  await pg.query(
    `insert into law_library_articles (law_serial, ord, seq, heading, text, law_name) values
     ('P', 1, 'المادة السابعة والثمانون بعد المائة', '', 'مدة الاعتراض بطلب الاستئناف أو التدقيق ثلاثون يوماً، ويستثنى من ذلك الأحكام الصادرة في المسائل المستعجلة فتكون عشرة أيام.', 'نظام المرافعات الشرعية'),
     ('P', 2, 'المادة التاسعة والسبعون بعد المائة', '', 'يبدأ موعد الاعتراض على الحكم من تاريخ تسليم صورة صك الحكم إلى المحكوم عليه. الإيجار أجرة', 'نظام المرافعات الشرعية')`,
  );
  return { pg, sql, w, k, lease, lawyer: await resolveMembership(sql, "l", w.id), staff: await resolveMembership(sql, "s", w.id) };
}

test("deadlines: start day excluded, urgent periods, Friday/Saturday roll over", () => {
  // 2026-10-01 is a Thursday: +30 → 2026-10-31 (Saturday) → Sunday 2026-11-01.
  const a = computeDeadline("appeal", "2026-10-01", false, "2026-10-01");
  assert.equal(a.lastDay, "2026-10-31");
  assert.equal(a.deadline, "2026-11-01");
  assert.equal(a.movedForWeekend, true);
  assert.equal(a.daysLeft, 31);
  const u = computeDeadline("appeal", "2026-10-01", true, "2026-10-05");
  assert.equal(u.days, 10);
  assert.equal(u.deadline, "2026-10-11", "Sunday 11 October is a working day");
  assert.equal(computeDeadline("cassation", "2026-10-01", true, "2026-10-01").days, 15);
  assert.equal(computeDeadline("review", "2026-10-01", true, "2026-10-01").urgent, false, "no urgent period for review");
  assert.throws(() => computeDeadline("nope", "2026-10-01", false, "2026-10-01"), /WS:invalid/);
  assert.equal(RULE_BY_ID.get("payment_order")?.days, 15);
});

test("deadlines: the rule's articles come from the library; filing makes a task on the case", async () => {
  const { pg, sql, k, lawyer } = await setup();
  const arts = await ruleArticlesCore(sql, RULE_BY_ID.get("appeal")!);
  assert.deepEqual(arts.map((a) => a.seq), ["المادة السابعة والثمانون بعد المائة", "المادة التاسعة والسبعون بعد المائة"]);
  const { taskId, result } = await fileDeadlineCore(sql, lawyer, { caseId: k, ruleId: "appeal", start: "2026-10-01", urgent: false, today: "2026-10-02" });
  const [t] = (await pg.query<{ title: string; due_on: string; notes: string; assignee_id: string }>(`select title, due_on::text, notes, assignee_id from law_tasks where id = $1`, [taskId])).rows;
  assert.equal(t.title, "آخر يوم: الاعتراض بطلب الاستئناف أو التدقيق");
  assert.equal(t.due_on, result.deadline);
  assert.equal(t.assignee_id, "l");
  assert.match(t.notes, /نظام المرافعات الشرعية، المادة \(187\)/);
  assert.match(t.notes, /امتد إلى 2026-11-01/);
  await pg.close();
});

test("chronology: sorted, sourced, only this case's files; staff may build it", async () => {
  const { pg, sql, k, staff, lawyer } = await setup();
  assert.deepEqual(
    parseChronology('```json\n{"events":[{"date":"2024-07-01","iso":"2024-07-01","event":"تأخر السداد","source":"م1 ص2"},{"date":"غرة محرم","iso":null,"event":"إشعار","source":"ملاحظة"},{"date":"2024-01-01","iso":"2024-01-01","event":"إبرام العقد","source":"م1 ص1"},{"date":"","event":"بلا تاريخ"}]}\n```').map((e) => e.event),
    ["إبرام العقد", "تأخر السداد", "إشعار"],
  );
  await requestCaseAiCore(sql, staff, k, "chronology");
  let prompt = "";
  await runCaseAiCore(sql, staff, k, "chronology", {
    complete: async () => "",
    completeJson: async (m) => {
      prompt = m.map((x) => x.content).join("\n");
      return '{"events":[{"date":"2024-01-01","iso":"2024-01-01","event":"إبرام العقد","source":"م1 ص1"}]}';
    },
    read: async () => ({ status: "failed", method: null, pages: [] }),
    needsOcr: () => false,
  });
  assert.match(prompt, /<<< م1 ص1 — «عقد الإيجار.pdf» >>>/);
  assert.doesNotMatch(prompt, /نص سري من قضية أخرى/);
  const got = await getCaseAiCore(sql, staff, k);
  assert.equal(got.chronology?.status, "ready");
  assert.equal((got.chronology?.result as ChronologyResult).events[0].event, "إبرام العقد");
  assert.equal((got.chronology?.result as ChronologyResult).sources[0].name, "عقد الإيجار.pdf");

  // The briefing is the lawyer's.
  await assert.rejects(requestCaseAiCore(sql, staff, k, "briefing"), /WS:role/);
  await requestCaseAiCore(sql, lawyer, k, "briefing");
  let brief = "";
  await runCaseAiCore(sql, lawyer, k, "briefing", {
    complete: async (m) => {
      brief = m.map((x) => x.content).join("\n");
      return "## الموقف في سطرين\nنطالب بالأجرة [م1 ص2] [ن1].";
    },
    completeJson: async () => "",
    read: async () => ({ status: "failed", method: null, pages: [] }),
    needsOcr: () => false,
  });
  assert.match(brief, /لا توجد جلسة قادمة مجدولة/);
  assert.match(brief, /مواد نظامية \(بيانات\):\n<<< ن1: نظام المرافعات الشرعية/);
  const lawyerView = await getCaseAiCore(sql, lawyer, k);
  assert.match((lawyerView.briefing?.result as BriefingResult).text, /نطالب بالأجرة/);
  assert.equal((await getCaseAiCore(sql, staff, k)).briefing, undefined, "staff never see the briefing");

  // A model failure is recorded.
  await requestCaseAiCore(sql, lawyer, k, "chronology");
  await runCaseAiCore(sql, lawyer, k, "chronology", {
    complete: async () => "",
    completeJson: async () => "ليس JSON",
    read: async () => ({ status: "failed", method: null, pages: [] }),
    needsOcr: () => false,
  });
  assert.equal((await getCaseAiCore(sql, lawyer, k)).chronology?.status, "failed");
  await pg.close();
});
