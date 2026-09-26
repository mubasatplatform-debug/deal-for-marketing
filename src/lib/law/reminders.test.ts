/**
 * Automatic reminders on a real schema: client windows (24 h / 1 h), the
 * claim ledger (a second run sends nothing, a failed send retries), the
 * office switches, read-only offices, and each lawyer's morning digest.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, type SqlTag } from "../saas/tenancy-core.ts";
import {
  dueClientRemindersCore,
  dueLawyerDigestsCore,
  getReminderSettingsCore,
  markSentCore,
  processRemindersCore,
  saveReminderSettingsCore,
  type ClientReminderDue,
  type LawyerDigestDue,
} from "./reminders-core.ts";

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

const MIN = 60_000;
const HOUR = 60 * MIN;
/** Thursday 1 Oct 2026, 08:00 Riyadh (05:00 UTC). */
const NOW = Date.parse("2026-10-01T05:00:00.000Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();

let n = 0;
async function addUser(pg: PGlite, id: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [
    id,
    `محامي ${id}`,
    `${id}@x.sa`,
  ]);
}

async function office(pg: PGlite, sql: SqlTag, owner: string) {
  n += 1;
  await addUser(pg, owner);
  const w = await createWorkspaceCore(sql, owner, {
    name: `مكتب التذكير ${n}`,
    city: "الرياض",
    crNumber: null,
    teamSize: "2-5",
    slug: `remind-${n}-office`,
  });
  // A paying office with no end date: never lapses, whatever the test clock.
  await pg.query(`update workspaces set status = 'active', trial_ends_at = null, current_period_end = null where id = $1`, [w.id]);
  return w;
}

async function member(pg: PGlite, ws: string, user: string, role = "lawyer") {
  await addUser(pg, user);
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [ws, user, role]);
}

async function appointment(
  pg: PGlite,
  ws: string,
  startsAt: string,
  extra: { status?: string; email?: string | null; clientId?: string | null; lawyer?: string | null; mode?: string; nonce?: string | null; title?: string } = {},
): Promise<string> {
  const rows = await pg.query<{ id: string }>(
    `insert into law_appointments (workspace_id, kind, mode, status, title, client_id, lead_name, lead_email, lawyer_id, starts_at, ends_at, meet_nonce)
     values ($1, 'consultation', $2, $3, $4, $5, 'عميل محتمل', $6, $7, $8::timestamptz, $8::timestamptz + interval '30 minutes', $9)
     returning id`,
    [
      ws,
      extra.mode ?? "video",
      extra.status ?? "confirmed",
      extra.title ?? "",
      extra.clientId ?? null,
      extra.email === undefined ? "lead@client.sa" : extra.email,
      extra.lawyer ?? null,
      startsAt,
      extra.nonce === undefined ? "nonce-1" : extra.nonce,
    ],
  );
  return rows.rows[0].id;
}

test("client reminders: only confirmed appointments with an email inside the 24h / 1h windows", async () => {
  const { pg, sql } = await freshDb();
  const w = await office(pg, sql, "o1");
  await member(pg, w.id, "l1");

  const in24 = await appointment(pg, w.id, at(24 * HOUR), { lawyer: "l1" });
  const in1 = await appointment(pg, w.id, at(HOUR), { mode: "in_office", nonce: null });
  await appointment(pg, w.id, at(22 * HOUR)); // between windows
  await appointment(pg, w.id, at(26 * HOUR)); // too far
  await appointment(pg, w.id, at(30 * MIN)); // too close
  await appointment(pg, w.id, at(24 * HOUR), { status: "pending" });
  await appointment(pg, w.id, at(24 * HOUR), { status: "cancelled" });
  await appointment(pg, w.id, at(24 * HOUR), { email: null }); // no way to reach them

  // The client record's email wins over the lead's.
  const [client] = (
    await pg.query<{ id: string }>(
      `insert into law_clients (workspace_id, name, email) values ($1, 'شركة النور', 'client@nour.sa') returning id`,
      [w.id],
    )
  ).rows;
  const withClient = await appointment(pg, w.id, at(HOUR + 10 * MIN), { clientId: client.id });

  const due = await dueClientRemindersCore(sql, NOW);
  const by = new Map(due.map((d) => [d.appointmentId, d]));
  assert.equal(due.length, 3);
  assert.equal(by.get(in24)?.kind, "client_24h");
  assert.equal(by.get(in24)?.lawyerName, "محامي l1");
  assert.equal(by.get(in24)?.meetNonce, "nonce-1");
  assert.equal(by.get(in1)?.kind, "client_1h");
  assert.equal(by.get(in1)?.meetNonce, null);
  assert.equal(by.get(in1)?.mode, "in_office");
  assert.equal(by.get(withClient)?.recipient, "client@nour.sa");
  assert.match(by.get(in24)?.officeName ?? "", /^مكتب التذكير/);

  // The 24h reminder of an appointment and its 1h reminder are separate: an
  // hour before, the same appointment is due again as client_1h.
  const later = await dueClientRemindersCore(sql, NOW + 23 * HOUR);
  assert.ok(later.some((d) => d.appointmentId === in24 && d.kind === "client_1h"));
});

