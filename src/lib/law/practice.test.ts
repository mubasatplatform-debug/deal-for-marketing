/**
 * Practice modules on a real schema (PGLite + every migration): tenant
 * isolation (IDOR), role rules, the atomic booking, the storage quota and the
 * composite foreign keys.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceCore, resolveMembership, WorkspaceError, type SqlTag } from "../saas/tenancy-core.ts";
import {
  addNoteCore,
  addPaymentCore,
  createCaseCore,
  createClientCore,
  createHearingCore,
  createTaskCore,
  deleteCaseCore,
  deleteClientCore,
  deleteNoteCore,
  deleteTaskCore,
  getCaseCore,
  getClientCore,
  homeCore,
  listCasesCore,
  listClientsCore,
  listTasksCore,
  setCaseStageCore,
  setTaskDoneCore,
  updateCaseCore,
  updateClientCore,
} from "./practice-core.ts";
import {
  admitCore,
  bookSlotCore,
  busyCore,
  calendarCore,
  convertLeadCore,
  createAppointmentCore,
  listConsultationsCore,
  loadAppointmentCore,
  meetByHashCore,
  publicOfficeCore,
  saveConsultNotesCore,
  saveSettingsCore,
  setSlugCore,
  setStatusCore,
  visibleAppointment,
  type NewAppointment,
} from "./schedule-core.ts";
import {
  deleteDocumentCore,
  documentMetaCore,
  foldersCore,
  insertDocumentCore,
  listDocumentsCore,
  resolveTarget,
} from "./documents-core.ts";
import { caseFields, clientFields } from "./schemas.ts";
import { hashMeetToken } from "./meet-token.ts";

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

async function addUser(pg: PGlite, id: string) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [
    id,
    `User ${id}`,
    `${id}@x.sa`,
  ]);
}

let n = 0;
async function office(sql: SqlTag, owner: string, plan?: string) {
  n += 1;
  const w = await createWorkspaceCore(sql, owner, {
    name: `مكتب ${n}`,
    city: "الرياض",
    crNumber: null,
    teamSize: "2-5",
    slug: `office-p2-${n}`,
  });
  if (plan) await sql`update workspaces set plan = ${plan} where id = ${w.id}`;
  return w;
}

async function member(pg: PGlite, ws: string, user: string, role: string) {
  await addUser(pg, user);
  await pg.query(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3)`, [ws, user, role]);
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (err: unknown) => err instanceof WorkspaceError && err.code === code, `expected ${code}`);
}

const client = (name: string, extra: Record<string, unknown> = {}) =>
  clientFields.parse({ kind: "individual", name, phone: "0501234567", ...extra });

const kase = (title: string, extra: Record<string, unknown> = {}) =>
  caseFields.parse({ title, caseType: "commercial", ...extra });

function appt(extra: Partial<NewAppointment> = {}): NewAppointment {
  const start = new Date(Date.now() + 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  return {
    kind: "consultation",
    mode: "in_office",
    status: "confirmed",
    title: "استشارة عقد إيجار",
    clientId: null,
    caseId: null,
    leadName: "سارة",
    leadPhone: "+966501112223",
    leadEmail: null,
    lawyerId: null,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
    location: "",
    videoRoom: null,
    meetNonce: null,
    meetTokenHash: null,
    ...extra,
  };
}

test("IDOR: a second office can neither read nor touch the first office's records", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "a");
  await addUser(pg, "b");
  const A = await office(sql, "a");
  const B = await office(sql, "b");
  const a = await resolveMembership(sql, "a", A.id, "staff", { write: true });
  const b = await resolveMembership(sql, "b", B.id, "staff", { write: true });

  const c = await createClientCore(sql, a, client("عميل أ"));
  const k = await createCaseCore(sql, a, kase("قضية أ", { clientId: c.id, lawyerIds: ["a"] }));
  const h = await createHearingCore(sql, a, k.id, {
    startsAt: new Date(Date.now() + 3_600_000).toISOString(),
    durationMinutes: 60,
    court: "المحكمة التجارية",
    room: "3",
    status: "scheduled",
    outcome: "",
  });
  const t = await createTaskCore(sql, a, { title: "مذكرة رد", notes: "", caseId: k.id, assigneeId: "a", dueOn: null });
  const note = await addNoteCore(sql, a, { clientId: c.id, caseId: null, body: "ملاحظة سرية" });
  const ap = await createAppointmentCore(sql, a, appt({ clientId: c.id, lawyerId: "a" }));
  await insertDocumentCore(sql, a, {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: c.id,
    caseId: k.id,
    name: "عقد.pdf",
    mime: "application/pdf",
    size: 10,
    storage: "db",
    data: new TextEncoder().encode("%PDF-1.4 x"),
    blobPath: null,
  });

  // Office B sees nothing of A in its lists…
  assert.equal((await listClientsCore(sql, b, { q: "", page: 1 })).total, 0);
  assert.equal((await listCasesCore(sql, b, { q: "", page: 1 })).total, 0);
  assert.equal((await listTasksCore(sql, b, { scope: "all", includeDone: true })).length, 0);
  assert.equal((await listDocumentsCore(sql, b, { q: "", page: 1 })).total, 0);
  assert.equal((await listConsultationsCore(sql, b, { view: "all", q: "", page: 1 })).total, 0);
  assert.equal((await foldersCore(sql, b)).total, 0);
  const far = new Date(Date.now() + 30 * 86_400_000).toISOString();
  assert.equal((await calendarCore(sql, b, { from: new Date(0).toISOString(), to: far })).length, 0);
  // …and every direct id of A answers "not found", reads and writes alike.
  await rejects(getClientCore(sql, b, c.id), "not_found");
  await rejects(getCaseCore(sql, b, k.id), "not_found");
  await rejects(updateClientCore(sql, b, c.id, client("مخترق")), "not_found");
  await rejects(updateCaseCore(sql, b, k.id, kase("مخترق")), "not_found");
  await rejects(setCaseStageCore(sql, b, k.id, "closed"), "not_found");
  await rejects(addPaymentCore(sql, b, k.id, 100), "not_found");
  await rejects(deleteCaseCore(sql, b, k.id), "not_found");
  await rejects(deleteClientCore(sql, b, c.id), "not_found");
  await rejects(createHearingCore(sql, b, k.id, { startsAt: new Date().toISOString(), durationMinutes: 30, court: "", room: "", status: "scheduled", outcome: "" }), "not_found");
  await rejects(setTaskDoneCore(sql, b, t.id, true), "not_found");
  await rejects(deleteTaskCore(sql, b, t.id), "not_found");
  await rejects(deleteNoteCore(sql, b, note.id), "not_found");
  await rejects(loadAppointmentCore(sql, b, ap.id), "not_found");
  await rejects(setStatusCore(sql, b, ap.id, "cancelled"), "not_found");
  await rejects(saveConsultNotesCore(sql, b, ap.id, "x"), "not_found");
  await rejects(admitCore(sql, b, ap.id), "not_found");
  await rejects(convertLeadCore(sql, b, ap.id), "not_found");
  assert.equal(await documentMetaCore(sql, b, "11111111-1111-4111-8111-111111111111"), null);
  await rejects(deleteDocumentCore(sql, b, "11111111-1111-4111-8111-111111111111"), "not_found");
  // B cannot attach its own rows to A's client / case / member.
  await rejects(createCaseCore(sql, b, kase("ربط", { clientId: c.id })), "not_found");
  await rejects(createTaskCore(sql, b, { title: "ربط", notes: "", caseId: k.id, assigneeId: null, dueOn: null }), "not_found");
  await rejects(createTaskCore(sql, b, { title: "ربط", notes: "", caseId: null, assigneeId: "a", dueOn: null }), "invalid");
  await rejects(addNoteCore(sql, b, { clientId: c.id, caseId: null, body: "x" }), "not_found");
  await rejects(createAppointmentCore(sql, b, appt({ clientId: c.id })), "not_found");
  await rejects(resolveTarget(sql, b, null, k.id), "not_found");

  // Still intact for A.
  const detail = await getCaseCore(sql, a, k.id);
  assert.equal(detail.case.title, "قضية أ");
  assert.equal(detail.hearings[0].id, h.id);
  assert.equal(detail.case.lawyers[0].id, "a");
  await pg.close();
});

test("composite foreign keys refuse cross-office links even from raw SQL", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "a");
  await addUser(pg, "b");
  const A = await office(sql, "a");
  const B = await office(sql, "b");
  const a = await resolveMembership(sql, "a", A.id);
  const c = await createClientCore(sql, a, client("عميل أ"));
  // A case in B pointing at A's client.
  await assert.rejects(
    pg.query(`insert into law_cases (workspace_id, ref_no, title, client_id) values ($1, 1, 'x y', $2)`, [B.id, c.id]),
    /foreign key/,
  );
  // A task in A assigned to someone who is not a member of A.
  await assert.rejects(
    pg.query(`insert into law_tasks (workspace_id, title, assignee_id) values ($1, 'x y', 'b')`, [A.id]),
    /foreign key/,
  );
  await pg.close();
});

test("roles: staff runs reception but cannot delete, edit cases, or see fees", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  const W = await office(sql, "o");
  await member(pg, W.id, "s", "staff");
  await member(pg, W.id, "l", "lawyer");
  await member(pg, W.id, "l2", "lawyer");
  const owner = await resolveMembership(sql, "o", W.id);
  const staff = await resolveMembership(sql, "s", W.id);
  const lawyer = await resolveMembership(sql, "l", W.id);
  const lawyer2 = await resolveMembership(sql, "l2", W.id);

  const c = await createClientCore(sql, staff, client("عميل"));
  await rejects(createCaseCore(sql, staff, kase("قضية")), "role");
  const k = await createCaseCore(sql, lawyer, kase("قضية", { clientId: c.id, feesHalalas: 500000, lawyerIds: ["l"] }));
  assert.equal(k.refNo, 1);
  const k2 = await createCaseCore(sql, lawyer, kase("قضية ٢"));
  assert.equal(k2.refNo, 2);

  // Fees are hidden from staff, visible to lawyers.
  assert.equal((await getCaseCore(sql, staff, k.id)).case.fees_halalas, null);
  assert.equal((await getCaseCore(sql, lawyer, k.id)).case.fees_halalas, 500000);
  await rejects(addPaymentCore(sql, staff, k.id, 1000), "role");
  await addPaymentCore(sql, lawyer, k.id, 150000);
  const after = await getCaseCore(sql, lawyer, k.id);
  assert.equal(after.case.paid_halalas, 150000);
  assert.ok(after.notes.some((x) => x.kind === "event" && x.body.includes("دفعة")));
  // The timeline is shared with reception, so it never carries the amount.
  assert.ok((await getCaseCore(sql, staff, k.id)).notes.every((x) => !x.body.includes("1,500")));

  // Stage moves are logged on the timeline.
  await setCaseStageCore(sql, lawyer, k.id, "filed");
  assert.ok((await getCaseCore(sql, lawyer, k.id)).notes.some((x) => x.body.includes("مرفوعة")));
  await rejects(setCaseStageCore(sql, staff, k.id, "closed"), "role");

  // Deletes are for admins and up; a client with cases cannot be deleted.
  await rejects(deleteCaseCore(sql, lawyer, k2.id), "role");
  await rejects(deleteClientCore(sql, staff, c.id), "role");
  await rejects(deleteClientCore(sql, owner, c.id), "has_records");
  await deleteCaseCore(sql, owner, k2.id);

  // Private consultation notes: only the assigned lawyer (or admins) see and write them.
  const ap = await createAppointmentCore(sql, staff, appt({ lawyerId: "l" }));
  await rejects(saveConsultNotesCore(sql, staff, ap.id, "x"), "role");
  await rejects(saveConsultNotesCore(sql, lawyer2, ap.id, "x"), "role");
  await saveConsultNotesCore(sql, lawyer, ap.id, "الموكل يملك نسخة العقد");
  const full = await loadAppointmentCore(sql, lawyer, ap.id);
  assert.equal(visibleAppointment(lawyer, full).private_notes, "الموكل يملك نسخة العقد");
  assert.equal(visibleAppointment(staff, await loadAppointmentCore(sql, staff, ap.id)).private_notes, null);
  assert.equal(visibleAppointment(owner, await loadAppointmentCore(sql, owner, ap.id)).private_notes, "الموكل يملك نسخة العقد");
  // Outcomes are the lawyer's; statuses move only along the allowed path.
  await rejects(setStatusCore(sql, staff, ap.id, "done"), "role");
  await setStatusCore(sql, lawyer, ap.id, "done");
  await rejects(setStatusCore(sql, lawyer, ap.id, "pending"), "status");

  // Tasks: staff completes, cannot delete others' tasks.
  const t = await createTaskCore(sql, lawyer, { title: "مراجعة", notes: "", caseId: k.id, assigneeId: "s", dueOn: "2020-01-01" });
  await setTaskDoneCore(sql, staff, t.id, true);
  await rejects(deleteTaskCore(sql, staff, t.id), "role");
  const overdue = await createTaskCore(sql, staff, { title: "متأخرة", notes: "", caseId: null, assigneeId: "s", dueOn: "2020-01-01" });
  const home = await homeCore(sql, staff);
  assert.ok(home.overdue.some((x) => x.id === overdue.id));
  assert.ok(!home.overdue.some((x) => x.id === t.id));
  assert.ok(home.myTasks.some((x) => x.id === overdue.id));
  await deleteTaskCore(sql, staff, overdue.id); // own task

  // Notes: author or admin deletes.
  const nNote = await addNoteCore(sql, lawyer, { clientId: c.id, caseId: null, body: "اتصل العميل" });
  await rejects(deleteNoteCore(sql, staff, nNote.id), "role");
  await deleteNoteCore(sql, lawyer, nNote.id);
  assert.equal((await getClientCore(sql, owner, c.id)).notes.length, 0);
  await pg.close();
});

test("booking: slots are reserved atomically and never double-booked", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  const W = await office(sql, "o");
  await member(pg, W.id, "l", "lawyer");
  const owner = await resolveMembership(sql, "o", W.id);
  await saveSettingsCore(sql, owner, {
    bookingEnabled: true,
    bookingModes: ["video", "phone"],
    workDays: [0, 1, 2, 3, 4, 5, 6],
    dayStart: "09:00",
    dayEnd: "17:00",
    slotMinutes: 30,
    bufferMinutes: 10,
    minNoticeMinutes: 0,
    horizonDays: 30,
    bookingNote: "",
  });
  await setSlugCore(sql, owner, "al-adl");
  await addUser(pg, "z");
  const other = await office(sql, "z");
  const otherSlug = (await pg.query<{ slug: string }>(`select slug from workspaces where id = $1`, [other.id])).rows[0].slug;
  await rejects(setSlugCore(sql, owner, otherSlug), "slug_taken");

  const pub = await publicOfficeCore(sql, "al-adl");
  assert.ok(pub?.open);
  assert.deepEqual(pub?.modes, ["video", "phone"]);
  assert.deepEqual(
    pub?.lawyers.map((l) => l.id),
    ["l", "o"],
  );
  assert.equal(await publicOfficeCore(sql, "nope"), null);

  const start = new Date(Date.now() + 2 * 86_400_000);
  start.setUTCHours(8, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String((seq += 1)).padStart(12, "0")}`;
  const base = {
    get id() {
      return nextId();
    },
    workspaceId: W.id,
    mode: "video" as const,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    bufferMinutes: 10,
    topic: "نزاع عمالي",
    phone: "+966501234567",
    email: null,
    clientId: null,
    room: "maktab-abcdefghijklmnopqrstuvwxyz012345",
  };
  const one = await bookSlotCore(sql, { ...base, candidates: ["l", "o"], name: "أحمد", nonce: "n1", tokenHash: hashMeetToken("t1") });
  const two = await bookSlotCore(sql, { ...base, candidates: ["l", "o"], name: "خالد", nonce: "n2", tokenHash: hashMeetToken("t2") });
  const three = await bookSlotCore(sql, { ...base, candidates: ["l", "o"], name: "فهد", nonce: "n3", tokenHash: hashMeetToken("t3") });
  assert.equal(one?.lawyerId, "l");
  assert.equal(two?.lawyerId, "o");
  assert.equal(three, null, "both lawyers are taken");
  // The buffer blocks the adjacent slot too.
  const adjacent = await bookSlotCore(sql, {
    ...base,
    startsAt: end.toISOString(),
    endsAt: new Date(end.getTime() + 30 * 60_000).toISOString(),
    candidates: ["l"],
    name: "سعد",
    nonce: "n4",
    tokenHash: hashMeetToken("t4"),
  });
  assert.equal(adjacent, null);
  // A non-member candidate is never booked.
  assert.equal(await bookSlotCore(sql, { ...base, startsAt: new Date(start.getTime() + 86_400_000).toISOString(), endsAt: new Date(end.getTime() + 86_400_000).toISOString(), candidates: ["stranger"], name: "س", nonce: "n5", tokenHash: hashMeetToken("t5") }), null);

  const busy = await busyCore(sql, W.id, ["l", "o"], new Date(Date.now()).toISOString(), new Date(Date.now() + 5 * 86_400_000).toISOString());
  assert.equal(busy.length, 2);

  // The booked consultation is pending, found by its meeting-token hash, and logged.
  const meet = await meetByHashCore(sql, hashMeetToken("t1"));
  assert.equal(meet?.status, "pending");
  assert.equal(meet?.client_name, "أحمد");
  assert.equal(meet?.lawyer_id, "l");
  assert.equal(await meetByHashCore(sql, hashMeetToken("nope")), null);
  const [ev] = (await pg.query<{ n: number }>(`select count(*)::int as n from workspace_events where kind = 'consult_booked'`)).rows;
  assert.equal(ev.n, 2);

  // The lead becomes a client in one step (reusing an existing client with the same phone).
  const existing = await createClientCore(sql, owner, client("أحمد القحطاني", { phone: "0501234567" }));
  const converted = await convertLeadCore(sql, owner, one!.id);
  assert.equal(converted.clientId, existing.id);
  // The public meeting page of an online booking never reveals the office's
  // record of that client, only the name the booker typed.
  assert.equal((await meetByHashCore(sql, hashMeetToken("t1")))?.client_name, "أحمد");
  await pg.close();
});

test("booking is closed on read-only offices and video needs a plan that includes it", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  const W = await office(sql, "o", "basic");
  const owner = await resolveMembership(sql, "o", W.id);
  await rejects(
    saveSettingsCore(sql, owner, {
      bookingEnabled: true,
      bookingModes: ["video"],
      workDays: [0],
      dayStart: "09:00",
      dayEnd: "12:00",
      slotMinutes: 30,
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      horizonDays: 7,
      bookingNote: "",
    }),
    "plan_feature",
  );
  await rejects(createAppointmentCore(sql, owner, appt({ mode: "video" })), "plan_feature");
  await saveSettingsCore(sql, owner, {
    bookingEnabled: true,
    bookingModes: ["phone"],
    workDays: [0],
    dayStart: "09:00",
    dayEnd: "12:00",
    slotMinutes: 30,
    bufferMinutes: 0,
    minNoticeMinutes: 0,
    horizonDays: 7,
    bookingNote: "",
  });
  const slug = (await pg.query<{ slug: string }>(`select slug from workspaces where id = $1`, [W.id])).rows[0].slug;
  assert.equal((await publicOfficeCore(sql, slug))?.open, true);
  await pg.query(`update workspaces set status = 'suspended' where id = $1`, [W.id]);
  assert.equal((await publicOfficeCore(sql, slug))?.open, false);
  await pg.close();
});

test("documents: the storage quota is enforced under the office lock", async () => {
  const { pg, sql } = await freshDb();
  await addUser(pg, "o");
  const W = await office(sql, "o", "basic");
  const owner = await resolveMembership(sql, "o", W.id);
  const bytes = new TextEncoder().encode("%PDF-1.4");
  const doc = (id: string, size: number) =>
    insertDocumentCore(sql, owner, {
      id,
      clientId: null,
      caseId: null,
      name: "ملف.pdf",
      mime: "application/pdf",
      size,
      storage: "db",
      data: bytes,
      blobPath: null,
    });
  await doc("22222222-2222-4222-8222-222222222222", 2 * 1024 ** 3 - 10);
  await rejects(doc("33333333-3333-4333-8333-333333333333", 11), "quota");
  await doc("44444444-4444-4444-8444-444444444444", 10);
  const page = await listDocumentsCore(sql, owner, { q: "ملف", page: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.usage.used, 2 * 1024 ** 3);
  assert.equal(page.usage.quota, 2 * 1024 ** 3);
  assert.equal((await foldersCore(sql, owner)).unfiled, 2);
  await pg.close();
});
