/**
 * «مركز التواصل» on a real schema (PGLite + every migration) with a scripted
 * model: office isolation, the visitor token reaching only its own
 * conversation, notes never leaving through the visitor poll, the AI first
 * responder (reply, handoff on request, caps, failure), and the team's
 * actions (reply, assign, status, link / create client, counts, AI tools).
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import type { Llm, LlmMessage, LlmResult } from "./agent/agent-core.ts";
import { adapterFor, ChannelNotConnectedError, CHANNEL_LIST } from "./inbox-channels.ts";
import {
  AI_TURNS_PER_CONVERSATION,
  HANDOFF_MARK,
  aiFirstReplyCore,
  assignCore,
  chatOfficeCore,
  classifyCore,
  clientFromConversationCore,
  countsCore,
  deleteQuickReplyCore,
  getConversationCore,
  linkClientCore,
  listConversationsCore,
  listQuickRepliesCore,
  markReadCore,
  noteCore,
  parseIntent,
  receiveInboundCore,
  replyCore,
  saveInboxSettingsCore,
  saveQuickReplyCore,
  setStatusCore,
  startChatCore,
  suggestReplyCore,
  summarizeCore,
  visitorConversationCore,
  visitorPollCore,
  visitorSendCore,
  wantsHuman,
  type ChatOffice,
} from "./inbox-core.ts";
import { createClientCore } from "./practice-core.ts";

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

function scripted(steps: ((m: LlmMessage[]) => LlmResult)[]): Llm & { calls: number; seen: LlmMessage[][] } {
  const fn = (async (messages: LlmMessage[]) => {
    fn.seen.push(messages);
    const step = steps[fn.calls] ?? (() => ({ content: "شكرًا لتواصلك." }));
    fn.calls += 1;
    return step(messages);
  }) as unknown as Llm & { calls: number; seen: LlmMessage[][] };
  fn.calls = 0;
  fn.seen = [];
  return fn;
}

const token = () => {
  const t = randomBytes(32).toString("base64url");
  return { token: t, hash: createHash("sha256").update(t).digest("hex") };
};

let n = 0;
async function setup() {
  const { pg, sql } = await freshDb();
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('o1', 'Owner 1', 'o1@x.sa', true), ('o2', 'Owner 2', 'o2@x.sa', true)`);
  n += 1;
  const w1 = { ...(await createWorkspaceCore(sql, "o1", { name: "مكتب الأمانة", city: "الرياض", crNumber: null, teamSize: "2-5", slug: `inbox-a-${n}` })), slug: `inbox-a-${n}` };
  const w2 = { ...(await createWorkspaceCore(sql, "o2", { name: "مكتب العدل", city: "جدة", crNumber: null, teamSize: "2-5", slug: `inbox-b-${n}` })), slug: `inbox-b-${n}` };
  await member(pg, w1.id, "l1", "lawyer");
  await member(pg, w1.id, "s1", "staff");
  const owner = await resolveMembership(sql, "o1", w1.id, "staff", { write: true });
  const lawyer = await resolveMembership(sql, "l1", w1.id, "staff", { write: true });
  const staff = await resolveMembership(sql, "s1", w1.id, "staff", { write: true });
  const other = await resolveMembership(sql, "o2", w2.id, "staff", { write: true });
  const settings = { webchatEnabled: true, aiFirstReply: true, welcome: "أهلًا بك", awayText: "" };
  await saveInboxSettingsCore(sql, owner, settings);
  await saveInboxSettingsCore(sql, other, settings);
  const office1 = (await chatOfficeCore(sql, w1.slug))!;
  const office2 = (await chatOfficeCore(sql, w2.slug))!;
  return { pg, sql, w1, w2, owner, lawyer, staff, other, office1, office2 };
}

async function start(sql: SqlTag, office: ChatOffice, message = "أريد استشارة في عقد عمل", aiFirst = false) {
  const t = token();
  const conv = await startChatCore(sql, office, { name: "سارة", phone: "+966501112223", message, tokenHash: t.hash }, { aiFirst });
  return { ...t, conv };
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (err: unknown) => err instanceof WorkspaceError && err.code === code, `expected ${code}`);
}

test("inbox: offices are isolated; staff actions stay inside the office", async () => {
  const { sql, owner, lawyer, other, office1, office2 } = await setup();
  const a = await start(sql, office1);
  await start(sql, office2, "سؤال لمكتب آخر");

  const mine = await listConversationsCore(sql, owner, { tab: "all" });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, a.conv.id);
  assert.equal(mine[0].unread_count, 1);
  assert.equal(mine[0].preview, "أريد استشارة في عقد عمل");
  assert.equal((await listConversationsCore(sql, other, { tab: "all" })).length, 1);

  // Another office's id behaves like an unknown one, for every action.
  await rejects(getConversationCore(sql, other, a.conv.id), "not_found");
  await rejects(replyCore(sql, other, a.conv.id, "مرحبا"), "not_found");
  await rejects(noteCore(sql, other, a.conv.id, "ملاحظة"), "not_found");
  await rejects(assignCore(sql, other, a.conv.id, null), "not_found");
  await rejects(setStatusCore(sql, other, a.conv.id, "closed"), "not_found");
  await rejects(clientFromConversationCore(sql, other, a.conv.id), "not_found");
  // …and a member of another office can't be assigned.
  await rejects(assignCore(sql, lawyer, a.conv.id, "o2"), "invalid");
  // A client of another office can't be linked.
  const foreign = await createClientCore(sql, other, { kind: "individual", name: "عميل آخر", phone: null, email: null, idNumber: null, notes: "", tags: [] });
  await rejects(linkClientCore(sql, owner, a.conv.id, foreign.id), "not_found");
  // Search works inside the office only.
  assert.equal((await listConversationsCore(sql, owner, { tab: "all", q: "سارة" })).length, 1);
  assert.equal((await listConversationsCore(sql, owner, { tab: "all", q: "0501112223" })).length, 1);
  assert.equal((await listConversationsCore(sql, owner, { tab: "all", q: "لا يوجد" })).length, 0);
});

test("web chat: a visitor token reaches only its own conversation; notes never reach the visitor", async () => {
  const { sql, lawyer, office1, office2 } = await setup();
  const a = await start(sql, office1);
  const b = await start(sql, office1, "سؤال ثانٍ");

  assert.equal((await visitorConversationCore(sql, office1.id, a.hash))?.id, a.conv.id);
  assert.equal((await visitorConversationCore(sql, office1.id, b.hash))?.id, b.conv.id);
  // The same token in another office, or a wrong / malformed token, finds nothing.
  assert.equal(await visitorConversationCore(sql, office2.id, a.hash), null);
  assert.equal(await visitorConversationCore(sql, office1.id, token().hash), null);
  assert.equal(await visitorConversationCore(sql, office1.id, "not-a-hash"), null);

  await noteCore(sql, lawyer, a.conv.id, "ملاحظة داخلية: العميل مهم");
  await assignCore(sql, lawyer, a.conv.id, "l1"); // a private system event
  await replyCore(sql, lawyer, a.conv.id, "أهلًا سارة، كيف نخدمك؟");

  const poll = await visitorPollCore(sql, a.conv, null);
  assert.deepEqual(
    poll.messages.map((m) => m.from),
    ["me", "office"],
  );
  assert.ok(!poll.messages.some((m) => m.body.includes("ملاحظة داخلية")), "notes never reach the visitor");
  assert.ok(!poll.messages.some((m) => m.body.includes("تولّى")), "private events never reach the visitor");
  assert.equal(poll.status, "pending");

  // The other visitor sees none of it.
  const pollB = await visitorPollCore(sql, b.conv, null);
  assert.deepEqual(pollB.messages.map((m) => m.body), ["سؤال ثانٍ"]);

  // Polling since the last message returns it again (slack window) plus anything newer.
  const since = poll.messages[poll.messages.length - 1].at;
  await visitorSendCore(sql, a.conv, "شكرًا لكم");
  const next = await visitorPollCore(sql, a.conv, since);
  assert.ok(next.messages.some((m) => m.body === "شكرًا لكم"));
  assert.equal(next.status, "open", "a visitor message puts the conversation back to the team");

  // Staff see everything, including the note.
  const thread = await getConversationCore(sql, lawyer, a.conv.id);
  assert.ok(thread.messages.some((m) => m.direction === "note"));
  assert.equal(thread.conversation.can_send, true);
});

test("web chat: closed office and settings rules", async () => {
  const { sql, owner, staff, office1 } = await setup();
  await rejects(saveInboxSettingsCore(sql, staff, { webchatEnabled: false, aiFirstReply: false, welcome: "", awayText: "" }), "role");
  await saveInboxSettingsCore(sql, owner, { webchatEnabled: false, aiFirstReply: false, welcome: "", awayText: "" });
  const closed = (await chatOfficeCore(sql, office1.slug))!;
  assert.equal(closed.open, false);
  await rejects(start(sql, closed), "forbidden");
  assert.equal(await chatOfficeCore(sql, "no-such-office"), null);

  // Away text is posted as a public event outside working hours.
  await saveInboxSettingsCore(sql, owner, { webchatEnabled: true, aiFirstReply: false, welcome: "", awayText: "نحن خارج أوقات العمل الآن." });
  const office = (await chatOfficeCore(sql, office1.slug))!;
  const friday = Date.parse("2026-09-25T10:00:00+03:00"); // a Friday: not a work day by default
  const t = token();
  const conv = await startChatCore(sql, office, { name: "خالد", phone: null, message: "مرحبا", tokenHash: t.hash }, { aiFirst: false, now: friday });
  const poll = await visitorPollCore(sql, conv, null);
  assert.deepEqual(poll.messages.map((m) => m.from), ["me", "system"]);
  assert.match(poll.messages[1].body, /خارج أوقات العمل/);
});

test("AI first responder: replies, hands off on request, and respects caps", async () => {
  const { sql, lawyer, office1 } = await setup();
  const opts = { bookingUrl: "https://deal.mubasat.net/o/x/book", dailyCap: 200 };

  // A normal question: the AI answers as 'ai', status stays 'bot'.
  const a = await start(sql, office1, "ما ساعات عملكم؟", true);
  assert.equal(a.conv.status, "bot");
  const llm = scripted([
    (m) => {
      assert.equal(m[0].role, "system");
      assert.match(String(m[0].content), /لا تقدّم أي استشارة/);
      assert.match(String(m[0].content), /https:\/\/deal\.mubasat\.net\/o\/x\/book|سيتواصل/);
      return { content: "نعمل من الأحد إلى الخميس، من 9 صباحًا إلى 5 مساءً." };
    },
  ]);
  const r1 = await aiFirstReplyCore(sql, office1, a.conv.id, llm, opts);
  assert.deepEqual(r1, { replied: true, handoff: null });
  let poll = await visitorPollCore(sql, a.conv, null);
  assert.deepEqual(poll.messages.map((m) => m.from), ["me", "ai"]);
  assert.equal(poll.status, "bot");

  // Asking for a person hands off without calling the model, and tells the visitor.
  await visitorSendCore(sql, a.conv, "أريد أن أتحدث مع موظف من فضلك");
  const before = llm.calls;
  const r2 = await aiFirstReplyCore(sql, office1, a.conv.id, llm, opts);
  assert.equal(r2.handoff, "request");
  assert.equal(llm.calls, before, "no model call for an explicit request");
  poll = await visitorPollCore(sql, a.conv, null);
  assert.equal(poll.status, "open");
  assert.equal(poll.messages[poll.messages.length - 1].from, "system");
  // Once handed off, the AI stays out.
  assert.deepEqual(await aiFirstReplyCore(sql, office1, a.conv.id, llm, opts), { replied: false, handoff: null });

  // The model can hand off itself (marker stripped from the reply).
  const b = await start(sql, office1, "عندي قضية عاجلة جدًا", true);
  const unsure = scripted([() => ({ content: `سأحوّلك إلى أحد أعضاء الفريق الآن.\n${HANDOFF_MARK}` })]);
  const r3 = await aiFirstReplyCore(sql, office1, b.conv.id, unsure, opts);
  assert.deepEqual(r3, { replied: true, handoff: "model" });
  poll = await visitorPollCore(sql, b.conv, null);
  assert.ok(!poll.messages.some((m) => m.body.includes(HANDOFF_MARK)));
  assert.equal(poll.status, "open");

  // A model failure hands off silently.
  const c = await start(sql, office1, "سؤال", true);
  const broken: Llm = async () => {
    throw new Error("WS:ai_unavailable");
  };
  assert.equal((await aiFirstReplyCore(sql, office1, c.conv.id, broken, opts)).handoff, "error");
  poll = await visitorPollCore(sql, c.conv, null);
  assert.deepEqual(poll.messages.map((m) => m.from), ["me"], "the visitor sees no error");
  const staffView = await getConversationCore(sql, lawyer, c.conv.id);
  assert.ok(staffView.messages.some((m) => m.direction === "system" && /تعذّر/.test(m.body)), "the team sees why");

  // Per-conversation cap.
  const d = await start(sql, office1, "سؤال 1", true);
  const chatty = scripted([]);
  for (let i = 0; i < AI_TURNS_PER_CONVERSATION; i += 1) {
    assert.equal((await aiFirstReplyCore(sql, office1, d.conv.id, chatty, opts)).replied, true);
    await visitorSendCore(sql, d.conv, `سؤال ${i + 2}`);
  }
  assert.equal((await aiFirstReplyCore(sql, office1, d.conv.id, chatty, opts)).handoff, "cap");
  assert.equal(chatty.calls, AI_TURNS_PER_CONVERSATION);

  // Per-office daily cap.
  const e = await start(sql, office1, "سؤال", true);
  const r5 = await aiFirstReplyCore(sql, office1, e.conv.id, chatty, { ...opts, dailyCap: 3 });
  assert.equal(r5.handoff, "daily_cap");

  // The office turns the AI off (or its plan drops it) mid-conversation: hand off, no model call.
  const f = await start(sql, office1, "سؤال آخر", true);
  const calls = chatty.calls;
  const off = await aiFirstReplyCore(sql, { ...office1, settings: { ...office1.settings, aiFirstReply: false } }, f.conv.id, chatty, opts);
  assert.equal(off.handoff, "off");
  assert.equal(chatty.calls, calls);
  const g = await start(sql, office1, "سؤال ثالث", true);
  assert.equal((await aiFirstReplyCore(sql, office1, g.conv.id, chatty, { ...opts, aiAllowed: false })).handoff, "off");

  assert.equal(wantsHuman("ممكن اكلم محامي؟"), true);
  assert.equal(wantsHuman("ما ساعات العمل؟"), false);
});

test("team: reply, assign, status, link / create client, counts, quick replies", async () => {
  const { sql, owner, lawyer, staff, office1 } = await setup();
  const a = await start(sql, office1);
  const b = await start(sql, office1, "سؤال عن الأتعاب");

  let counts = await countsCore(sql, lawyer);
  assert.deepEqual(counts, { all: 2, unassigned: 2, mine: 0, closed: 0, unread: 2 });

  await markReadCore(sql, lawyer, b.conv.id);
  assert.equal((await countsCore(sql, lawyer)).unread, 1);

  // Replying assigns an unassigned conversation to the replier and clears unread.
  await replyCore(sql, lawyer, a.conv.id, "أهلًا بك");
  counts = await countsCore(sql, lawyer);
  assert.equal(counts.mine, 1);
  assert.equal(counts.unassigned, 1);
  assert.equal(counts.unread, 0);
  assert.equal((await listConversationsCore(sql, lawyer, { tab: "mine" }))[0]?.id, a.conv.id);
  assert.equal((await listConversationsCore(sql, lawyer, { tab: "unassigned" }))[0]?.id, b.conv.id);

  await assignCore(sql, owner, b.conv.id, "s1");
  assert.equal((await countsCore(sql, staff)).mine, 1);
  await assignCore(sql, owner, b.conv.id, null);

  await setStatusCore(sql, staff, a.conv.id, "closed");
  counts = await countsCore(sql, lawyer);
  assert.equal(counts.closed, 1);
  assert.equal(counts.all, 1);
  assert.equal((await listConversationsCore(sql, lawyer, { tab: "closed" }))[0]?.id, a.conv.id);
  // A visitor message reopens a closed conversation.
  await visitorSendCore(sql, a.conv, "عندي سؤال إضافي");
  assert.equal((await countsCore(sql, lawyer)).closed, 0);

  // Create a client from the conversation, then a second conversation from
  // the same phone links to that client instead of creating another.
  const made = await clientFromConversationCore(sql, staff, a.conv.id);
  assert.equal(made.existed, false);
  const again = await clientFromConversationCore(sql, staff, b.conv.id);
  assert.equal(again.existed, true);
  assert.equal(again.clientId, made.clientId);
  const thread = await getConversationCore(sql, lawyer, a.conv.id);
  assert.equal(thread.conversation.client_id, made.clientId);
  assert.equal(thread.conversation.client_name, "سارة");
  await linkClientCore(sql, lawyer, a.conv.id, null);
  assert.equal((await getConversationCore(sql, lawyer, a.conv.id)).conversation.client_id, null);

  // Quick replies: admins manage, everyone reads.
  await rejects(saveQuickReplyCore(sql, staff, { title: "ترحيب", body: "أهلًا بك" }), "role");
  const q = await saveQuickReplyCore(sql, owner, { title: "ترحيب", body: "أهلًا بك في مكتبنا" });
  assert.equal((await listQuickRepliesCore(sql, staff)).length, 1);
  await saveQuickReplyCore(sql, owner, { id: q.id, title: "ترحيب", body: "مرحبًا" });
  assert.equal((await listQuickRepliesCore(sql, staff))[0].body, "مرحبًا");
  await deleteQuickReplyCore(sql, owner, q.id);
  assert.equal((await listQuickRepliesCore(sql, staff)).length, 0);
});

test("channels: inbound from a future channel lands in the inbox; replies need a connected adapter", async () => {
  const { sql, lawyer, office1 } = await setup();
  const r = await receiveInboundCore(sql, office1.id, { channel: "whatsapp", phone: "+966500000001", name: "فهد", body: "السلام عليكم" });
  const again = await receiveInboundCore(sql, office1.id, { channel: "whatsapp", phone: "+966500000001", body: "هل أنتم متاحون؟" });
  assert.equal(again.conversationId, r.conversationId, "the same contact joins the open conversation");
  const thread = await getConversationCore(sql, lawyer, r.conversationId);
  assert.equal(thread.messages.length, 2);
  assert.equal(thread.conversation.can_send, false);
  await rejects(replyCore(sql, lawyer, r.conversationId, "أهلًا"), "invalid");
  await assert.rejects(adapterFor("sms").send(thread.conversation as never, "x"), (e: unknown) => e instanceof ChannelNotConnectedError);
  assert.deepEqual(
    CHANNEL_LIST.map((c) => [c.id, c.connected]),
    [
      ["webchat", true],
      ["whatsapp", false],
      ["sms", false],
      ["voice", false],
    ],
  );
});

test("team AI: summary, suggested reply (never sent), classification; plan gate", async () => {
  const { sql, lawyer, office1, pg, w1 } = await setup();
  const a = await start(sql, office1, "أحتاج أن أعرف كم أتعاب قضية عمالية");
  await noteCore(sql, lawyer, a.conv.id, "عميل محتمل");
  const llm = scripted([
    (m) => {
      assert.match(String(m[1].content), /ملاحظة داخلية/);
      return { content: "- العميلة سارة تسأل عن أتعاب قضية عمالية." };
    },
    () => ({ content: "أهلًا سارة، تختلف الأتعاب حسب القضية، ويسعدنا تحديد موعد." }),
    () => ({ content: "استفسار أتعاب" }),
  ]);
  const s = await summarizeCore(sql, lawyer, llm, a.conv.id);
  assert.match(s.summary, /أتعاب/);
  assert.equal((await getConversationCore(sql, lawyer, a.conv.id)).conversation.ai_summary, s.summary);

  const d = await suggestReplyCore(sql, lawyer, llm, a.conv.id);
  assert.match(d.draft, /سارة/);
  const out = (await getConversationCore(sql, lawyer, a.conv.id)).messages.filter((m) => m.direction === "out");
  assert.equal(out.length, 0, "a suggestion is never sent");

  assert.equal((await classifyCore(sql, lawyer, llm, a.conv.id)).intent, "fees");
  assert.equal((await listConversationsCore(sql, lawyer, { tab: "all" }))[0].ai_intent, "fees");
  assert.equal(parseIntent("الفئة: موعد"), "appointment");
  assert.equal(parseIntent("لا أعرف"), "other");

  await rejects(summarizeCore(sql, lawyer, null, a.conv.id), "ai_unavailable");
  await pg.query(`update workspaces set plan = 'basic' where id = $1`, [w1.id]);
  const basic = await resolveMembership(sql, "l1", w1.id, "staff", { write: true });
  await rejects(summarizeCore(sql, basic, llm, a.conv.id), "plan_feature");
});
