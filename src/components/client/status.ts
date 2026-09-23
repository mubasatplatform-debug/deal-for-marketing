import { phone, requestStatus } from "@/lib/content";

/** Ordered lifecycle of a request, as the team moves it in /admin. */
export const STEPS = ["new", "review", "production", "delivered"] as const;
export type Step = (typeof STEPS)[number];

export const TEAM_EMAIL = "info@dealadv.sa";

/** Index of a status on the tracker; unknown values sit on the first step. */
export function stepIndex(status: string): number {
  const i = (STEPS as readonly string[]).indexOf(status);
  return i < 0 ? 0 : i;
}

export function statusLabel(status: string): string {
  return requestStatus[status] ?? status;
}

export function waLink(text: string): string {
  return `${phone.wa}?text=${encodeURIComponent(text)}`;
}

export function followUpText(id?: number): string {
  return id
    ? `السلام عليكم فريق ديل، أتابع طلبي رقم #${id}.`
    : "السلام عليكم فريق ديل، عندي استفسار عن طلب.";
}
