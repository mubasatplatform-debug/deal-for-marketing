/** Arabic wording and figure formatting for «مكتب المحامي» screens. */

/** "يوم واحد" / "يومان" / "٣ أيام" / "١٢ يومًا" — with Latin digits like the rest of the UI. */
export function daysAr(n: number): string {
  if (n <= 0) return "أقل من يوم";
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  if (n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

export function membersAr(n: number): string {
  if (n === 1) return "عضو واحد";
  if (n === 2) return "عضوان";
  if (n <= 10) return `${n} أعضاء`;
  return `${n} عضوًا`;
}

/** 23 سبتمبر 2026 (Gregorian, Riyadh time). */
export function dateAr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

const RIYADH = "Asia/Riyadh";
const AR = "ar-SA-u-ca-gregory-nu-latn";

/** "10:30 ص" (Riyadh). */
export function timeAr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(AR, { hour: "numeric", minute: "2-digit", timeZone: RIYADH });
}

/** "الأحد 27 سبتمبر" (Riyadh). */
export function dayAr(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(AR, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: RIYADH,
  });
}

/** "27 سبتمبر" (Riyadh). */
export function shortDateAr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(AR, { day: "numeric", month: "short", timeZone: RIYADH });
}

/** "الأحد 27 سبتمبر · 10:30 ص". */
export function whenAr(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${dayAr(iso)} · ${timeAr(iso)}`;
}

/** Riyadh 'YYYY-MM-DD' of an ISO instant (for date inputs). */
export function ymdOf(iso: string): string {
  return new Date(Date.parse(iso) + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Riyadh 'HH:MM' of an ISO instant (for time inputs). */
export function hmOf(iso: string): string {
  return new Date(Date.parse(iso) + 3 * 3_600_000).toISOString().slice(11, 16);
}

/** "+966 50 123 4567" for display (E.164 stays the stored value). */
export function phoneAr(e164: string | null | undefined): string {
  if (!e164) return "—";
  const m = /^\+966(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (m) return `0${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}

/** Riyals text (Arabic-Indic digits and separators accepted) -> halalas, or null. */
export function toHalalas(text: string): number | null {
  const t = text
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
  if (t === "") return 0;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Minutes -> "30 دقيقة" / "ساعة" / "ساعة ونصف". */
export function durationAr(min: number): string {
  if (min === 60) return "ساعة";
  if (min === 90) return "ساعة ونصف";
  if (min === 120) return "ساعتان";
  if (min > 60 && min % 60 === 0) return `${min / 60} ساعات`;
  return `${min} دقيقة`;
}

/** Halalas -> "1,234.50". */
export function sar(halalas: number, digits = 2): string {
  return (halalas / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Whole riyals -> "1,234". */
export function riyals(n: number): string {
  return n.toLocaleString("en-US");
}

/** 'YYYY-MM-DD' of today + `days`, in Riyadh. */
export function ymdFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

/** The tile letter for an office: skips a leading generic word ("مكتب", "شركة"…). */
export function officeInitial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const generic = /^(مكتب|شركة|مؤسسة|مجموعة)$/;
  const word = words.find((w) => !generic.test(w)) ?? words[0] ?? "";
  return word.replace(/^ال(?=\S{2,})/, "").charAt(0);
}
