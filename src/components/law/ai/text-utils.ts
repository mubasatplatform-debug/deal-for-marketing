const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** «١٢» → «12». */
export const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/** The (document, page) pairs a citation marker names: [م2 ص5], [م1 ص3، م4 ص1], [م2 جزء 3], [م3]. */
export function parseMarker(raw: string): { n: number; page: number }[] {
  const out: { n: number; page: number }[] = [];
  for (const m of toLatinDigits(raw).matchAll(/م\s*(\d+)(?:\s*[،,]?\s*(?:ص|صفحة|جزء)\s*(\d+))?/g)) {
    out.push({ n: Number(m[1]), page: m[2] ? Number(m[2]) : 0 });
  }
  return out;
}
