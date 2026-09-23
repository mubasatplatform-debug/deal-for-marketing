/**
 * Enumerations of the practice modules and their Arabic labels — pure, shared
 * by the zod schemas, the server and the UI. The SQL `check` constraints in
 * migrations/0010_law_practice.sql list the same values.
 */

export const CLIENT_KINDS = ["individual", "company"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];
export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  individual: "فرد",
  company: "منشأة",
};

export const CASE_TYPES = [
  "commercial",
  "labor",
  "family",
  "criminal",
  "administrative",
  "real_estate",
  "general",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];
export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  commercial: "تجاري",
  labor: "عمالي",
  family: "أحوال شخصية",
  criminal: "جزائي",
  administrative: "إداري",
  real_estate: "عقاري",
  general: "عام",
};

/** The case pipeline, in order. */
export const CASE_STAGES = [
  "consultation",
  "study",
  "filed",
  "hearings",
  "judgment",
  "enforcement",
  "closed",
] as const;
export type CaseStage = (typeof CASE_STAGES)[number];
export const CASE_STAGE_LABELS: Record<CaseStage, string> = {
  consultation: "استشارة",
  study: "قيد الدراسة",
  filed: "مرفوعة",
  hearings: "جلسات",
  judgment: "حكم",
  enforcement: "تنفيذ",
  closed: "مغلقة",
};

export const HEARING_STATUSES = ["scheduled", "held", "postponed", "cancelled"] as const;
export type HearingStatus = (typeof HEARING_STATUSES)[number];
export const HEARING_STATUS_LABELS: Record<HearingStatus, string> = {
  scheduled: "مجدولة",
  held: "عُقدت",
  postponed: "مؤجلة",
  cancelled: "ملغاة",
};

export const APPOINTMENT_KINDS = ["appointment", "consultation"] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

export const MODES = ["video", "in_office", "phone"] as const;
export type ConsultMode = (typeof MODES)[number];
export const MODE_LABELS: Record<ConsultMode, string> = {
  video: "مكالمة فيديو",
  in_office: "حضوري في المكتب",
  phone: "مكالمة هاتفية",
};
export const MODE_SHORT: Record<ConsultMode, string> = {
  video: "فيديو",
  in_office: "حضوري",
  phone: "هاتف",
};

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "done", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكدة",
  done: "تمت",
  cancelled: "ملغاة",
  no_show: "لم يحضر",
};

/** Statuses that hold a lawyer's time. */
export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["pending", "confirmed"];

/** Allowed status moves (the server refuses anything else). */
export const STATUS_MOVES: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["done", "no_show", "cancelled"],
  done: ["confirmed"],
  no_show: ["confirmed"],
  cancelled: ["confirmed"],
};

export function canMoveStatus(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return STATUS_MOVES[from].includes(to);
}

export const SLOT_LENGTHS = [15, 20, 30, 45, 60, 90, 120] as const;

export const WEEKDAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;
