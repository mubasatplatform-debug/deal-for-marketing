/**
 * The agent toolbox on a real schema (PGLite + every migration): every tool's
 * input converts to JSON Schema, tools run with the caller's role rules, and
 * the partial-update tools keep the fields they were not asked to change.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../../saas/tenancy-core.ts";
import { getCaseCore } from "../practice-core.ts";
import { AGENT_TOOLS, runTool, toolJsonSchema } from "./tools.ts";

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

async function member(pg: PGlite, ws: string, user: string, role: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [user, `U ${user}`, `${user}@x.sa`]);
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [ws, user, role]);
}

test("agent tools: unique names, JSON Schema for every input, writes flagged", () => {
  const names = AGENT_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "unique names");
  for (const t of AGENT_TOOLS) {
    const s = toolJsonSchema(t);
    assert.equal(s.type, "object", `${t.name} schema is an object`);
    assert.ok(/^[a-z_]+$/.test(t.name), `${t.name} is snake_case`);
    if (t.write) assert.ok(t.summarize, `${t.name} has a confirm summary`);
  }
  assert.ok(!names.some((n) => n.startsWith("delete")), "no delete tools");
});

test("agent tools: run with the member's role, partial updates keep other fields", async () => {
  const { pg, sql } = await freshDb();
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o', 'Owner', 'o@x.sa', true)`);
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "agent-1" });
  await member(pg, w.id, "l", "lawyer");
  await member(pg, w.id, "s", "staff");
  const lawyer = { sql, access: await resolveMembership(sql, "l", w.id, "staff", { write: true }) };
  const staff = { sql, access: await resolveMembership(sql, "s", w.id, "staff", { write: true }) };

  const client = (await runTool(lawyer, "create_client", { name: "شركة الأفق", kind: "company", phone: "0501234567" })) as { id: string };
  const found = (await runTool(lawyer, "search_clients", { query: "الأفق" })) as { rows: { id: string }[] };
  assert.equal(found.rows[0]?.id, client.id);

  const k = (await runTool(lawyer, "create_case", {
    title: "مطالبة تجارية",
    case_type: "commercial",
    client_id: client.id,
    fees_sar: 12_000,
    lawyer_ids: ["l"],
  })) as { id: string };
  await runTool(lawyer, "record_payment", { case_id: k.id, amount_sar: 2_000 });
  await runTool(lawyer, "update_case", { case_id: k.id, court: "المحكمة التجارية بالرياض" });

  const after = (await getCaseCore(sql, lawyer.access, k.id)).case;
  assert.equal(after.court, "المحكمة التجارية بالرياض");
  assert.equal(after.title, "مطالبة تجارية", "untouched field kept");
  assert.equal(after.fees_halalas, 1_200_000);
  assert.equal(after.paid_halalas, 200_000);

  // Staff may not open cases or see reports — the tool path enforces the same rules.
  await assert.rejects(runTool(staff, "create_case", { title: "x y", case_type: "commercial" }), (e: unknown) => e instanceof WorkspaceError);
  await assert.rejects(runTool(staff, "office_reports", {}), (e: unknown) => e instanceof WorkspaceError);

  // Bad input never reaches the database.
  await assert.rejects(runTool(lawyer, "record_payment", { case_id: k.id, amount_sar: -5 }));
  await assert.rejects(runTool(lawyer, "nope", {}));
});