test("client reminders: a second run sends nothing; a failed send is retried", async () => {
  const { pg, sql } = await freshDb();
  const w = await office(pg, sql, "o2");
  await appointment(pg, w.id, at(24 * HOUR));
  await appointment(pg, w.id, at(HOUR));

  const sent: ClientReminderDue[] = [];
  const ok = { client: async (r: ClientReminderDue) => (sent.push(r), true), digest: async () => true };

  const first = await processRemindersCore(sql, NOW, ok);
  assert.deepEqual(first, { client24: 1, client1: 1, digests: 0, failed: 0 });
  const second = await processRemindersCore(sql, NOW + 5 * MIN, ok);
  assert.deepEqual(second, { client24: 0, client1: 0, digests: 0, failed: 0 });
  assert.equal(sent.length, 2);

  // A concurrent claim loses.
  const [d] = await dueClientRemindersCore(sql, NOW);
  assert.equal(d, undefined);
  assert.equal(await markSentCore(sql, sent[0].kind, sent[0].refId, sent[0].recipient), false);

  // A failed send releases its claim, and the next run sends it.
  await appointment(pg, w.id, at(24 * HOUR + 30 * MIN));
  const failing = { client: async () => false, digest: async () => true };
  assert.deepEqual(await processRemindersCore(sql, NOW, failing), { client24: 0, client1: 0, digests: 0, failed: 1 });
  const throwing = {
    client: async (): Promise<boolean> => {
      throw new Error("relay down");
    },
    digest: async () => true,
  };
  assert.equal((await processRemindersCore(sql, NOW, throwing)).failed, 1);
  assert.deepEqual(await processRemindersCore(sql, NOW, ok), { client24: 1, client1: 0, digests: 0, failed: 0 });

  // A moved appointment is reminded again for its new time.
  const day = sent.find((s) => s.kind === "client_24h") as ClientReminderDue;
  assert.equal((await dueClientRemindersCore(sql, NOW + HOUR)).filter((m) => m.appointmentId === day.appointmentId).length, 0);
  await pg.query(
    `update law_appointments set starts_at = $2::timestamptz + interval '1 hour', ends_at = $2::timestamptz + interval '90 minutes'
     where id = $1`,
    [day.appointmentId, day.startsAt],
  );
  const moved = await dueClientRemindersCore(sql, NOW + HOUR);
  assert.ok(moved.some((m) => m.appointmentId === day.appointmentId && m.kind === "client_24h"));
});

