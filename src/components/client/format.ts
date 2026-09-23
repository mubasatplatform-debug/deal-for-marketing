const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  day: "numeric",
  month: "long",
});
const fullDateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const relFmt = new Intl.RelativeTimeFormat("ar-u-nu-latn", { numeric: "auto" });

const DAY = 86_400_000;

function toDate(value: string | Date): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 سبتمبر" — the year is added only when it isn't the current one. */
export function formatDate(value: string | Date, now = new Date()): string {
  const d = toDate(value);
  if (!d) return "";
  return d.getFullYear() === now.getFullYear() ? dateFmt.format(d) : fullDateFmt.format(d);
}

export function isoDate(value: string | Date): string | undefined {
  return toDate(value)?.toISOString();
}

/** "اليوم", "أمس", "قبل 3 أيام"; falls back to the date after four weeks. */
export function relativeDate(value: string | Date, now = new Date()): string {
  const d = toDate(value);
  if (!d) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / DAY);
  if (days <= 0) return "اليوم";
  if (days < 7) return relFmt.format(-days, "day");
  if (days < 28) return relFmt.format(-Math.floor(days / 7), "week");
  return formatDate(d, now);
}
