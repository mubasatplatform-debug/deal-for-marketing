import { useCallback, useEffect, useId, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileMinus2, Loader2, LockKeyhole, Printer } from "lucide-react";
import { toast, Toaster } from "sonner";
import { DealWordmark } from "@/components/logo";
import { Button } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { Dialog } from "@/components/keys/dialog";
import { Field } from "@/components/law/fields";
import { dateAr, sar } from "@/components/law/format";
import { draftTotals, newLine, parseLines, type DraftLine, type LineErrors } from "@/components/law/invoice-draft";
import { LinesEditor } from "@/components/law/invoice-lines";
import { TextArea } from "@/components/law/kit";
import { QrCode } from "@/components/law/qr-code";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getInvoice, issueCreditNote } from "@/lib/law/invoices";
import { INVOICE_TITLES, type InvoiceDetail } from "@/lib/law/invoices-core";
import { rememberOtpReturn } from "@/lib/otp/return";
import { workspaceErrorCode, workspaceErrorMessage } from "@/lib/saas/errors";
import { pageHead } from "@/lib/seo";

/**
 * The printable tax invoice / credit note, outside the app frame: bilingual
 * labels as ZATCA simplified / standard invoices show them, the seller and
 * buyer, lines, totals and the Phase-1 QR code (drawn in the browser from the
 * stored TLV). «طباعة» prints just the sheet (A4).
 */
export const Route = createFileRoute("/app_/invoices/$id")({
  head: () => pageHead({ title: "فاتورة ضريبية — مكتب المحامي", noindex: true }),
  component: InvoicePage,
});

type Loaded = InvoiceDetail & { workspaceId: string };

const PRINT_CSS = `
html,body{background:var(--color-paper)}
@page{size:A4;margin:12mm}
@media print{html,body{background:#fff!important}}
`;

function InvoicePage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<{ code: string | null; message: string } | null>(null);
  const [crediting, setCrediting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getInvoice({ data: { id } }));
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (workspaceErrorCode(err) === "otp_required") {
        // The code screen lives in the /app layout; come back here after it.
        rememberOtpReturn(window.location.pathname);
        window.location.replace("/app");
        return;
      }
      setError({ code: workspaceErrorCode(err), message: workspaceErrorMessage(err) });
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    if (user?.id) void load();
    else if (!isPending) window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [user?.id, isPending, load]);

  return (
    <div className="min-h-dvh bg-paper font-dash text-pine-deep print:bg-white">
      <style>{PRINT_CSS}</style>
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex min-h-14 max-w-[900px] flex-wrap items-center gap-2 px-4 py-2 md:px-8">
          <a
            href={data ? `/app/invoices?ws=${data.workspaceId}` : "/app/invoices"}
            className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            الفواتير
          </a>
          <DealWordmark className="mx-auto hidden h-5 w-auto text-pine sm:block" />
          <div className="ms-auto flex flex-wrap items-center gap-2 sm:ms-0">
            {data && data.canIssue && data.invoice.kind === "invoice" && data.creditable > 0 ? (
              <Button icon={FileMinus2} onClick={() => setCrediting(true)}>
                إشعار دائن
              </Button>
            ) : null}
            <Button variant="dark" icon={Printer} disabled={!data} onClick={() => window.print()}>
              طباعة
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-3 py-6 md:px-8 md:py-10 print:max-w-none print:p-0">
        {error ? (
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
              <LockKeyhole className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">تعذّر فتح الفاتورة</h1>
            <p className="mt-2 text-sm text-slate">{error.message}</p>
            <a href="/app/invoices" className={`${buttonClass("dark")} mt-6 w-full`}>
              العودة للفواتير
            </a>
          </div>
        ) : !data ? (
          <div className="grid h-72 place-items-center">
            <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
          </div>
        ) : (
          <>
            <InvoiceSheet d={data} />
            <Related d={data} />
          </>
        )}
      </main>

      {crediting && data ? <CreditNoteDialog d={data} onClose={() => setCrediting(false)} /> : null}
      <Toaster position="top-center" dir="rtl" richColors />
    </div>
  );
}

