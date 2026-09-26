/**
 * Office reports/analytics on a real schema (PGLite + every migration):
 * financial totals, stage pipeline, top clients, and the fees permission gate.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import { addPaymentCore, createCaseCore, createClientCore, reportsCore, setCaseStageCore } from "./practice-core.ts";
import { caseFields, clientFields } from "./schemas.ts";

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
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, `User ${id}`, `${id}@x.sa`]);
}
async function member(pg: PGlite, ws: string, user: string, role: string) {
  await addUser(pg, user);
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [ws, user, role]);
}

const client = (name: string) => clientFields.parse({ kind: "individual", name, phone: "0501234567" });
const kase = (title: string, extra: Record<string, unknown> = {}) => caseFields.parse({ title, caseType: "commercial", ...extra });

test("reports: financial totals, collection rate, stages and top clients", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب التقارير", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "rep-1" });
  await member(pg, w.id, "l", "lawyer");
  const lawyer = await resolveMembership(sql, "l", w.id);

  const c1 = await createClientCore(sql, lawyer, client("عميل أ"));
  const c2 = await createClientCore(sql, lawyer, client("عميل ب"));
  const k1 = await createCaseCore(sql, lawyer, kase("قضية ١", { clientId: c1.id, feesHalalas: 1_000_000, lawyerIds: ["l"] }));
  const k2 = await createCaseCore(sql, lawyer, kase("قضية ٢", { clientId: c2.id, feesHalalas: 500_000, lawyerIds: ["l"] }));
  await createCaseCore(sql, lawyer, kase("قضية ٣", { clientId: c1.id, feesHalalas: 0, lawyerIds: ["l"] }));
  await addPaymentCore(sql, lawyer, k1.id, 400_000);
  await addPaymentCore(sql, lawyer, k2.id, 500_000);
  await setCaseStageCore(sql, lawyer, k2.id, "closed");

  const r = await reportsCore(sql, lawyer);
  assert.equal(r.finance.billed, 1_500_000);
  assert.equal(r.finance.collected, 900_000);
  assert.equal(r.finance.outstanding, 600_000);
  assert.equal(r.finance.collectionRate, 60);
  assert.equal(r.totals.cases, 3);
  assert.equal(r.totals.openCases, 2);
  assert.equal(r.totals.clients, 2);

  // Stages are zero-filled and sum to the case count.
  assert.equal(r.stages.length, 7);
  assert.equal(
    r.stages.reduce((s, x) => s + x.count, 0),
    3,
  );
  assert.equal(r.stages.find((s) => s.stage === "closed")?.count, 1);

  // Top clients ordered by outstanding; client أ owes 600k, client ب owes 0.
  assert.equal(r.topClients[0]?.name, "عميل أ");
  assert.equal(r.topClients[0]?.outstanding, 600_000);

  // Six months always returned, newest last.
  assert.equal(r.openedByMonth.length, 6);
});

test("reports: staff (no fees permission) is refused", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "rep-2" });
  await member(pg, w.id, "s", "staff");
  const staff = await resolveMembership(sql, "s", w.id);
  await assert.rejects(reportsCore(sql, staff), (e: unknown) => e instanceof WorkspaceError && e.code === "role");
});
