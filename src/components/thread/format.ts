/** Dates in the thread: Riyadh calendar days, Gregorian, Latin digits. */
const TZ = "Asia/Riyadh";
const LOCALE = "ar-SA-u-nu-latn-ca-gregory";

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const dayYearFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** 'YYYY-MM-DD' of the Riyadh calendar day. */
export function riyadhDay(d: Date): string {
  return keyFmt.format(d);
}

/** "اليوم" / "أمس" / "الأحد، 21 سبتمبر" (year added when not this year). */
export function dayLabel(d: Date, now: Date): string {
  const key = riyadhDay(d);
  if (key === riyadhDay(now)) return "اليوم";
  if (key === riyadhDay(new Date(now.getTime() - 86_400_000))) return "أمس";
  return key.slice(0, 4) === riyadhDay(now).slice(0, 4) ? dayFmt.format(d) : dayYearFmt.format(d);
}

export const timeLabel = (d: Date) => timeFmt.format(d);
export const fullLabel = (d: Date) => fullFmt.format(d);

/** Arabic count of messages: رسالة / رسالتان / 3 رسائل / 11 رسالة. */
export function messagesWord(n: number): string {
  if (n === 1) return "رسالة جديدة";
  if (n === 2) return "رسالتان جديدتان";
  if (n >= 3 && n <= 10) return `${n} رسائل جديدة`;
  return `${n} رسالة جديدة`;
}
