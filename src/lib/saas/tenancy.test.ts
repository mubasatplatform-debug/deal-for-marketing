import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { hashInviteToken, isInviteTokenShape, newInviteToken } from "./invite-token.ts";
import {
  acceptInviteCore,
  consoleActivateCore,
  consoleExtendTrialCore,
  consoleSuspendCore,
  createInviteCore,
  createInvoiceCore,
  createWorkspaceCore,
  markInvoicePaidCore,
  pickActiveWorkspace,
  previewInviteCore,
  removeMemberCore,
  resolveMembership,
  revokeInviteCore,
  seatUsage,
  setRoleCore,
  teamCore,
  WorkspaceError,
  type SqlTag,
} from "./tenancy-core.ts";
import { seatLimit } from "./plans.ts";

const migrationsDir = new URL("../../../migrations/", import.meta.url);

/** A fresh PGLite with every top-level migration applied, behind the app's SQL surface. */
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
  tag.query = (async (text: string, params: unknown[] = []) =>
    (await pg.query(text, params)).rows) as SqlTag["query"];
  return { pg, sql: tag };
}

async function addUser(pg: PGlite, id: string, email: string) {
  await pg.query(
    `insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`,
    [id, id, email],
  );
}

let slugN = 0;
async function office(sql: SqlTag, owner: string, name = "مكتب الاختبار") {
  slugN += 1;
  return createWorkspaceCore(sql, owner, {
    name,
    city: "الرياض",
    crNumber: null,
    teamSize: "2-5",
    slug: `office-test-${slugN}`,
  });
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (err: unknown) => err instanceof WorkspaceError && err.code === code);
}

test("the guard: members get in, everyone else gets the same 403", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "a", "a@x.sa");
  await addUser(pg, "b", "b@x.sa");
  const A = await office(sql, "a", "مكتب أ");
  const B = await office(sql, "b", "مكتب ب");

  const access = await resolveMembership(sql, "a", A.id);
  assert.equal(access.role, "owner");
  assert.equal(access.workspace.id, A.id);
  assert.equal(access.lifecycle.status, "trialing");

  // Cross-tenant, unknown, and malformed ids are indistinguishable.
  await rejects(resolveMembership(sql, "a", B.id), "forbidden");
  await rejects(resolveMembership(sql, "a", "00000000-0000-4000-8000-000000000000"), "forbidden");
  await rejects(resolveMembership(sql, "a", "' or 1=1 --"), "forbidden");
  await rejects(resolveMembership(sql, "", A.id), "forbidden");

  // An explicit switch to someone else's office is refused, not silently redirected.
  await rejects(pickActiveWorkspace(sql, "a", B.id), "forbidden");
  const picked = await pickActiveWorkspace(sql, "a", null);
  assert.equal(picked.active?.id, A.id);
  assert.deepEqual(
    picked.memberships.map((m) => m.id),
    [A.id],
  );
  await pg.close();
});

