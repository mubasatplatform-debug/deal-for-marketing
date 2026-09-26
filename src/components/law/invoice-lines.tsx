import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/dash/ui";
import { fieldClass } from "@/components/law/fields";
import { sar } from "@/components/law/format";
import { draftTotals, newLine, type DraftLine, type LineErrors } from "@/components/law/invoice-draft";
import { MAX_LINES } from "@/lib/law/invoices-core";
import { cn } from "@/lib/utils";

/**
 * The lines of a new invoice or credit note: description, quantity, unit
 * price (riyals), VAT 15% or 0% with a reason — plus the live totals, using
 * the same per-line rounding as the server (invoices-core.ts).
 */

const small = cn(fieldClass, "h-11 text-[14px]");

export function LinesEditor({
  lines,
  onChange,
  errors,
  disabled,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  errors: LineErrors;
  disabled?: boolean;
}) {
  const uid = useId();
  const totals = draftTotals(lines);
  const set = (key: string, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div>
      <ol className="space-y-3">
        {lines.map((l, i) => {
          const e = errors[l.key] ?? {};
          const line = totals.lines[i];
          const id = `${uid}-${l.key}`;
          return (
            <li key={l.key} className="rounded-xl border border-line bg-paper/50 p-3 md:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-pine-deep">
                  البند <span className="font-ui tabular-nums">{i + 1}</span>
                </span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`حذف البند ${i + 1}`}
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
                    className="grid size-9 place-items-center rounded-lg text-slate hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-12">
                <label className="sm:col-span-12" htmlFor={`${id}-d`}>
                  <span className="mb-1 block text-[13px] font-semibold">الوصف</span>
                  <input
                    id={`${id}-d`}
                    value={l.description}
                    maxLength={300}
                    disabled={disabled}
                    aria-invalid={Boolean(e.description) || undefined}
                    placeholder="مثال: أتعاب الترافع في القضية العمالية"
                    onChange={(ev) => set(l.key, { description: ev.target.value })}
                    className={cn(small, e.description ? "border-red-500" : "border-line-strong")}
                  />
                  {e.description ? <span className="mt-1 block text-[12.5px] text-red-700">{e.description}</span> : null}
                </label>
                <label className="sm:col-span-3" htmlFor={`${id}-q`}>
                  <span className="mb-1 block text-[13px] font-semibold">الكمية</span>
                  <input
                    id={`${id}-q`}
                    dir="ltr"
                    inputMode="decimal"
                    value={l.qty}
                    disabled={disabled}
                    aria-invalid={Boolean(e.qty) || undefined}
                    onChange={(ev) => set(l.key, { qty: ev.target.value })}
                    className={cn(small, "text-left font-ui", e.qty ? "border-red-500" : "border-line-strong")}
                  />
                  {e.qty ? <span className="mt-1 block text-[12.5px] text-red-700">{e.qty}</span> : null}
                </label>
                <label className="sm:col-span-4" htmlFor={`${id}-p`}>
                  <span className="mb-1 block text-[13px] font-semibold">سعر الوحدة (ر.س، قبل الضريبة)</span>
                  <input
                    id={`${id}-p`}
                    dir="ltr"
                    inputMode="decimal"
                    value={l.price}
                    placeholder="0.00"
                    disabled={disabled}
                    aria-invalid={Boolean(e.price) || undefined}
                    onChange={(ev) => set(l.key, { price: ev.target.value })}
                    className={cn(small, "text-left font-ui", e.price ? "border-red-500" : "border-line-strong")}
                  />
                  {e.price ? <span className="mt-1 block text-[12.5px] text-red-700">{e.price}</span> : null}
                </label>
                <label className="sm:col-span-5" htmlFor={`${id}-r`}>
                  <span className="mb-1 block text-[13px] font-semibold">ضريبة القيمة المضافة</span>
                  <select
                    id={`${id}-r`}
                    value={l.rate}
                    disabled={disabled}
                    onChange={(ev) => set(l.key, { rate: Number(ev.target.value) === 0 ? 0 : 15 })}
                    className={cn(small, "cursor-pointer border-line-strong")}
                  >
                    <option value={15}>15٪ (النسبة الأساسية)</option>
                    <option value={0}>0٪ معفى / خارج نطاق الضريبة</option>
                  </select>
                </label>
                {l.rate === 0 ? (
                  <label className="sm:col-span-12" htmlFor={`${id}-x`}>
                    <span className="mb-1 block text-[13px] font-semibold">سبب الإعفاء أو عدم الخضوع</span>
                    <input
                      id={`${id}-x`}
                      value={l.reason}
                      maxLength={300}
                      disabled={disabled}
                      aria-invalid={Boolean(e.reason) || undefined}
                      placeholder="مثال: رسوم حكومية مدفوعة نيابة عن العميل"
                      onChange={(ev) => set(l.key, { reason: ev.target.value })}
                      className={cn(small, e.reason ? "border-red-500" : "border-line-strong")}
                    />
                    {e.reason ? <span className="mt-1 block text-[12.5px] text-red-700">{e.reason}</span> : null}
                  </label>
                ) : null}
              </div>
              <p className="mt-2 text-end text-[12.5px] text-slate">
                المبلغ <span className="font-ui font-semibold text-pine-deep tabular-nums">{sar(line?.line_net_halalas ?? 0)}</span>
                {" · "}الضريبة{" "}
                <span className="font-ui font-semibold text-pine-deep tabular-nums">{sar(line?.line_vat_halalas ?? 0)}</span>
              </p>
            </li>
          );
        })}
      </ol>
      {lines.length < MAX_LINES ? (
        <Button icon={Plus} className="mt-3" disabled={disabled} onClick={() => onChange([...lines, newLine()])}>
          إضافة بند
        </Button>
      ) : null}
      <TotalsBox subtotal={totals.subtotal} vat={totals.vat} total={totals.total} className="mt-4" />
    </div>
  );
}

export function TotalsBox({
  subtotal,
  vat,
  total,
  className,
}: {
  subtotal: number;
  vat: number;
  total: number;
  className?: string;
}) {
  return (
    <dl className={cn("ms-auto max-w-sm space-y-1.5 rounded-xl bg-pine-50/60 p-4 text-sm", className)}>
      <div className="flex justify-between gap-3">
        <dt className="text-slate">الإجمالي قبل الضريبة</dt>
        <dd className="font-ui font-semibold tabular-nums">{sar(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate">ضريبة القيمة المضافة</dt>
        <dd className="font-ui font-semibold tabular-nums">{sar(vat)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-pine-100 pt-1.5 text-[15px]">
        <dt className="font-bold">الإجمالي شامل الضريبة</dt>
        <dd className="font-ui font-bold tabular-nums">{sar(total)} ر.س</dd>
      </div>
    </dl>
  );
}
