/**
 * Who may do what in the practice modules — pure (no app aliases), shared by
 * the server (the check that counts) and the UI (hide what you cannot do).
 *
 * Each action names the LOWEST role allowed; higher roles inherit it
 * (owner > admin > lawyer > staff, see saas/lifecycle.ts). The few rules that
 * also depend on ownership ("your own note") are the `*Own` helpers below.
 *
 * In words:
 *   staff  — reception: clients, appointments, consultations (booking and
 *            status), tasks, uploads. No fees, no private call notes, no
 *            deleting records, no case edits.
 *   lawyer — the legal work: cases, hearings, fees, documents, running video
 *            consultations and their private notes, the client portal link
 *            and what it shares.
 *   admin  — deletes records, office booking settings.
 *   owner  — everything admin can (plus the subscription, phase 1).
 */
import { roleAtLeast, type Role } from "../saas/lifecycle.ts";

export const PERMISSIONS = {
  "client.view": "staff",
  "client.create": "staff",
  "client.edit": "staff",
  "client.delete": "admin",
  // The client portal link and which documents it shows (portal-core.ts).
  "client.portal": "lawyer",

  "case.view": "staff",
  "case.create": "lawyer",
  "case.edit": "lawyer",
  "case.delete": "admin",
  "case.fees.view": "lawyer",

  "hearing.manage": "lawyer",

  "task.create": "staff",
  "task.complete": "staff",
  "task.edit": "lawyer",
  "task.delete": "lawyer",

  "note.create": "staff",
  "note.delete": "admin",

  "appointment.view": "staff",
  "appointment.manage": "staff",
  "appointment.delete": "admin",

  "consult.manage": "staff",
  "consult.notes": "lawyer",
  "consult.host": "lawyer",
  "consult.outcome": "lawyer",

  "document.view": "staff",
  "document.upload": "staff",
  "document.delete": "lawyer",

  "settings.booking": "admin",
} as const satisfies Record<string, Role>;

export type Action = keyof typeof PERMISSIONS;

export const ACTIONS = Object.keys(PERMISSIONS) as Action[];

export function can(role: Role, action: Action): boolean {
  return roleAtLeast(role, PERMISSIONS[action]);
}

/** Notes: an author may delete their own; admins may delete any. */
export function canDeleteNote(role: Role, userId: string, authorId: string | null): boolean {
  return can(role, "note.delete") || (authorId !== null && authorId === userId);
}

/** Tasks: the creator or assignee may edit their own; lawyers and up any. */
export function canEditTask(
  role: Role,
  userId: string,
  task: { created_by: string | null; assignee_id: string | null },
): boolean {
  return can(role, "task.edit") || task.created_by === userId || task.assignee_id === userId;
}

/**
 * Hosting a video consultation (join as the host, admit the client, write
 * private notes): the assigned lawyer, or any admin/owner. Another lawyer of
 * the office may not open a colleague's call.
 */
export function canHostConsult(role: Role, userId: string, lawyerId: string | null): boolean {
  if (!can(role, "consult.host")) return false;
  return roleAtLeast(role, "admin") || lawyerId === null || lawyerId === userId;
}

/** Everything a role may do, for the UI and the report. */
export function allowedActions(role: Role): Action[] {
  return ACTIONS.filter((a) => can(role, a));
}
