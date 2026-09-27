import { useId, useState, type ReactNode } from "react";
import { AlertCircle, CalendarClock, Clock, Loader2, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Skeleton } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { documentUrl } from "@/components/law/documents-ui";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { dateAr, whenAr } from "@/components/law/format";
import { Tabs, useCan, useLoad } from "@/components/law/kit";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { LightText } from "@/components/law/ai/light-text";
import { parseMarker, toLatinDigits } from "@/components/law/ai/text-utils";
import { usePollPending } from "@/components/law/ai/use-poll-pending";
import { buildCaseAi, deadlineRules, fileDeadline, getCaseAi, previewDeadline, type DeadlinePreview } from "@/lib/law/ai/case-ai";
import type { BriefingResult, CaseAiKind, ChronologyResult, Source } from "@/lib/law/ai/case-ai-core";
import { cn } from "@/lib/utils";

/**
 * «أدوات القضية الذكية» on the case page: the chronology of events from the
 * file (each event with its source), the briefing for the next hearing (for
 * lawyers), and statutory objection deadlines computed from the articles of
 * the laws library and filed as a task on the case.
 */

type Tab = "chronology" | "briefing" | "deadlines";

const ERROR_TEXT: Record<string, string> = {
  timeout: "استغرق الإعداد وقتًا أطول من المعتاد. أعد المحاولة.",
  no_material: "لا توجد مادة كافية: أضف مستندات مقروءة أو ملاحظات أو جلسات للقضية ثم أعد المحاولة.",
  unreadable: "تعذّرت قراءة مستندات القضية.",
};

