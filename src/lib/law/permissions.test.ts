import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES } from "../saas/lifecycle.ts";
import {
  ACTIONS,
  PERMISSIONS,
  allowedActions,
  can,
  canDeleteNote,
  canEditTask,
  canHostConsult,
} from "./permissions.ts";

test("every action names a real minimum role", () => {
  assert.ok(ACTIONS.length > 20);
  for (const a of ACTIONS) assert.ok(ROLES.includes(PERMISSIONS[a]), a);
});

test("higher roles can do everything lower roles can", () => {
  const order = ["staff", "lawyer", "admin", "owner"] as const;
  for (let i = 1; i < order.length; i += 1) {
    const lower = new Set(allowedActions(order[i - 1]));
    const higher = new Set(allowedActions(order[i]));
    for (const a of lower) assert.ok(higher.has(a), `${order[i]} lacks ${a}`);
  }
  assert.deepEqual(allowedActions("owner"), ACTIONS);
});

test("staff: reception work, no deletes, no fees, no case edits, no private notes", () => {
  for (const a of [
    "client.view",
    "client.create",
    "client.edit",
    "case.view",
    "task.create",
    "task.complete",
    "appointment.manage",
    "consult.manage",
    "document.view",
    "document.upload",
    "note.create",
  ] as const) {
    assert.ok(can("staff", a), a);
  }
  for (const a of [
    "client.delete",
    "client.portal",
    "case.create",
    "case.edit",
    "case.delete",
    "case.fees.view",
    "hearing.manage",
    "consult.notes",
    "consult.host",
    "consult.outcome",
    "document.delete",
    "appointment.delete",
    "settings.booking",
  ] as const) {
    assert.equal(can("staff", a), false, a);
  }
});

test("lawyers run cases and calls; only admins delete records or change booking settings", () => {
  assert.ok(can("lawyer", "case.create"));
  assert.ok(can("lawyer", "case.fees.view"));
  assert.ok(can("lawyer", "hearing.manage"));
  assert.ok(can("lawyer", "consult.host"));
  assert.ok(can("lawyer", "document.delete"));
  assert.equal(can("lawyer", "case.delete"), false);
  assert.equal(can("lawyer", "client.delete"), false);
  assert.equal(can("lawyer", "settings.booking"), false);
  assert.ok(can("admin", "case.delete"));
  assert.ok(can("admin", "settings.booking"));
});

test("ownership rules: notes, tasks and hosting a consultation", () => {
  assert.ok(canDeleteNote("staff", "u1", "u1"));
  assert.equal(canDeleteNote("staff", "u1", "u2"), false);
  assert.equal(canDeleteNote("lawyer", "u1", null), false);
  assert.ok(canDeleteNote("admin", "u1", "u2"));

  assert.ok(canEditTask("staff", "u1", { created_by: "u1", assignee_id: null }));
  assert.ok(canEditTask("staff", "u1", { created_by: "u2", assignee_id: "u1" }));
  assert.equal(canEditTask("staff", "u1", { created_by: "u2", assignee_id: "u3" }), false);
  assert.ok(canEditTask("lawyer", "u1", { created_by: "u2", assignee_id: "u3" }));

  assert.ok(canHostConsult("lawyer", "u1", "u1"));
  assert.ok(canHostConsult("lawyer", "u1", null));
  assert.equal(canHostConsult("lawyer", "u1", "u2"), false, "a colleague's call");
  assert.ok(canHostConsult("admin", "u1", "u2"));
  assert.equal(canHostConsult("staff", "u1", "u1"), false);
});
