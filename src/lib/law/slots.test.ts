import assert from "node:assert/strict";
import { test } from "node:test";
import { computeSlots, freeLawyers, isOfferedStart, type Availability } from "./slots.ts";
import {
  addDays,
  isYmd,
  riyadhAt,
  riyadhHm,
  riyadhToIso,
  riyadhYmd,
  weekStart,
  weekday,
} from "./time.ts";

const MIN = 60_000;
const at = (iso: string) => Date.parse(iso);

const base: Availability = {
  workDays: [0, 1, 2, 3, 4],
  dayStart: 9 * 60,
  dayEnd: 12 * 60,
  slotMinutes: 30,
  bufferMinutes: 0,
  minNoticeMinutes: 0,
  horizonDays: 14,
};

test("Riyadh time is UTC+3 all year", () => {
  assert.equal(riyadhToIso("2026-09-27", "09:00"), "2026-09-27T06:00:00.000Z");
  assert.equal(riyadhToIso("2026-01-15", "00:30"), "2026-01-14T21:30:00.000Z");
  assert.equal(riyadhYmd(at("2026-09-26T21:00:00Z")), "2026-09-27", "midnight in Riyadh is 21:00 UTC");
  assert.equal(riyadhYmd(at("2026-09-26T20:59:00Z")), "2026-09-26");
  assert.equal(riyadhHm(at("2026-09-27T06:05:00Z")), "09:05");
  assert.equal(riyadhToIso("2026-02-30", "10:00"), null);
  assert.equal(riyadhToIso("2026-02-10", "24:00"), null);
  assert.equal(weekday("2026-09-27"), 0, "27 Sep 2026 is a Sunday");
  assert.equal(weekStart("2026-10-01"), "2026-09-27");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.ok(isYmd("2028-02-29"));
  assert.equal(isYmd("2027-02-29"), false);
});

test("slots fill working hours on working days only", () => {
  // Now: Saturday 26 Sep 2026, 08:00 Riyadh.
  const now = at("2026-09-26T05:00:00Z");
  const days = computeSlots({ availability: base, lawyers: ["l"], busy: [], now, days: 7 });
  // Sat (6) and Fri (5) are off: Sun–Thu remain.
  assert.deepEqual(
    days.map((d) => d.date),
    ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"],
  );
  const sunday = days[0];
  assert.deepEqual(
    sunday.slots.map((s) => s.time),
    ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
  );
  assert.equal(sunday.slots[0].start, "2026-09-27T06:00:00.000Z");
  assert.equal(sunday.slots[0].end, "2026-09-27T06:30:00.000Z");
});

test("a slot that does not fit before closing is not offered", () => {
  const now = at("2026-09-26T05:00:00Z");
  const days = computeSlots({ availability: { ...base, slotMinutes: 45 }, lawyers: ["l"], busy: [], now, days: 2 });
  // 09:00, 09:45, 10:30 (ends 11:15), 11:15 would end 12:00 -> ok; 12:00 no.
  assert.deepEqual(
    days[0].slots.map((s) => s.time),
    ["09:00", "09:45", "10:30", "11:15"],
  );
});

test("past slots and the minimum notice are excluded", () => {
  // Sunday 27 Sep, 10:10 Riyadh.
  const now = at("2026-09-27T07:10:00Z");
  const noNotice = computeSlots({ availability: base, lawyers: ["l"], busy: [], now, days: 1 });
  assert.deepEqual(
    noNotice[0].slots.map((s) => s.time),
    ["10:30", "11:00", "11:30"],
  );
  const withNotice = computeSlots({
    availability: { ...base, minNoticeMinutes: 60 },
    lawyers: ["l"],
    busy: [],
    now,
    days: 1,
  });
  assert.deepEqual(
    withNotice[0].slots.map((s) => s.time),
    ["11:30"],
  );
});

