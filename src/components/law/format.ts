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