/** "2026-09-26 12:15:42" in Riyadh time (Latin digits). */
function riyadhStamp(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}:${v("minute")}:${v("second")}`;
}

function Label({ ar, en }: { ar: string; en: string }) {
  return (
    <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] text-slate">
      <span className="font-semibold">{ar}</span>
      <span dir="ltr" className="font-ui text-[11px]">
        {en}
      </span>
    </span>
  );
}

function KV({ ar, en, children, ltr }: { ar: string; en: string; children: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="py-1.5">
      <Label ar={ar} en={en} />
      <p dir={ltr ? "ltr" : undefined} className={ltr ? "text-end font-ui text-[14px] font-semibold tabular-nums" : "text-[14px] font-semibold"}>
        {children}
      </p>
    </div>
  );
}

function InvoiceSheet({ d }: { d: Loaded }) {
  const inv = d.invoice;
  const title = INVOICE_TITLES[inv.kind][inv.invoice_type];
  const credit = inv.kind === "credit_note";
  const rates = new Set(d.lines.map((l) => l.vat_rate));
  const vatLabel = rates.size === 1 && rates.has(15) ? "ضريبة القيمة المضافة 15٪" : "ضريبة القيمة المضافة";
  const vatLabelEn = rates.size === 1 && rates.has(15) ? "VAT 15%" : "VAT";

  return (
    <article className="rounded-2xl bg-white p-5 text-[#0d1f20] shadow-[0_1px_2px_rgba(16,38,40,0.05),0_12px_32px_-16px_rgba(16,38,40,0.18)] ring-1 ring-line md:p-10 print:rounded-none print:p-0 print:shadow-none print:ring-0">
      {/* Title + QR */}
      <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-extrabold md:text-[26px]">{title.ar}</h1>
          <p dir="ltr" className="text-end font-ui text-[15px] font-bold text-slate sm:text-start">
            {title.en}
          </p>
          <dl className="mt-4 grid max-w-md grid-cols-1 gap-x-6 sm:grid-cols-2">
            <KV ar="رقم الفاتورة" en="Invoice No." ltr>
              {inv.number}
            </KV>
            <KV ar="تاريخ ووقت الإصدار" en="Issue date & time" ltr>
              {riyadhStamp(inv.issued_at)}
            </KV>
            {credit && inv.original_number ? (
              <KV ar="الفاتورة الأصلية" en="Original invoice" ltr>
                {inv.original_number}
              </KV>
            ) : null}
            <KV ar="العملة" en="Currency" ltr>
              SAR
            </KV>
          </dl>
        </div>
        <div className="shrink-0 self-center sm:self-start">
          <QrCode value={inv.qr_tlv} size={140} label={`رمز الاستجابة السريعة للفاتورة ${inv.number}`} />
        </div>
      </div>

      {/* Parties */}
      <div className="mt-6 grid gap-4 border-y border-[#dfe5e4] py-4 sm:grid-cols-2 print:grid-cols-2">
        <section>
          <h2 className="mb-1 flex items-baseline justify-between gap-2 text-[14px] font-extrabold">
            البائع <span dir="ltr" className="font-ui text-[12px] text-slate">Seller</span>
          </h2>
          <KV ar="الاسم" en="Name">
            {inv.seller_name}
          </KV>
          <KV ar="الرقم الضريبي" en="VAT No." ltr>
            {inv.seller_vat}
          </KV>
          {inv.seller_address ? (
            <KV ar="العنوان" en="Address">
              {inv.seller_address}
            </KV>
          ) : null}
        </section>
        <section>
          <h2 className="mb-1 flex items-baseline justify-between gap-2 text-[14px] font-extrabold">
            {inv.invoice_type === "standard" ? "المشتري" : "العميل"}{" "}
            <span dir="ltr" className="font-ui text-[12px] text-slate">
              {inv.invoice_type === "standard" ? "Buyer" : "Customer"}
            </span>
          </h2>
          <KV ar="الاسم" en="Name">
            {inv.buyer_name}
          </KV>
          {inv.buyer_vat ? (
            <KV ar="الرقم الضريبي" en="VAT No." ltr>
              {inv.buyer_vat}
            </KV>
          ) : null}
          {inv.buyer_address ? (
            <KV ar="العنوان" en="Address">
              {inv.buyer_address}
            </KV>
          ) : null}
        </section>
      </div>

      {credit ? (
        <p className="mt-4 rounded-xl bg-[#f6f7f5] p-3 text-[13px] print:border print:border-[#dfe5e4]">
          <span className="font-bold">سبب الإشعار</span> <span dir="ltr" className="font-ui text-[11px] text-slate">Reason</span>:{" "}
          {inv.notes}
        </p>
      ) : null}

      {/* Lines */}
      <div className="mt-5 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[640px] border-collapse text-[13px] print:min-w-0">
          <thead>
            <tr className="border-b-2 border-[#0d1f20] text-[12px]">
              <Th ar="#" en="" className="w-8" />
              <Th ar="الوصف" en="Description" className="text-start" />
              <Th ar="الكمية" en="Qty" />
              <Th ar="سعر الوحدة" en="Unit price" />
              <Th ar="المبلغ الخاضع" en="Taxable amount" />
              <Th ar="النسبة" en="VAT rate" />
              <Th ar="الضريبة" en="VAT amount" />
              <Th ar="المجموع" en="Total incl. VAT" />
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.idx} className="border-b border-[#dfe5e4] align-top">
                <td className="py-2.5 font-ui tabular-nums">{l.idx}</td>
                <td className="py-2.5 pe-2">
                  <p className="font-semibold">{l.description}</p>
                  {l.exemption_reason ? <p className="mt-0.5 text-[12px] text-slate">معفى / خارج النطاق: {l.exemption_reason}</p> : null}
                </td>
                <Td>{Number(l.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })}</Td>
                <Td>{sar(l.unit_halalas)}</Td>
                <Td>{sar(l.line_net_halalas)}</Td>
                <Td>{l.vat_rate}%</Td>
                <Td>{sar(l.line_vat_halalas)}</Td>
                <Td bold>{sar(l.line_net_halalas + l.line_vat_halalas)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <dl className="ms-auto mt-5 max-w-sm space-y-1 text-[14px]">
        <TotalRow ar="الإجمالي غير شامل الضريبة" en="Total (excl. VAT)" v={inv.subtotal_halalas} />
        <TotalRow ar={vatLabel} en={vatLabelEn} v={inv.vat_halalas} />
        <TotalRow ar="الإجمالي شامل الضريبة" en="Total (incl. VAT)" v={inv.total_halalas} strong />
      </dl>

      {!credit && inv.notes ? (
        <p className="mt-5 text-[13px] leading-relaxed">
          <span className="font-bold">ملاحظات:</span> {inv.notes}
        </p>
      ) : null}

      <footer className="mt-8 border-t border-[#dfe5e4] pt-3 text-[11px] leading-relaxed text-slate">
        <p dir="ltr" className="font-ui break-all">
          UUID: {inv.uuid}
        </p>
        <p className="mt-1">فاتورة إلكترونية صادرة وفق متطلبات المرحلة الأولى (مرحلة الإصدار) من الفوترة الإلكترونية.</p>
      </footer>
    </article>
  );
}

function Th({ ar, en, className }: { ar: string; en: string; className?: string }) {
  return (
    <th className={`px-1 py-2 text-end align-bottom font-bold ${className ?? ""}`}>
      <span className="block">{ar}</span>
      {en ? (
        <span dir="ltr" className="block font-ui text-[10.5px] font-semibold text-slate">
          {en}
        </span>
      ) : null}
    </th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td className={`px-1 py-2.5 text-end font-ui tabular-nums whitespace-nowrap ${bold ? "font-bold" : ""}`}>{children}</td>;
}

function TotalRow({ ar, en, v, strong }: { ar: string; en: string; v: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${strong ? "border-t-2 border-[#0d1f20] pt-2 text-[16px] font-extrabold" : ""}`}>
      <dt>
        {ar}{" "}
        <span dir="ltr" className="font-ui text-[11px] font-semibold text-slate">
          {en}
        </span>
      </dt>
      <dd className="font-ui tabular-nums whitespace-nowrap">{sar(v)} SAR</dd>
    </div>
  );
}

