import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { hashVisitorIp, reserveHit, type SqlTag } from "./rate-limit-core.ts";

const migrationsDir = new URL("../../migrations/", import.meta.url);

/** A fresh PGLite with every top-level migration applied, behind the app's tag. */
async function freshDb(): Promise<{ pg: PGlite; sql: SqlTag }> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(new URL(name, migrationsDir), "utf8"));
  }
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return (await pg.query(text, values)).rows;
  }) as SqlTag;
  return { pg, sql };
}

test("a burst of parallel reservations never overshoots the limit", async () => {
  const { pg, sql } = await freshDb();
  const results = await Promise.all(
    Array.from({ length: 50 }, () => reserveHit(sql, "lead:burst", 5, 3600)),
  );
  assert.equal(results.filter(Boolean).length, 5);
  const [{ n }] = (
    await pg.query<{ n: number }>("select count(*)::int as n from rate_hits where key = 'lead:burst'")
  ).rows;
  assert.equal(n, 5);
  await pg.close();
});

test("keys are limited independently and only within the window", async () => {
  const { pg, sql } = await freshDb();
  assert.equal(await reserveHit(sql, "a", 1, 3600), true);
  assert.equal(await reserveHit(sql, "a", 1, 3600), false);
  assert.equal(await reserveHit(sql, "b", 1, 3600), true);
  // Age the hit past a 60 s window: that window has room again.
  await pg.exec("update rate_hits set at = now() - interval '2 minutes' where key = 'a'");
  assert.equal(await reserveHit(sql, "a", 1, 60), true);
  await pg.close();
});

test("every reservation purges hits older than a day", async () => {
  const { pg, sql } = await freshDb();
  await pg.exec(
    "insert into rate_hits (key, at) values ('old', now() - interval '25 hours'), ('recent', now() - interval '23 hours')",
  );
  await reserveHit(sql, "other", 10, 60);
  const keys = (await pg.query<{ key: string }>("select key from rate_hits order by key")).rows.map(
    (r) => r.key,
  );
  assert.deepEqual(keys, ["other", "recent"]);
  await pg.close();
});

test("visitor IPs are pseudonymized with a keyed, truncated hash", () => {
  const a = hashVisitorIp("203.0.113.7", "secret-1");
  assert.equal(a, hashVisitorIp("203.0.113.7", "secret-1"));
  assert.notEqual(a, hashVisitorIp("203.0.113.8", "secret-1"));
  assert.notEqual(a, hashVisitorIp("203.0.113.7", "secret-2"));
  assert.match(a, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(!a.includes("203"));
});