export function CaseAiPanel({ caseId, onTaskFiled }: { caseId: string; onTaskFiled?: () => void }) {
  const allowed = useCan();
  const canChrono = allowed("ai.documents", { write: false });
  const canBrief = allowed("draft.manage", { write: false });
  const canFile = allowed("task.create");
  const tabs = [
    canChrono ? { value: "chronology" as const, label: "التسلسل الزمني" } : null,
    canBrief ? { value: "briefing" as const, label: "إحاطة الجلسة" } : null,
    { value: "deadlines" as const, label: "المهل النظامية" },
  ].filter((t): t is { value: Tab; label: string } => t !== null);
  const [tab, setTab] = useState<Tab>(tabs[0].value);

  return (
    <Card className="overflow-hidden">
      <header className="flex items-start gap-3 px-5 pt-5 md:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime/30 text-pine-deep">
          <Sparkles className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-pine-deep">أدوات القضية</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-slate">
            تسلسل الوقائع من ملف القضية، وإحاطة الجلسة القادمة، وحساب مهل الاعتراض من نصوص الأنظمة.
          </p>
        </div>
      </header>
      <div className="mt-3">
        <Tabs label="أدوات القضية" value={tab} onChange={setTab} tabs={tabs} />
      </div>
      <div className="px-5 py-5 md:px-6">
        {tab === "deadlines" ? (
          <DeadlinesTab caseId={caseId} canFile={canFile} onFiled={onTaskFiled} />
        ) : (
          <ProductTab key={tab} caseId={caseId} kind={tab} />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Chronology and briefing                                                   */
/* ------------------------------------------------------------------------ */

function ProductTab({ caseId, kind }: { caseId: string; kind: CaseAiKind }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const [starting, setStarting] = useState(false);
  const res = useLoad(() => getCaseAi({ data: { workspaceId: wsId, caseId } }), [wsId, caseId]);
  const row = res.data?.[kind] ?? null;
  usePollPending(row ? [row] : null, res.reload, 3000);

  async function build() {
    setStarting(true);
    try {
      await buildCaseAi({ data: { workspaceId: wsId, caseId, kind } });
      await res.reload();
    } catch (err) {
      toast.error(aiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const noun = kind === "chronology" ? "التسلسل الزمني" : "إحاطة الجلسة";
  const pending = row?.status === "pending";

  if (res.error && !res.data) {
    return <p className="text-[13px] text-red-700">{res.error}</p>;
  }
  if (!res.data) return <Skeleton className="h-24 w-full" />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] leading-relaxed text-slate">
          {row && row.status !== "pending"
            ? `آخر إعداد ${whenAr(row.updated_at)}${row.created_by_name ? ` · ${row.created_by_name}` : ""}`
            : kind === "chronology"
              ? "يستخرج المساعد كل واقعة مؤرخة من مستندات القضية وملاحظاتها وجلساتها، مرتبة ومع مصدرها."
              : "ملخص للمحامي قبل الجلسة: الوقائع، موقف كل طرف، النقاط المفتوحة، الأسئلة المتوقعة والحجج مع سندها من الملفات والأنظمة."}
        </p>
        <Button
          size="sm"
          variant={row ? undefined : "dark"}
          icon={pending || starting ? Loader2 : row ? RotateCw : Sparkles}
          disabled={pending || starting}
          onClick={() => void build()}
          className={cn("h-10", (pending || starting) && "[&_svg]:motion-safe:animate-spin")}
        >
          {pending ? "جارٍ الإعداد…" : row ? "إعادة الإعداد" : `إعداد ${noun}`}
        </Button>
      </div>

      {pending ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-[13px] text-slate" role="status">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          يقرأ المساعد ملف القضية — قد يستغرق ذلك دقيقة أو دقيقتين. يمكنك مغادرة الصفحة والعودة.
        </p>
      ) : null}

      {row?.status === "failed" ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {ERROR_TEXT[row.error ?? ""] ?? "تعذّر الإعداد هذه المرة. أعد المحاولة."}
        </p>
      ) : null}

      {row?.status === "ready" && row.result ? (
        kind === "chronology" ? (
          <ChronologyView result={row.result as ChronologyResult} wsId={wsId} />
        ) : (
          <BriefingView result={row.result as BriefingResult} wsId={wsId} />
        )
      ) : null}
    </>
  );
}

/** A [مN صP] marker as links to the file at that page. */
function SourceLinks({ raw, sources, wsId }: { raw: string; sources: Source[]; wsId: string }): ReactNode {
  const refs = parseMarker(raw);
  if (!refs.length) return raw;
  return (
    <span className="inline-flex flex-wrap gap-1 align-baseline">
      {refs.map((r, i) => {
        const s = sources.find((x) => x.n === r.n);
        if (!s) return null;
        const href = documentUrl(wsId, s.documentId, true) + (r.page ? `#page=${r.page}` : "");
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={`${s.name}${r.page ? ` — صفحة ${r.page}` : ""}`}
            className="rounded-md bg-pine-50 px-1.5 font-ui text-[12px] font-bold text-pine hover:bg-pine-50/70 hover:underline"
          >
            م{r.n}
            {r.page ? ` ص${r.page}` : ""}
          </a>
        );
      })}
    </span>
  );
}

function ChronologyView({ result, wsId }: { result: ChronologyResult; wsId: string }) {
  if (!result.events.length) {
    return <p className="mt-4 text-[13px] text-slate">لم يجد المساعد وقائع مؤرخة في ملف القضية.</p>;
  }
  return (
    <>
      <ol className="relative mt-5 space-y-4 border-s-2 border-pine-50 ps-5">
        {result.events.map((e, i) => (
          <li key={i} className="relative">
            <span aria-hidden="true" className="absolute -start-[27px] top-1.5 size-3 rounded-full border-2 border-surface bg-pine" />
            <p className="font-ui text-[12.5px] font-bold text-pine tabular-nums">
              {e.iso ? dateAr(e.iso) : e.date}
              {e.iso && e.date && toLatinDigits(e.date) !== e.iso ? <span className="ms-2 font-normal text-slate">({e.date})</span> : null}
            </p>
            <p className="mt-0.5 text-[14px] leading-[1.8] text-pine-deep">{e.event}</p>
            {e.source ? (
              <p className="mt-0.5 text-[12px] text-slate">
                المصدر:{" "}
                {parseMarker(e.source).length ? <SourceLinks raw={e.source} sources={result.sources} wsId={wsId} /> : e.source}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-[12px] text-slate">مستخرج آليًا من ملف القضية — راجع التواريخ في مصادرها قبل الاعتماد عليها.</p>
    </>
  );
}

function BriefingView({ result, wsId }: { result: BriefingResult; wsId: string }) {
  return (
    <>
      {result.hearing ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-lime/20 px-4 py-3 text-[13px] font-semibold text-pine-deep">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          {result.hearing}
        </p>
      ) : null}
      <LightText
        className="mt-4"
        text={result.text}
        cite={(raw, key) => {
          const latin = toLatinDigits(raw);
          if (/ن\s*\d/.test(latin) && !/م\s*\d/.test(latin)) {
            const ns = [...latin.matchAll(/ن\s*(\d+)/g)].map((m) => Number(m[1]));
            return (
              <span key={key} className="inline-flex gap-1 align-baseline">
                {ns.map((n) => {
                  const a = result.articles.find((x) => x.n === n);
                  return a ? (
                    <a
                      key={n}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`${a.law_name} — ${a.seq}`}
                      className="rounded-md bg-lime/30 px-1.5 font-ui text-[12px] font-bold text-pine-deep hover:bg-lime/50"
                    >
                      ن{n}
                    </a>
                  ) : null;
                })}
              </span>
            );
          }
          return <SourceLinks key={key} raw={raw} sources={result.sources} wsId={wsId} />;
        }}
      />
      {result.articles.length ? (
        <details className="mt-5 rounded-xl border border-line">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-[13px] font-bold text-pine-deep">
            المواد النظامية المعروضة على المساعد ({result.articles.length})
          </summary>
          <ul className="space-y-3 border-t border-line px-4 py-3">
            {result.articles.map((a) => (
              <li key={a.n} className="text-[13px] leading-[1.9]">
                <p className="font-bold text-pine-deep">
                  ن{a.n}: {a.law_name} — {a.seq}
                </p>
                <p className="text-slate">{a.text}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="mt-5 text-[12px] text-slate">إحاطة آلية من ملف القضية ونصوص الأنظمة — للاستعانة بها في التحضير، لا تغني عن مراجعة المحامي.</p>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Deadlines                                                                 */
/* ------------------------------------------------------------------------ */

function DeadlinesTab({ caseId, canFile, onFiled }: { caseId: string; canFile: boolean; onFiled?: () => void }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const uid = useId();
  const rules = useLoad(() => deadlineRules({ data: { workspaceId: wsId } }), [wsId]);
  const [ruleId, setRuleId] = useState("appeal");
  const [start, setStart] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [preview, setPreview] = useState<DeadlinePreview | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "file">(null);
  const rule = rules.data?.find((r) => r.id === ruleId) ?? null;

  function reset() {
    setPreview(null);
  }

  async function compute() {
    if (!start) {
      toast.error("اختر تاريخ بداية المدة.");
      return;
    }
    setBusy("preview");
    try {
      setPreview(await previewDeadline({ data: { workspaceId: wsId, ruleId, start, urgent: urgent && Boolean(rule?.urgentDays) } }));
    } catch (err) {
      toast.error(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function file() {
    if (!preview) return;
    setBusy("file");
    try {
      const r = await fileDeadline({ data: { workspaceId: wsId, caseId, ruleId, start, urgent: preview.urgent } });
      toast.success(`أُضيفت مهمة على القضية مستحقة في ${dateAr(r.deadline)}`);
      onFiled?.();
    } catch (err) {
      toast.error(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (rules.error && !rules.data) return <p className="text-[13px] text-red-700">{rules.error}</p>;
  if (!rules.data) return <Skeleton className="h-24 w-full" />;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${uid}-rule`} label="نوع المهلة">
          <SelectInput
            id={`${uid}-rule`}
            value={ruleId}
            onChange={(e) => {
              setRuleId(e.target.value);
              setUrgent(false);
              reset();
            }}
          >
            {rules.data.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id={`${uid}-start`} label="تاريخ بداية المدة" hint={rule?.startsWhen}>
          <TextInput
            id={`${uid}-start`}
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              reset();
            }}
            className="font-ui"
          />
        </Field>
      </div>
      {rule?.urgentDays ? (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px] text-pine-deep">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => {
              setUrgent(e.target.checked);
              reset();
            }}
            className="size-4 accent-[var(--color-pine)]"
          />
          حكم في مسألة مستعجلة ({rule.urgentDays} أيام بدل {rule.days})
        </label>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="dark" icon={busy === "preview" ? Loader2 : CalendarClock} disabled={busy !== null} onClick={() => void compute()} className="h-10">
          احسب المهلة
        </Button>
      </div>

      {preview ? (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-4" role="status">
          <p className="text-[13px] text-slate">آخر يوم لتقديم {preview.rule.label}</p>
          <p className="mt-1 text-[20px] font-extrabold text-pine-deep">{dateAr(preview.deadline)}</p>
          <p
            className={cn(
              "mt-1 text-[13px] font-semibold",
              preview.daysLeft < 0 ? "text-red-700" : preview.daysLeft <= 5 ? "text-amber-700" : "text-pine",
            )}
          >
            {preview.daysLeft < 0
              ? `انقضت المهلة منذ ${Math.abs(preview.daysLeft)} يومًا`
              : preview.daysLeft === 0
                ? "اليوم آخر يوم"
                : `باقٍ ${preview.daysLeft} يومًا`}
          </p>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-[13px] leading-[1.8] text-pine-deep marker:text-pine/60">
            <li>
              المدة {preview.days} يومًا{preview.urgent ? " (مسألة مستعجلة)" : ""} — {preview.rule.law}، المادة ({preview.rule.article}).
            </li>
            <li>لا يُحسب يوم البداية ({dateAr(preview.start)}).</li>
            {preview.movedForWeekend ? (
              <li>آخر يوم بالعدّ {dateAr(preview.lastDay)} يوافق عطلة نهاية الأسبوع، فتمتد المهلة إلى أول يوم عمل.</li>
            ) : null}
            <li>إن وافق آخر المدة عطلة رسمية (كالأعياد) امتدت إلى أول يوم عمل بعدها (المادة 22 من نظام المرافعات الشرعية).</li>
          </ul>
          {preview.articles.length ? (
            <details className="mt-3">
              <summary className="min-h-10 cursor-pointer py-2 text-[13px] font-bold text-pine">نص المواد</summary>
              <ul className="space-y-3">
                {preview.articles.map((a) => (
                  <li key={`${a.law_serial}-${a.ord}`} className="rounded-xl bg-surface p-3 text-[13px] leading-[1.9]">
                    <a href={a.url} target="_blank" rel="noreferrer" className="font-bold text-pine-deep hover:underline">
                      {a.law_name} — {a.seq}
                    </a>
                    <p className="mt-1 text-slate">{a.text}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {canFile ? (
            <div className="mt-4 flex justify-end">
              <Button size="sm" icon={busy === "file" ? Loader2 : Clock} disabled={busy !== null} onClick={() => void file()} className="h-10">
                أضفها مهمة على القضية
              </Button>
            </div>
          ) : null}
          <p className="mt-3 text-[12px] text-slate">حساب آلي بالتقويم الميلادي — تحقّق من تاريخ التبليغ وأي عطلة رسمية قبل الاعتماد.</p>
        </div>
      ) : null}
    </>
  );
}
