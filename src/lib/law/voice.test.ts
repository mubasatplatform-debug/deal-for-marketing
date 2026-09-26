/**
 * «مركز الاتصال» on a real schema (PGLite + every migration): office
 * isolation, Saudi-only numbers (local input normalized), the call caps,
 * monotonic status from relay events, unknown calls as no-ops, the recording
 * flag following the office setting, the note a finished call leaves in its
 * conversation, the transcript + AI summary with scripted fakes, and the
 * relay signatures (dial + event window).
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import type { Llm, LlmMessage, LlmResult } from "./agent/agent-core.ts";
import { createClientCore } from "./practice-core.ts";
import { receiveInboundCore } from "./inbox-core.ts";
import {
  CALLS_PER_OFFICE_DAY,
  CALLS_PER_USER_HOUR,
  applyVoiceEventCore,
  callLogText,
  callRecordingCore,
  cleanSummary,
  createCallCore,
  formatDuration,
  getCallCore,
  getVoiceSettingsCore,
  listCallsCore,
  logCallToConversationCore,
  mapRelayStatus,
  saudiPhone,
  saveVoiceSettingsCore,
  setTranscriptCore,
  summarizeCallByIdCore,
  summarizeCallCore,
} from "./voice-core.ts";
import { EVENT_WINDOW_SEC, signDial, verifyEventSignature } from "./voice-sign.ts";

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

let n = 0;
async function setup() {
  const { pg, sql } = await freshDb();
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o1', 'سالم', 'o1@x.sa', true), ('o2', 'Owner 2', 'o2@x.sa', true)`);
  n += 1;
  const w1 = await createWorkspaceCore(sql, "o1", { name: "مكتب الأمانة", city: "الرياض", crNumber: null, teamSize: "2-5", slug: `voice-a-${n}` });
  const w2 = await createWorkspaceCore(sql, "o2", { name: "مكتب العدل", city: "جدة", crNumber: null, teamSize: "2-5", slug: `voice-b-${n}` });
  await member(pg, w1.id, "s1", "staff");
  const owner = await resolveMembership(sql, "o1", w1.id, "staff", { write: true });
  const staff = await resolveMembership(sql, "s1", w1.id, "staff", { write: true });
  const other = await resolveMembership(sql, "o2", w2.id, "staff", { write: true });
  return { pg, sql, w1, w2, owner, staff, other };
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (err: unknown) => err instanceof WorkspaceError && err.code === code, `expected ${code}`);
}

function scripted(reply: string): Llm & { seen: LlmMessage[][] } {
  const fn = (async (messages: LlmMessage[]): Promise<LlmResult> => {
    fn.seen.push(messages);
    return { content: reply };
  }) as unknown as Llm & { seen: LlmMessage[][] };
  fn.seen = [];
  return fn;
}

test("voice: Saudi-only numbers, local input normalized", () => {
  assert.equal(saudiPhone("0501234567"), "+966501234567");
  assert.equal(saudiPhone("٠٥٠١٢٣٤٥٦٧"), "+966501234567");
  assert.equal(saudiPhone("050 123 4567"), "+966501234567");
  assert.equal(saudiPhone("+966 50 123 4567"), "+966501234567");
  assert.equal(saudiPhone("00966501234567"), "+966501234567");
  assert.equal(saudiPhone("0112345678"), "+966112345678");
  assert.equal(saudiPhone("+971501234567"), null);
  assert.equal(saudiPhone("+14155550100"), null);
  assert.equal(saudiPhone("12345"), null);
  assert.equal(saudiPhone(""), null);
  assert.equal(mapRelayStatus("in-progress"), "in_progress");
  assert.equal(mapRelayStatus("answered"), "in_progress");
  assert.equal(mapRelayStatus("no-answer"), "no_answer");
  assert.equal(mapRelayStatus("weird"), null);
  assert.equal(formatDuration(192), "3:12");
  assert.equal(formatDuration(5), "0:05");
  assert.equal(formatDuration(3725), "1:02:05");
});

test("voice: calls are created in the caller's office only", async () => {
  const { sql, owner, staff, other } = await setup();
  await rejects(createCallCore(sql, owner, { to: "+971501234567" }), "invalid");
  await rejects(createCallCore(sql, owner, { to: "not a number" }), "invalid");

  const client = await createClientCore(sql, owner, { kind: "individual", name: "نورة", phone: "+966501112223", email: null, idNumber: null, notes: "", tags: [] });
  const foreign = await createClientCore(sql, other, { kind: "individual", name: "خالد", phone: "+966509998887", email: null, idNumber: null, notes: "", tags: [] });
  const conv = await receiveInboundCore(sql, other.workspace.id, { channel: "whatsapp", phone: "+966509998887", body: "مرحبا" });

  const call = await createCallCore(sql, staff, { to: "0501112223", clientId: client.id });
  assert.equal(call.to, "+966501112223");
  assert.equal(call.recorded, false);

  // Another office's client / conversation behaves like an unknown one.
  await rejects(createCallCore(sql, owner, { to: "0501112223", clientId: foreign.id }), "not_found");
  await rejects(createCallCore(sql, owner, { to: "0501112223", conversationId: conv.conversationId }), "not_found");

  const mine = await listCallsCore(sql, owner, {});
  assert.equal(mine.total, 1);
  assert.equal(mine.rows[0].client_name, "نورة");
  assert.equal(mine.rows[0].user_name, "U s1");
  assert.equal(mine.rows[0].status, "queued");
  assert.equal((await listCallsCore(sql, owner, { mine: true })).total, 0);
  assert.equal((await listCallsCore(sql, staff, { mine: true })).total, 1);
  assert.equal((await listCallsCore(sql, owner, { clientId: client.id })).total, 1);
  assert.equal((await listCallsCore(sql, other, {})).total, 0);
  await rejects(getCallCore(sql, other, call.id), "not_found");
  await rejects(callRecordingCore(sql, other, call.id), "not_found");
  await rejects(setTranscriptCore(sql, other, call.id, "نص"), "not_found");
  assert.equal((await getCallCore(sql, owner, call.id)).id, call.id);
});

test("voice: the recording flag follows the office setting; admins change it", async () => {
  const { sql, owner, staff, other } = await setup();
  assert.deepEqual(await getVoiceSettingsCore(sql, owner), { recordCalls: false });
  await rejects(saveVoiceSettingsCore(sql, staff, { recordCalls: true }), "role");
  await saveVoiceSettingsCore(sql, owner, { recordCalls: true });
  assert.deepEqual(await getVoiceSettingsCore(sql, staff), { recordCalls: true });
  assert.deepEqual(await getVoiceSettingsCore(sql, other), { recordCalls: false });

  const recorded = await createCallCore(sql, staff, { to: "0501112223" });
  assert.equal(recorded.recorded, true);
  const notRecorded = await createCallCore(sql, other, { to: "0501112223" });
  assert.equal(notRecorded.recorded, false);

  // A recording lands only on a call the office chose to record.
  const r1 = await applyVoiceEventCore(sql, { type: "recording", callId: notRecorded.id, recordingSid: "RE123", recordingStatus: "completed" });
  assert.equal(r1.applied, false);
  const pending = await applyVoiceEventCore(sql, { type: "recording", callId: recorded.id, recordingSid: "RE456", recordingStatus: "in-progress" });
  assert.equal(pending.applied, false);
  const r2 = await applyVoiceEventCore(sql, { type: "recording", callId: recorded.id, recordingSid: "RE456", recordingStatus: "completed" });
  assert.deepEqual(r2, { applied: true, ended: false, recordingReady: true, callId: recorded.id });
  const again = await applyVoiceEventCore(sql, { type: "recording", callId: recorded.id, recordingSid: "RE789", recordingStatus: "completed" });
  assert.equal(again.recordingReady, false);
  assert.equal(await callRecordingCore(sql, owner, recorded.id), "RE456");
  assert.equal((await getCallCore(sql, owner, recorded.id)).has_recording, true);
});

test("voice: caps per member per hour and per office per day", async () => {
  const { pg, sql, owner, staff } = await setup();
  for (let i = 0; i < CALLS_PER_USER_HOUR; i += 1) {
    await pg.query(`insert into law_calls (workspace_id, user_id, to_phone) values ($1, 's1', '+966501112223')`, [staff.workspace.id]);
  }
  await rejects(createCallCore(sql, staff, { to: "0501112223" }), "call_limit");
  // Another member of the office is not held by s1's hourly cap.
  await createCallCore(sql, owner, { to: "0501112223" });
  // Older than an hour no longer counts for the member.
  await pg.query(`update law_calls set created_at = now() - interval '2 hours' where user_id = 's1'`);
  await createCallCore(sql, staff, { to: "0501112223" });

  const left = CALLS_PER_OFFICE_DAY - (CALLS_PER_USER_HOUR + 2);
  for (let i = 0; i < left; i += 1) {
    await pg.query(`insert into law_calls (workspace_id, user_id, to_phone, created_at) values ($1, 'o1', '+966501112223', now() - interval '3 hours')`, [owner.workspace.id]);
  }
  await rejects(createCallCore(sql, owner, { to: "0501112223" }), "call_limit");
});

test("voice: relay events move a call forward only; unknown calls are no-ops", async () => {
  const { sql, owner, staff } = await setup();
  const unknown = await applyVoiceEventCore(sql, { type: "status", callId: randomUUID(), status: "ringing" });
  assert.equal(unknown.applied, false);
  assert.equal((await applyVoiceEventCore(sql, { type: "status", callId: "nope", status: "ringing" })).applied, false);

  const call = await createCallCore(sql, staff, { to: "0501112223" });
  const ev = (status: string, duration?: number) => applyVoiceEventCore(sql, { type: "status", callId: call.id, callSid: "CA1", status, duration });

  assert.equal((await ev("initiated")).applied, true);
  assert.equal((await ev("ringing")).applied, true);
  assert.equal((await ev("initiated")).applied, false, "never backwards");
  assert.equal((await ev("bogus")).applied, false);
  assert.equal((await ev("in-progress")).applied, true);
  assert.equal((await ev("answered")).applied, false, "same state twice is a no-op");
  let c = await getCallCore(sql, owner, call.id);
  assert.equal(c.status, "in_progress");
  assert.ok(c.answered_at);
  assert.equal(c.ended_at, null);

  const done = await ev("completed", 192);
  assert.deepEqual(done, { applied: true, ended: true, recordingReady: false, callId: call.id });
  c = await getCallCore(sql, owner, call.id);
  assert.equal(c.status, "completed");
  assert.equal(c.duration_sec, 192);
  assert.ok(c.ended_at);

  // Final is final: late or duplicate events change nothing.
  assert.equal((await ev("ringing")).applied, false);
  assert.equal((await ev("failed")).applied, false);
  assert.equal((await ev("completed", 192)).applied, false);
  assert.equal((await getCallCore(sql, owner, call.id)).status, "completed");

  // A call that is never answered.
  const missed = await createCallCore(sql, staff, { to: "0501112223" });
  await applyVoiceEventCore(sql, { type: "status", callId: missed.id, status: "ringing" });
  const na = await applyVoiceEventCore(sql, { type: "status", callId: missed.id, status: "no-answer", duration: 0 });
  assert.equal(na.ended, true);
  const m = await getCallCore(sql, owner, missed.id);
  assert.equal(m.status, "no_answer");
  assert.equal(m.answered_at, null);
  assert.equal(m.duration_sec, 0);
});

test("voice: a finished call is logged in its conversation (or the client's open one)", async () => {
  const { sql, owner, staff } = await setup();
  const client = await createClientCore(sql, owner, { kind: "individual", name: "نورة", phone: "+966501112223", email: null, idNumber: null, notes: "", tags: [] });
  const conv = await receiveInboundCore(sql, owner.workspace.id, { channel: "whatsapp", phone: "+966501112223", body: "أريد موعدًا" });
  await sql`update law_conversations set client_id = ${client.id} where id = ${conv.conversationId}`;

  // Through the client's open conversation.
  const call = await createCallCore(sql, staff, { to: "0501112223", clientId: client.id });
  assert.equal(await logCallToConversationCore(sql, call.id), null, "not before it ends");
  await applyVoiceEventCore(sql, { type: "status", callId: call.id, status: "in-progress" });
  await applyVoiceEventCore(sql, { type: "status", callId: call.id, status: "completed", duration: 192 });
  const logged = await sql<{ id: string; body: string; direction: string; author_id: string | null }>`
    select id, body, direction, author_id from law_messages
    where conversation_id = ${conv.conversationId} and channel_meta ->> 'call_id' = ${call.id}
  `;
  assert.equal(logged.length, 1);
  assert.equal(logged[0].direction, "system");
  assert.equal(logged[0].author_id, "s1");
  assert.equal(logged[0].body, "مكالمة صادرة · المدة 3:12 · بواسطة U s1");

  // Logging again rewrites the same message (e.g. once a summary exists).
  await sql`update law_calls set ai_summary = ${"- طلبت العميلة موعدًا"} where id = ${call.id}`;
  assert.equal(await logCallToConversationCore(sql, call.id), logged[0].id);
  const [after] = await sql<{ body: string; n: number }>`
    select max(body) as body, count(*)::int as n from law_messages where channel_meta ->> 'call_id' = ${call.id}
  `;
  assert.equal(Number(after.n), 1);
  // The inbox is open to reception: it says a summary exists, never what was said.
  assert.match(after.body, /ملخص المكالمة متاح في صفحة «المكالمات»/);
  assert.doesNotMatch(after.body, /طلبت العميلة/);

  // Directly into the given conversation, even without a client.
  const direct = await createCallCore(sql, owner, { to: "0501112223", conversationId: conv.conversationId });
  await applyVoiceEventCore(sql, { type: "status", callId: direct.id, status: "busy" });
  const [b] = await sql<{ body: string }>`select body from law_messages where channel_meta ->> 'call_id' = ${direct.id}`;
  assert.equal(b.body, "مكالمة صادرة · مشغول · بواسطة سالم");

  // No conversation, no log.
  const loose = await createCallCore(sql, owner, { to: "0551234567" });
  await applyVoiceEventCore(sql, { type: "status", callId: loose.id, status: "failed" });
  assert.equal(await logCallToConversationCore(sql, loose.id), null);

  assert.equal(
    callLogText({ direction: "outbound", status: "completed", duration_sec: 65, user_name: "فلان", recorded: true, ai_summary: null }),
    "مكالمة صادرة · المدة 1:05 · بواسطة فلان · مسجّلة",
  );
});

test("voice: transcript and AI summary (plan, recording, scripted model)", async () => {
  const { pg, sql, owner, other } = await setup();
  await saveVoiceSettingsCore(sql, owner, { recordCalls: true });
  const call = await createCallCore(sql, owner, { to: "0501112223" });
  const llm = scripted("**الموضوع:** موعد\n- طلب العميل موعدًا\nالإجراءات التالية:\n- تأكيد الموعد");
  let transcribed = 0;
  const transcribe = async (sid: string) => {
    transcribed += 1;
    assert.equal(sid, "RE1");
    return "أهلا، أريد موعدا يوم الأحد.";
  };

  // No recording yet.
  await rejects(summarizeCallCore(sql, owner, call.id, { llm, transcribe }), "invalid");
  await applyVoiceEventCore(sql, { type: "status", callId: call.id, status: "completed", duration: 30 });
  await applyVoiceEventCore(sql, { type: "recording", callId: call.id, recordingSid: "RE1", recordingStatus: "completed" });
  // Another office can't summarize it.
  await pg.query(`update workspaces set plan = 'pro' where id = $1`, [other.workspace.id]);
  const otherPro = await resolveMembership(sql, "o2", other.workspace.id, "staff", { write: true });
  await rejects(summarizeCallCore(sql, otherPro, call.id, { llm, transcribe }), "not_found");
  await rejects(summarizeCallCore(sql, owner, call.id, { llm: null, transcribe }), "ai_unavailable");

  const { summary } = await summarizeCallCore(sql, owner, call.id, { llm, transcribe });
  assert.equal(summary, "الموضوع: موعد\n- طلب العميل موعدًا\nالإجراءات التالية:\n- تأكيد الموعد");
  assert.equal(transcribed, 1);
  assert.match(String(llm.seen[0][0].content), /الإجراءات التالية/);
  assert.match(String(llm.seen[0][1].content), /أريد موعدا يوم الأحد/);
  const c = await getCallCore(sql, owner, call.id);
  assert.equal(c.transcript, "أهلا، أريد موعدا يوم الأحد.");
  assert.equal(c.ai_summary, summary);

  // The transcript is reused on a second run.
  await summarizeCallByIdCore(sql, owner.workspace.id, call.id, { llm, transcribe });
  assert.equal(transcribed, 1);

  // A plan without AI is refused (also for the background job).
  await pg.query(`update workspaces set plan = 'basic' where id = $1`, [owner.workspace.id]);
  const basic = await resolveMembership(sql, "o1", owner.workspace.id, "staff", { write: true });
  await rejects(summarizeCallCore(sql, basic, call.id, { llm, transcribe }), "plan_feature");
  await rejects(summarizeCallByIdCore(sql, owner.workspace.id, call.id, { llm, transcribe }), "plan_feature");

  assert.equal(cleanSummary("## عنوان\n* نقطة\n**مهم**"), "عنوان\n- نقطة\nمهم");
});

test("voice: dial and event signatures", () => {
  const secret = "s3cret";
  const id = "7b0f6a6e-2d1c-4c1e-9d8b-0a1b2c3d4e5f";
  const expected = createHmac("sha256", secret).update(`${id}|+966501112223|1|1800000120`).digest("hex");
  assert.equal(signDial(secret, id, "+966501112223", "1", 1_800_000_120), expected);
  assert.notEqual(signDial(secret, id, "+966501112223", "0", 1_800_000_120), expected);
  // The expiry is signed: a later exp can't be substituted.
  assert.notEqual(signDial(secret, id, "+966501112223", "1", 1_800_009_999), expected);

  const body = JSON.stringify({ type: "status", callId: id, status: "ringing" });
  const now = 1_800_000_000;
  const ts = String(now);
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  assert.deepEqual(verifyEventSignature(secret, ts, sig, body, now), { ok: true });
  assert.deepEqual(verifyEventSignature(secret, ts, sig.toUpperCase(), body, now), { ok: true });
  assert.deepEqual(verifyEventSignature(secret, ts, sig, body, now + EVENT_WINDOW_SEC), { ok: true });
  assert.deepEqual(verifyEventSignature(secret, ts, sig, body, now + EVENT_WINDOW_SEC + 1), { ok: false, reason: "stale" });
  assert.deepEqual(verifyEventSignature(secret, ts, sig, body, now - EVENT_WINDOW_SEC - 1), { ok: false, reason: "stale" });
  assert.deepEqual(verifyEventSignature(secret, ts, sig, `${body} `, now), { ok: false, reason: "signature" });
  assert.deepEqual(verifyEventSignature("other", ts, sig, body, now), { ok: false, reason: "signature" });
  assert.deepEqual(verifyEventSignature(secret, ts, "abc", body, now), { ok: false, reason: "signature" });
  assert.deepEqual(verifyEventSignature(secret, "12a", sig, body, now), { ok: false, reason: "stale" });
  assert.deepEqual(verifyEventSignature(secret, null, sig, body, now), { ok: false, reason: "missing" });
  assert.deepEqual(verifyEventSignature(secret, ts, null, body, now), { ok: false, reason: "missing" });
  assert.deepEqual(verifyEventSignature("", ts, sig, body, now), { ok: false, reason: "missing" });
});

test("voice: call content is for lawyers and the caller, not the rest of reception", async () => {
  const { sql, owner, staff } = await setup();
  const call = await createCallCore(sql, owner, { to: "0501112223" });
  await sql`update law_calls set recording_sid = 'RE1', transcript = 'نص', ai_summary = '- ملخص' where id = ${call.id}`;

  const asStaff = await getCallCore(sql, staff, call.id);
  assert.equal(asStaff.transcript, null);
  assert.equal(asStaff.ai_summary, null);
  assert.equal(asStaff.has_recording, false);
  assert.equal((await listCallsCore(sql, staff)).rows.find((r) => r.id === call.id)?.ai_summary, null);
  await assert.rejects(callRecordingCore(sql, staff, call.id), /WS:role/);

  const asOwner = await getCallCore(sql, owner, call.id);
  assert.equal(asOwner.transcript, "نص");
  assert.equal(await callRecordingCore(sql, owner, call.id), "RE1");

  // The member who made the call sees their own call's content.
  const own = await createCallCore(sql, staff, { to: "0501112223" });
  await sql`update law_calls set recording_sid = 'RE2', ai_summary = '- خاص' where id = ${own.id}`;
  assert.equal((await getCallCore(sql, staff, own.id)).ai_summary, "- خاص");
  assert.equal(await callRecordingCore(sql, staff, own.id), "RE2");
});
