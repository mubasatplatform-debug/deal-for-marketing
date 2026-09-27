import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, FileImage, FileSearch, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Skeleton } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { TextInput } from "@/components/law/fields";
import { dateAr } from "@/components/law/format";
import { SearchInput, TextArea, useDebounced } from "@/components/law/kit";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { PERSPECTIVE_CHIPS, REVIEW_DISCLAIMER, isReviewable } from "@/components/law/ai/review-kinds";
import { listDocuments } from "@/lib/law/documents";
import type { DocumentRow } from "@/lib/law/documents-core";
import { startReview } from "@/lib/law/ai/reviews";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

type PickedDoc = { id: string; name: string };

/**
 * «مراجعة عقد جديدة»: pick the contract (an office document), whose side we
 * are on, optionally its type and notes; the review runs in the background
 * and we go straight to its page, which waits for it.
 */
export function ReviewDialog({
  document: preset,
  caseId,
  onClose,
}: {
  /** Review this document (skips the picker). */
  document?: PickedDoc;
  /** Limit the picker to one case's documents. */
  caseId?: string;
  onClose: () => void;
}) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const uid = useId();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<PickedDoc | null>(preset ?? null);
  const [perspective, setPerspective] = useState("");
  const [contractType, setContractType] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ doc?: string; perspective?: string; form?: string }>({});
  const formError = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (errors.form) formError.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [errors.form]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!doc) next.doc = "اختر العقد الذي تريد مراجعته.";
    if (perspective.trim().length < 2) next.perspective = "حدّد الطرف الذي نراجع العقد لمصلحته.";
    setErrors(next);
    if (Object.keys(next).length || !doc) return;
    setBusy(true);
    try {
      const { id } = await startReview({
        data: {
          workspaceId: wsId,
          documentId: doc.id,
          perspective: perspective.trim(),
          contractType: contractType.trim(),
          notes: notes.trim(),
        },
      });
      toast.success("بدأ المساعد مراجعة العقد");
      void navigate({ to: "/app/reviews/$id", params: { id } });
    } catch (err) {
      setErrors({ form: aiErrorMessage(err) });
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="مراجعة عقد جديدة"
      description="يراجع المساعد العقد بندًا بندًا لمصلحة موكّلك وفق دليل المكتب ومكتبة الأنظمة السعودية، مع مستوى الخطر وصياغة بديلة."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : FileSearch} disabled={busy}>
            {busy ? "جارٍ البدء…" : "ابدأ المراجعة"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-pine-deep">العقد</legend>
          {doc && preset?.id === doc.id ? (
            <p className="flex min-h-12 items-center gap-3 rounded-xl bg-paper px-3.5 py-2.5 ring-1 ring-line">
              <FileText className="size-4 shrink-0 text-pine" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-pine-deep" title={doc.name}>
                {doc.name}
              </span>
            </p>
          ) : (
            <DocPicker
              wsId={wsId}
              caseId={caseId}
              value={doc}
              invalid={Boolean(errors.doc)}
              onChange={(d) => {
                setDoc(d);
                setErrors((x) => ({ ...x, doc: undefined }));
              }}
            />
          )}
          {errors.doc ? <p className="mt-1.5 text-[13px] text-red-700">{errors.doc}</p> : null}
        </fieldset>

        <div>
          <label htmlFor={`${uid}-side`} className="mb-1.5 block text-sm font-semibold text-pine-deep">
            نراجع العقد لمصلحة
          </label>
          <TextInput
            id={`${uid}-side`}
            value={perspective}
            maxLength={200}
            invalid={Boolean(errors.perspective)}
            aria-describedby={`${uid}-side-hint`}
            onChange={(e) => {
              setPerspective(e.target.value);
              setErrors((x) => ({ ...x, perspective: undefined }));
            }}
            placeholder="مثال: المشتري (شركة الأفق التجارية)"
          />
          <div role="group" aria-label="اختيارات سريعة للطرف" className="mt-2 flex flex-wrap gap-1.5">
            {PERSPECTIVE_CHIPS.map((p) => {
              const on = perspective.trim() === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPerspective(p);
                    setErrors((x) => ({ ...x, perspective: undefined }));
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                    on ? "border-pine bg-pine-50 text-pine-deep" : "border-line-strong text-slate hover:bg-paper hover:text-pine-deep",
                  )}
                >
                  {on ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  {p}
                </button>
              );
            })}
          </div>
          {errors.perspective ? (
            <p className="mt-1.5 text-[13px] text-red-700">{errors.perspective}</p>
          ) : (
            <p id={`${uid}-side-hint`} className="mt-1.5 text-[12.5px] text-slate">
              موكّل المكتب في هذا العقد — تُقاس المخاطر من جهته.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${uid}-type`} className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-pine-deep">
            نوع العقد <span className="text-xs font-normal text-slate">(اختياري)</span>
          </label>
          <TextInput
            id={`${uid}-type`}
            value={contractType}
            maxLength={120}
            onChange={(e) => setContractType(e.target.value)}
            placeholder="مثال: عقد توريد، عقد إيجار تجاري، عقد عمل"
          />
        </div>

        <div>
          <label htmlFor={`${uid}-notes`} className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-pine-deep">
            ملاحظات للمساعد <span className="text-xs font-normal text-slate">(اختياري)</span>
          </label>
          <TextArea
            id={`${uid}-notes`}
            rows={3}
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: ركّز على الضمان وغرامات التأخير، والعميل لا يقبل التحكيم خارج الرياض."
          />
        </div>

        {errors.form ? (
          <p ref={formError} role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-700 ring-1 ring-red-200 ring-inset">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {errors.form}
          </p>
        ) : null}
        <p className="text-[12px] leading-relaxed text-slate">
          {REVIEW_DISCLAIMER} تستغرق المراجعة عادةً دقيقة أو دقيقتين.
        </p>
      </form>
    </Dialog>
  );
}

/** Searchable list of the office's reviewable documents (PDF, Word, images). */
function DocPicker({
  wsId,
  caseId,
  value,
  invalid,
  onChange,
}: {
  wsId: string;
  caseId?: string;
  value: PickedDoc | null;
  invalid: boolean;
  onChange: (d: PickedDoc) => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    listDocuments({ data: { workspaceId: wsId, q: dq, caseId: caseId ?? null, page: 1 } })
      .then((p) => alive && setRows(p.rows.filter((d) => isReviewable(d.name))))
      .catch((err) => alive && setError(workspaceErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [wsId, caseId, dq]);

  return (
    <div className={cn("rounded-xl p-2 ring-1", invalid ? "ring-red-400" : "ring-line")}>
      <SearchInput value={q} onChange={setQ} label="ابحث في المستندات" placeholder="ابحث باسم الملف…" />
      {error ? (
        <p className="px-2 pt-3 pb-1 text-[13px] text-red-700">{error}</p>
      ) : !rows ? (
        <div className="space-y-2 pt-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-2 pt-3 pb-1 text-[13px] leading-relaxed text-slate">
          {dq
            ? "لا عقود بهذا الاسم."
            : "لا مستندات قابلة للمراجعة. ارفع العقد أولًا في «المستندات» (PDF أو Word أو صورة)."}
        </p>
      ) : (
        <ul role="radiogroup" aria-label="اختر العقد" className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {rows.map((d) => {
            const on = value?.id === d.id;
            const Icon = /\.(jpe?g|png|webp)$/i.test(d.name) ? FileImage : FileText;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ id: d.id, name: d.name })}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-start",
                    on ? "bg-pine-50 ring-1 ring-pine/30" : "hover:bg-paper",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", on ? "text-pine" : "text-slate")} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-pine-deep" title={d.name}>
                      {d.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate">
                      {[d.case_title ?? d.client_name, dateAr(d.created_at)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {on ? (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-pine text-snow" aria-hidden="true">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
