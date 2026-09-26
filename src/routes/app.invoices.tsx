import { useEffect, useId, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronLeft, FileCheck2, Info, Plus, ReceiptText, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Pill } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { dateAr, sar, timeAr } from "@/components/law/format";
import { draftTotals, newLine, parseLines, type DraftLine, type LineErrors } from "@/components/law/invoice-draft";
import { LinesEditor } from "@/components/law/invoice-lines";
import {
  ClientPicker,
  ConfirmDialog,
  ErrorCard,
  ListSkeleton,
  Pagination,
  SearchInput,
  TextArea,
  useCan,
  useDebounced,
  useLoad,
  type PickedClient,
} from "@/components/law/kit";
import { toLatinDigits } from "@/components/law/office-options";
import { getInvoiceClient, issueInvoice, listInvoices } from "@/lib/law/invoices";
import { VAT_NUMBER_RE, type InvoiceClient, type InvoiceRow } from "@/lib/law/invoices-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/invoices")({
  component: Invoices,
});

function Invoices() {
  const { active } = useLawApp();
  const allowed = useCan();
  const canSee = allowed("invoice.view", { write: false });
  const canIssue = allowed("invoice.issue");
  const isManager = active.role === "owner" || active.role === "admin";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q.trim());
  const list = useLoad(
    () => (canSee ? listInvoices({ data: { workspaceId: active.workspace.id, q: dq, page } }) : Promise.resolve(null)),
    [active.workspace.id, dq, page, canSee],
  );
  const data = list.data;

  if (!canSee) {
    return (
      <>
        <PageHead title="الفواتير" />
        <Card>
          <EmptyState icon={ReceiptText} title="الفواتير غير متاحة لدورك" body="تظهر الفواتير لأعضاء الفريق ذوي صلاحية الأتعاب." />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="الفواتير"
        subtitle="فواتير ضريبية إلكترونية لعملاء المكتب، متوافقة مع المرحلة الأولى من الفوترة الإلكترونية"
        actions={
          canIssue && !creating ? (
            <Button variant="primary" icon={Plus} disabled={data ? !data.taxReady : true} onClick={() => setCreating(true)}>
              فاتورة جديدة
            </Button>
          ) : null
        }
      />

      {data && !data.taxReady ? (
        <div role="status" className="mb-4 flex flex-col gap-3 rounded-2xl border border-lime/40 bg-lime-50 p-4 text-sm text-pine-deep sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-lime-600" aria-hidden="true" />
          <p className="flex-1 leading-relaxed">
            <strong className="font-bold">أكمل بيانات الفوترة الضريبية أولًا.</strong>{" "}
            {isManager
              ? "أضف الاسم النظامي والرقم الضريبي وعنوان المكتب لتبدأ بإصدار الفواتير."
              : "يضيفها مالك المكتب أو المدير من الإعدادات، ثم يمكنك إصدار الفواتير."}
          </p>
          {isManager ? (
            <a href="/app/settings#tax" className="inline-flex min-h-10 items-center font-semibold text-pine hover:underline">
              فتح الإعدادات
            </a>
          ) : null}
        </div>
      ) : null}

      {creating ? (
        <NewInvoice onClose={() => setCreating(false)} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              label="بحث في الفواتير"
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="اسم العميل أو رقم الفاتورة"
              className="sm:max-w-md sm:flex-1"
            />
          </div>
          {list.error && !data ? (
            <ErrorCard title="تعذّر تحميل الفواتير" message={list.error} onRetry={() => void list.reload()} />
          ) : (
            <Card className="overflow-hidden">
              {!data ? (
                <ListSkeleton />
              ) : data.rows.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title={dq ? "لا فواتير مطابقة" : "لا فواتير بعد"}
                  body={dq ? "غيّر كلمة البحث." : "أصدر أول فاتورة ضريبية لعميل: البنود، الضريبة، ورمز الاستجابة السريعة تلقائيًا."}
                />
              ) : (
                <>
                  <div className="hidden grid-cols-[7.5rem_1fr_8rem_7rem_9rem_1rem] gap-3 border-b border-line px-6 py-2.5 text-[12.5px] font-semibold text-slate md:grid">
                    <span>الرقم</span>
                    <span>العميل</span>
                    <span>التاريخ</span>
                    <span>النوع</span>
                    <span className="text-end">الإجمالي (ر.س)</span>
                    <span />
                  </div>
                  <ul className={cn("divide-y divide-line", list.loading && "opacity-60 transition-opacity")}>
                    {data.rows.map((r) => (
                      <InvoiceItem key={r.id} r={r} />
                    ))}
                  </ul>
                  <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
                </>
              )}
            </Card>
          )}
          <PhaseNote />
        </>
      )}
    </>
  );
}

