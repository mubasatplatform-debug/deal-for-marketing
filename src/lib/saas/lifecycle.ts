/**
 * Roles and subscription lifecycle — pure (no app aliases, no I/O), shared by
 * the server guard, the UI and the node tests.
 */
import { GRACE_DAYS } from "./plans.ts";

export type Role = "owner" | "admin" | "lawyer" | "staff";
export type InviteRole = Exclude<Role, "owner">;
export type WorkspaceStatus = "trialing" | "active" | "past_due" | "suspended" | "cancelled";

export const ROLES: readonly Role[] = ["owner", "admin", "lawyer", "staff"];
export const INVITE_ROLES: readonly InviteRole[] = ["admin", "lawyer", "staff"];

/** Higher can do everything lower can. */
const RANK: Record<Role, number> = { staff: 1, lawyer: 2, admin: 3, owner: 4 };

export const ROLE_LABELS: Record<Role, string> = {
  owner: "مالك المكتب",
  admin: "مدير",
  lawyer: "محامٍ",
  staff: "موظف",
};

export const ROLE_HINTS: Record<Role, string> = {
  owner: "كل الصلاحيات، ومنها الاشتراك ونقل الملكية.",
  admin: "يدير الفريق والإعدادات والاشتراك.",
  lawyer: "يعمل على العملاء والقضايا والمستندات.",
  staff: "المواعيد والاستقبال والمهام المكتبية.",
};

export const STATUS_LABELS: Record<WorkspaceStatus, string> = {
  trialing: "تجربة مجانية",
  active: "نشط",
  past_due: "متأخر السداد",
  suspended: "موقوف",
  cancelled: "ملغى",
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export type LifecycleInput = {
  status: string;
  trial_ends_at: string | Date | null;
  current_period_end: string | Date | null;
};

export type Lifecycle = {
  /** The status as of `now` (the stored one, or what lapsing turned it into). */
  status: WorkspaceStatus;
  /** Suspended / cancelled offices are read-only; data stays. */
  readOnly: boolean;
  /** Whole days left in the trial or paid period (0 when lapsed or n/a). */
  daysLeft: number;
  /** When a past_due office turns read-only, if it will. */
  suspendsAt: string | null;
  /** The date the current access ends (trial end or period end). */
  endsAt: string | null;
};

const DAY = 86_400_000;

function ms(v: string | Date | null): number | null {
  if (v === null || v === undefined) return null;
  const t = typeof v === "string" ? Date.parse(v) : v.getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Effective status, computed on read. The stored status only changes on real
 * events (sign-up, payment, a team action); time passing is derived here:
 *
 *   trialing / active / past_due whose end date passed -> past_due for
 *   GRACE_DAYS (full access, loud banner), then suspended (read-only).
 *   suspended / cancelled stay as they are until the team or a payment acts.
 */
export function effectiveStatus(ws: LifecycleInput, now: number = Date.now()): Lifecycle {
  const stored = ws.status as WorkspaceStatus;
  if (stored === "suspended" || stored === "cancelled") {
    return { status: stored, readOnly: true, daysLeft: 0, suspendsAt: null, endsAt: null };
  }
  const end = stored === "trialing" ? ms(ws.trial_ends_at) : ms(ws.current_period_end);
  const endsAt = end === null ? null : new Date(end).toISOString();
  // An active office without an end date (e.g. a hand-made enterprise deal) never lapses.
  if (end === null) {
    return {
      status: stored === "past_due" ? "past_due" : stored,
      readOnly: false,
      daysLeft: 0,
      suspendsAt: null,
      endsAt,
    };
  }
  if (now < end && stored !== "past_due") {
    return {
      status: stored,
      readOnly: false,
      daysLeft: Math.ceil((end - now) / DAY),
      suspendsAt: null,
      endsAt,
    };
  }
  const suspendAt = end + GRACE_DAYS * DAY;
  if (now < suspendAt) {
    return {
      status: "past_due",
      readOnly: false,
      daysLeft: 0,
      suspendsAt: new Date(suspendAt).toISOString(),
      endsAt,
    };
  }
  return { status: "suspended", readOnly: true, daysLeft: 0, suspendsAt: null, endsAt };
}
