/**
 * Client portal on a real schema (PGLite + every migration): a link reaches
 * only its own client, rotation and revocation kill old links, suspended
 * offices go dark, and the view never carries fees or unshared documents.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import {
  hashPortalToken,
  newPortalToken,
  portalDocumentCore,
  portalStatusCore,
  portalViewCore,
  resolvePortalCore,
  revokePortalCore,
  savePortalCore,
  setDocumentSharedCore,
  touchPortalCore,
} from "./portal-core.ts";

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

async function user(pg: PGlite, id: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, `U ${id}`, `${id}@x.sa`]);
}

async function member(pg: PGlite, ws: string, id: string, role: string) {
  await user(pg, id);
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [ws, id, role]);
}

async function client(pg: PGlite, ws: string, name: string): Promise<string> {
  const r = await pg.query<{ id: string }>(`insert into law_clients (workspace_id, name) values ($1, $2) returning id`, [ws, name]);
  return r.rows[0].id;
}

async function caseOf(pg: PGlite, ws: string, clientId: string, ref: number, title: string): Promise<string> {
  const r = await pg.query<{ id: string }>(
    `insert into law_cases (workspace_id, ref_no, title, client_id, court, opposing_party, description, fees_halalas, paid_halalas)
     values ($1, $2, $3, $4, 'المحكمة العمالية بالرياض', 'شركة الخصم السرية', 'ملاحظات داخلية سرية', 987654, 12345)
     returning id`,
    [ws, ref, title, clientId],
  );
  return r.rows[0].id;
}

async function doc(pg: PGlite, ws: string, clientId: string | null, name: string): Promise<string> {
  const r = await pg.query<{ id: string }>(
    `insert into law_documents (workspace_id, client_id, name, mime, size, storage, data)
     values ($1, $2, $3, 'application/pdf', 4, 'db', '\\x25504446'::bytea) returning id`,
    [ws, clientId, name],
  );
  return r.rows[0].id;
}

const DAY = 86_400_000;

async function setup() {
  const { pg, sql } = await freshDb();
  await user(pg, "o");
  const w = await createWorkspaceCore(sql, "o", { name: "مكتب الأمانة", city: "الرياض", crNumber: null, teamSize: "2-5", slug: "portal-1" });
  await member(pg, w.id, "l", "lawyer");
  await member(pg, w.id, "s", "staff");
  await user(pg, "o2");
  const w2 = await createWorkspaceCore(sql, "o2", { name: "مكتب آخر", city: "جدة", crNumber: null, teamSize: "1", slug: "portal-2" });

  const lawyer = await resolveMembership(sql, "l", w.id, "staff", { write: true });
  const staff = await resolveMembership(sql, "s", w.id, "staff", { write: true });
  const other = await resolveMembership(sql, "o2", w2.id, "staff", { write: true });

  const ali = await client(pg, w.id, "علي السالم");
  const sara = await client(pg, w.id, "سارة الحربي");
  const foreign = await client(pg, w2.id, "عميل مكتب آخر");

  const aliCase = await caseOf(pg, w.id, ali, 1, "دعوى عمالية");
  const saraCase = await caseOf(pg, w.id, sara, 2, "قضية سارة");
  await caseOf(pg, w2.id, foreign, 1, "قضية المكتب الآخر");

  const future = new Date(Date.now() + 3 * DAY).toISOString();
  const past = new Date(Date.now() - 3 * DAY).toISOString();
  await pg.query(`insert into law_hearings (workspace_id, case_id, starts_at, court, outcome) values ($1, $2, $3, 'المحكمة العمالية', 'نتيجة داخلية')`, [w.id, aliCase, future]);
  await pg.query(`insert into law_hearings (workspace_id, case_id, starts_at) values ($1, $2, $3)`, [w.id, aliCase, past]);
  await pg.query(`insert into law_hearings (workspace_id, case_id, starts_at, status) values ($1, $2, $3, 'cancelled')`, [
    w.id,
    aliCase,
    new Date(Date.now() + 5 * DAY).toISOString(),
  ]);
  await pg.query(`insert into law_hearings (workspace_id, case_id, starts_at) values ($1, $2, $3)`, [w.id, saraCase, future]);

  const apStart = new Date(Date.now() + 2 * DAY).toISOString();
  const apEnd = new Date(Date.now() + 2 * DAY + 3_600_000).toISOString();
  await pg.query(
    `insert into law_appointments (workspace_id, kind, mode, status, title, client_id, starts_at, ends_at, private_notes, meet_nonce)
     values ($1, 'consultation', 'video', 'confirmed', 'استشارة متابعة', $2, $3, $4, 'ملاحظة خاصة بالمحامي', 'abc123')`,
    [w.id, ali, apStart, apEnd],
  );
  await pg.query(
    `insert into law_appointments (workspace_id, kind, mode, status, title, client_id, starts_at, ends_at)
     values ($1, 'appointment', 'in_office', 'cancelled', 'موعد ملغى', $2, $3, $4)`,
    [w.id, ali, apStart, apEnd],
  );

  const sharedDoc = await doc(pg, w.id, ali, "عقد العمل.pdf");
  const privateDoc = await doc(pg, w.id, ali, "مذكرة داخلية.pdf");
  const saraDoc = await doc(pg, w.id, sara, "مستند سارة.pdf");
  const unfiled = await doc(pg, w.id, null, "غير مصنف.pdf");
  await setDocumentSharedCore(sql, lawyer, sharedDoc, true);
  await setDocumentSharedCore(sql, lawyer, saraDoc, true);

  return { pg, sql, w, w2, lawyer, staff, other, ali, sara, foreign, sharedDoc, privateDoc, saraDoc, unfiled };
}

test("portal: a link resolves only its own client, with only safe fields", async () => {
  const s = await setup();
  const { token, tokenHash } = newPortalToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashPortalToken(token), tokenHash);
  await savePortalCore(s.sql, s.lawyer, s.ali, tokenHash);

  const who = await resolvePortalCore(s.sql, tokenHash);
  assert.equal(who?.client.id, s.ali);
  assert.equal(who?.workspace.id, s.w.id);

  const view = await portalViewCore(s.sql, tokenHash, { meetUrl: (id, nonce) => (nonce ? `https://x/meet/${id}` : null) });
  assert.ok(view);
  assert.equal(view.client.name, "علي السالم");
  assert.equal(view.office.name, "مكتب الأمانة");
  assert.deepEqual(view.cases.map((c) => c.ref_no), [1], "only this client's cases");
  assert.ok(view.cases[0].next_hearing_at, "the next hearing date is shown");
  assert.equal(view.hearings.length, 1, "only future, non-cancelled hearings of this client's cases");
  assert.equal(view.appointments.length, 1, "cancelled appointments are hidden");
  assert.match(view.appointments[0].meet_url ?? "", /^https:\/\/x\/meet\//);
  assert.deepEqual(view.documents.map((d) => d.id), [s.sharedDoc], "only shared documents of this client");

  const json = JSON.stringify(view);
  for (const secret of ["987654", "12345", "fees", "paid", "شركة الخصم السرية", "ملاحظات داخلية سرية", "نتيجة داخلية", "ملاحظة خاصة", "abc123", "meet_nonce", "مذكرة داخلية", "سارة"]) {
    assert.ok(!json.includes(secret), `the view must not contain ${secret}`);
  }
});

test("portal: rotating kills the old link, revoking kills the link", async () => {
  const s = await setup();
  const first = newPortalToken();
  await savePortalCore(s.sql, s.lawyer, s.ali, first.tokenHash);
  const second = newPortalToken();
  await savePortalCore(s.sql, s.lawyer, s.ali, second.tokenHash);
  assert.equal(await resolvePortalCore(s.sql, first.tokenHash), null, "rotated link is dead");
  assert.equal(await portalViewCore(s.sql, first.tokenHash), null);
  assert.equal((await resolvePortalCore(s.sql, second.tokenHash))?.client.id, s.ali);

  await touchPortalCore(s.sql, second.tokenHash);
  const st = await portalStatusCore(s.sql, s.staff, s.ali);
  assert.equal(st.state, "active");
  assert.ok(st.last_seen_at, "last opened is recorded");

  await revokePortalCore(s.sql, s.lawyer, s.ali);
  assert.equal(await resolvePortalCore(s.sql, second.tokenHash), null, "revoked link is dead");
  assert.equal(await portalDocumentCore(s.sql, second.tokenHash, s.sharedDoc), null);
  assert.equal((await portalStatusCore(s.sql, s.lawyer, s.ali)).state, "revoked");

  // A new link after revoking works again.
  const third = newPortalToken();
  await savePortalCore(s.sql, s.lawyer, s.ali, third.tokenHash);
  assert.equal((await resolvePortalCore(s.sql, third.tokenHash))?.client.id, s.ali);
  assert.equal(await resolvePortalCore(s.sql, second.tokenHash), null);
});

test("portal: a suspended or cancelled office's links stop working", async () => {
  const s = await setup();
  const t = newPortalToken();
  await savePortalCore(s.sql, s.lawyer, s.ali, t.tokenHash);
  for (const status of ["suspended", "cancelled"]) {
    await s.pg.query(`update workspaces set status = $1 where id = $2`, [status, s.w.id]);
    assert.equal(await resolvePortalCore(s.sql, t.tokenHash), null, status);
    assert.equal(await portalViewCore(s.sql, t.tokenHash), null, status);
    assert.equal(await portalDocumentCore(s.sql, t.tokenHash, s.sharedDoc), null, status);
  }
  await s.pg.query(`update workspaces set status = 'active' where id = $1`, [s.w.id]);
  assert.ok(await resolvePortalCore(s.sql, t.tokenHash));
});

test("portal: downloads need a shared document of the same client", async () => {
  const s = await setup();
  const t = newPortalToken();
  await savePortalCore(s.sql, s.lawyer, s.ali, t.tokenHash);
  const file = await portalDocumentCore(s.sql, t.tokenHash, s.sharedDoc);
  assert.equal(file?.name, "عقد العمل.pdf");
  assert.ok(file?.data && file.data.length === 4);
  assert.equal(await portalDocumentCore(s.sql, t.tokenHash, s.privateDoc), null, "unshared");
  assert.equal(await portalDocumentCore(s.sql, t.tokenHash, s.saraDoc), null, "another client's shared document");
  assert.equal(await portalDocumentCore(s.sql, t.tokenHash, s.unfiled), null, "unfiled");
  assert.equal(await portalDocumentCore(s.sql, t.tokenHash, "not-a-uuid"), null);
  assert.equal(await portalDocumentCore(s.sql, "0".repeat(64), s.sharedDoc), null, "unknown token");

  // Un-sharing hides it again.
  await setDocumentSharedCore(s.sql, s.lawyer, s.sharedDoc, false);
  assert.equal(await portalDocumentCore(s.sql, t.tokenHash, s.sharedDoc), null);
  assert.deepEqual((await portalViewCore(s.sql, t.tokenHash))?.documents, []);
});

test("portal: roles and tenancy for the office side", async () => {
  const s = await setup();
  const t = newPortalToken();
  // Staff can see the status but not manage the link or sharing.
  await assert.rejects(savePortalCore(s.sql, s.staff, s.ali, t.tokenHash), (e: unknown) => e instanceof WorkspaceError && e.code === "role");
  await assert.rejects(setDocumentSharedCore(s.sql, s.staff, s.privateDoc, true), (e: unknown) => e instanceof WorkspaceError && e.code === "role");
  assert.equal((await portalStatusCore(s.sql, s.staff, s.ali)).state, "none");

  // Another office cannot reach this office's client, link or documents.
  await assert.rejects(savePortalCore(s.sql, s.other, s.ali, t.tokenHash), (e: unknown) => e instanceof WorkspaceError && e.code === "not_found");
  await assert.rejects(portalStatusCore(s.sql, s.other, s.ali), (e: unknown) => e instanceof WorkspaceError && e.code === "not_found");
  await assert.rejects(revokePortalCore(s.sql, s.other, s.ali), (e: unknown) => e instanceof WorkspaceError && e.code === "not_found");
  await assert.rejects(setDocumentSharedCore(s.sql, s.other, s.privateDoc, true), (e: unknown) => e instanceof WorkspaceError && e.code === "not_found");

  // A document without a client cannot be shared.
  await assert.rejects(setDocumentSharedCore(s.sql, s.lawyer, s.unfiled, true), (e: unknown) => e instanceof WorkspaceError && e.code === "invalid");

  // The other office's own link reaches only its own client.
  const theirs = newPortalToken();
  await savePortalCore(s.sql, s.other, s.foreign, theirs.tokenHash);
  const view = await portalViewCore(s.sql, theirs.tokenHash);
  assert.equal(view?.client.name, "عميل مكتب آخر");
  assert.deepEqual(view?.documents, []);
  assert.deepEqual(view?.cases.map((c) => c.title), ["قضية المكتب الآخر"]);
  assert.equal(await portalDocumentCore(s.sql, theirs.tokenHash, s.sharedDoc), null, "cross-office document");

  // A hash already used by one client cannot be reused for another.
  const mine = newPortalToken();
  await savePortalCore(s.sql, s.lawyer, s.ali, mine.tokenHash);
  await assert.rejects(savePortalCore(s.sql, s.lawyer, s.sara, mine.tokenHash));
});