function KindPill({ r }: { r: Pick<InvoiceRow, "kind" | "invoice_type"> }) {
  if (r.kind === "credit_note") return <Pill tone="danger">إشعار دائن</Pill>;
  return <Pill tone={r.invoice_type === "standard" ? "pine" : "neutral"}>{r.invoice_type === "standard" ? "ضريبية" : "مبسطة"}</Pill>;
}

function InvoiceItem({ r }: { r: InvoiceRow }) {
  const credit = r.kind === "credit_note";
  return (
    <li>
      <Link
        to="/app/invoices/$id"
        params={{ id: r.id }}
        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper md:grid md:grid-cols-[7.5rem_1fr_8rem_7rem_9rem_1rem] md:items-center md:px-6"
      >
        <span dir="ltr" className="shrink-0 text-start font-ui text-[13px] font-bold text-pine-deep tabular-nums">
          {r.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{r.buyer_name}</p>
          <p className="mt-0.5 text-xs text-slate md:hidden">
            {dateAr(r.issued_at)} · <KindPill r={r} />
          </p>
          {credit && r.original_number ? (
            <p className="mt-0.5 text-xs text-slate">
              على الفاتورة <span className="font-ui" dir="ltr">{r.original_number}</span>
            </p>
          ) : null}
        </div>
        <span className="hidden text-[13px] text-slate md:block">{dateAr(r.issued_at)}</span>
        <span className="hidden md:block">
          <KindPill r={r} />
        </span>
        <span className={cn("shrink-0 text-end font-ui text-sm font-bold tabular-nums", credit ? "text-red-700" : "text-pine-deep")}>
          {credit ? "−" : ""}
          {sar(r.total_halalas)}
        </span>
        <ChevronLeft className="mt-0.5 size-4 shrink-0 text-slate md:mt-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

function PhaseNote() {
  return (
    <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-slate">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        يغطي النظام المرحلة الأولى (مرحلة الإصدار): فواتير إلكترونية مرقّمة تسلسليًا، لا تُعدّل بعد إصدارها، مع رمز
        الاستجابة السريعة. الربط مع منصة «فاتورة» (المرحلة الثانية) غير مشمول حاليًا.
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------------ */
/* New invoice                                                               */
/* ------------------------------------------------------------------------ */

type FormErrors = Partial<Record<"client" | "buyerName" | "buyerVat" | "buyerAddress" | "lines", string>>;

function NewInvoice({ onClose }: { onClose: () => void }) {
  const { active } = useLawApp();
  const navigate = useNavigate();
  const uid = useId();
  const [client, setClient] = useState<PickedClient | null>(null);
  const [info, setInfo] = useState<InvoiceClient | null>(null);
  const [caseId, setCaseId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [standard, setStandard] = useState(false);
  const [buyerVat, setBuyerVat] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [lineErrors, setLineErrors] = useState<LineErrors>({});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setInfo(null);
    setCaseId("");
    setStandard(false);
    if (!client) return;
    setBuyerName(client.name);
    let alive = true;
    getInvoiceClient({ data: { workspaceId: active.workspace.id, clientId: client.id } })
      .then((c) => alive && setInfo(c))
      .catch((err) => toast.error(workspaceErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [client, active.workspace.id]);

  const company = info?.kind === "company";
  const totals = draftTotals(lines);

  function review(e: FormEvent) {
    e.preventDefault();
    const next: FormErrors = {};
    if (!client) next.client = "اختر العميل.";
    if (buyerName.trim().length < 2) next.buyerName = "اكتب اسم المشتري.";
    if (company && standard) {
      if (!VAT_NUMBER_RE.test(buyerVat)) next.buyerVat = "الرقم الضريبي ١٥ رقمًا يبدأ وينتهي بالرقم 3.";
      if (buyerAddress.trim().length < 3) next.buyerAddress = "العنوان مطلوب في الفاتورة الضريبية.";
    }
    const parsed = parseLines(lines);
    setLineErrors(parsed.errors);
    if (parsed.ok && totals.total <= 0) next.lines = "إجمالي الفاتورة يجب أن يكون أكبر من صفر.";
    setErrors(next);
    if (Object.keys(next).length || !parsed.ok) return;
    setConfirming(true);
  }

  async function issue() {
    if (!client) return;
    const parsed = parseLines(lines);
    try {
      const r = await issueInvoice({
        data: {
          workspaceId: active.workspace.id,
          invoice: {
            clientId: client.id,
            caseId: caseId || null,
            buyerName: buyerName.trim(),
            buyerVat: company && standard ? buyerVat : null,
            buyerAddress: company && standard ? buyerAddress.trim() : null,
            notes: notes.trim(),
            lines: parsed.inputs,
          },
        },
      });
      toast.success(`صدرت الفاتورة ${r.number}`);
      setConfirming(false);
      void navigate({ to: "/app/invoices/$id", params: { id: r.id } });
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader
        title="فاتورة جديدة"
        description={company && standard ? "فاتورة ضريبية (منشأة مسجلة في الضريبة)" : "فاتورة ضريبية مبسطة"}
        actions={
          <Button variant="ghost" icon={X} onClick={onClose} aria-label="إغلاق النموذج">
            إلغاء
          </Button>
        }
      />
      <form onSubmit={review} noValidate className="space-y-6 px-5 pt-5 pb-6 md:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id={`${uid}-client`} label="العميل" error={errors.client}>
            <ClientPicker id={`${uid}-client`} value={client} onChange={setClient} invalid={Boolean(errors.client)} />
          </Field>
          <Field id={`${uid}-case`} label="القضية" optional hint={client && info && info.cases.length === 0 ? "لا قضايا لهذا العميل." : undefined}>
            <SelectInput
              id={`${uid}-case`}
              value={caseId}
              disabled={!info || info.cases.length === 0}
              onChange={(e) => setCaseId(e.target.value)}
            >
              <option value="">بلا ربط بقضية</option>
              {info?.cases.map((k) => (
                <option key={k.id} value={k.id}>
                  #{k.ref_no} — {k.title}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="md:col-span-2">
            <Field id={`${uid}-bn`} label="اسم المشتري كما يظهر في الفاتورة" error={errors.buyerName}>
              <TextInput
                id={`${uid}-bn`}
                value={buyerName}
                maxLength={200}
                onChange={(e) => setBuyerName(e.target.value)}
                invalid={Boolean(errors.buyerName)}
              />
            </Field>
          </div>
          {company ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper/60 p-3 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={standard}
                onChange={(e) => setStandard(e.target.checked)}
                className="mt-1 size-4 accent-[var(--color-pine)]"
              />
              <span>
                <span className="font-semibold">العميل منشأة مسجلة في ضريبة القيمة المضافة</span>
                <span className="mt-0.5 block text-[13px] text-slate">
                  تصدر «فاتورة ضريبية» تتضمن الرقم الضريبي للمشتري وعنوانه بدل الفاتورة المبسطة.
                </span>
              </span>
            </label>
          ) : null}
          {company && standard ? (
            <>
              <Field id={`${uid}-bv`} label="الرقم الضريبي للمشتري" error={errors.buyerVat}>
                <TextInput
                  id={`${uid}-bv`}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={15}
                  value={buyerVat}
                  onChange={(e) => setBuyerVat(toLatinDigits(e.target.value).replace(/\D/g, ""))}
                  placeholder="3xxxxxxxxxxxxx3"
                  invalid={Boolean(errors.buyerVat)}
                  className="text-left font-ui"
                />
              </Field>
              <Field id={`${uid}-ba`} label="عنوان المشتري" error={errors.buyerAddress}>
                <TextInput
                  id={`${uid}-ba`}
                  value={buyerAddress}
                  maxLength={300}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  invalid={Boolean(errors.buyerAddress)}
                  placeholder="المدينة، الحي، الشارع"
                />
              </Field>
            </>
          ) : null}
        </div>

        <div>
          <h3 className="mb-3 text-[14px] font-bold">البنود</h3>
          <LinesEditor lines={lines} onChange={setLines} errors={lineErrors} />
          {errors.lines ? <p className="mt-2 text-[13px] text-red-700">{errors.lines}</p> : null}
        </div>

        <Field id={`${uid}-notes`} label="ملاحظات على الفاتورة" optional>
          <TextArea id={`${uid}-notes`} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button type="submit" variant="primary" icon={FileCheck2}>
            مراجعة وإصدار
          </Button>
          <Button onClick={onClose}>إلغاء</Button>
          <span className="text-[13px] text-slate">لا يمكن تعديل الفاتورة بعد إصدارها.</span>
        </div>
      </form>

      {confirming ? (
        <ConfirmDialog
          title="إصدار الفاتورة"
          confirmLabel="إصدار الفاتورة"
          onClose={() => setConfirming(false)}
          onConfirm={issue}
          body={
            <>
              <p>
                ستصدر فاتورة إلى <strong className="text-pine-deep">{buyerName.trim()}</strong> بإجمالي{" "}
                <strong className="font-ui text-pine-deep tabular-nums">{sar(totals.total)} ر.س</strong> شامل الضريبة (
                <span className="font-ui tabular-nums">{sar(totals.vat)}</span>).
              </p>
              <p className="mt-2 font-semibold text-pine-deep">
                لا يمكن تعديل الفاتورة بعد إصدارها. أي تصحيح يكون بإصدار إشعار دائن عليها.
              </p>
              <p className="mt-2 text-[12.5px]">
                تاريخ ووقت الإصدار: الآن ({dateAr(new Date().toISOString())} {timeAr(new Date().toISOString())}).
              </p>
            </>
          }
        />
      ) : null}
    </Card>
  );
}
