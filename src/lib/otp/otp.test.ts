/**
 * WhatsApp codes: phone rules, the two-step sign-in state per session, the
 * booking "recently verified" memory, and how the relay's answers map to
 * errors — on a real schema, with no network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { SqlTag } from "../saas/tenancy-core.ts";
import {
  OtpError,
  devSender,
  disableCore,
  enableCore,
  maskPhone,
  markSessionCore,
  phoneRememberedCore,
  relaySender,
  rememberPhoneCore,
  secondFactorMissingCore,
  twoFactorStateCore,
  whatsappPhone,
} from "./otp-core.ts";

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

async function userWithSessions(pg: PGlite, id: string, sessions: string[]) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $1, $2, true)`, [id, `${id}@x.sa`]);
  for (const s of sessions) {
    await pg.query(
      `insert into "session" (id, "expiresAt", token, "updatedAt", "userId") values ($1, now() + interval '1 day', $2, now(), $3)`,
      [s, `tok-${s}`, id],
    );
  }
}

test("otp: WhatsApp phones are mobiles in E.164, masked for display", () => {
  assert.equal(whatsappPhone("0501234567"), "+966501234567");
  assert.equal(whatsappPhone("٠٥٠١٢٣٤٥٦٧"), "+966501234567");
  assert.equal(whatsappPhone("00966 50 123 4567"), "+966501234567");
  assert.equal(whatsappPhone("0112345678"), null, "a Riyadh landline has no WhatsApp");
  assert.equal(whatsappPhone("+971501234567"), "+971501234567");
  assert.equal(whatsappPhone("abc"), null);
  assert.equal(maskPhone("+966501234591"), "+966 5•• ••• •91");
  assert.ok(!maskPhone("+971501234567").includes("50123"));
});

test("otp: two-step sign-in is per session, and changing it resets other sessions", async () => {
  const { pg, sql } = await freshDb();
  await userWithSessions(pg, "u", ["s1", "s2"]);
  await userWithSessions(pg, "v", ["t1"]);

  assert.deepEqual(await twoFactorStateCore(sql, "u", "s1"), { enabled: false, phone: null, verified: true });
  assert.equal(await secondFactorMissingCore(sql, "u", "s1"), false, "off → nothing to pass");

  await enableCore(sql, "u", "+966501234567", "s1");
  assert.equal(await secondFactorMissingCore(sql, "u", "s1"), false, "the session that enrolled has passed");
  assert.equal(await secondFactorMissingCore(sql, "u", "s2"), true, "another session must pass a code");
  const st = await twoFactorStateCore(sql, "u", "s2");
  assert.equal(st.enabled, true);
  assert.equal(st.verified, false);
  assert.equal(st.phone, "+966 5•• ••• •67");

  // Another user's session id never counts for this user.
  await markSessionCore(sql, "v", "t1");
  assert.equal(await secondFactorMissingCore(sql, "u", "t1"), true);
  await markSessionCore(sql, "u", "t1"); // t1 belongs to v: the row stays v's
  assert.equal(await secondFactorMissingCore(sql, "u", "t1"), true);

  await markSessionCore(sql, "u", "s2");
  assert.equal(await secondFactorMissingCore(sql, "u", "s2"), false);

  // A new number: every other session must pass again.
  await enableCore(sql, "u", "+966551112233", "s1");
  assert.equal(await secondFactorMissingCore(sql, "u", "s2"), true);

  // Signing out deletes the session → its pass goes with it.
  await pg.query(`delete from "session" where id = 's1'`);
  assert.equal((await pg.query(`select 1 from session_second_factor where session_id = 's1'`)).rows.length, 0);

  await disableCore(sql, "u");
  assert.equal(await secondFactorMissingCore(sql, "u", "s2"), false);
});

test("otp: a verified booking phone is remembered per visitor, briefly", async () => {
  const { sql } = await freshDb();
  assert.equal(await phoneRememberedCore(sql, "book", "+966501234567", "vis1"), false);
  await rememberPhoneCore(sql, "book", "+966501234567", "vis1");
  assert.equal(await phoneRememberedCore(sql, "book", "+966501234567", "vis1"), true);
  assert.equal(await phoneRememberedCore(sql, "book", "+966501234567", "vis2"), false, "another visitor");
  assert.equal(await phoneRememberedCore(sql, "book", "+966509999999", "vis1"), false, "another number");
  await rememberPhoneCore(sql, "book", "+966500000000", "vis1", -1); // already expired
  assert.equal(await phoneRememberedCore(sql, "book", "+966500000000", "vis1"), false);
});

test("otp: relay answers map to errors; the dev sender only takes 000000", async () => {
  const calls: unknown[] = [];
  const fake = (status: number, body: unknown) =>
    (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;

  await relaySender("https://relay", "t", fake(200, { ok: true, status: "pending" })).start("+966501234567");
  assert.deepEqual(calls.at(-1), { action: "start", to: "+966501234567" });
  assert.equal(await relaySender("https://relay", "t", fake(200, { ok: true, approved: true })).check("+966501234567", "123456"), true);
  assert.equal(await relaySender("https://relay", "t", fake(200, { ok: true, approved: false })).check("+966501234567", "123456"), false);

  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (err) {
      return err instanceof OtpError ? err.code : "other";
    }
  };
  assert.equal(await code(relaySender("u", "t", fake(429, {})).start("+966501234567")), "rate_limited");
  assert.equal(await code(relaySender("u", "t", fake(422, {})).start("+966501234567")), "bad_phone");
  assert.equal(await code(relaySender("u", "t", fake(502, {})).start("+966501234567")), "send_failed");
  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  assert.equal(await code(relaySender("u", "t", down).start("+966501234567")), "send_failed");

  assert.equal(await devSender().check("+966501234567", "000000"), true);
  assert.equal(await devSender().check("+966501234567", "123456"), false);
});
