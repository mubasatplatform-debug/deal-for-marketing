/**
 * Row helpers for the practice cores — pure. Drivers differ (pg vs PGLite):
 * timestamps arrive as Date, int8 as number or BigInt. Everything a core
 * returns goes through `plain`, so server functions hand the browser JSON-safe
 * rows with ISO strings and plain numbers, identical on both databases.
 */
export function plain<T>(value: unknown): T {
  return convert(value) as T;
}

function convert(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (Array.isArray(v)) return v.map(convert);
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = convert(x);
    return out;
  }
  return v;
}

export function plainRows<T>(rows: unknown[]): T[] {
  return rows.map((r) => plain<T>(r));
}

/** Escape LIKE wildcards in user search text. */
export function likeEscape(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const PAGE_SIZE = 20;
