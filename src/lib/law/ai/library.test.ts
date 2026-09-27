/**
 * «مكتبة الأنظمة» on a real schema (PGLite + every migration): Arabic search
 * over articles (normalization, prefixes, laws no longer in force ranked
 * last), article lookup by number or ordinal words, the loader's
 * load-once-per-file behaviour, and answers grounded in retrieved articles.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import type { SqlTag } from "../../saas/tenancy-core.ts";
import { articleNumber, articleOrdinals } from "./arabic.ts";
import { askLawsCore, findLawCore, getArticleCore, lawArticlesCore, listLawsCore, searchLawsCore } from "./library-core.ts";
import { seedLaws } from "../../../../scripts/seed-laws.mjs";

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

const LAWS = {
  laws: [
    {
      serial: "ITHBAT",
      name: "نظام الإثبات",
      type: "نظام",
      status: "ساري",
      classification: "القضاء",
      issued: "1443-05-26",
      tool: "المرسوم الملكي رقم م/43",
      summary: "أحكام الإثبات",
      url: "https://laws.moj.gov.sa/ar/legislation/ITHBAT",
      boeUrl: null,
      articles: [
        { seq: "المادة الأولى", heading: "الباب الأول: أحكام عامة", text: "تسري أحكام هذا النظام على المعاملات المدنية والتجارية." },
        { seq: "المادة الثانية", heading: "الباب الأول: أحكام عامة", text: "1. على المدعي أن يثبت ما يدعيه من حق، وللمدعى عليه نفيه.\n2. لا يجوز للقاضي أن يحكم بعلمه الشخصي." },
        { seq: "المادة الثالثة والعشرون", heading: "الباب الثالث: الكتابة", text: "المحرر العادي حجة على من وقّعه ما لم ينكر صراحةً ما هو منسوب إليه من خط أو إمضاء." },
      ],
    },
    {
      serial: "OLD",
      name: "نظام المرافعات القديم",
      type: "نظام",
      status: "ملغي",
      classification: "القضاء",
      issued: null,
      tool: null,
      summary: "",
      url: "https://laws.moj.gov.sa/ar/legislation/OLD",
      boeUrl: null,
      articles: [{ seq: "المادة الأولى", heading: "", text: "على المدعي أن يثبت دعواه." }],
    },
  ],
};

async function loaded() {
  const db = await freshDb();
  const dir = mkdtempSync(join(tmpdir(), "laws-"));
  const file = join(dir, "laws.json.gz");
  writeFileSync(file, gzipSync(JSON.stringify(LAWS)));
  const client = { query: (t: string, p?: unknown[]) => db.pg.query(t, p) };
  assert.equal(await seedLaws(client, { file, log: () => undefined }), "loaded");
  assert.equal(await seedLaws(client, { file, log: () => undefined }), "unchanged", "same file → no reload");
  return { ...db, file, client };
}

test("arabic ordinals: article numbers both ways", () => {
  assert.deepEqual(articleOrdinals(23), ["الثالثة والعشرون"]);
  assert.deepEqual(articleOrdinals(11), ["الحادية عشرة"]);
  assert.ok(articleOrdinals(101).includes("الحادية بعد المائة"));
  assert.ok(articleOrdinals(242).includes("الثانية والأربعون بعد المائتين"));
  assert.equal(articleNumber("المادة الثالثة والعشرون"), 23);
  assert.equal(articleNumber("م ٢٣"), 23);
  assert.equal(articleNumber("المادة المائتان"), 200);
  assert.equal(articleNumber("غير رقم"), null);
});

test("library: load, list, search with Arabic normalization, repealed laws last", async () => {
  const { pg, sql } = await loaded();
  const laws = await listLawsCore(sql);
  assert.deepEqual(laws.map((l) => [l.name, l.article_count]), [
    ["نظام الإثبات", 3],
    ["نظام المرافعات القديم", 1],
  ]);
  // «المدعى» / «المدعي» / «بالمدعي» all meet; diacritics ignored.
  const hits = await searchLawsCore(sql, { query: "على مَن يقع عبء الإثبات على المدعِي؟" });
  assert.equal(hits[0].seq, "المادة الثانية", "the article saying who bears the burden ranks first");
  const repealed = hits.findIndex((h) => h.law_status === "ملغي");
  assert.ok(repealed > 0, "the repealed law's article ranks below the one in force");
  // Narrowed to one law by (part of) its name.
  const only = await searchLawsCore(sql, { query: "المحرر العادي حجة", law: "الإثبات" });
  assert.deepEqual(only.map((h) => h.seq), ["المادة الثالثة والعشرون"]);
  assert.deepEqual(await searchLawsCore(sql, { query: "في من على" }), [], "stop words alone find nothing");
  assert.equal((await findLawCore(sql, "ITHBAT"))?.name, "نظام الإثبات");
  await pg.close();
});

test("library: article by number or words; browsing; answers cite retrieved articles", async () => {
  const { pg, sql } = await loaded();
  assert.equal((await getArticleCore(sql, "نظام الإثبات", "23"))?.seq, "المادة الثالثة والعشرون");
  assert.equal((await getArticleCore(sql, "الإثبات", "المادة الثانية"))?.text.startsWith("1. على المدعي"), true);
  assert.equal(await getArticleCore(sql, "الإثبات", "99"), null);
  assert.equal(await getArticleCore(sql, "نظام غير موجود", "1"), null);
  const page = await lawArticlesCore(sql, "ITHBAT", 1, 2);
  assert.equal(page.total, 3);
  assert.deepEqual(page.articles.map((a) => a.ord), [1, 2]);

  let prompt = "";
  const r = await askLawsCore(sql, { question: "هل على المدعي أن يثبت ما يدعيه؟" }, async (m) => {
    prompt = m.map((x) => x.content).join("\n");
    return "يقع على المدعي [ن1].";
  });
  assert.match(prompt, /<<< ن\d+: نظام الإثبات — المادة الثانية — الباب الأول: أحكام عامة >>>\n1\. على المدعي/);
  assert.match(prompt, /\(ملغي\)/, "a repealed law is flagged to the model");
  assert.equal(r.articles[0].n, 1);
  const none = await askLawsCore(sql, { question: "ضريبة القيمة المضافة" }, async () => {
    throw new Error("must not be called");
  });
  assert.equal(none.articles.length, 0);
  await pg.close();
});

test("library: a changed file replaces the whole library in one go", async () => {
  const { pg, sql, file, client } = await loaded();
  const next = { laws: [{ ...LAWS.laws[0], articles: LAWS.laws[0].articles.slice(0, 1) }] };
  writeFileSync(file, gzipSync(JSON.stringify(next)));
  assert.equal(await seedLaws(client, { file, log: () => undefined }), "loaded");
  assert.deepEqual((await listLawsCore(sql)).map((l) => [l.name, l.article_count]), [["نظام الإثبات", 1]]);
  assert.equal(await seedLaws(client, { file: join(tmpdir(), "missing-laws.json.gz"), log: () => undefined }), "missing");
  await pg.close();
});