test("the guard enforces the minimum role and read-only offices", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  await addUser(pg, "s", "s@x.sa");
  const W = await office(sql, "o");
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, 's', 'staff')`, [W.id]);

  await resolveMembership(sql, "s", W.id, "staff");
  await rejects(resolveMembership(sql, "s", W.id, "admin"), "role");
  await resolveMembership(sql, "o", W.id, "admin", { write: true });

  await consoleSuspendCore(sql, "deal", W.id);
  // Reads still work on a suspended office; writes do not.
  const ro = await resolveMembership(sql, "o", W.id, "admin");
  assert.equal(ro.lifecycle.readOnly, true);
  await rejects(resolveMembership(sql, "o", W.id, "admin", { write: true }), "read_only");
  await pg.close();
});

test("a lapsed trial is past_due, then read-only — computed on read, nothing deleted", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  const W = await office(sql, "o");
  await pg.query(`update workspaces set trial_ends_at = now() - interval '2 days' where id = $1`, [W.id]);
  let a = await resolveMembership(sql, "o", W.id);
  assert.equal(a.lifecycle.status, "past_due");
  assert.equal(a.lifecycle.readOnly, false);
  await pg.query(`update workspaces set trial_ends_at = now() - interval '30 days' where id = $1`, [W.id]);
  a = await resolveMembership(sql, "o", W.id);
  assert.equal(a.lifecycle.status, "suspended");
  assert.equal(a.lifecycle.readOnly, true);
  const [{ n }] = (await pg.query<{ n: number }>(`select count(*)::int as n from workspaces`)).rows;
  assert.equal(n, 1);

  await consoleExtendTrialCore(sql, "deal", W.id, 7);
  a = await resolveMembership(sql, "o", W.id);
  assert.equal(a.lifecycle.status, "trialing");
  assert.ok(a.lifecycle.daysLeft >= 6 && a.lifecycle.daysLeft <= 7);
  await pg.close();
});

test("invites: seat limits count members + open invites; re-invite replaces", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  const W = await office(sql, "o");
  await pg.query(`update workspaces set plan = 'basic' where id = $1`, [W.id]);
  const owner = await resolveMembership(sql, "o", W.id, "admin", { write: true });
  const limit = seatLimit("basic");
  assert.equal(limit, 3);

  await createInviteCore(sql, owner, "one@x.sa", "lawyer", newInviteToken().hash);
  await createInviteCore(sql, owner, "two@x.sa", "staff", newInviteToken().hash);
  assert.deepEqual(await seatUsage(sql, W.id, "basic"), { members: 1, pending: 2, used: 3, limit: 3 });
  await rejects(createInviteCore(sql, owner, "three@x.sa", "staff", newInviteToken().hash), "seat_limit");

  // Re-inviting the same email (any case) replaces the open invite, costing no seat.
  await createInviteCore(sql, owner, "ONE@x.sa", "admin", newInviteToken().hash);
  const team = await teamCore(sql, owner);
  assert.equal(team.invites.length, 2);
  assert.equal(team.invites.find((i) => i.email === "one@x.sa")?.role, "admin");

  // Revoking frees the seat; expired invites stop counting.
  await revokeInviteCore(sql, owner, team.invites[0].id);
  assert.equal((await seatUsage(sql, W.id, "basic")).used, 2);
  await pg.query(`update workspace_invites set expires_at = now() - interval '1 minute' where workspace_id = $1`, [W.id]);
  assert.equal((await seatUsage(sql, W.id, "basic")).used, 1);

  // Existing members cannot be invited again.
  await rejects(createInviteCore(sql, owner, "o@x.sa", "staff", newInviteToken().hash), "already_member");
  await pg.close();
});

test("parallel invites never overshoot the seat limit", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  const W = await office(sql, "o");
  await pg.query(`update workspaces set plan = 'basic' where id = $1`, [W.id]);
  const owner = await resolveMembership(sql, "o", W.id, "admin");
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) =>
      createInviteCore(sql, owner, `p${i}@x.sa`, "staff", newInviteToken().hash),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal((await seatUsage(sql, W.id, "basic")).used, 3);
  await pg.close();
});

test("only owners and admins invite; revoking another office's invite is not found", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  await addUser(pg, "l", "l@x.sa");
  await addUser(pg, "z", "z@x.sa");
  const W = await office(sql, "o");
  const Z = await office(sql, "z");
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, 'l', 'lawyer')`, [W.id]);
  const lawyer = await resolveMembership(sql, "l", W.id);
  await rejects(createInviteCore(sql, lawyer, "x@x.sa", "staff", newInviteToken().hash), "role");

  const zOwner = await resolveMembership(sql, "z", Z.id, "admin");
  await createInviteCore(sql, zOwner, "q@x.sa", "staff", newInviteToken().hash);
  const zInvite = (await teamCore(sql, zOwner)).invites[0];
  const wOwner = await resolveMembership(sql, "o", W.id, "admin");
  await rejects(revokeInviteCore(sql, wOwner, zInvite.id), "not_found");
  // Staff/lawyers do not see pending invites at all.
  assert.equal((await teamCore(sql, lawyer)).invites.length, 0);
  await pg.close();
});

