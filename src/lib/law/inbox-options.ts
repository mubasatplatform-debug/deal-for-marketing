/**
 * «مركز التواصل» vocabulary — pure (no app aliases), shared by the inbox
 * core, the server functions and the UI: conversation statuses, request
 * intents, the list tabs, and who may do what.
 */
import { roleAtLeast, type Role } from "../saas/lifecycle.ts";

export const CONV_STATUSES = ["bot", "open", "pending", "closed"] as const;
export type ConvStatus = (typeof CONV_STATUSES)[number];
export const CONV_STATUS_LABELS: Record<ConvStatus, string> = {
  bot: "يرد المساعد الآلي",
  open: "بانتظار الفريق",
  pending: "بانتظار العميل",
  closed: "مغلقة",
};

export const INTENTS = ["new_consultation", "case_followup", "fees", "appointment", "other"] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABELS: Record<Intent, string> = {
  new_consultation: "استشارة جديدة",
  case_followup: "متابعة قضية",
  fees: "استفسار أتعاب",
  appointment: "موعد",
  other: "أخرى",
};

export const INBOX_TABS = ["all", "unassigned", "mine", "closed"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];
export const INBOX_TAB_LABELS: Record<InboxTab, string> = {
  all: "الكل",
  unassigned: "غير مسند",
  mine: "لي",
  closed: "مغلقة",
};

/**
 * Who may do what in the inbox (lowest role; higher roles inherit):
 * everyone in the office reads and answers the shared inbox; admins and
 * owners manage its settings and the quick replies.
 */
const INBOX_ROLES = {
  view: "staff",
  reply: "staff",
  settings: "admin",
  quickReplies: "admin",
} as const satisfies Record<string, Role>;
export type InboxAction = keyof typeof INBOX_ROLES;

export function canInbox(role: Role, action: InboxAction): boolean {
  return roleAtLeast(role, INBOX_ROLES[action]);
}
