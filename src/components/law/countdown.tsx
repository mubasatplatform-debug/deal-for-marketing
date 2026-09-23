import { useEffect, useState } from "react";

/** Current time, ticking every `ms` (default 1 s). */
export function useNow(ms = 1000, offset = 0): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(t);
  }, [ms, offset]);
  return now;
}

/** "بعد 3 أيام" / "بعد 2 س 05 د" / "بعد 04:12" — until `target` (ms). */
export function untilAr(target: number, now: number): string {
  const s = Math.max(0, Math.round((target - now) / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d >= 2) return `بعد ${d} أيام`;
  if (d === 1) return `بعد يوم و${h} ساعة`;
  if (h > 0) return `بعد ${h} س ${String(m).padStart(2, "0")} د`;
  return `بعد ${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Join window: opens 10 minutes before the start, closes 30 minutes after the end. */
export function windowOf(startsAt: string, endsAt: string, now: number) {
  const opens = Date.parse(startsAt) - 10 * 60_000;
  const closes = Date.parse(endsAt) + 30 * 60_000;
  return { opens, closes, state: now < opens ? ("early" as const) : now > closes ? ("ended" as const) : ("open" as const) };
}