test("invite tokens: shape, hashing, and acceptance only by the invited email", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  const { token, hash } = newInviteToken();
  assert.ok(isInviteTokenShape(token));
  assert.equal(hash, hashInviteToken(token));
  assert.notEqual(hash, token);
  assert.equal(isInviteTokenShape("short"), false);
  assert.equal(isInviteTokenShape(`${token.slice(0, 42)}!`), false);

  await addUser(pg, "o", "o@x.sa");
  await addUser(pg, "n", "new@x.sa");
  await addUser(pg, "m", "mallory@x.sa");
  const W = await office(sql, "o");
  const owner = await resolveMembership(sql, "o", W.id, "admin");
  await createInviteCore(sql, owner, "New@X.sa", "lawyer", hash);

  // The raw token is never stored.
  const stored = (await pg.query<{ n: number }>(`select count(*)::int as n from workspace_invites where token_hash = $1`, [token])).rows[0];
  assert.equal(stored.n, 0);

  const preview = await previewInviteCore(sql, hash);
  assert.equal(preview?.state, "open");
  assert.equal(preview?.email, "new@x.sa");
  assert.equal(await previewInviteCore(sql, hashInviteToken("nope")), null);

  await rejects(acceptInviteCore(sql, "m", "mallory@x.sa", hash), "email_mismatch");
  await rejects(acceptInviteCore(sql, "n", "new@x.sa", hashInviteToken("wrong")), "invite_invalid");
  const res = await acceptInviteCore(sql, "n", "NEW@x.sa", hash);
  assert.equal(res.workspaceId, W.id);
  const access = await resolveMembership(sql, "n", W.id);
  assert.equal(access.role, "lawyer");
  // Idempotent for the same person; used for anyone else.
  await acceptInviteCore(sql, "n", "new@x.sa", hash);
  await rejects(acceptInviteCore(sql, "m", "new@x.sa", hash), "invite_used");
  assert.equal((await previewInviteCore(sql, hash))?.state, "used");
  // Accepting made it the new member's active office.
  assert.equal((await pickActiveWorkspace(sql, "n", null)).active?.id, W.id);
  await pg.close();
});

test("expired and revoked invites cannot be accepted", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  await addUser(pg, "n", "n@x.sa");
  const W = await office(sql, "o");
  const owner = await resolveMembership(sql, "o", W.id, "admin");
  const t1 = newInviteToken();
  await createInviteCore(sql, owner, "n@x.sa", "staff", t1.hash);
  await pg.query(`update workspace_invites set expires_at = now() - interval '1 second'`);
  await rejects(acceptInviteCore(sql, "n", "n@x.sa", t1.hash), "invite_expired");
  const t2 = newInviteToken();
  await createInviteCore(sql, owner, "n@x.sa", "staff", t2.hash);
  const inv = (await teamCore(sql, owner)).invites[0];
  await revokeInviteCore(sql, owner, inv.id);
  await rejects(acceptInviteCore(sql, "n", "n@x.sa", t2.hash), "invite_revoked");
  await pg.close();
});

test("roles: the last owner stays, admins cannot touch owners", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  await addUser(pg, "a", "a@x.sa");
  await addUser(pg, "l", "l@x.sa");
  const W = await office(sql, "o");
  await pg.query(
    `insert into workspace_members (workspace_id, user_id, role) values ($1, 'a', 'admin'), ($1, 'l', 'lawyer')`,
    [W.id],
  );
  const owner = await resolveMembership(sql, "o", W.id, "admin");
  const admin = await resolveMembership(sql, "a", W.id, "admin");
  const lawyer = await resolveMembership(sql, "l", W.id);

  await rejects(setRoleCore(sql, owner, "o", "admin"), "last_owner");
  await rejects(removeMemberCore(sql, owner, "o"), "last_owner");
  await rejects(setRoleCore(sql, admin, "o", "staff"), "role");
  await rejects(removeMemberCore(sql, admin, "o"), "role");
  await rejects(setRoleCore(sql, admin, "l", "owner"), "role");
  await rejects(setRoleCore(sql, lawyer, "l", "admin"), "role");
  await rejects(removeMemberCore(sql, lawyer, "a"), "role");

  await setRoleCore(sql, admin, "l", "staff");
  assert.equal((await resolveMembership(sql, "l", W.id)).role, "staff");

  // With a second owner, the first can step down.
  await setRoleCore(sql, owner, "a", "owner");
  await setRoleCore(sql, owner, "o", "admin");
  assert.equal((await resolveMembership(sql, "o", W.id)).role, "admin");

  // Anyone may leave; a removed member loses access immediately.
  const staff = await resolveMembership(sql, "l", W.id);
  await removeMemberCore(sql, staff, "l");
  await rejects(resolveMembership(sql, "l", W.id), "forbidden");
  await rejects(setRoleCore(sql, owner, "ghost", "staff"), "not_member");
  await pg.close();
});

