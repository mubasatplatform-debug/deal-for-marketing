/**
 * Arabic text helpers for reading office files — pure, shared by extraction,
 * search and tests.
 *
 * PDFs often store Arabic in presentation forms (ﻢﻜﺣ) and in visual order,
 * so a text layer reads back reversed: «4471 ﻢﻗر ﻢﻜﺣ ﻚﺻ» for «صك حكم رقم 4471».
 * `fixPdfArabic` folds the presentation forms (NFKC) and, when a page reads
 * reversed, flips each line back while keeping number and Latin runs intact.
 */

const ARABIC = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
/** Runs that keep their own left-to-right order inside a flipped line. */
const LTR_RUN = /[0-9A-Za-z\u0660-\u0669][0-9A-Za-z\u0660-\u0669/.,:-]*[0-9A-Za-z\u0660-\u0669]|[0-9A-Za-z\u0660-\u0669]/g;
/**
 * Base-form Arabic (not presentation forms): the PDF reader already put these
 * runs in logical order, so after flipping the line they are flipped back.
 */
const BASE_RUN = /[\u0600-\u065F\u066A-\u06FF]{2,}/g;

/** A visual-order line (raw, before NFKC) → logical order. */
function reverseLine(line: string): string {
  const flipped = [...line].reverse().join("");
  return flipped
    .replace(LTR_RUN, (run) => [...run].reverse().join(""))
    .replace(BASE_RUN, (run) => [...run].reverse().join(""));
}

/**
 * Whether Arabic words read backwards: the article «ال» turns up at word ends
 * («لا») far more than at word starts. Needs a handful of words to decide.
 */
export function looksReversed(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => ARABIC.test(w) && w.length >= 3);
  if (words.length < 4) return false;
  let starts = 0;
  let ends = 0;
  for (const w of words) {
    const bare = w.replace(/[^\u0621-\u064A]/g, "");
    if (/^ال/.test(bare)) starts += 1;
    // «ال» read backwards, also when the lam-alef ligature carried a hamza.
    if (/(ل[اأإآ]|ل[أإآ]ا)$/.test(bare)) ends += 1;
  }
  return ends >= 2 && ends > starts * 2;
}

/** One page of PDF text → readable logical-order Arabic. */
export function fixPdfArabic(page: string): string {
  const fold = (t: string) => t.normalize("NFKC").replace(/\u0640+/g, "");
  const lines = page.split(/\r?\n/);
  if (!looksReversed(fold(page))) return lines.map((l) => fold(l).trimEnd()).join("\n").trim();
  // Flip first, fold after: a lam-alef ligature must expand in the right order.
  return lines
    .map((l) => fold(ARABIC.test(l) ? reverseLine(l.trim()) : l.trim()))
    .join("\n")
    .trim();
}

/** Search form of a word or text: no diacritics or tatweel, one alef, ya and ta marbuta folded. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase();
}

const STOP = new Set(
  [
    "في", "من", "على", "الى", "إلى", "عن", "ما", "ماذا", "هل", "هو", "هي", "ان", "أن", "إن", "او", "أو", "مع",
    "هذا", "هذه", "ذلك", "تلك", "التي", "الذي", "كان", "كانت", "لم", "لا", "قد", "كل", "بين", "بعد", "قبل",
    "عند", "حتى", "ثم", "اي", "أي", "كيف", "متى", "اين", "أين", "لماذا", "the", "a", "of", "and", "to",
  ].map(normalizeForSearch),
);

/** Content terms of a question: normalized, stop words and the article dropped. */
export function searchTerms(text: string): string[] {
  const out = new Set<string>();
  for (const raw of normalizeForSearch(text).split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOP.has(raw)) continue;
    let w = raw;
    for (const p of ["وال", "بال", "كال", "فال", "لل", "ال"]) {
      if (w.startsWith(p) && w.length - p.length >= 2) {
        w = w.slice(p.length);
        break;
      }
    }
    if (w.length >= 2) out.add(w);
  }
  return [...out];
}

export type Chunk = { source: number; page: number; text: string };

/** Split pages into chunks of about `size` characters on paragraph/line breaks. */
export function chunkPages(source: number, pages: string[], size = 1800): Chunk[] {
  const out: Chunk[] = [];
  pages.forEach((page, i) => {
    const parts = page.split(/\n{2,}|\n/);
    let buf = "";
    for (const part of parts) {
      if (buf && buf.length + part.length + 1 > size) {
        out.push({ source, page: i + 1, text: buf.trim() });
        buf = "";
      }
      if (part.length > size) {
        for (let at = 0; at < part.length; at += size) out.push({ source, page: i + 1, text: part.slice(at, at + size).trim() });
        continue;
      }
      buf += (buf ? "\n" : "") + part;
    }
    if (buf.trim()) out.push({ source, page: i + 1, text: buf.trim() });
  });
  return out.filter((c) => c.text.length > 0);
}

/**
 * Pick the excerpts a question needs within `budget` characters: everything
 * when it all fits, otherwise the chunks sharing the most question terms
 * (ties: document order), always keeping each source's first chunk so the
 * model knows what every document is. Returned in document order.
 */
export function selectChunks(chunks: Chunk[], question: string, budget: number): Chunk[] {
  const total = chunks.reduce((n, c) => n + c.text.length, 0);
  if (total <= budget) return chunks;
  const terms = searchTerms(question);
  const scored = chunks.map((c, i) => {
    const hay = normalizeForSearch(c.text);
    let score = 0;
    for (const t of terms) {
      let at = hay.indexOf(t);
      let hits = 0;
      while (at !== -1 && hits < 5) {
        hits += 1;
        at = hay.indexOf(t, at + t.length);
      }
      if (hits) score += 1 + Math.log2(hits + 1);
    }
    return { c, i, score };
  });
  const picked = new Set<number>();
  let used = 0;
  const firstOf = new Map<number, number>();
  scored.forEach(({ c, i }) => {
    if (!firstOf.has(c.source)) firstOf.set(c.source, i);
  });
  for (const i of firstOf.values()) {
    const len = scored[i].c.text.length;
    if (used + len > budget) continue;
    picked.add(i);
    used += len;
  }
  for (const s of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (picked.has(s.i)) continue;
    if (s.score === 0 && terms.length) break;
    if (used + s.c.text.length > budget) continue;
    picked.add(s.i);
    used += s.c.text.length;
  }
  return [...picked].sort((a, b) => a - b).map((i) => chunks[i]);
}

export type Citation = { source: number; page: number };

/**
 * Citations the model wrote as [م2 ص5] / [م2، ص5] / [م2] (document 2, page 5),
 * in order of first appearance, limited to known sources.
 */
export function parseCitations(answer: string, sourceCount: number): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const m of answer.matchAll(/\[\s*م\s*([0-9٠-٩]+)(?:\s*[،,]?\s*ص\s*([0-9٠-٩]+))?\s*\]/g)) {
    const n = (s: string | undefined) => (s ? Number(normalizeForSearch(s)) : 0);
    const source = n(m[1]);
    const page = n(m[2]);
    if (source < 1 || source > sourceCount) continue;
    const key = `${source}:${page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source, page });
  }
  return out;
}
