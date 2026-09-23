/**
 * «مكتب المحامي» plans — the ONE place prices, seat limits and feature flags
 * live. Pure data + helpers (no app aliases), so node tests import it directly
 * and both the server (checkout, seat checks) and the client (pricing, billing)
 * read the same numbers.
 *
 * DRAFT PRICES — placeholders for the owner to set. Every amount below is a
 * draft in Saudi riyals, EXCLUDING 15% VAT, and has not been approved. Change
 * the numbers here only; nothing else hard-codes a price.
 */

export type PlanId = "basic" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export type FeatureFlag =
  | "team"
  | "appointments"
  | "clients"
  | "cases"
  | "documents"
  | "videoSessions"
  | "aiDrafting"
  | "multiBranch"
  | "prioritySupport";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** SAR per month / per year, excluding VAT. DRAFT. */
  price: Record<BillingCycle, number>;
  /** Members + pending invites allowed in the workspace. */
  seats: number;
  features: Record<FeatureFlag, boolean>;
  highlight?: boolean;
};

/** Saudi VAT, applied on top of the plan price at checkout. */
export const VAT_RATE = 0.15;

/** Free-trial length for a new office, and the plan it trials. */
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: PlanId = "pro";

/**
 * Days a lapsed office (trial or paid period ended) keeps full access with a
 * warning before it turns read-only. Nothing is ever deleted automatically.
 */
export const GRACE_DAYS = 7;

/** Pending invites expire after this many days. */
export const INVITE_TTL_DAYS = 7;

/** Offices one person may own (abuse guard on sign-up). */
export const MAX_OWNED_WORKSPACES = 5;

// DRAFT: prices, seat limits and feature split are placeholders for the owner.
export const PLANS: readonly Plan[] = [
  {
    id: "basic",
    name: "أساسي",
    tagline: "للمحامي المستقل والمكتب الناشئ",
    price: { monthly: 199, yearly: 1990 },
    seats: 3,
    features: {
      team: true,
      appointments: true,
      clients: true,
      cases: true,
      documents: true,
      videoSessions: false,
      aiDrafting: false,
      multiBranch: false,
      prioritySupport: false,
    },
  },
  {
    id: "pro",
    name: "احترافي",
    tagline: "للمكاتب التي تدير فريقًا وقضايا متعددة",
    price: { monthly: 499, yearly: 4990 },
    seats: 10,
    highlight: true,
    features: {
      team: true,
      appointments: true,
      clients: true,
      cases: true,
      documents: true,
      videoSessions: true,
      aiDrafting: true,
      multiBranch: false,
      prioritySupport: false,
    },
  },
  {
    id: "enterprise",
    name: "مؤسسي",
    tagline: "لشركات المحاماة والفروع المتعددة",
    price: { monthly: 1299, yearly: 12990 },
    seats: 40,
    features: {
      team: true,
      appointments: true,
      clients: true,
      cases: true,
      documents: true,
      videoSessions: true,
      aiDrafting: true,
      multiBranch: true,
      prioritySupport: true,
    },
  },
] as const;

export const PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];

export const FEATURE_LABELS: Record<FeatureFlag, string> = {
  team: "الفريق والصلاحيات",
  appointments: "المواعيد والحجوزات",
  clients: "ملفات العملاء",
  cases: "إدارة القضايا",
  documents: "العقود والمستندات",
  videoSessions: "جلسات الفيديو",
  aiDrafting: "مساعد الصياغة بالذكاء الاصطناعي",
  multiBranch: "تعدد الفروع",
  prioritySupport: "دعم بأولوية ومدير حساب",
};

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "شهري",
  yearly: "سنوي",
};

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && PLANS.some((p) => p.id === v);
}

/** The plan by id; an unknown id (e.g. a plan retired later) falls back to basic. */
export function getPlan(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function seatLimit(planId: string): number {
  return getPlan(planId).seats;
}

/** Amounts in halalas (1 SAR = 100 halalas), rounded once, so totals always add up. */
export function quote(planId: PlanId, cycle: BillingCycle) {
  const plan = getPlan(planId);
  const subtotal = Math.round(plan.price[cycle] * 100);
  const vat = Math.round(subtotal * VAT_RATE);
  return { plan, cycle, subtotal, vat, total: subtotal + vat, currency: "SAR" as const };
}

/** Yearly saving vs. twelve monthly payments, as a whole percentage. */
export function yearlySavingPct(plan: Plan): number {
  const full = plan.price.monthly * 12;
  return full > 0 ? Math.round(((full - plan.price.yearly) / full) * 100) : 0;
}
