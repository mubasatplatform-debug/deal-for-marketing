import type { Risk } from "@/lib/law/ai/review-core";

/** «مراجعة العقود» — client-safe vocabulary (risk labels and colors, reviewable files, quick sides). */

export const REVIEW_DISCLAIMER = "مراجعة آلية أولية — تحتاج مراجعة المحامي قبل الاعتماد عليها.";

export const RISK_ORDER: Risk[] = ["red", "yellow", "green"];

export const RISK_LABEL: Record<Risk, string> = {
  green: "مقبول",
  yellow: "يحتاج تفاوضًا",
  red: "خطر مرتفع",
};

/** Colors per risk: pill, the stripe on the start side, soft panel. */
export const RISK_STYLE: Record<Risk, { pill: string; stripe: string; soft: string; text: string; dot: string }> = {
  green: {
    pill: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    stripe: "bg-emerald-500",
    soft: "bg-emerald-50 ring-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  yellow: {
    pill: "bg-amber-50 text-amber-800 ring-amber-200",
    stripe: "bg-amber-400",
    soft: "bg-amber-50 ring-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-400",
  },
  red: {
    pill: "bg-red-50 text-red-700 ring-red-200",
    stripe: "bg-red-600",
    soft: "bg-red-50 ring-red-200",
    text: "text-red-700",
    dot: "bg-red-600",
  },
};

/** File types the review can read (same rule as the server). */
const REVIEWABLE_RE = /\.(pdf|docx|jpe?g|png|webp)$/i;
export const isReviewable = (name: string) => REVIEWABLE_RE.test(name);

export const PERSPECTIVE_CHIPS = [
  "المشتري",
  "البائع / المورد",
  "مقدم الخدمة",
  "العميل",
  "صاحب العمل",
  "الموظف",
  "المؤجر",
  "المستأجر",
] as const;
