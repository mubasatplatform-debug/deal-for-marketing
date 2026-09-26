/**
 * «مركز الاتصال» vocabulary — pure (no app aliases), shared by the calls core,
 * the server functions and the UI: call statuses and their labels, the
 * relay's status names, Saudi-number validation and duration formatting.
 */
import { normalizePhone } from "../phone.ts";

export const CALL_STATUSES = [
  "queued",
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "busy",
  "no_answer",
  "failed",
  "canceled",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const TERMINAL_STATUSES: readonly CallStatus[] = ["completed", "busy", "no_answer", "failed", "canceled"];

export function isTerminal(status: CallStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Progress order: a call only ever moves forward (terminal states are final). */
export function statusRank(status: CallStatus): number {
  switch (status) {
    case "queued":
      return 0;
    case "initiated":
      return 1;
    case "ringing":
      return 2;
    case "in_progress":
      return 3;
    default:
      return 4;
  }
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  queued: "قيد البدء",
  initiated: "جارٍ الاتصال",
  ringing: "يرن",
  in_progress: "متصل",
  completed: "مكتملة",
  busy: "مشغول",
  no_answer: "لم يُرد",
  failed: "تعذّر الاتصال",
  canceled: "أُلغيت",
};

/** The relay (Twilio) status names → ours; unknown names → null. */
export function mapRelayStatus(status: string): CallStatus | null {
  switch (status) {
    case "queued":
      return "queued";
    case "initiated":
      return "initiated";
    case "ringing":
      return "ringing";
    case "in-progress":
    case "answered":
      return "in_progress";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no_answer";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}

/** Saudi E.164 as the relay accepts it: mobiles and landlines, nothing else. */
export const SAUDI_E164 = /^\+966[1-9]\d{7,8}$/;

/**
 * A Saudi number in E.164 from what people type (05…, 5…, 9665…, +966…,
 * Arabic-Indic digits, spaces), or null for anything else — foreign numbers
 * included, since the relay only dials inside Saudi Arabia.
 */
export function saudiPhone(input: string): string | null {
  const e164 = normalizePhone(input);
  return e164 && SAUDI_E164.test(e164) ? e164 : null;
}

/** "3:12" / "1:02:05" for a duration in seconds. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Per-member and per-office call caps (outbound calls cost the office money). */
export const CALLS_PER_USER_HOUR = 60;
export const CALLS_PER_OFFICE_DAY = 200;
