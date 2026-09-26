/**
 * Sample data and the onboarding checklist on a real schema (PGLite + every
 * migration): the seed shows up in the ordinary list cores, is refused twice,
 * clears only demo rows, refuses to clear while a real row hangs off a demo
 * row, and never reaches another office.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import { buildDemoSet, clearDemoCore, onboardingCore, seedDemoCore, workingDayAfter } from "./demo-core.ts";
import {
  addNoteCore,
  createCaseCore,
  createClientCore,
  createTaskCore,
  homeCore,
  listCasesCore,
  listClientsCore,
  listTasksCore,
  setCaseStageCore,
} from "./practice-core.ts";
import { caseFields, clientFields } from "./schemas.ts";
import { riyadhMinutes, riyadhYmd, weekday } from "./time.ts";

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

async function addUser(pg: PGlite, id: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, `U ${id}`, `${id}@x.sa`]);
}

async function setup() {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  await addUser(pg, "o2");
  await addUser(pg, "st");
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب الأمانة", city: "", crNumber: null, teamSize: "1", slug: "demo-1" });
  const w2 = await createWorkspaceCore(sql, "o2", { name: "مكتب آخر", city: "جدة", crNumber: null, teamSize: "1", slug: "demo-2" });
  const owner = await resolveMembership(sql, "o", w.id, "admin", { write: true });
  const other = await resolveMembership(sql, "o2", w2.id, "admin", { write: true });
  return { pg, sql, w, w2, owner, other };
}

const client = (name: string) => clientFields.parse({ kind: "individual", name, phone: "0501234567" });
const kase = (title: string, extra: Record<string, unknown> = {}) => caseFields.parse({ title, caseType: "commercial", ...extra });

async function count(pg: PGlite, table: string, ws: string, where = "true"): Promise<number> {
  const r = await pg.query<{ n: number }>(`select count(*)::int as n from ${table} where workspace_id = $1 and ${where}`, [ws]);
  return Number(r.rows[0].n);
}

test("demo set: Riyadh working hours, upcoming hearings, tasks due today and overdue", () => {
  // Thursday 2026-09-24 10:00 Riyadh.
  const now = Date.parse("2026-09-24T07:00:00Z");
  let n = 0;
  const set = buildDemoSet(now, { video: true }, () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, "0")}`);
  const today = riyadhYmd(now);
  assert.equal(workingDayAfter(today, 1), "2026-09-27", "Thursday → Sunday");
  for (const h of set.hearings) {
    const t = Date.parse(h.starts_at);
    assert.ok(t > now && t < now + 15 * 86_400_000, "hearings within two weeks");
    assert.ok(![5, 6].includes(weekday(riyadhYmd(t))), "no weekend hearings");
    const m = riyadhMinutes(t);
    assert.ok(m >= 8 * 60 && m <= 15 * 60, "court hours");
  }
  for (const a of set.appointments) {
    const m = riyadhMinutes(a.starts_at);
    assert.ok(m >= 9 * 60 && m <= 17 * 60);
  }
  assert.ok(set.tasks.some((t) => t.due_on === today && !t.done));
  assert.ok(set.tasks.some((t) => t.due_on < today && !t.done));
  assert.ok(set.cases.every((c) => c.paid_halalas < c.fees_halalas && c.paid_halalas > 0), "partial payments");
  assert.ok(set.clients.every((c) => /^\+9665000000\d\d$/.test(c.phone)));
  assert.ok(set.appointments.some((a) => a.mode === "video"));
  assert.ok(!buildDemoSet(now, { video: false }).appointments.some((a) => a.mode === "video"));
});

test("seed: rows show in the list cores, a second seed is refused", async () => {
  const { sql, owner } = await setup();
  const r = await seedDemoCore(sql, owner);
  assert.equal(r.clients, 4);
  assert.equal(r.cases, 4);

  const clients = await listClientsCore(sql, owner, { q: "", page: 1 });
  assert.equal(clients.total, 4);
  assert.ok(clients.rows.every((c) => c.is_demo === true));
  const cases = await listCasesCore(sql, owner, { q: "", page: 1 });
  assert.equal(cases.total, 4);
  assert.deepEqual(cases.rows.map((c) => c.ref_no).sort(), [1, 2, 3, 4]);
  assert.ok(cases.rows.every((c) => c.is_demo && c.lawyers.some((l) => l.id === "o")));
  assert.ok(cases.rows.some((c) => c.next_hearing), "upcoming hearings attached");

  const mine = await listTasksCore(sql, owner, { scope: "mine" });
  assert.equal(mine.length, 4, "open demo tasks are assigned to the seeder");
  const home = await homeCore(sql, owner);
  assert.equal(home.counts.clients, 4);
  assert.ok(home.overdue.length >= 1);
  assert.ok(home.counts.pendingConsults >= 1);

  await assert.rejects(seedDemoCore(sql, owner), (e: unknown) => e instanceof WorkspaceError && e.code === "demo_exists");
  assert.equal((await listClientsCore(sql, owner, { q: "", page: 1 })).total, 4);
});

test("seed/clear: managers only", async () => {
  const { pg, sql, w, owner } = await setup();
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, 'st', 'lawyer')`, [w.id]);
  const lawyer = await resolveMembership(sql, "st", w.id, "staff", { write: true });
  await assert.rejects(seedDemoCore(sql, lawyer), (e: unknown) => e instanceof WorkspaceError && e.code === "role");
  await seedDemoCore(sql, owner);
  await assert.rejects(clearDemoCore(sql, lawyer), (e: unknown) => e instanceof WorkspaceError && e.code === "role");
});

test("clear: removes only demo rows, real data and the other office untouched", async () => {
  const { pg, sql, w, w2, owner, other } = await setup();
  // Real data before and after the seed; ref numbers continue.
  const real = await createClientCore(sql, owner, client("عميل حقيقي"));
  const realCase = await createCaseCore(sql, owner, kase("قضية حقيقية", { clientId: real.id }));
  await createTaskCore(sql, owner, { title: "مهمة حقيقية", notes: "", caseId: realCase.id, assigneeId: "o", dueOn: null });
  await seedDemoCore(sql, other);
  await seedDemoCore(sql, owner);
  const refs = (await listCasesCore(sql, owner, { q: "", page: 1 })).rows.map((c) => c.ref_no).sort();
  assert.deepEqual(refs, [1, 2, 3, 4, 5]);

  // Trying the demo out (a stage change writes an event note) never blocks clearing.
  const demoCase = (await listCasesCore(sql, owner, { q: "", page: 1 })).rows.find((c) => c.is_demo)!;
  await setCaseStageCore(sql, owner, demoCase.id, "judgment");

  const r = await clearDemoCore(sql, owner);
  assert.deepEqual(r, { clients: 4, cases: 4 });
  for (const t of ["law_clients", "law_cases", "law_hearings", "law_tasks", "law_appointments", "law_notes"]) {
    assert.equal(await count(pg, t, w.id, "is_demo"), 0, `${t} has no demo rows left`);
  }
  const clients = await listClientsCore(sql, owner, { q: "", page: 1 });
  assert.deepEqual(clients.rows.map((c) => c.name), ["عميل حقيقي"]);
  const cases = await listCasesCore(sql, owner, { q: "", page: 1 });
  assert.deepEqual(cases.rows.map((c) => c.title), ["قضية حقيقية"]);
  assert.equal((await listTasksCore(sql, owner, { scope: "all" })).length, 1);

  // The other office still has its whole demo set.
  assert.equal((await listClientsCore(sql, other, { q: "", page: 1 })).total, 4);
  assert.equal(await count(pg, "law_hearings", w2.id, "is_demo"), 4);

  // Clearing twice is harmless; seeding again works after a clear.
  assert.deepEqual(await clearDemoCore(sql, owner), { clients: 0, cases: 0 });
  await seedDemoCore(sql, owner);
  assert.equal((await listClientsCore(sql, owner, { q: "", page: 1 })).total, 5);
});

test("clear: refused while a real task, note or case hangs off demo data", async () => {
  const { pg, sql, w, owner } = await setup();
  await seedDemoCore(sql, owner);
  const demoCase = (await listCasesCore(sql, owner, { q: "", page: 1 })).rows[0];
  const demoClient = (await listClientsCore(sql, owner, { q: "", page: 1 })).rows[0];

  // A real task on a demo case: clearing would cascade-delete it.
  const task = await createTaskCore(sql, owner, { title: "مهمة حقيقية", notes: "", caseId: demoCase.id, assigneeId: null, dueOn: null });
  await assert.rejects(clearDemoCore(sql, owner), (e: unknown) => e instanceof WorkspaceError && e.code === "demo_in_use");
  assert.equal(await count(pg, "law_clients", w.id, "is_demo"), 4, "nothing was deleted");
  assert.equal(await count(pg, "law_tasks", w.id, `id = '${task.id}'`), 1);

  // Moved off the demo case → clearing goes through and keeps the task.
  await pg.query(`update law_tasks set case_id = null where id = $1`, [task.id]);
  // A real note on a demo client blocks too.
  const note = await addNoteCore(sql, owner, { clientId: demoClient.id, caseId: null, body: "ملاحظة حقيقية" });
  await assert.rejects(clearDemoCore(sql, owner), (e: unknown) => e instanceof WorkspaceError && e.code === "demo_in_use");
  await pg.query(`delete from law_notes where id = $1`, [note.id]);
  // A real case filed under a demo client blocks too.
  const realCase = await createCaseCore(sql, owner, kase("قضية حقيقية", { clientId: demoClient.id }));
  await assert.rejects(clearDemoCore(sql, owner), (e: unknown) => e instanceof WorkspaceError && e.code === "demo_in_use");
  await pg.query(`update law_cases set client_id = null where id = $1`, [realCase.id]);

  await clearDemoCore(sql, owner);
  assert.equal(await count(pg, "law_tasks", w.id, `id = '${task.id}'`), 1, "the real task survived");
  assert.equal(await count(pg, "law_cases", w.id), 1, "the real case survived");
  assert.equal(await count(pg, "law_clients", w.id), 0);
});

test("onboarding: flags flip with real data only", async () => {
  const { pg, sql, w, owner, other } = await setup();
  let s = await onboardingCore(sql, owner);
  assert.deepEqual(s.steps, { office: false, booking: false, client: false, case: false, team: false, twoStep: false });
  assert.equal(s.hasDemo, false);
  assert.equal(s.hasRealData, false);

  await seedDemoCore(sql, owner);
  s = await onboardingCore(sql, owner);
  assert.equal(s.hasDemo, true);
  assert.equal(s.steps.client, false, "demo clients do not count");
  assert.equal(s.steps.case, false, "demo cases do not count");
  assert.equal(s.hasRealData, false);
  assert.equal((await onboardingCore(sql, other)).hasDemo, false, "other office unaffected");

  await pg.query(`update workspaces set city = 'الرياض', cr_number = '1010123456' where id = $1`, [w.id]);
  await pg.query(`insert into law_office_settings (workspace_id, booking_enabled) values ($1, true)`, [w.id]);
  const c = await createClientCore(sql, owner, client("عميل حقيقي"));
  await createCaseCore(sql, owner, kase("قضية حقيقية", { clientId: c.id }));
  await pg.query(
    `insert into workspace_invites (workspace_id, email, role, token_hash, expires_at) values ($1, 'l@x.sa', 'lawyer', 'h1', now() + interval '7 days')`,
    [w.id],
  );
  await pg.query(`insert into user_whatsapp_2fa (user_id, phone) values ('o', '+966500000099')`);

  s = await onboardingCore(sql, owner);
  assert.deepEqual(s.steps, { office: true, booking: true, client: true, case: true, team: true, twoStep: true });
  assert.equal(s.hasRealData, true);

  const o2 = await onboardingCore(sql, other);
  assert.equal(o2.steps.client, false);
  assert.equal(o2.steps.team, false);
  assert.equal(o2.steps.twoStep, false, "two-step is per user");
});
