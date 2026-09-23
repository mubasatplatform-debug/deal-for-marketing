import { mobile, requestStatus } from "@/lib/content";
import type { Tone } from "@/components/dash/ui";

/** Ordered lifecycle of a request, as the team moves it in /admin. */
export const STEPS = ["new", "review", "production", "delivered"] as const;
export type Step = (typeof STEPS)[number];

export const TEAM_EMAIL = "info@mubasat.net";

/** Index of a status on the stepper; unknown values sit on the first step. */
export function stepIndex(status: string): number {
  const i = (STEPS as readonly string[]).indexOf(status);
  return i < 0 ? 0 : i;
}

export function isDelivered(status: string): boolean {
  return stepIndex(status) === STEPS.length - 1;
}

export function statusLabel(status: string): string {
  return requestStatus[status] ?? requestStatus.new;
}

/** Pill tone per step: quiet while waiting, lime while we work, pine when done. */
export function statusTone(status: string): Tone {
  return (["neutral", "pine", "lime", "neutral"] as const)[stepIndex(status)];
}

/** What happens next, in the client's words. */
export function nextStepText(status: string): string {
  return [
    "فريق ديل يراجع طلبك ويتواصل معك خلال يوم عمل.",
    "نراجع التفاصيل معك ونجهّز خطة التنفيذ قبل البدء.",
    "فريقنا يعمل على طلبك الآن، ونحدّث الحالة هنا مع كل مرحلة.",
    "تم تسليم طلبك. سعدنا بالعمل معك.",
  ][stepIndex(status)];
}

/** WhatsApp runs on the mobile line. */
const WA_BASE = `https://wa.me/${mobile.wa}`;

export function waLink(text: string): string {
  return `${WA_BASE}?text=${encodeURIComponent(text)}`;
}

export function followUpText(id?: number, service?: string): string {
  if (!id) return "السلام عليكم فريق ديل، عندي استفسار عن طلب.";
  return `السلام عليكم فريق ديل، أتابع طلبي رقم #${id}${service ? ` (${service})` : ""}.`;
}

/** "لديك طلبان قيد التنفيذ" — Arabic number agreement for 1, 2, 3–10, 11+. */
export function activeSummary(active: number, total: number): string {
  if (total === 0) return "لم ترسل أي طلب بعد.";
  if (active === 0) return "كل طلباتك تم تسليمها. نحن هنا متى احتجتنا.";
  if (active === 1) return "لديك طلب واحد قيد التنفيذ.";
  if (active === 2) return "لديك طلبان قيد التنفيذ.";
  if (active <= 10) return `لديك ${active} طلبات قيد التنفيذ.`;
  return `لديك ${active} طلبًا قيد التنفيذ.`;
}
