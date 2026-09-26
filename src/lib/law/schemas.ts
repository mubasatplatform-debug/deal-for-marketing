/**
 * Input schemas of the practice modules — pure (zod + relative imports), so
 * the server functions validate with them and node tests import them
 * directly. Browser forms pre-check the same rules for instant feedback; the
 * server parse is the one that counts.
 *
 * Conventions: Arabic-Indic digits are accepted wherever people type numbers;
 * empty optional strings become null; money is halalas (integers); Riyadh
 * wall-clock values are 'YYYY-MM-DD' + 'HH:MM'.
 */
import { z } from "zod";
import { normalizePhone } from "../phone.ts";
import {
  APPOINTMENT_KINDS,
  APPOINTMENT_STATUSES,
  CASE_STAGES,
  CASE_TYPES,
  CLIENT_KINDS,
  HEARING_STATUSES,
  MODES,
  SLOT_LENGTHS,
} from "./options.ts";
import { HM_RE, isYmd } from "./time.ts";

export const latinDigits = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export const wsId = z.string().uuid();
export const uuid = z.string().uuid();
export const memberId = z.string().min(1).max(128);

const text = (max: number) => z.string().trim().max(max);
/** Optional text: '' / null / undefined -> null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const ymd = z.string().refine(isYmd, "date");
export const hm = z.string().regex(HM_RE, "time");

export const phoneField = z
  .string()
  .trim()
  .max(40)
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return p;
  });

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "email");

/** National id / iqama / CR: 10 digits (Arabic-Indic accepted). */
export const idNumberField = z
  .string()
  .trim()
  .max(20)
  .nullish()
  .transform((v) => (v ? latinDigits(v).replace(/\s/g, "") : null))
  .refine((v) => v === null || /^[0-9]{10}$/.test(v), "id");

export const tagsField = z
  .array(z.string().trim().min(1).max(30))
  .max(12)
  .default([])
  .transform((tags) => [...new Set(tags)]);

export const halalas = z.number().int().min(0).max(100_000_000_000);

/* ------------------------------------------------------------------------ */
/* Clients                                                                   */
/* ------------------------------------------------------------------------ */

export const clientFields = z.object({
  kind: z.enum(CLIENT_KINDS),
  name: z.string().trim().min(2).max(160),
  phone: phoneField,
  email: emailField,
  idNumber: idNumberField,
  notes: text(4000).default(""),
  tags: tagsField,
});
export type ClientFields = z.infer<typeof clientFields>;

export const clientListInput = z.object({
  workspaceId: wsId,
  q: text(100).default(""),
  kind: z.enum(CLIENT_KINDS).nullish(),
  tag: optText(30),
  page: z.number().int().min(1).max(10_000).default(1),
});

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

export const caseFields = z
  .object({
    title: z.string().trim().min(2).max(200),
    clientId: uuid.nullish().transform((v) => v ?? null),
    caseType: z.enum(CASE_TYPES),
    stage: z.enum(CASE_STAGES).default("consultation"),
    court: text(160).default(""),
    courtCaseNo: optText(60),
    opposingParty: text(200).default(""),
    description: text(4000).default(""),
    feesHalalas: halalas.default(0),
    paidHalalas: halalas.default(0),
    openedOn: ymd.nullish().transform((v) => v ?? null),
    lawyerIds: z.array(memberId).max(10).default([]).transform((ids) => [...new Set(ids)]),
  });
export type CaseFields = z.infer<typeof caseFields>;

export const caseListInput = z.object({
  workspaceId: wsId,
  q: text(100).default(""),
  stage: z.enum(CASE_STAGES).nullish(),
  caseType: z.enum(CASE_TYPES).nullish(),
  lawyerId: memberId.nullish(),
  clientId: uuid.nullish(),
  page: z.number().int().min(1).max(10_000).default(1),
});

export const hearingFields = z.object({
  date: ymd,
  time: hm,
  durationMinutes: z.number().int().min(5).max(600).default(60),
  court: text(160).default(""),
  room: text(60).default(""),
  status: z.enum(HEARING_STATUSES).default("scheduled"),
  outcome: text(4000).default(""),
});

