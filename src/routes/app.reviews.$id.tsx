import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  Copy,
  Download,
  ExternalLink,
  FileQuestion,
  FileText,
  HelpCircle,
  Loader2,
  RotateCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Num, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { useLawApp } from "@/components/law/app-context";
import { documentUrl } from "@/components/law/documents-ui";
import { dateAr, timeAr } from "@/components/law/format";
import { ConfirmDialog, ErrorCard, useCan, useLoad } from "@/components/law/kit";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { REVIEW_DISCLAIMER, RISK_LABEL, RISK_ORDER, RISK_STYLE } from "@/components/law/ai/review-kinds";
import { ReviewStatePill, RiskPill } from "@/components/law/ai/reviews-ui";
import { toLatinDigits } from "@/components/law/ai/text-utils";
import { deleteReview, getReview, startReview } from "@/lib/law/ai/reviews";
import type { ClauseFinding, MissingClause, ReviewResult, ReviewRow, Risk } from "@/lib/law/ai/review-core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/reviews/$id")({
  component: ReviewPage,
});

const POLL_MS = 3000;

function ReviewPage() {
  const { id } = Route.useParams();
  const { active } = useLawApp();
  const res = useLoad(() => getReview({ data: { workspaceId: active.workspace.id, id } }), [active.workspace.id, id]);
  const r = res.data;

  // Poll while the assistant is reviewing.
  const reload = res.reload;
  useEffect(() => {
    if (r?.status !== "pending") return;
    const t = setTimeout(() => void reload(), POLL_MS);
    return () => clearTimeout(t);
  }, [r, reload]);

  if (res.error && (!r || r.id !== id)) {
    return (
      <>
        <BackLink />
        <ErrorCard title="تعذّر فتح المراجعة" message={res.error} onRetry={() => void res.reload()} />
      </>
    );
  }
  if (!r || r.id !== id) {
    return (
      <>
        <BackLink />
        <Card className="h-72 animate-pulse bg-pine-50/40">
          <span className="sr-only">جارٍ التحميل…</span>
        </Card>
      </>
    );
  }
  return <ReviewView key={r.id} review={r} onReload={res.reload} />;
}

function BackLink() {
  return (
    <Link to="/app/reviews" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep">
      <ArrowRight className="size-4" aria-hidden="true" />
      مراجعة العقود
    </Link>
  );
}

const isPdf = (name: string) => /\.pdf$/i.test(name);

function failureText(error: string | null): string {
  if (!error) return "لم يُكمل المساعد المراجعة هذه المرة.";
  if (error === "timeout") return "انقطعت المراجعة قبل أن تكتمل.";
  if (error === "document_gone") return "حُذف ملف العقد من المستندات، فلم تعد مراجعته ممكنة.";
  if (error === "unreadable") return "تعذّرت قراءة نص العقد — قد يكون الملف ممسوحًا بجودة منخفضة أو محميًا بكلمة مرور.";
  if (error.startsWith("WS:")) return aiErrorMessage(new Error(error));
  return "لم يُكمل المساعد المراجعة هذه المرة (قد يكون مشغولًا أو العقد طويلًا).";
}