test("busy time and buffers remove overlapping slots per lawyer", () => {
  const now = at("2026-09-26T05:00:00Z");
  // Lawyer A busy 10:00–10:30 Riyadh on Sunday.
  const busy = [{ lawyerId: "A", start: at("2026-09-27T07:00:00Z"), end: at("2026-09-27T07:30:00Z") }];
  const noBuffer = computeSlots({ availability: base, lawyers: ["A"], busy, now, fromYmd: "2026-09-27", days: 1 });
  assert.deepEqual(
    noBuffer[0].slots.map((s) => s.time),
    ["09:00", "09:30", "10:30", "11:00", "11:30"],
    "back-to-back is fine without a buffer",
  );
  const buffered = computeSlots({ availability: { ...base, bufferMinutes: 15 }, lawyers: ["A"], busy, now, fromYmd: "2026-09-27", days: 1 });
  assert.deepEqual(
    buffered[0].slots.map((s) => s.time),
    ["09:00", "11:00", "11:30"],
    "a 15-minute buffer blocks both neighbours",
  );
  // With a second lawyer, the slot stays offered and names who is free.
  const two = computeSlots({ availability: base, lawyers: ["A", "B"], busy, now, fromYmd: "2026-09-27", days: 1 });
  const ten = two[0].slots.find((s) => s.time === "10:00");
  assert.deepEqual(ten?.lawyers, ["B"]);
  assert.deepEqual(two[0].slots[0].lawyers, ["A", "B"]);
});

test("overlap edges: touching intervals do not collide, partial overlaps do", () => {
  const s = at("2026-09-27T07:00:00Z");
  const e = s + 30 * MIN;
  assert.deepEqual(freeLawyers(["A"], [{ lawyerId: "A", start: e, end: e + 30 * MIN }], s, e, 0), ["A"]);
  assert.deepEqual(freeLawyers(["A"], [{ lawyerId: "A", start: s - 30 * MIN, end: s }], s, e, 0), ["A"]);
  assert.deepEqual(freeLawyers(["A"], [{ lawyerId: "A", start: s + 29 * MIN, end: e + 60 * MIN }], s, e, 0), []);
  assert.deepEqual(freeLawyers(["A"], [{ lawyerId: "A", start: e + 5 * MIN, end: e + 60 * MIN }], s, e, 5), ["A"]);
  assert.deepEqual(freeLawyers(["A"], [{ lawyerId: "A", start: e + 4 * MIN, end: e + 60 * MIN }], s, e, 5), []);
  assert.deepEqual(freeLawyers(["A"], [{ lawyerId: "B", start: s, end: e }], s, e, 0), ["A"]);
});

test("the booking horizon and fully-booked days", () => {
  const now = at("2026-09-26T05:00:00Z");
  const days = computeSlots({ availability: { ...base, horizonDays: 3 }, lawyers: ["A"], busy: [], now, days: 30 });
  assert.deepEqual(
    days.map((d) => d.date),
    ["2026-09-27", "2026-09-28"],
    "Sat (today, off) + Sun + Mon",
  );
  const allDay = [{ lawyerId: "A", start: riyadhAt("2026-09-27", 0), end: riyadhAt("2026-09-28", 0) }];
  const full = computeSlots({ availability: base, lawyers: ["A"], busy: allDay, now, fromYmd: "2026-09-27", days: 1 });
  assert.equal(full[0].date, "2026-09-27");
  assert.equal(full[0].slots.length, 0);
  assert.deepEqual(computeSlots({ availability: base, lawyers: [], busy: [], now }), []);
});

test("isOfferedStart accepts grid starts only", () => {
  const now = at("2026-09-26T05:00:00Z");
  assert.ok(isOfferedStart(base, "2026-09-27T06:00:00.000Z", now));
  assert.ok(isOfferedStart(base, "2026-09-27T09:30:00+03:00", now));
  assert.equal(isOfferedStart(base, "2026-09-27T06:10:00.000Z", now), false, "off the grid");
  assert.equal(isOfferedStart(base, "2026-09-27T09:00:00.000Z", now), false, "12:00 Riyadh: closing time");
  assert.equal(isOfferedStart(base, "2026-09-25T06:00:00.000Z", now), false, "Friday / past");
  assert.equal(isOfferedStart(base, "2026-10-02T06:00:00.000Z", now), false, "Friday");
  assert.equal(isOfferedStart(base, "2026-10-30T06:00:00.000Z", now), false, "beyond the horizon");
  assert.equal(isOfferedStart(base, "not-a-date", now), false);
});