/** On screen only: the credit notes of an invoice, the original of a credit note. */
function Related({ d }: { d: Loaded }) {
  const inv = d.invoice;
  if (inv.kind === "credit_note") {
    return inv.original_id ? (
      <p className="mt-4 text-sm print:hidden">
        إشعار دائن على الفاتورة{" "}
        <a href={`/app/invoices/${inv.original_id}`} dir="ltr" className="font-ui font-semibold text-pine hover:underline">
          {inv.original_number}
        </a>
      </p>
    ) : null;
  }
  return (
    <section className="mt-6 rounded-2xl bg-surface p-5 ring-1 ring-line print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold">الإشعارات الدائنة</h2>
        <p className="text-[13px] text-slate">
          المتبقي القابل للإشعار: <span className="font-ui font-semibold text-pine-deep tabular-nums">{sar(d.creditable)} ر.س</span>
        </p>
      </div>
      {d.creditNotes.length === 0 ? (
        <p className="mt-2 text-[13px] text-slate">لا إشعارات دائنة على هذه الفاتورة. الفاتورة لا تُعدّل بعد إصدارها؛ التصحيح بإشعار دائن.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {d.creditNotes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <a href={`/app/invoices/${c.id}`} dir="ltr" className="font-ui font-semibold text-pine hover:underline">
                {c.number}
              </a>
              <span className="text-slate">{dateAr(c.issued_at)}</span>
              <span className="font-ui font-semibold text-red-700 tabular-nums">−{sar(c.total_halalas)}</span>
            </li>
          ))}
        </ul>
      )}
      {d.caseRef ? (
        <p className="mt-3 text-[13px] text-slate">
          مرتبطة بالقضية{" "}
          <a href={`/app/cases/${d.caseRef.id}`} className="font-semibold text-pine hover:underline">
            #{d.caseRef.ref_no} — {d.caseRef.title}
          </a>
        </p>
      ) : null}
    </section>
  );
}