test("two owners demoting each other at once still leave one owner", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o1", "o1@x.sa");
  await addUser(pg, "o2", "o2@x.sa");
  const W = await office(sql, "o1");
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, 'o2', 'owner')`, [W.id]);
  const a1 = await resolveMembership(sql, "o1", W.id, "admin");
  const a2 = await resolveMembership(sql, "o2", W.id, "admin");
  await Promise.allSettled([setRoleCore(sql, a1, "o2", "staff"), setRoleCore(sql, a2, "o1", "staff")]);
  const [{ n }] = (
    await pg.query<{ n: number }>(`select count(*)::int as n from workspace_members where workspace_id = $1 and role = 'owner'`, [W.id])
  ).rows;
  assert.equal(n, 1);
  await pg.close();
});

test("billing: pending requests are reused; paying activates and extends the period", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  await addUser(pg, "l", "l@x.sa");
  const W = await office(sql, "o");
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, 'l', 'lawyer')`, [W.id]);
  const owner = await resolveMembership(sql, "o", W.id, "admin");
  const lawyer = await resolveMembership(sql, "l", W.id);
  await rejects(createInvoiceCore(sql, lawyer, "pro", "monthly", "manual"), "role");

  const first = await createInvoiceCore(sql, owner, "basic", "yearly", "manual");
  assert.equal(first.reused, false);
  assert.equal(first.invoice.subtotal, 199000);
  assert.equal(first.invoice.vat, 29850);
  assert.equal(first.invoice.total, 228850);
  const again = await createInvoiceCore(sql, owner, "basic", "yearly", "manual");
  assert.equal(again.reused, true);
  assert.equal(again.invoice.id, first.invoice.id);
  // A different plan cancels the older request.
  const other = await createInvoiceCore(sql, owner, "enterprise", "monthly", "manual");
  const states = (await pg.query<{ status: string }>(`select status from workspace_invoices order by number`)).rows;
  assert.deepEqual(states.map((s) => s.status), ["cancelled", "pending"]);
  assert.equal(await markInvoicePaidCore(sql, first.invoice.id, "deal"), null);

  const paid = await markInvoicePaidCore(sql, other.invoice.id, "deal");
  assert.ok(paid);
  const a = await resolveMembership(sql, "o", W.id);
  assert.equal(a.workspace.plan, "enterprise");
  assert.equal(a.lifecycle.status, "active");
  assert.ok(a.lifecycle.daysLeft >= 27 && a.lifecycle.daysLeft <= 32);
  // Idempotent: a second confirmation changes nothing.
  assert.equal(await markInvoicePaidCore(sql, other.invoice.id, "deal"), null);
  await pg.close();
});

test("console activation sets plan and period end", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  const W = await office(sql, "o");
  const until = new Date(Date.now() + 90 * 86_400_000).toISOString();
  await consoleActivateCore(sql, "deal", W.id, "enterprise", "yearly", until);
  const a = await resolveMembership(sql, "o", W.id);
  assert.equal(a.workspace.plan, "enterprise");
  assert.equal(a.lifecycle.status, "active");
  await rejects(
    consoleActivateCore(sql, "deal", "00000000-0000-4000-8000-000000000000", "basic", "monthly", until),
    "not_found",
  );
  const events = (await pg.query<{ kind: string }>(`select kind from workspace_events where workspace_id = $1 order by id`, [W.id])).rows;
  assert.deepEqual(events.map((e) => e.kind), ["created", "activate"]);
  await pg.close();
});

test("one person owns at most a handful of offices", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "deal", "team@deal.sa");
  await addUser(pg, "o", "o@x.sa");
  for (let i = 0; i < 5; i += 1) await office(sql, "o");
  await rejects(office(sql, "o"), "too_many");
  await pg.close();
});