test("reminders: the office switches, and read-only offices get nothing", async () => {
  const { pg, sql } = await freshDb();
  const w = await office(pg, sql, "o3");
  await appointment(pg, w.id, at(24 * HOUR));
  await pg.query(`insert into law_tasks (workspace_id, title, assignee_id, due_on) values ($1, 'تجهيز المذكرة', 'o3', '2026-10-01')`, [w.id]);

  assert.deepEqual(await getReminderSettingsCore(sql, w.id), { clientConsult: true, lawyerDaily: true });
  assert.equal((await dueClientRemindersCore(sql, NOW)).length, 1);
  assert.equal((await dueLawyerDigestsCore(sql, NOW)).length, 1);

  await saveReminderSettingsCore(sql, w.id, { clientConsult: false, lawyerDaily: true });
  assert.deepEqual(await getReminderSettingsCore(sql, w.id), { clientConsult: false, lawyerDaily: true });
  assert.equal((await dueClientRemindersCore(sql, NOW)).length, 0);
  assert.equal((await dueLawyerDigestsCore(sql, NOW)).length, 1);

  await saveReminderSettingsCore(sql, w.id, { clientConsult: true, lawyerDaily: false });
  assert.equal((await dueClientRemindersCore(sql, NOW)).length, 1);
  assert.equal((await dueLawyerDigestsCore(sql, NOW)).length, 0);

  await saveReminderSettingsCore(sql, w.id, { clientConsult: true, lawyerDaily: true });
  for (const status of ["suspended", "cancelled"]) {
    await pg.query(`update workspaces set status = $2 where id = $1`, [w.id, status]);
    assert.equal((await dueClientRemindersCore(sql, NOW)).length, 0, status);
    assert.equal((await dueLawyerDigestsCore(sql, NOW)).length, 0, status);
  }
  // A trial lapsed past its grace period is read-only too.
  await pg.query(`update workspaces set status = 'trialing', trial_ends_at = $2 where id = $1`, [w.id, at(-60 * 24 * HOUR)]);
  assert.equal((await dueClientRemindersCore(sql, NOW)).length, 0);
  assert.equal((await processRemindersCore(sql, NOW, { client: async () => true, digest: async () => true })).digests, 0);
});

