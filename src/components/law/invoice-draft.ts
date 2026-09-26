import { toHalalas } from "@/components/law/format";
import { computeInvoice, type LineInput, type VatRate } from "@/lib/law/invoices-core";

/**
 * Draft invoice lines as typed in the form (strings), turned into the inputs
 * the server takes, with per-line errors and live totals that use the same
 * per-line rounding as the server (invoices-core.ts).
 */

export type DraftLine = { key: string; description: string; qty: string; price: string; rate: VatRate; reason: string };

let seq = 0;
export function newLine(init: Partial<Omit<DraftLine, "key">> = {}): DraftLine {
  seq += 1;
  return { key: `l${seq}`, description: "", qty: "1", price: "", rate: 15, reason: "", ...init };
}

const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, ".");

function parseQty(v: string): number | null {
  const t = latin(v.trim());
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 100_000 ? n : null;
}

export type LineErrors = Record<string, Partial<Record<"description" | "qty" | "price" | "reason", string>>>;

/** Draft lines -> inputs (what the server takes) and per-line errors. */
export function parseLines(lines: DraftLine[]): { inputs: LineInput[]; errors: LineErrors; ok: boolean } {
  const errors: LineErrors = {};
  const inputs: LineInput[] = [];
  for (const l of lines) {
    const e: LineErrors[string] = {};
    const qty = parseQty(l.qty);
    const price = l.price.trim() === "" ? null : toHalalas(l.price);
    if (l.description.trim().length < 2) e.description = "اكتب وصف البند.";
    if (qty === null) e.qty = "كمية غير صحيحة.";
    if (price === null) e.price = "سعر غير صحيح.";
    if (l.rate === 0 && l.reason.trim().length < 3) e.reason = "اذكر سبب الإعفاء أو عدم الخضوع.";
    if (Object.keys(e).length) errors[l.key] = e;
    inputs.push({
      description: l.description.trim(),
      quantity: qty ?? 0,
      unitHalalas: price ?? 0,
      vatRate: l.rate,
      exemptionReason: l.rate === 0 ? l.reason.trim() : null,
    });
  }
  return { inputs, errors, ok: Object.keys(errors).length === 0 };
}

/** Live totals of the draft (invalid lines count as zero). */
export function draftTotals(lines: DraftLine[]) {
  return computeInvoice(
    lines.map((l) => ({
      description: l.description,
      quantity: parseQty(l.qty) ?? 0,
      unitHalalas: (l.price.trim() ? toHalalas(l.price) : 0) ?? 0,
      vatRate: l.rate,
    })),
  );
}