function ReviewView({ review: r, onReload }: { review: ReviewRow; onReload: () => Promise<void> }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const allowed = useCan();
  const canEdit = allowed("draft.manage");
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "retry">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileUrl = r.document_id ? documentUrl(wsId, r.document_id, true) : null;
  const pageUrl = (page: number) =>
    fileUrl && page > 0 && isPdf(r.document_name) ? `${fileUrl}#page=${page}` : fileUrl;
  const wordUrl = `/api/law/reviews/${r.id}?ws=${wsId}`;
  const res = r.status === "ready" ? r.result : null;
  const contractType = res?.contract_type || r.contract_type;

  async function retry() {
    if (!r.document_id) return;
    setBusy("retry");
    try {
      const { id } = await startReview({
        data: {
          workspaceId: wsId,
          documentId: r.document_id,
          perspective: r.perspective,
          contractType: r.contract_type,
          notes: r.notes,
        },
      });
      toast.success("بدأ المساعد مراجعة العقد من جديد");
      void navigate({ to: "/app/reviews/$id", params: { id } });
    } catch (err) {
      toast.error(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const target = r.case_id ? (
    <Link to="/app/cases/$id" params={{ id: r.case_id }} className="font-semibold text-pine hover:underline">
      {r.case_title}
    </Link>
  ) : r.client_id ? (
    <Link to="/app/clients/$id" params={{ id: r.client_id }} className="font-semibold text-pine hover:underline">
      {r.client_name}
    </Link>
  ) : null;

  return (
    <>
      <BackLink />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate">
            <span>مراجعة عقد</span>
            {contractType ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{contractType}</span>
              </>
            ) : null}
            {target ? (
              <>
                <span aria-hidden="true">·</span>
                {target}
              </>
            ) : null}
          </p>
          <h1 className="mt-1.5 text-[22px] leading-snug font-extrabold break-words md:text-[26px]">
            {fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noopener" className="hover:text-pine hover:underline">
                {r.document_name}
                <ExternalLink className="ms-2 inline size-4 align-middle text-slate" aria-hidden="true" />
                <span className="sr-only"> (فتح الملف)</span>
              </a>
            ) : (
              r.document_name
            )}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate">
            <ReviewStatePill row={r} />
            <span>
              لصالح: <strong className="font-semibold text-pine-deep">{r.perspective}</strong>
            </span>
            {r.created_by_name ? (
              <>
                <span aria-hidden="true">·</span>
                <span>أعدّها {r.created_by_name}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>
              {dateAr(r.created_at)} {timeAr(r.created_at)}
            </span>
          </p>
        </div>
        {r.status !== "pending" ? (
          <div className="flex flex-wrap items-center gap-2 self-start">
            {r.status === "ready" ? (
              <a href={wordUrl} download className={buttonClass("secondary")}>
                <Download className="size-4" aria-hidden="true" />
                تنزيل التقرير Word
              </a>
            ) : null}
            {canEdit ? (
              <Button icon={Trash2} variant="ghost" onClick={() => setConfirmDelete(true)} className="hover:bg-red-50 hover:text-red-700">
                حذف
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-lime-50 px-4 py-3 text-[13px] leading-relaxed font-semibold text-pine-deep ring-1 ring-lime/40 ring-inset">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-lime-600" aria-hidden="true" />
        {REVIEW_DISCLAIMER}
      </p>

      {r.status === "pending" ? (
        <Card className="px-6 py-14 text-center">
          <div role="status" className="flex flex-col items-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-lime-50 text-lime-600">
              <Loader2 className="size-6 motion-safe:animate-spin" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-bold text-pine-deep">يراجع المساعد العقد بندًا بندًا… قد يستغرق دقيقة أو دقيقتين</p>
            <p className="mt-1 max-w-md text-sm text-slate">
              يمكنك مغادرة الصفحة؛ تبقى المراجعة جارية وتجدها في «مراجعة العقود» حين تكتمل.
            </p>
            <div className="mt-6 w-full max-w-md space-y-2.5" aria-hidden="true">
              <Skeleton className="mx-auto h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </Card>
      ) : null}

      {r.status === "failed" ? (
        <Card className="px-6 py-12 text-center">
          <div className="flex flex-col items-center" role="alert">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-bold text-pine-deep">تعذّرت مراجعة العقد</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-slate">
              {failureText(r.error)}
              {r.document_id ? " أعد المحاولة بنفس العقد والطرف والملاحظات." : null}
            </p>
            {canEdit && r.document_id ? (
              <Button
                variant="primary"
                icon={busy === "retry" ? Loader2 : RotateCw}
                disabled={Boolean(busy)}
                onClick={() => void retry()}
                className="mt-5"
              >
                أعد المحاولة
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {res ? <ReviewReport res={res} pageUrl={pageUrl} /> : null}

      {r.notes.trim() ? (
        <details className="group rounded-2xl border border-line bg-surface px-5 py-1 md:px-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-slate hover:text-pine-deep">
            <FileText className="size-4" aria-hidden="true" />
            الملاحظات التي أُعطيت للمساعد
          </summary>
          <p className="pb-4 text-[13px] leading-relaxed whitespace-pre-wrap text-pine-deep">{r.notes}</p>
        </details>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="حذف المراجعة؟"
          body="تُحذف المراجعة ونتائجها نهائيًا. يبقى ملف العقد في المستندات كما هو."
          confirmLabel="حذف نهائيًا"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await deleteReview({ data: { workspaceId: wsId, id: r.id } });
              toast.success("حُذفت المراجعة");
              void navigate({ to: "/app/reviews" });
            } catch (err) {
              toast.error(aiErrorMessage(err));
              setConfirmDelete(false);
              void onReload();
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* The report                                                                */
/* ------------------------------------------------------------------------ */

const VERDICT_TITLE: Record<Risk, string> = {
  green: "العقد مقبول في مجمله",
  yellow: "العقد يحتاج تفاوضًا",
  red: "العقد فيه مخاطر مرتفعة",
};

function refNumber(ref: string): number {
  return Number(toLatinDigits(ref).replace(/\D/g, "")) || 0;
}

function ReviewReport({ res, pageUrl }: { res: ReviewResult; pageUrl: (page: number) => string | null }) {
  const [filter, setFilter] = useState<Risk | "all">("all");
  const [openArts, setOpenArts] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Risk, number> = { red: 0, yellow: 0, green: 0 };
    for (const x of res.clauses) c[x.risk] += 1;
    return c;
  }, [res.clauses]);
  const shown = filter === "all" ? res.clauses : res.clauses.filter((c) => c.risk === filter);

  function goToArticle(n: number) {
    const el = document.getElementById(`art-${n}`);
    if (!el) return;
    setOpenArts((s) => new Set(s).add(n));
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(n);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  }

  const refChips = (refs: string[]) => {
    const ns = [...new Set(refs.map(refNumber).filter((n) => res.articles.some((a) => a.n === n)))];
    if (!ns.length) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-slate">المرجع:</span>
        {ns.map((n) => {
          const a = res.articles.find((x) => x.n === n);
          return (
            <a
              key={n}
              href={`#art-${n}`}
              onClick={(e) => {
                e.preventDefault();
                goToArticle(n);
              }}
              title={a ? `${a.law_name} — ${a.seq}` : undefined}
              aria-label={a ? `المرجع ن${n}: ${a.law_name} — ${a.seq}` : `المرجع ن${n}`}
              className="inline-flex min-h-8 items-center rounded-md bg-lime/30 px-2 font-ui text-[12px] font-bold text-pine-deep hover:bg-lime/50"
            >
              [ن{n}]
            </a>
          );
        })}
      </div>
    );
  };

  const filters: { value: Risk | "all"; label: string; count: number }[] = [
    { value: "all", label: "الكل", count: res.clauses.length },
    ...RISK_ORDER.map((k) => ({ value: k, label: RISK_LABEL[k], count: counts[k] })),
  ];

  return (
    <>
      {/* Verdict + summary */}
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className={cn("flex flex-col gap-3 p-5 ring-1 ring-inset md:p-6", RISK_STYLE[res.overall].soft)}>
            <p className="text-[12.5px] font-semibold text-slate">التقييم العام</p>
            <div className="flex items-center gap-3">
              <span className={cn("size-4 shrink-0 rounded-full ring-4 ring-white/70", RISK_STYLE[res.overall].dot)} aria-hidden="true" />
              <p className={cn("text-[20px] leading-tight font-extrabold md:text-[22px]", RISK_STYLE[res.overall].text)}>
                {RISK_LABEL[res.overall]}
              </p>
            </div>
            <p className="text-[13.5px] font-bold text-pine-deep">{VERDICT_TITLE[res.overall]}</p>
            {res.overall_reason ? (
              <p className="text-[13px] leading-relaxed break-words text-pine-deep/90">{res.overall_reason}</p>
            ) : null}
          </div>
          <div className="min-w-0 p-5 md:p-6">
            <h2 className="text-[15px] font-bold text-pine-deep">ملخص العقد</h2>
            <p className="mt-2 text-[14px] leading-[1.9] break-words whitespace-pre-line text-pine-deep">{res.summary || "—"}</p>
            {res.parties.length ? (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate">
                  <Users className="size-3.5" aria-hidden="true" />
                  الأطراف
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {res.parties.map((p, i) => (
                    <li key={i} className="max-w-full rounded-lg bg-paper px-2.5 py-1 text-[13px] break-words text-pine-deep ring-1 ring-line">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {res.pages_total > 0 && res.pages_read < res.pages_total ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800 ring-1 ring-amber-200 ring-inset">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  راجع المساعد أول <Num>{res.pages_read}</Num> من <Num>{res.pages_total}</Num> صفحة — راجع بقية العقد بنفسك.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Clauses */}
      <section aria-labelledby="clauses-h">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="clauses-h" className="text-[17px] font-extrabold text-pine-deep">
              البنود <Num className="text-[14px] font-bold text-slate">({res.clauses.length})</Num>
            </h2>
            <p className="mt-1 text-[13px] text-slate">
              {RISK_ORDER.map((k, i) => (
                <span key={k}>
                  {i > 0 ? <span aria-hidden="true"> · </span> : null}
                  <span className={cn("font-semibold", RISK_STYLE[k].text)}>
                    <Num>{counts[k]}</Num> {RISK_LABEL[k]}
                  </span>
                </span>
              ))}
            </p>
          </div>
          <div role="group" aria-label="تصفية البنود حسب الخطر" className="flex flex-wrap gap-1.5">
            {filters.map((f) => {
              const on = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                    on ? "border-pine bg-pine text-snow" : "border-line-strong bg-surface text-pine-deep hover:bg-paper",
                  )}
                >
                  {f.value !== "all" ? (
                    <span aria-hidden="true" className={cn("size-2 rounded-full", RISK_STYLE[f.value].dot)} />
                  ) : null}
                  {f.label}
                  <Num className={cn("text-[11.5px]", on ? "text-lime" : "text-slate")}>{f.count}</Num>
                </button>
              );
            })}
          </div>
        </div>
        {shown.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-slate">
            {res.clauses.length ? "لا بنود بهذا المستوى." : "لم يسجّل المساعد ملاحظات على بنود العقد."}
          </Card>
        ) : (
          <ol className="space-y-3">
            {shown.map((c, i) => (
              <ClauseCard key={`${c.title}-${i}`} c={c} pageUrl={pageUrl} refs={refChips(c.refs)} />
            ))}
          </ol>
        )}
      </section>

      {/* Missing clauses */}
      {res.missing.length ? (
        <section aria-labelledby="missing-h">
          <h2 id="missing-h" className="mb-3 flex items-center gap-2 text-[17px] font-extrabold text-pine-deep">
            <FileQuestion className="size-5 text-pine" aria-hidden="true" />
            بنود غائبة <Num className="text-[14px] font-bold text-slate">({res.missing.length})</Num>
          </h2>
          <ul className="space-y-3">
            {res.missing.map((m, i) => (
              <MissingCard key={`${m.title}-${i}`} m={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Questions */}
      {res.questions.length ? (
        <Card className="p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-pine-deep">
            <HelpCircle className="size-[18px] text-pine" aria-hidden="true" />
            أسئلة للعميل
          </h2>
          <ol className="mt-3 space-y-2">
            {res.questions.map((q, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-pine-deep">
                <Num className="mt-px shrink-0 font-bold text-pine">{i + 1}.</Num>
                <span className="min-w-0 break-words">{q}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {/* Articles */}
      {res.articles.length ? (
        <section aria-labelledby="arts-h">
          <h2 id="arts-h" className="mb-3 flex items-center gap-2 text-[17px] font-extrabold text-pine-deep">
            <BookOpenText className="size-5 text-pine" aria-hidden="true" />
            المواد النظامية المرجعية
          </h2>
          <ul className="space-y-3">
            {res.articles.map((a) => (
              <ArticleItem
                key={a.n}
                a={a}
                open={openArts.has(a.n)}
                flash={flash === a.n}
                onToggle={() =>
                  setOpenArts((s) => {
                    const next = new Set(s);
                    if (next.has(a.n)) next.delete(a.n);
                    else next.add(a.n);
                    return next;
                  })
                }
              />
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-slate">
            المصدر: البوابة القانونية لوزارة العدل. تحقّق من آخر التعديلات في المصدر الرسمي قبل الاستناد إلى المادة.
          </p>
        </section>
      ) : null}
    </>
  );
}

function copyText(text: string) {
  void navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success("نُسخت الصياغة"))
    .catch(() => toast.error("تعذّر النسخ"));
}

function SuggestedBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-lime-50 p-3.5 ring-1 ring-lime/40 ring-inset md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-bold text-lime-600">الصياغة المقترحة</p>
        <button
          type="button"
          onClick={() => copyText(text)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-pine-deep hover:bg-lime/30"
        >
          <Copy className="size-3.5" aria-hidden="true" />
          نسخ الصياغة
        </button>
      </div>
      <p className="mt-1 text-[14px] leading-[1.9] break-words whitespace-pre-line text-pine-deep">{text}</p>
    </div>
  );
}

function ClauseCard({
  c,
  pageUrl,
  refs,
}: {
  c: ClauseFinding;
  pageUrl: (page: number) => string | null;
  refs: ReactNode;
}) {
  const href = c.page > 0 ? pageUrl(c.page) : null;
  return (
    <li className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,38,40,0.04)]">
      <span aria-hidden="true" className={cn("absolute inset-y-0 start-0 w-1.5", RISK_STYLE[c.risk].stripe)} />
      <div className="space-y-3 py-4 ps-5 pe-4 md:py-5 md:ps-7 md:pe-6">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-bold break-words text-pine-deep">{c.title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {c.page > 0 ? (
              href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener"
                  aria-label={`فتح العقد عند الصفحة ${c.page}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-pine hover:bg-paper hover:underline"
                >
                  ص <Num>{c.page}</Num>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-[12.5px] text-slate">
                  ص <Num>{c.page}</Num>
                </span>
              )
            ) : null}
            <RiskPill risk={c.risk} />
          </div>
        </div>
        {c.quote ? (
          <blockquote className="border-s-4 border-line-strong bg-paper/70 py-2 ps-3.5 pe-3 text-[13.5px] leading-[1.9] break-words text-slate italic">
            «{c.quote}»
          </blockquote>
        ) : null}
        {c.issue ? (
          <div>
            <p className="text-[12.5px] font-bold text-slate">الملاحظة</p>
            <p className="mt-0.5 text-[14px] leading-[1.85] break-words text-pine-deep">{c.issue}</p>
          </div>
        ) : null}
        {c.recommendation ? (
          <div>
            <p className="text-[12.5px] font-bold text-slate">التوصية</p>
            <p className="mt-0.5 text-[14px] leading-[1.85] break-words text-pine-deep">{c.recommendation}</p>
          </div>
        ) : null}
        {c.suggested_text ? <SuggestedBox text={c.suggested_text} /> : null}
        {refs}
      </div>
    </li>
  );
}

function MissingCard({ m }: { m: MissingClause }) {
  return (
    <li className="relative overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface">
      <span aria-hidden="true" className={cn("absolute inset-y-0 start-0 w-1.5", RISK_STYLE[m.risk].stripe)} />
      <div className="space-y-3 py-4 ps-5 pe-4 md:py-5 md:ps-7 md:pe-6">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-bold break-words text-pine-deep">{m.title}</h3>
          <RiskPill risk={m.risk} />
        </div>
        {m.why ? <p className="text-[14px] leading-[1.85] break-words text-pine-deep">{m.why}</p> : null}
        {m.suggested_text ? <SuggestedBox text={m.suggested_text} /> : null}
      </div>
    </li>
  );
}

function ArticleItem({
  a,
  open,
  flash,
  onToggle,
}: {
  a: ReviewResult["articles"][number];
  open: boolean;
  flash: boolean;
  onToggle: () => void;
}) {
  const long = a.text.length > 300;
  const text = open || !long ? a.text : `${a.text.slice(0, 300)}…`;
  return (
    <li
      id={`art-${a.n}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-surface p-4 transition-shadow md:p-5",
        flash ? "border-lime ring-4 ring-lime/40" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-md bg-lime/30 px-1.5 font-ui text-[12px] font-bold text-pine-deep">ن{a.n}</span>
        <p className="text-[14px] font-bold text-pine-deep">{a.law_name}</p>
        <span className="text-slate" aria-hidden="true">
          —
        </span>
        <p className="text-[14px] font-semibold text-pine">{a.seq}</p>
      </div>
      <p className="mt-3 text-[14px] leading-[1.95] break-words whitespace-pre-line text-pine-deep">{text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
        {long ? (
          <button type="button" aria-expanded={open} className="min-h-10 font-semibold text-pine hover:underline" onClick={onToggle}>
            {open ? "عرض أقل" : "النص كاملًا"}
          </button>
        ) : null}
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-slate hover:text-pine-deep"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            المصدر الرسمي
          </a>
        ) : null}
      </div>
    </li>
  );
}
