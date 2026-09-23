/**
 * Phone normalisation for lead forms — shared by the form (instant feedback)
 * and the server function (the check that counts).
 *
 * Accepts what Saudi visitors actually type: Arabic-Indic or Persian digits,
 * spaces, dashes and brackets, a leading 00/+966/966/0, and returns E.164.
 * Saudi mobiles (5XXXXXXXX) and landlines (1X–7X area codes) are accepted;
 * any other `+` number of 8–15 digits is kept as-is for foreign clients.
 */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : PERSIAN.indexOf(d));
  });
}

export function normalizePhone(input: string): string | null {
  const raw = toLatinDigits(input.trim()).replace(/[\s\-().]/g, "");
  if (!raw) return null;
  const international = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/^\+|^00/, "");
  if (!/^\d+$/.test(digits)) return null;

  // Saudi national significant number: 9 digits, mobile 5X or landline 1X–7X.
  const saudi = digits.replace(/^966/, "").replace(/^0/, "");
  const isSaudiShape = /^[1-7]\d{8}$/.test(saudi);
  if (digits.startsWith("966") && isSaudiShape) return `+966${saudi}`;
  if (!international && isSaudiShape) return `+966${saudi}`;
  if (international && !digits.startsWith("966") && /^\d{8,15}$/.test(digits)) return `+${digits}`;
  return null;
}
