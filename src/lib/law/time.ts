/**
 * Riyadh calendar arithmetic — pure. Saudi Arabia is UTC+3 all year (no DST),
 * so a fixed offset is exact and keeps server and browser in agreement no
 * matter where either runs.
 *
 * Wall-clock values travel as strings: a day is 'YYYY-MM-DD', a time 'HH:MM'
 * (both Riyadh). Instants travel as ISO strings (UTC).
 */
export const RIYADH_OFFSET_MIN = 180;
const MIN = 60_000;
const DAY = 86_400_000;

export const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The Riyadh calendar day of an instant. */
export function riyadhYmd(at: Date | number | string = Date.now()): string {
  const t = typeof at === "number" ? at : new Date(at).getTime();
  return new Date(t + RIYADH_OFFSET_MIN * MIN).toISOString().slice(0, 10);
}

/** Minutes after Riyadh midnight of an instant. */
export function riyadhMinutes(at: Date | number | string): number {
  const t = typeof at === "number" ? at : new Date(at).getTime();
  const d = new Date(t + RIYADH_OFFSET_MIN * MIN);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** 'HH:MM' in Riyadh. */
export function riyadhHm(at: Date | number | string): string {
  const m = riyadhMinutes(at);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** UTC ms of Riyadh midnight starting `ymd`. */
export function riyadhDayStart(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`) - RIYADH_OFFSET_MIN * MIN;
}

/** The instant of a Riyadh wall-clock day + minutes after midnight. */
export function riyadhAt(ymd: string, minutes: number): number {
  return riyadhDayStart(ymd) + minutes * MIN;
}

/** 'YYYY-MM-DD' + 'HH:MM' (Riyadh) -> ISO instant. Null when malformed. */
export function riyadhToIso(ymd: string, hm: string): string | null {
  if (!YMD_RE.test(ymd) || !HM_RE.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  const t = riyadhAt(ymd, h * 60 + m);
  // Reject impossible days (2026-02-31 would roll over).
  if (riyadhYmd(t) !== ymd) return null;
  return new Date(t).toISOString();
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHm(min: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

/** The Sunday that starts the (Saudi) week of `ymd`. */
export function weekStart(ymd: string): string {
  return addDays(ymd, -weekday(ymd));
}

export function isYmd(v: unknown): v is string {
  return typeof v === "string" && YMD_RE.test(v) && riyadhYmd(riyadhDayStart(v)) === v;
}
