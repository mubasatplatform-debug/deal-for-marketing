/**
 * AI over office files on a real schema (PGLite + every migration): Arabic
 * PDF text repair, excerpt selection and citations, questions scoped to one
 * office's files, and drafts written from a case (roles, sources, revisions,
 * fees only for lawyers) — the model and the file reader are fakes.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../../saas/tenancy-core.ts";
import { chunkPages, fixPdfArabic, looksReversed, normalizeForSearch, parseCitations, searchTerms, selectChunks } from "./arabic.ts";
import { askDocumentsCore, saveTextCore, sourcesCore, type ExtractResult } from "./docai-core.ts";
import {
  cleanDraft,
  createDraftCore,
  deleteDraftCore,
  draftContextCore,
  draftFileName,
  getDraftCore,
  listDraftsCore,
  saveDraftBodyCore,
  STALE_PENDING_MS,
  writeDraftCore,
} from "./drafts-core.ts";

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

async function user(pg: PGlite, id: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, `U ${id}`, `${id}@x.sa`]);
}

async function doc(pg: PGlite, ws: string, caseId: string | null, clientId: string | null, name: string): Promise<string> {
  const r = await pg.query<{ id: string }>(
    `insert into law_documents (workspace_id, case_id, client_id, name, mime, size, storage, data)
     values ($1, $2, $3, $4, 'application/pdf', 4, 'db', '\\x25504446'::bytea) returning id`,
    [ws, caseId, clientId, name],
  );
  return r.rows[0].id;
}

async function setup() {
  const { pg, sql } = await freshDb();
  await user(pg, "o");
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب الأمانة", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "docai-1" });
  for (const [id, role] of [["l", "lawyer"], ["s", "staff"]] as const) {
    await user(pg, id);
    await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [w.id, id, role]);
  }
  const c = (await pg.query<{ id: string }>(`insert into law_clients (workspace_id, name, id_number) values ($1, 'محمد السالم', '1012345678') returning id`, [w.id])).rows[0].id;
  const k = (
    await pg.query<{ id: string }>(
      `insert into law_cases (workspace_id, ref_no, title, client_id, court, opposing_party, description, fees_halalas)
       values ($1, 7, 'مطالبة مالية ضد شركة الأفق', $2, 'المحكمة العامة بالرياض', 'شركة الأفق للمقاولات', 'تأخر سداد مستخلصات', 5000000) returning id`,
      [w.id, c],
    )
  ).rows[0].id;
  // Another office with its own file — never reachable from the first.
  await user(pg, "x");
  const other = await createWorkspaceCore(sql, "x", { name: "مكتب آخر", city: "جدة", crNumber: null, teamSize: "1", slug: "docai-2" });
  const foreign = await doc(pg, other.id, null, null, "سري.pdf");
  const owner = await resolveMembership(sql, "o", w.id);
  const lawyer = await resolveMembership(sql, "l", w.id);
  const staff = await resolveMembership(sql, "s", w.id);
  await pg.query(`update workspaces set plan = 'pro' where id = $1`, [w.id]);
  return { pg, sql, w, c, k, owner, lawyer, staff, foreign };
}

test("arabic: reversed PDF lines are repaired, numbers and ligatures intact", () => {
  const raw = "4471 ﻢﻗر ﻢﻜﺣ ﻚﺻ\n.لﺎﻳر 150,000 رهﺪﻗ ﻎﻠﺒﻤﺑ تﻻوﺎﻘﻤﻠﻟ ﻖﻓﻷا ﺔﻛﺮﺷ ﻪﻴﻠﻋ ﻰﻋﺪﻤﻟا ﻰﻠﻋ";
  assert.ok(looksReversed(raw.normalize("NFKC")));
  const fixed = fixPdfArabic(raw);
  assert.match(fixed, /^صك حكم رقم 4471$/m);
  assert.match(fixed, /على المدعى عليه شركة الأفق للمقاولات بمبلغ قدره 150,000 ريال\./);
  // Already-logical text is left alone (only presentation forms folded).
  assert.equal(fixPdfArabic("المحكمة العامة بالرياض قضت بإلزام المدعى عليه بالدفع وفق العقد المبرم"), "المحكمة العامة بالرياض قضت بإلزام المدعى عليه بالدفع وفق العقد المبرم");
});

test("arabic: search terms, chunk selection and citations", () => {
  assert.equal(normalizeForSearch("إلزام المدعى عليه بالأتعاب"), "الزام المدعي عليه بالاتعاب");
  assert.deepEqual(searchTerms("ما هو المبلغ في العقد؟"), ["مبلغ", "عقد"]);
  const chunks = [
    ...chunkPages(1, ["مقدمة عامة عن الشركة ".repeat(40), "العقد ينص على مبلغ مئة ألف ريال"]),
    ...chunkPages(2, ["محضر جلسة لا علاقة له ".repeat(40), "تفاصيل أخرى ".repeat(40)]),
  ];
  assert.equal(selectChunks(chunks, "أي سؤال", 1_000_000).length, chunks.length, "everything fits → everything");
  const picked = selectChunks(chunks, "ما المبلغ في العقد؟", 1200);
  assert.ok(picked.some((c) => c.text.includes("مئة ألف")), "the relevant chunk is kept");
  assert.ok(picked.reduce((n, c) => n + c.text.length, 0) <= 1200);
  assert.deepEqual(parseCitations("المبلغ 100 ألف [م1 ص2] وورد أيضًا [م١، ص٢] و[م9 ص1] و[م2]", 2), [
    { source: 1, page: 2 },
    { source: 2, page: 0 },
  ]);
});

test("docai: a question reads the case's files, answers with citations, never another office's", async () => {
  const { pg, sql, w, c, k, lawyer, staff, foreign } = await setup();
  const judgment = await doc(pg, w.id, k, c, "صك الحكم.pdf");
  const contract = await doc(pg, w.id, k, c, "العقد.docx");
  const photo = await doc(pg, w.id, k, c, "إيصال.jpg");
  await doc(pg, w.id, null, c, "ملف العميل فقط.pdf");
  const reads: string[] = [];
  const queued: string[] = [];
  const texts: Record<string, ExtractResult> = {
    [judgment]: { status: "ready", method: "pdf", pages: ["مقدمة الحكم", "حكمت المحكمة بإلزام المدعى عليه بدفع 150,000 ريال"] },
    [contract]: { status: "ready", method: "docx", pages: ["مدة العقد سنة تبدأ من 1445/01/01هـ"] },
  };
  let prompt = "";
  const deps = {
    read: async (d: { id: string }) => {
      reads.push(d.id);
      return texts[d.id] ?? { status: "failed" as const, method: null, pages: [] };
    },
    queue: (ids: string[]) => queued.push(...ids),
    needsOcr: (name: string) => /\.jpg$/.test(name),
    complete: async (m: { role: string; content: string }[]) => {
      prompt = m.map((x) => x.content).join("\n");
      return "حُكم بإلزام المدعى عليه بدفع 150,000 ريال [م1 ص2]، ومدة العقد سنة [م2 ص1].";
    },
  };
  const r = await askDocumentsCore(sql, staff, { caseId: k, question: "بكم حُكم على المدعى عليه؟" }, deps);
  assert.deepEqual(reads.sort(), [judgment, contract].sort(), "text-layer files are read now");
  assert.deepEqual(queued, [photo], "the photo goes to the background reader");
  assert.equal(r.sources.length, 2);
  assert.deepEqual(
    r.citations.map((x) => [x.name, x.label]),
    [
      ["صك الحكم.pdf", "ص 2"],
      ["العقد.docx", "جزء 1"],
    ],
  );
  assert.deepEqual(r.pending.map((p) => p.name), ["إيصال.jpg"]);
  assert.match(prompt, /<<< م1 ص2 >>>\nحكمت المحكمة/);
  assert.doesNotMatch(prompt, /ملف العميل فقط/, "only the case's files");

  // Read once: the next question does not read again.
  reads.length = 0;
  await askDocumentsCore(sql, staff, { caseId: k, question: "ما مدة العقد؟" }, deps);
  assert.deepEqual(reads, []);

  // Another office's document can't be named as a source.
  const onlyForeign = await sourcesCore(sql, lawyer, { documentIds: [foreign] });
  assert.equal(onlyForeign.length, 0);
  await assert.rejects(askDocumentsCore(sql, staff, { question: "؟؟" }, deps), /WS:invalid/);
  // Text saved for a document of another office is refused silently.
  await saveTextCore(sql, w.id, foreign, { status: "ready", method: "pdf", pages: ["سر"] });
  assert.equal((await pg.query(`select 1 from law_document_texts where document_id = $1`, [foreign])).rows.length, 0);
  await pg.close();
});

test("docai: no readable files → a clear answer without calling the model", async () => {
  const { pg, sql, w, c, k, staff } = await setup();
  await doc(pg, w.id, k, c, "جدول.xlsx");
  let called = false;
  const r = await askDocumentsCore(sql, staff, { caseId: k, question: "لخّص" }, {
    read: async () => ({ status: "ready", method: "pdf", pages: ["x"] }),
    queue: () => undefined,
    needsOcr: () => false,
    complete: async () => {
      called = true;
      return "";
    },
  });
  assert.equal(called, false);
  assert.match(r.answer, /لا توجد مستندات مقروءة/);
  assert.deepEqual(r.skipped.map((s) => s.reason), ["unsupported"]);
  await pg.close();
});

test("drafts: lawyers write from the case and its files; staff can't; revisions build on the last text", async () => {
  const { pg, sql, w, c, k, lawyer, staff, foreign } = await setup();
  const judgment = await doc(pg, w.id, k, c, "صك الحكم.pdf");
  await saveTextCore(sql, w.id, judgment, { status: "ready", method: "pdf", pages: ["حكمت المحكمة بإلزام المدعى عليه"] });

  await assert.rejects(createDraftCore(sql, staff, { kind: "claim", caseId: k, instructions: "", sourceIds: [] }), /WS:role/);
  await assert.rejects(
    createDraftCore(sql, lawyer, { kind: "claim", caseId: k, instructions: "", sourceIds: [foreign] }),
    /WS:not_found/,
    "another office's file can't be a source",
  );

  const id = await createDraftCore(sql, lawyer, { kind: "objection", caseId: k, instructions: "ركّز على القصور في التسبيب", sourceIds: [judgment] });
  const pending = await getDraftCore(sql, lawyer, id);
  assert.equal(pending.status, "pending");
  assert.equal(pending.title, "لائحة اعتراضية (استئناف) — مطالبة مالية ضد شركة الأفق");
  assert.equal(pending.client_id, c, "the client is taken from the case");

  const ctx = await draftContextCore(sql, lawyer, pending);
  assert.match(ctx, /المحكمة: المحكمة العامة بالرياض/);
  assert.match(ctx, /الأتعاب المتفق عليها: 50,000 ريال/);
  assert.match(ctx, /<<< مستند: «صك الحكم.pdf» >>>\nحكمت المحكمة/);
  assert.match(ctx, /رقم الهوية\/السجل: 1012345678/);

  let seen = "";
  await writeDraftCore(sql, lawyer, id, async (m) => {
    seen = m.map((x) => x.content).join("\n");
    return "إليك المسودة:\n# لائحة اعتراضية\n## أسباب الاعتراض\n1. القصور في التسبيب";
  });
  assert.match(seen, /ركّز على القصور في التسبيب/);
  assert.match(seen, /أسباب الاعتراض/, "the kind's structure guide is sent");
  const ready = await getDraftCore(sql, lawyer, id);
  assert.equal(ready.status, "ready");
  assert.ok(ready.body.startsWith("# لائحة اعتراضية"), "the preface is stripped");

  await saveDraftBodyCore(sql, lawyer, id, `${ready.body}\n2. سبب أضافه المحامي`);
  const rev = await createDraftCore(sql, lawyer, { kind: "objection", caseId: k, instructions: "أضف طلب وقف التنفيذ", sourceIds: [judgment], parentId: id });
  let revPrompt = "";
  await writeDraftCore(sql, lawyer, rev, async (m) => {
    revPrompt = m.map((x) => x.content).join("\n");
    return "# لائحة اعتراضية معدّلة";
  });
  assert.match(revPrompt, /سبب أضافه المحامي/, "the revision starts from the edited text");
  assert.match(revPrompt, /أضف طلب وقف التنفيذ/);

  // A model failure is recorded, not thrown.
  const bad = await createDraftCore(sql, lawyer, { kind: "letter", clientId: c, instructions: "", sourceIds: [] });
  await writeDraftCore(sql, lawyer, bad, async () => {
    throw new Error("WS:ai_unavailable");
  });
  assert.equal((await getDraftCore(sql, lawyer, bad)).status, "failed");

  const list = await listDraftsCore(sql, lawyer, { caseId: k });
  assert.equal(list.length, 2);
  assert.ok(list.every((d) => d.body === ""), "lists carry no bodies");
  await assert.rejects(listDraftsCore(sql, staff), /WS:role/);

  // A draft left pending by a restart reads as failed.
  const stuck = await createDraftCore(sql, lawyer, { kind: "letter", clientId: c, instructions: "", sourceIds: [] });
  const later = Date.now() + STALE_PENDING_MS + 1000;
  assert.equal((await getDraftCore(sql, lawyer, stuck, later)).status, "failed");

  await deleteDraftCore(sql, lawyer, bad);
  await assert.rejects(getDraftCore(sql, lawyer, bad), (e) => e instanceof WorkspaceError && e.code === "not_found");
  await pg.close();
});

test("drafts: staff-visible context never carries fees; file names are safe", async () => {
  const { pg, sql, w, k, lawyer } = await setup();
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, 'x', 'lawyer')`, [w.id]).catch(() => undefined);
  const id = await createDraftCore(sql, lawyer, { kind: "case_summary", caseId: k, instructions: "", sourceIds: [] });
  const d = await getDraftCore(sql, lawyer, id);
  // A lawyer sees fees; the context builder hides them from roles that can't.
  const asStaffLike = { ...lawyer, role: "staff" as const };
  assert.doesNotMatch(await draftContextCore(sql, asStaffLike, d), /الأتعاب/);
  assert.equal(draftFileName('مذكرة: "رد" / 2'), "مذكرة رد 2.docx");
  assert.equal(cleanDraft("```markdown\n# عنوان\nنص\n```"), "# عنوان\nنص");
  await pg.close();
});