export const taskFields = z.object({
  title: z.string().trim().min(2).max(200),
  notes: text(2000).default(""),
  caseId: uuid.nullish().transform((v) => v ?? null),
  assigneeId: memberId.nullish().transform((v) => v ?? null),
  dueOn: ymd.nullish().transform((v) => v ?? null),
});

export const noteFields = z
  .object({
    clientId: uuid.nullish().transform((v) => v ?? null),
    caseId: uuid.nullish().transform((v) => v ?? null),
    body: z.string().trim().min(1).max(4000),
  })
  .refine((v) => Boolean(v.clientId || v.caseId), "target");

/* ------------------------------------------------------------------------ */
/* Appointments & consultations                                              */
/* ------------------------------------------------------------------------ */

export const appointmentFields = z
  .object({
    kind: z.enum(APPOINTMENT_KINDS),
    mode: z.enum(MODES).default("in_office"),
    title: text(200).default(""),
    clientId: uuid.nullish().transform((v) => v ?? null),
    caseId: uuid.nullish().transform((v) => v ?? null),
    leadName: optText(120),
    leadPhone: phoneField,
    leadEmail: emailField,
    lawyerId: memberId.nullish().transform((v) => v ?? null),
    date: ymd,
    time: hm,
    durationMinutes: z.number().int().min(5).max(480).default(30),
    location: text(200).default(""),
    status: z.enum(["pending", "confirmed"]).default("confirmed"),
  })
  .refine((v) => v.kind === "appointment" || Boolean(v.clientId || (v.leadName && v.leadName.length >= 2)), {
    message: "client",
    path: ["clientId"],
  })
  .refine((v) => v.kind === "appointment" || v.title.length >= 2, { message: "topic", path: ["title"] });
export type AppointmentFields = z.infer<typeof appointmentFields>;

export const statusInput = z.enum(APPOINTMENT_STATUSES);

export const calendarInput = z.object({
  workspaceId: wsId,
  from: ymd,
  days: z.number().int().min(1).max(42).default(7),
  memberId: memberId.nullish(),
});

/* ------------------------------------------------------------------------ */
/* Booking settings & the public booking form                               */
/* ------------------------------------------------------------------------ */

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_RE, "slug")
  .refine((v) => !v.endsWith("-") && !v.includes("--"), "slug");

export const bookingSettingsFields = z
  .object({
    bookingEnabled: z.boolean(),
    bookingModes: z.array(z.enum(MODES)).min(1).max(3).transform((m) => [...new Set(m)]),
    workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform((d) => [...new Set(d)].sort()),
    dayStart: hm,
    dayEnd: hm,
    slotMinutes: z.number().int().refine((n) => (SLOT_LENGTHS as readonly number[]).includes(n), "slot"),
    bufferMinutes: z.number().int().min(0).max(120),
    minNoticeMinutes: z.number().int().min(0).max(20160),
    horizonDays: z.number().int().min(1).max(90),
    bookingNote: text(500).default(""),
  })
  .refine((v) => v.dayEnd > v.dayStart, { message: "hours", path: ["dayEnd"] });
export type BookingSettingsFields = z.infer<typeof bookingSettingsFields>;

export const bookingForm = z.object({
  slug: slugField,
  mode: z.enum(MODES),
  lawyerId: memberId.nullish().transform((v) => v ?? null),
  start: z.string().datetime({ offset: true }),
  name: z.string().trim().min(2).max(120),
  phone: phoneField.refine((v) => v !== null, "phone"),
  email: emailField,
  topic: z.string().trim().min(5).max(500),
  /** Honeypot: only bots fill it. */
  website: z.string().max(200).optional().default(""),
  /** Milliseconds the form was open (instant submits are bots). */
  fillMs: z.number().int().min(0).max(86_400_000).default(0),
  /** WhatsApp code for `phone`, when the booking page asks for one. */
  otpCode: z.string().trim().regex(/^\d{6}$/).nullish(),
});
export type BookingForm = z.infer<typeof bookingForm>;
