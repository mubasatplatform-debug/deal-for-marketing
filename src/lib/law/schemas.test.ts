import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appointmentFields,
  bookingForm,
  bookingSettingsFields,
  caseFields,
  clientFields,
  noteFields,
  slugField,
  taskFields,
} from "./schemas.ts";
import { STATUS_MOVES, canMoveStatus } from "./options.ts";
import { PLANS, planHas, storageQuotaBytes } from "../saas/plans.ts";

test("clients: Saudi phones normalize, Arabic digits are accepted, blanks become null", () => {
  const c = clientFields.parse({
    kind: "individual",
    name: "  محمد العتيبي ",
    phone: "٠٥٠ ١٢٣ ٤٥٦٧",
    email: " Mohammed@Example.SA ",
    idNumber: "١٠٢٣٤٥٦٧٨٩",
    tags: ["VIP", "VIP", "عقاري"],
  });
  assert.equal(c.name, "محمد العتيبي");
  assert.equal(c.phone, "+966501234567");
  assert.equal(c.email, "mohammed@example.sa");
  assert.equal(c.idNumber, "1023456789");
  assert.deepEqual(c.tags, ["VIP", "عقاري"]);
  assert.equal(c.notes, "");
  const blank = clientFields.parse({ kind: "company", name: "شركة الأفق", phone: "", email: "", idNumber: "" });
  assert.equal(blank.phone, null);
  assert.equal(blank.email, null);
  assert.equal(blank.idNumber, null);
  assert.equal(clientFields.safeParse({ kind: "individual", name: "م" }).success, false, "name too short");
  assert.equal(clientFields.safeParse({ kind: "individual", name: "محمد", phone: "12" }).success, false);
  assert.equal(clientFields.safeParse({ kind: "individual", name: "محمد", email: "nope" }).success, false);
  assert.equal(clientFields.safeParse({ kind: "individual", name: "محمد", idNumber: "12345" }).success, false);
  assert.equal(clientFields.safeParse({ kind: "robot", name: "محمد" }).success, false);
});

test("cases: enums, halalas and lawyers", () => {
  const k = caseFields.parse({ title: "مطالبة مالية", caseType: "commercial", feesHalalas: 1_500_000, lawyerIds: ["a", "a"] });
  assert.equal(k.stage, "consultation");
  assert.deepEqual(k.lawyerIds, ["a"]);
  assert.equal(k.clientId, null);
  assert.equal(caseFields.safeParse({ title: "x", caseType: "commercial" }).success, false);
  assert.equal(caseFields.safeParse({ title: "قضية", caseType: "sports" }).success, false);
  assert.equal(caseFields.safeParse({ title: "قضية", caseType: "labor", feesHalalas: 10.5 }).success, false);
  assert.equal(caseFields.safeParse({ title: "قضية", caseType: "labor", feesHalalas: -1 }).success, false);
  assert.equal(caseFields.safeParse({ title: "قضية", caseType: "labor", openedOn: "2026-02-30" }).success, false);
});

test("tasks and notes", () => {
  assert.equal(taskFields.parse({ title: "رفع مذكرة", dueOn: "2026-10-01" }).dueOn, "2026-10-01");
  assert.equal(taskFields.safeParse({ title: "رفع مذكرة", dueOn: "01/10/2026" }).success, false);
  assert.equal(noteFields.safeParse({ body: "ملاحظة" }).success, false, "a note needs a client or case");
  assert.ok(noteFields.safeParse({ body: "ملاحظة", clientId: "0b7c4a36-3c35-4f7d-9e4c-1c2d3e4f5a6b" }).success);
});

