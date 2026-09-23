/**
 * Free booking slots — pure, so the rules are unit-tested and the server and
 * the booking page agree. The server computes them (it knows everyone's busy
 * time); the page only renders the result, and the booking itself is
 * re-checked under a database lock (`law_book_slot`).
 *
 * A slot [start, start + slotMinutes) on a working day, inside working hours,
 * is free for a lawyer when none of their busy intervals comes closer than
 * `bufferMinutes` to it. Slots before `now + minNoticeMinutes` are never
 * offered. All wall-clock values are Riyadh time (see time.ts).
 */
import { addDays, riyadhAt, riyadhYmd, weekday } from "./time.ts";

export type Availability = {
  /** 0 = Sunday … 6 = Saturday. */
  workDays: number[];
  /** Minutes after Riyadh midnight. */
  dayStart: number;
  dayEnd: number;
  slotMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
};

export const DEFAULT_AVAILABILITY: Availability = {
  workDays: [0, 1, 2, 3, 4],
  dayStart: 9 * 60,
  dayEnd: 17 * 60,
  slotMinutes: 30,
  bufferMinutes: 10,
  minNoticeMinutes: 120,
  horizonDays: 21,
};

/** Busy time of one member (UTC ms). */
export type Busy = { lawyerId: string; start: number; end: number };

export type Slot = {
  /** ISO instants. */
  start: string;
  end: string;
  /** Riyadh 'HH:MM'. */
  time: string;
  /** Candidate lawyers free for the whole slot, in the input order. */
  lawyers: string[];
};

export type SlotDay = { date: string; weekday: number; slots: Slot[] };

const MIN = 60_000;

function overlaps(busy: Busy, start: number, end: number, bufferMs: number): boolean {
  return busy.start < end + bufferMs && busy.end > start - bufferMs;
}

/** Lawyers (of `lawyers`) free for [start, end) given busy time and a buffer. */
export function freeLawyers(
  lawyers: readonly string[],
  busy: readonly Busy[],
  start: number,
  end: number,
  bufferMinutes: number,
): string[] {
  const buf = bufferMinutes * MIN;
  return lawyers.filter((id) => !busy.some((b) => b.lawyerId === id && overlaps(b, start, end, buf)));
}

/**
 * Free slots for `days` Riyadh days starting `fromYmd` (clamped to today and
 * to the booking horizon). Days without a free slot are still returned (with
 * `slots: []`) for working days, so the page can show "no times left".
 */
export function computeSlots(input: {
  availability: Availability;
  lawyers: readonly string[];
  busy: readonly Busy[];
  now: number;
  fromYmd?: string;
  days?: number;
}): SlotDay[] {
  const a = input.availability;
  const today = riyadhYmd(input.now);
  const lastDay = addDays(today, a.horizonDays - 1);
  let day = input.fromYmd && input.fromYmd > today ? input.fromYmd : today;
  const count = Math.max(1, Math.min(input.days ?? a.horizonDays, 62));
  const earliest = input.now + a.minNoticeMinutes * MIN;
  const out: SlotDay[] = [];
  if (input.lawyers.length === 0 || a.slotMinutes <= 0 || a.dayEnd <= a.dayStart) return out;
  for (let i = 0; i < count && day <= lastDay; i += 1, day = addDays(day, 1)) {
    const wd = weekday(day);
    if (!a.workDays.includes(wd)) continue;
    const slots: Slot[] = [];
    for (let m = a.dayStart; m + a.slotMinutes <= a.dayEnd; m += a.slotMinutes) {
      const start = riyadhAt(day, m);
      const end = start + a.slotMinutes * MIN;
      if (start < earliest) continue;
      const lawyers = freeLawyers(input.lawyers, input.busy, start, end, a.bufferMinutes);
      if (lawyers.length === 0) continue;
      slots.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        time: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
        lawyers,
      });
    }
    out.push({ date: day, weekday: wd, slots });
  }
  return out;
}

/**
 * Is `startIso` one of the offered slot starts (on the grid, a working day,
 * inside hours, after the notice, within the horizon)? The booking server fn
 * refuses anything else before it tries to reserve.
 */
export function isOfferedStart(availability: Availability, startIso: string, now: number): boolean {
  const t = Date.parse(startIso);
  if (!Number.isFinite(t)) return false;
  const day = riyadhYmd(t);
  const today = riyadhYmd(now);
  if (day < today || day > addDays(today, availability.horizonDays - 1)) return false;
  if (!availability.workDays.includes(weekday(day))) return false;
  if (t < now + availability.minNoticeMinutes * MIN) return false;
  const minute = Math.round((t - riyadhAt(day, 0)) / MIN);
  if ((t - riyadhAt(day, 0)) % MIN !== 0) return false;
  if (minute < availability.dayStart || minute + availability.slotMinutes > availability.dayEnd) return false;
  return (minute - availability.dayStart) % availability.slotMinutes === 0;
}