test("lawyer digest: today's hearings, appointments and due tasks, per lawyer, once a day", async () => {
  const { pg, sql } = await freshDb();
  const w = await office(pg, sql, "boss");
  await member(pg, w.id, "ali");
  await member(pg, w.id, "sara");
  await member(pg, w.id, "idle", "staff");
  const other = await office(pg, sql, "other-owner");

  const [c1] = (
    await pg.query<{ id: string }>(
      `insert into law_cases (workspace_id, ref_no, title, court) values ($1, 7, 'دعوى تجارية', 'المحكمة التجارية') returning id`,
      [w.id],
    )
  ).rows;
  await pg.query(`insert into law_case_lawyers (workspace_id, case_id, user_id) values ($1, $2, 'ali'), ($1, $2, 'sara')`, [w.id, c1.id]);
  // Today 10:00 Riyadh; yesterday; tomorrow; a cancelled one today.
  await pg.query(
    `insert into law_hearings (workspace_id, case_id, starts_at, room, status) values
       ($1, $2, '2026-10-01T07:00:00Z', '4', 'scheduled'),
       ($1, $2, '2026-09-30T07:00:00Z', '', 'scheduled'),
       ($1, $2, '2026-10-02T07:00:00Z', '', 'scheduled'),
       ($1, $2, '2026-10-01T09:00:00Z', '', 'cancelled')`,
    [w.id, c1.id],
  );
  // Ali: one consultation today (plus one tomorrow and a cancelled one).
  await appointment(pg, w.id, "2026-10-01T10:00:00Z", { lawyer: "ali", title: "استشارة عمالية" });
  await appointment(pg, w.id, "2026-10-02T10:00:00Z", { lawyer: "ali" });
  await appointment(pg, w.id, "2026-10-01T11:00:00Z", { lawyer: "ali", status: "cancelled" });
  // Tasks: sara has one overdue and one today; a done one and a future one don't count.
  await pg.query(
    `insert into law_tasks (workspace_id, case_id, title, assignee_id, due_on, done_at) values
       ($1, $2, 'رفع اللائحة', 'sara', '2026-09-28', null),
       ($1, null, 'اتصال بالعميل', 'sara', '2026-10-01', null),
       ($1, null, 'منجزة', 'sara', '2026-09-30', now()),
       ($1, null, 'لاحقًا', 'sara', '2026-10-05', null),
       ($1, null, 'لغير المحامي', 'boss', null, null)`,
    [w.id, c1.id],
  );
  // Another office's items never leak in.
  await pg.query(`insert into law_tasks (workspace_id, title, assignee_id, due_on) values ($1, 'مهمة مكتب آخر', 'other-owner', '2026-10-01')`, [other.id]);

  // Before 07:00 Riyadh: nothing yet.
  assert.equal((await dueLawyerDigestsCore(sql, Date.parse("2026-10-01T03:59:00Z"))).length, 0);

  const due = await dueLawyerDigestsCore(sql, NOW);
  const of = (u: string) => due.find((d) => d.userId === u && d.workspaceId === w.id) as LawyerDigestDue;
  assert.deepEqual(due.filter((d) => d.workspaceId === w.id).map((d) => d.userId).sort(), ["ali", "sara"]);
  assert.ok(!due.some((d) => d.userId === "idle" || d.userId === "boss"), "members with nothing get nothing");

  const ali = of("ali");
  assert.equal(ali.date, "2026-10-01");
  assert.equal(ali.recipient, "ali@x.sa");
  assert.equal(ali.hearings.length, 1);
  assert.equal(ali.hearings[0].caseTitle, "دعوى تجارية");
  assert.equal(ali.hearings[0].caseRef, 7);
  assert.equal(ali.hearings[0].room, "4");
  assert.equal(ali.appointments.length, 1);
  assert.equal(ali.appointments[0].title, "استشارة عمالية");
  assert.equal(ali.tasks.length, 0);

  const sara = of("sara");
  assert.equal(sara.hearings.length, 1);
  assert.equal(sara.appointments.length, 0);
  assert.deepEqual(
    sara.tasks.map((t) => [t.title, t.overdue, t.caseTitle]),
    [
      ["رفع اللائحة", true, "دعوى تجارية"],
      ["اتصال بالعميل", false, null],
    ],
  );
  assert.deepEqual(sara.totals, { hearings: 1, appointments: 0, tasks: 2 });

  const other1 = due.find((d) => d.workspaceId === other.id);
  assert.equal(other1?.tasks[0].title, "مهمة مكتب آخر");

  // One digest per member per Riyadh day.
  const digests: LawyerDigestDue[] = [];
  const send = { client: async () => true, digest: async (d: LawyerDigestDue) => (digests.push(d), true) };
  const r1 = await processRemindersCore(sql, NOW, send);
  assert.equal(r1.digests, 3);
  assert.equal((await processRemindersCore(sql, NOW + 3 * HOUR, send)).digests, 0);
  assert.equal((await dueLawyerDigestsCore(sql, NOW + 10 * HOUR)).length, 0);
  // The next morning is a new day (the overdue tasks are still due).
  const tomorrow = await dueLawyerDigestsCore(sql, NOW + 24 * HOUR);
  assert.ok(tomorrow.some((d) => d.userId === "sara" && d.date === "2026-10-02"));
  assert.ok(tomorrow.some((d) => d.userId === "ali" && d.date === "2026-10-02"));
});

test("a run stops at its cap; the rest goes out next time", async () => {
  const { pg, sql } = await freshDb();
  const w = await office(pg, sql, "o5");
  for (let i = 0; i < 5; i += 1) await appointment(pg, w.id, at(24 * HOUR + i * MIN));
  const ok = { client: async () => true, digest: async () => true };
  assert.equal((await processRemindersCore(sql, NOW, ok, 3)).client24, 3);
  assert.equal((await processRemindersCore(sql, NOW, ok, 3)).client24, 2);
  assert.equal((await processRemindersCore(sql, NOW, ok, 3)).client24, 0);
});

test("client reminders: sample (demo) appointments never email anyone", async () => {
  const { pg, sql } = await freshDb();
  const w = await office(pg, sql, "demo-owner");
  const id = await appointment(pg, w.id, at(24 * HOUR));
  await pg.query(`update law_appointments set is_demo = true where id = $1`, [id]);
  assert.equal((await dueClientRemindersCore(sql, NOW)).length, 0);
});