function CreditNoteDialog({ d, onClose }: { d: Loaded; onClose: () => void }) {
  const navigate = useNavigate();
  const uid = useId();
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    d.lines.map((l) =>
      newLine({
        description: l.description,
        qty: String(l.quantity),
        price: (l.unit_halalas / 100).toFixed(2),
        rate: l.vat_rate,
        reason: l.exemption_reason ?? "",
      }),
    ),
  );
  const [lineErrors, setLineErrors] = useState<LineErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const totals = draftTotals(lines);

  async function submit() {
    const parsed = parseLines(lines);
    setLineErrors(parsed.errors);
    if (reason.trim().length < 3) return setError("اذكر سبب الإشعار الدائن.");
    if (!parsed.ok) return setError(null);
    if (totals.total <= 0) return setError("مبلغ الإشعار يجب أن يكون أكبر من صفر.");
    if (totals.total > d.creditable) return setError(`المبلغ أكبر من المتبقي القابل للإشعار (${sar(d.creditable)} ر.س).`);
    setError(null);
    setBusy(true);
    try {
      const r = await issueCreditNote({
        data: { workspaceId: d.workspaceId, note: { originalId: d.invoice.id, reason: reason.trim(), lines: parsed.inputs } },
      });
      toast.success(`صدر الإشعار الدائن ${r.number}`);
      onClose();
      void navigate({ to: "/app/invoices/$id", params: { id: r.id } });
    } catch (err) {
      setError(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={`إشعار دائن على ${d.invoice.number}`}
      description="يُصدر مستندًا جديدًا مرقّمًا يخفض مبلغ الفاتورة الأصلية، ولا يمكن تعديله بعد إصداره."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            تراجع
          </Button>
          <Button variant="primary" icon={busy ? Loader2 : FileMinus2} disabled={busy} onClick={() => void submit()}>
            إصدار الإشعار الدائن
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id={`${uid}-r`} label="سبب الإشعار" error={error && reason.trim().length < 3 ? error : undefined}>
          <TextArea
            id={`${uid}-r`}
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: خصم متفق عليه، أو إلغاء جزء من الخدمة"
            className="min-h-20"
            data-autofocus
          />
        </Field>
        <p className="text-[13px] text-slate">
          المتبقي القابل للإشعار: <span className="font-ui font-semibold text-pine-deep tabular-nums">{sar(d.creditable)} ر.س</span>. عدّل
          البنود لتطابق المبلغ المراد إشعاره.
        </p>
        <LinesEditor lines={lines} onChange={setLines} errors={lineErrors} disabled={busy} />
        {error && reason.trim().length >= 3 ? (
          <p role="alert" className="text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