test("appointments: a consultation needs a client or a lead, and a topic", () => {
  const base = { kind: "consultation", mode: "video", date: "2026-10-01", time: "10:30" };
  assert.equal(appointmentFields.safeParse({ ...base, title: "إيجار" }).success, false, "no client or lead");
  assert.equal(appointmentFields.safeParse({ ...base, leadName: "سارة" }).success, false, "no topic");
  const ok = appointmentFields.parse({ ...base, title: "عقد إيجار", leadName: "سارة", leadPhone: "0551234567" });
  assert.equal(ok.leadPhone, "+966551234567");
  assert.equal(ok.durationMinutes, 30);
  assert.equal(ok.status, "confirmed");
  assert.ok(appointmentFields.safeParse({ kind: "appointment", date: "2026-10-01", time: "09:00" }).success);
  assert.equal(appointmentFields.safeParse({ ...base, title: "x y", leadName: "سارة", time: "25:00" }).success, false);
});

test("booking settings and slugs", () => {
  const s = bookingSettingsFields.parse({
    bookingEnabled: true,
    bookingModes: ["video", "video", "phone"],
    workDays: [4, 0, 0, 1],
    dayStart: "09:00",
    dayEnd: "17:00",
    slotMinutes: 30,
    bufferMinutes: 10,
    minNoticeMinutes: 120,
    horizonDays: 21,
  });
  assert.deepEqual(s.bookingModes, ["video", "phone"]);
  assert.deepEqual(s.workDays, [0, 1, 4]);
  const bad = { ...s, dayStart: "17:00", dayEnd: "09:00" };
  assert.equal(bookingSettingsFields.safeParse(bad).success, false);
  assert.equal(bookingSettingsFields.safeParse({ ...s, slotMinutes: 25 }).success, false);
  assert.equal(bookingSettingsFields.safeParse({ ...s, bookingModes: [] }).success, false);
  assert.equal(slugField.parse(" Al-Adl-Law "), "al-adl-law");
  for (const bad of ["ab", "-adl", "adl-", "al--adl", "العدل", "al_adl", "a".repeat(64)]) {
    assert.equal(slugField.safeParse(bad).success, false, bad);
  }
});

test("the public booking form: phone required, honeypot and fill time carried", () => {
  const f = bookingForm.parse({
    slug: "al-adl",
    mode: "video",
    start: "2026-10-01T10:30:00+03:00",
    name: "سارة",
    phone: "0551234567",
    topic: "استشارة في عقد عمل",
    fillMs: 5000,
  });
  assert.equal(f.phone, "+966551234567");
  assert.equal(f.website, "");
  assert.equal(f.lawyerId, null);
  assert.equal(f.email, null);
  const missing = { slug: "al-adl", mode: "video", start: "2026-10-01T10:30:00Z", name: "سارة", topic: "استشارة في عقد" };
  assert.equal(bookingForm.safeParse(missing).success, false, "phone is required");
  assert.equal(bookingForm.safeParse({ ...missing, phone: "0551234567", start: "tomorrow" }).success, false);
  assert.equal(bookingForm.safeParse({ ...missing, phone: "0551234567", topic: "قصير" }).success, false);
});

test("consultation statuses move only along the allowed paths", () => {
  assert.ok(canMoveStatus("pending", "confirmed"));
  assert.ok(canMoveStatus("confirmed", "done"));
  assert.ok(canMoveStatus("confirmed", "no_show"));
  assert.ok(canMoveStatus("cancelled", "confirmed"));
  assert.equal(canMoveStatus("pending", "done"), false);
  assert.equal(canMoveStatus("done", "pending"), false);
  for (const [from, tos] of Object.entries(STATUS_MOVES)) assert.ok(!tos.includes(from as never), from);
});

test("plans: storage quotas grow with the tier; video consultations on احترافي and up", () => {
  assert.deepEqual(
    PLANS.map((p) => p.storageGb),
    [2, 10, 50],
  );
  assert.equal(storageQuotaBytes("basic"), 2 * 1024 ** 3);
  assert.equal(storageQuotaBytes("unknown-plan"), 2 * 1024 ** 3);
  assert.equal(planHas("basic", "videoSessions"), false);
  assert.equal(planHas("pro", "videoSessions"), true);
});
