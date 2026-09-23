import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FEATURE_LABELS,
  GRACE_DAYS,
  PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  VAT_RATE,
  getPlan,
  isPlanId,
  quote,
  seatLimit,
  yearlySavingPct,
} from "./plans.ts";
import { effectiveStatus, roleAtLeast, INVITE_ROLES } from "./lifecycle.ts";

test("plan config is well-formed", () => {
  const ids = PLANS.map((p) => p.id);
  assert.deepEqual(ids, ["basic", "pro", "enterprise"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(isPlanId(TRIAL_PLAN));
  assert.equal(TRIAL_DAYS, 14);
  assert.equal(VAT_RATE, 0.15);
  let prev = 0;
  for (const p of PLANS) {
    assert.ok(p.name.length > 0 && p.tagline.length > 0);
    assert.ok(Number.isInteger(p.seats) && p.seats >= 1);
    assert.ok(p.price.monthly > 0 && p.price.yearly > 0);
    // Yearly is a discount, never a penalty.
    assert.ok(p.price.yearly < p.price.monthly * 12);
    // Each tier costs more and seats more than the one below it.
    assert.ok(p.price.monthly > prev);
    prev = p.price.monthly;
    // Every flag is declared and labelled.
    assert.deepEqual(Object.keys(p.features).sort(), Object.keys(FEATURE_LABELS).sort());
  }
  assert.ok(PLANS[0].seats < PLANS[1].seats && PLANS[1].seats < PLANS[2].seats);
  // Higher tiers never lose a feature a lower tier has.
  for (let i = 1; i < PLANS.length; i += 1) {
    for (const [flag, on] of Object.entries(PLANS[i - 1].features)) {
      if (on) assert.ok(PLANS[i].features[flag as keyof typeof FEATURE_LABELS], `${PLANS[i].id} lacks ${flag}`);
    }
  }
});

test("quotes are integer halalas with 15% VAT", () => {
  for (const p of PLANS) {
    for (const cycle of ["monthly", "yearly"] as const) {
      const q = quote(p.id, cycle);
      assert.equal(q.subtotal, p.price[cycle] * 100);
      assert.equal(q.vat, Math.round(q.subtotal * 0.15));
      assert.equal(q.total, q.subtotal + q.vat);
      assert.ok(Number.isInteger(q.total));
      assert.equal(q.currency, "SAR");
    }
  }
  assert.ok(yearlySavingPct(getPlan("pro")) > 0);
});

test("unknown plans fall back safely", () => {
  assert.equal(isPlanId("gold"), false);
  assert.equal(getPlan("gold").id, "basic");
  assert.equal(seatLimit("gold"), getPlan("basic").seats);
});

test("roles rank owner > admin > lawyer > staff; owners are never invited", () => {
  assert.ok(roleAtLeast("owner", "admin"));
  assert.ok(roleAtLeast("admin", "lawyer"));
  assert.ok(roleAtLeast("lawyer", "staff"));
  assert.equal(roleAtLeast("staff", "lawyer"), false);
  assert.equal(roleAtLeast("admin", "owner"), false);
  assert.equal((INVITE_ROLES as readonly string[]).includes("owner"), false);
});

test("effective status: trial -> past_due (grace) -> suspended; paid periods lapse the same way", () => {
  const DAY = 86_400_000;
  const now = Date.UTC(2026, 8, 23);
  const at = (d: number) => new Date(now + d * DAY).toISOString();

  const trial = effectiveStatus({ status: "trialing", trial_ends_at: at(3.5), current_period_end: null }, now);
  assert.deepEqual([trial.status, trial.readOnly, trial.daysLeft], ["trialing", false, 4]);

  const lapsed = effectiveStatus({ status: "trialing", trial_ends_at: at(-1), current_period_end: null }, now);
  assert.equal(lapsed.status, "past_due");
  assert.equal(lapsed.readOnly, false);
  assert.equal(lapsed.suspendsAt, at(GRACE_DAYS - 1));

  const gone = effectiveStatus({ status: "trialing", trial_ends_at: at(-GRACE_DAYS - 1), current_period_end: null }, now);
  assert.deepEqual([gone.status, gone.readOnly], ["suspended", true]);

  const paid = effectiveStatus({ status: "active", trial_ends_at: at(-40), current_period_end: at(20) }, now);
  assert.deepEqual([paid.status, paid.daysLeft], ["active", 20]);
  const unpaid = effectiveStatus({ status: "active", trial_ends_at: null, current_period_end: at(-2) }, now);
  assert.equal(unpaid.status, "past_due");

  // Team decisions stick regardless of dates.
  assert.equal(effectiveStatus({ status: "suspended", trial_ends_at: at(10), current_period_end: null }, now).readOnly, true);
  assert.equal(effectiveStatus({ status: "cancelled", trial_ends_at: null, current_period_end: at(10) }, now).status, "cancelled");
  // An open-ended active deal never lapses.
  assert.equal(effectiveStatus({ status: "active", trial_ends_at: null, current_period_end: null }, now).status, "active");
});
