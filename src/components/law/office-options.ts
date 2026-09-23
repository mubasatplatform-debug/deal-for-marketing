/** Choices for the office forms (onboarding and settings). */

/** Saudi cities offered in the office forms (free text is still accepted by the server). */
export const CITIES = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الأحساء",
  "بريدة",
  "عنيزة",
  "الطائف",
  "تبوك",
  "أبها",
  "خميس مشيط",
  "حائل",
  "جازان",
  "نجران",
  "الجبيل",
  "ينبع",
  "الباحة",
  "سكاكا",
  "عرعر",
] as const;

export const TEAM_SIZE_OPTIONS = [
  { value: "1", label: "محامٍ مستقل" },
  { value: "2-5", label: "٢ – ٥ أشخاص" },
  { value: "6-10", label: "٦ – ١٠ أشخاص" },
  { value: "11-25", label: "١١ – ٢٥ شخصًا" },
  { value: "26+", label: "أكثر من ٢٥" },
] as const;

/** Arabic-Indic digits typed on an Arabic keyboard become Latin digits. */
export function toLatinDigits(v: string): string {
  return v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
