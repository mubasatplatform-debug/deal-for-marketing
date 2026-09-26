/**
 * The assistant loop on a real schema with a scripted model: reads run at
 * once, writes wait for the SAME person's confirmation and run exactly once,
 * with the stored arguments.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../../saas/tenancy-core.ts";
import { listCasesCore } from "../practice-core.ts";
import {
  agentTurnCore,
  cancelActionCore,
  confirmActionCore,
  listActionsCore,
  openAiTools,
  runLoggedToolCore,
  type Llm,
  type LlmMessage,
  type LlmResult,
} from "./agent-core.ts";
import { AGENT_TOOLS } from "./tools.ts";

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

/** A model that plays back a script; each step sees the conversation so far. */
function scripted(steps: ((m: LlmMessage[]) => LlmResult)[]): Llm & { calls: number } {
  const fn = (async (messages: LlmMessage[]) => {
    const step = steps[fn.calls] ?? (() => ({ content: "انتهيت." }));
    fn.calls += 1;
    return step(messages);
  }) as unknown as Llm & { calls: number };
  fn.calls = 0;
  return fn;
}
const call = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

async function setup() {
  const { pg, sql } = await freshDb();
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o', 'Owner', 'o@x.sa', true)`);
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب الأمانة", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "agent-2" });
  await member(pg, w.id, "l", "lawyer");
  await member(pg, w.id, "l2", "lawyer");
  const lawyer = await resolveMembership(sql, "l", w.id, "staff", { write: true });
  const lawyer2 = await resolveMembership(sql, "l2", w.id, "staff", { write: true });
  return { pg, sql, w, lawyer, lawyer2 };
}

test("assistant: reads run, a write waits for confirmation and runs once", async () => {
  const { sql, lawyer, lawyer2 } = await setup();
  const llm = scripted([
    () => ({ content: null, tool_calls: [call("c1", "search_cases", { query: "" })] }),
    (m) => {
      const last = m[m.length - 1];
      assert.equal(last.role, "tool", "the read result is fed back to the model");
      return { content: null, tool_calls: [call("c2", "create_case", { title: "دعوى عمالية", case_type: "labor", fees_sar: 8000 })] };
    },
    () => ({ content: "جهّزت فتح القضية، اضغط «تأكيد»." }),
  ]);

  const r = await agentTurnCore(sql, lawyer, llm, [{ role: "user", content: "افتح قضية عمالية بأتعاب 8000" }], {
    userName: "L",
    today: "2026-09-26",
  });
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].tool, "search_cases");
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].status, "pending");
  assert.match(r.actions[0].summary, /دعوى عمالية/);
  assert.match(r.reply, /تأكيد/);

  // Nothing was written yet.
  assert.equal((await listCasesCore(sql, lawyer, { q: "", page: 1 })).total, 0);

  // Another member cannot confirm someone else's proposal.
  await assert.rejects(confirmActionCore(sql, lawyer2, r.actions[0].id), (e: unknown) => e instanceof WorkspaceError);

  const done = await confirmActionCore(sql, lawyer, r.actions[0].id);
  assert.equal(done.action.status, "done");
  const cases = await listCasesCore(sql, lawyer, { q: "", page: 1 });
  assert.equal(cases.total, 1);

  // Confirming twice never writes twice.
  await assert.rejects(confirmActionCore(sql, lawyer, r.actions[0].id));
  assert.equal((await listCasesCore(sql, lawyer, { q: "", page: 1 })).total, 1);

  // It shows in the audit log.
  const log = await listActionsCore(sql, lawyer);
  assert.equal(log[0]?.tool, "create_case");
  assert.equal(log[0]?.status, "done");
});

test("assistant: cancel, invalid arguments, and unknown tools never write", async () => {
  const { sql, lawyer } = await setup();
  const llm = scripted([
    () => ({
      content: null,
      tool_calls: [
        call("a", "create_task", { title: "x" }), // too short → rejected by the schema
        call("b", "drop_everything", {}), // not a tool
        call("c", "create_task", { title: "مراجعة العقد" }),
      ],
    }),
    () => ({ content: "جهّزت المهمة." }),
  ]);
  const r = await agentTurnCore(sql, lawyer, llm, [{ role: "user", content: "أضف مهمة" }], { userName: "L", today: "2026-09-26" });
  assert.equal(r.actions.length, 1, "only the valid write is proposed");
  await cancelActionCore(sql, lawyer, r.actions[0].id);
  await assert.rejects(confirmActionCore(sql, lawyer, r.actions[0].id), "a cancelled action can't run");
});

test("assistant: a read-only office gets no write tools; MCP writes are logged", async () => {
  const { sql, lawyer } = await setup();
  const ro = { ...lawyer, lifecycle: { ...lawyer.lifecycle, readOnly: true } };
  let seen: unknown[] = [];
  const llm: Llm = async (_m, opts) => {
    seen = opts.tools;
    return { content: "للقراءة فقط." };
  };
  await agentTurnCore(sql, ro, llm, [{ role: "user", content: "مرحبا" }], { userName: "L", today: "2026-09-26" });
  const names = (seen as { function: { name: string } }[]).map((t) => t.function.name);
  assert.ok(names.includes("search_cases"));
  assert.ok(!names.some((n) => AGENT_TOOLS.find((t) => t.name === n)?.write), "no write tools offered");
  assert.equal(openAiTools(AGENT_TOOLS).length, AGENT_TOOLS.length);

  await runLoggedToolCore(sql, lawyer, "create_client", { name: "عميل من MCP", phone: "0501234567" });
  const log = await listActionsCore(sql, lawyer);
  assert.equal(log[0]?.source, "mcp");
  assert.equal(log[0]?.status, "done");
});

test("assistant: announcing a change without calling the tool gets one nudge", async () => {
  const { sql, lawyer } = await setup();
  const llm = scripted([
    () => ({ content: "جهّزت المهمة، اضغط «تأكيد» لإضافتها." }), // no tool call
    (m) => {
      assert.match(String((m[m.length - 1] as { content: string }).content), /لم تُستدعَ أي أداة كتابة/);
      return { content: null, tool_calls: [call("t", "create_task", { title: "مراجعة العقد" })] };
    },
    () => ({ content: "جهّزت المهمة، اضغط «تأكيد»." }),
  ]);
  const r = await agentTurnCore(sql, lawyer, llm, [{ role: "user", content: "أضف مهمة مراجعة العقد" }], { userName: "L", today: "2026-09-26" });
  assert.equal(r.actions.length, 1);
  assert.equal(llm.calls, 3);

  // A plain past-tense answer is never nudged.
  const calm = scripted([() => ({ content: "تم تأكيد إضافة العميل سابقًا." })]);
  const r2 = await agentTurnCore(sql, lawyer, calm, [{ role: "user", content: "شكرًا" }], { userName: "L", today: "2026-09-26" });
  assert.equal(r2.actions.length, 0);
  assert.equal(calm.calls, 1);
});
