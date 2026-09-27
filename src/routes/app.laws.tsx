import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, Copy, ExternalLink, Landmark, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, EmptyState, Pill, Select } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { ErrorCard, ListSkeleton, Pagination, TextArea, useDebounced, useLoad } from "@/components/law/kit";
import { LightText } from "@/components/law/ai/light-text";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { toLatinDigits } from "@/components/law/ai/text-utils";
import { askLaws, getLawArticles, listLaws, searchLaws } from "@/lib/law/ai/laws";
import type { ArticleHit, LawRow, LawsAnswer } from "@/lib/law/ai/library-core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/laws")({
  component: LawsPage,
});

type Mode = "ask" | "search" | "browse";

function LawsPage() {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const laws = useLoad(() => listLaws({ data: { workspaceId: wsId } }), [wsId]);
  const [mode, setMode] = useState<Mode>("ask");
  const [law, setLaw] = useState("");
  const [browse, setBrowse] = useState<LawRow | null>(null);

  const inForce = useMemo(() => (laws.data ?? []).filter((l) => l.status !== "ملغي"), [laws.data]);
  const count = laws.data?.reduce((n, l) => n + l.article_count, 0) ?? 0;

  return (
    <>
      <PageHead
        title="الأنظمة"
        subtitle={
          laws.data?.length
            ? `${laws.data.length.toLocaleString("ar-SA")} نظامًا ولائحة و${count.toLocaleString("ar-SA")} مادة من البوابة القانونية لوزارة العدل — ابحث بالنص، أو اسأل وتأتيك الإجابة بالمواد.`
            : "الأنظمة واللوائح العدلية من البوابة القانونية لوزارة العدل."
        }
      />
      <div role="tablist" aria-label="طريقة الاستخدام" className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["ask", "اسأل الأنظمة", Sparkles],
            ["search", "بحث في المواد", Search],
            ["browse", "تصفّح الأنظمة", BookOpenText],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={mode === v}
            onClick={() => {
              setMode(v);
              setBrowse(null);
            }}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-[13.5px] font-semibold transition-colors",
              mode === v ? "border-pine bg-pine text-snow" : "border-line bg-surface text-pine-deep hover:border-line-strong",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {laws.error ? (
        <ErrorCard title="تعذّر تحميل الأنظمة" message={laws.error} onRetry={laws.reload} />
      ) : laws.loading && !laws.data ? (
        <ListSkeleton rows={4} />
      ) : !laws.data?.length ? (
        <Card>
          <EmptyState icon={Landmark} title="مكتبة الأنظمة غير محمّلة بعد" body="تُحمَّل الأنظمة تلقائيًا مع التحديث القادم للمنصة." />
        </Card>
      ) : mode === "browse" ? (
        browse ? (
          <LawArticles wsId={wsId} law={browse} onBack={() => setBrowse(null)} />
        ) : (
          <LawGrid laws={laws.data} onOpen={setBrowse} />
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label htmlFor="law-filter" className="text-[13px] font-semibold text-slate">
              النظام
            </label>
            <Select id="law-filter" value={law} onChange={(e) => setLaw(e.target.value)} className="min-w-0 max-w-full flex-1 sm:max-w-sm">
              <option value="">كل الأنظمة السارية</option>
              {inForce.map((l) => (
                <option key={l.serial} value={l.serial}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          {mode === "ask" ? <AskPanel wsId={wsId} law={law} /> : <SearchPanel wsId={wsId} law={law} />}
        </>
      )}
      <p className="mt-6 text-[12.5px] leading-relaxed text-slate">
        المصدر: البوابة القانونية لوزارة العدل (laws.moj.gov.sa). النصوص للاسترشاد؛ ارجع إلى المصدر الرسمي قبل الاستناد إليها، وتحقق من آخر التعديلات.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function ArticleCard({ a, n, open }: { a: ArticleHit; n?: number; open?: boolean }) {
  const [expanded, setExpanded] = useState(Boolean(open));
  const long = a.text.length > 420;
  const text = expanded || !long ? a.text : `${a.text.slice(0, 420)}…`;
  const copy = () => {
    void navigator.clipboard
      ?.writeText(`${a.law_name} — ${a.seq}\n${a.text}`)
      .then(() => toast.success("نُسخ نص المادة"))
      .catch(() => toast.error("تعذّر النسخ"));
  };
  return (
    <li id={n ? `law-${n}` : undefined} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {n ? <span className="rounded-md bg-lime/30 px-1.5 font-ui text-[12px] font-bold text-pine-deep">ن{n}</span> : null}
        <p className="text-[14px] font-bold text-pine-deep">{a.law_name}</p>
        <span className="text-slate">·</span>
        <p className="text-[14px] font-semibold text-pine">{a.seq}</p>
        {a.law_status === "ملغي" ? <Pill tone="neutral">ملغي</Pill> : null}
      </div>
      {a.heading ? <p className="mt-1 text-[12.5px] text-slate">{a.heading}</p> : null}
      <p className="mt-3 text-[14px] leading-[1.95] whitespace-pre-line text-pine-deep">{text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
        {long ? (
          <button type="button" className="min-h-9 font-semibold text-pine hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "عرض أقل" : "النص كاملًا"}
          </button>
        ) : null}
        <button type="button" onClick={copy} className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-slate hover:text-pine-deep">
          <Copy className="size-3.5" aria-hidden="true" />
          نسخ
        </button>
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-slate hover:text-pine-deep">
          <ExternalLink className="size-3.5" aria-hidden="true" />
          المصدر الرسمي
        </a>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------ */

type Turn = { q: string; res: LawsAnswer };

const SUGGESTIONS = [
  "ما مدة الاعتراض على الحكم بالاستئناف؟",
  "متى يحق للمدعى عليه طلب رد القاضي؟",
  "ما حجية المحرر العادي في الإثبات؟",
  "ما شروط صحة عقد البيع في نظام المعاملات المدنية؟",
  "متى تسقط دعوى المسؤولية عن الفعل الضار؟",
];

function AskPanel({ wsId, law }: { wsId: string; law: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await askLaws({ data: { workspaceId: wsId, question: text, law: law || null } });
      setTurns((t) => [{ q: text, res }, ...t].slice(0, 8));
      setQ("");
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(q);
  };

  return (
    <>
      <Card className="p-4 md:p-5">
        <form onSubmit={submit}>
          <label htmlFor="laws-q" className="mb-2 block text-[14px] font-bold text-pine-deep">
            سؤالك النظامي
          </label>
          <TextArea
            id="laws-q"
            rows={3}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="مثال: ما المدة النظامية للاعتراض على حكم ابتدائي؟ وما أثر فواتها؟"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask(q);
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || q.trim().length < 3} className={buttonClass("primary")}>
              {busy ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {busy ? "يبحث في المواد…" : "اسأل"}
            </button>
            {error ? (
              <p role="alert" className="text-[13px] text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void ask(s)}
              className="min-h-9 rounded-full border border-line bg-paper px-3 text-start text-[12.5px] font-semibold text-pine-deep hover:border-line-strong disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      <ol className="mt-5 space-y-5" aria-label="الأسئلة والإجابات">
        {turns.map((t, i) => (
          <li key={`${i}-${t.q}`}>
            <Card className="p-4 md:p-5">
              <p className="text-[13px] font-semibold text-slate">س: {t.q}</p>
              <LightText
                className="mt-3"
                text={t.res.answer}
                cite={(raw, key) => {
                  const ns = [...toLatinDigits(raw).matchAll(/ن\s*(\d+)/g)].map((m) => Number(m[1]));
                  if (!ns.length) return raw;
                  return (
                    <span key={key} className="inline-flex gap-1 align-baseline">
                      {ns.map((n) => {
                        const a = t.res.articles.find((x) => x.n === n);
                        return (
                          <a
                            key={n}
                            href={`#law-${n}`}
                            title={a ? `${a.law_name} — ${a.seq}` : undefined}
                            className="rounded-md bg-lime/30 px-1.5 font-ui text-[12px] font-bold text-pine-deep hover:bg-lime/50"
                          >
                            ن{n}
                          </a>
                        );
                      })}
                    </span>
                  );
                }}
              />
              {t.res.articles.length ? (
                <>
                  <p className="mt-5 text-[13px] font-bold text-pine-deep">المواد التي بُنيت عليها الإجابة</p>
                  <ul className="mt-2 space-y-3">
                    {t.res.articles.map((a) => (
                      <ArticleCard key={`${a.law_serial}-${a.ord}`} a={a} n={i === 0 ? a.n : undefined} />
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="mt-4 text-[12px] text-slate">إجابة آلية من نصوص المواد المعروضة فقط — تحقّق منها قبل الاستناد إليها.</p>
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function SearchPanel({ wsId, law }: { wsId: string; law: string }) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 350);
  const hits = useLoad(
    () => (query.length >= 2 ? searchLaws({ data: { workspaceId: wsId, query, law: law || null } }) : Promise.resolve(null)),
    [wsId, query, law],
  );
  return (
    <>
      <label htmlFor="laws-search" className="sr-only">
        ابحث في نصوص المواد
      </label>
      <span className="relative block">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
        <input
          id="laws-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="كلمات من نص المادة، مثل: رد القاضي، المحرر العادي، التعويض عن الضرر"
          className="h-12 w-full rounded-xl border border-line bg-surface ps-10 pe-3 text-[14.5px] text-pine-deep outline-none placeholder:text-slate/70 focus:border-pine/40 focus:ring-4 focus:ring-pine/10"
        />
      </span>
      <div className="mt-4">
        {hits.error ? (
          <ErrorCard title="تعذّر البحث" message={hits.error} onRetry={hits.reload} />
        ) : hits.loading && query ? (
          <ListSkeleton rows={3} />
        ) : hits.data === null || hits.data === undefined ? (
          <p className="text-[13px] text-slate">اكتب كلمتين على الأقل.</p>
        ) : !hits.data.length ? (
          <Card>
            <EmptyState icon={Search} title="لا نتائج" body="جرّب كلمات أخرى أو أزل تحديد النظام." />
          </Card>
        ) : (
          <ul className="space-y-3">
            {hits.data.map((a) => (
              <ArticleCard key={`${a.law_serial}-${a.ord}`} a={a} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function LawGrid({ laws, onOpen }: { laws: LawRow[]; onOpen: (l: LawRow) => void }) {
  const [q, setQ] = useState("");
  const shown = laws.filter((l) => !q.trim() || l.name.includes(q.trim()));
  return (
    <>
      <input
        type="search"
        aria-label="تصفية الأنظمة بالاسم"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="اسم النظام أو اللائحة"
        className="mb-4 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-pine-deep outline-none placeholder:text-slate/70 focus:border-pine/40 focus:ring-4 focus:ring-pine/10 sm:max-w-sm"
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((l) => (
          <li key={l.serial}>
            <button
              type="button"
              onClick={() => onOpen(l)}
              className="flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-4 text-start transition-colors hover:border-line-strong"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-bold text-pine-deep">{l.name}</span>
                {l.status === "ملغي" ? <Pill tone="neutral">ملغي</Pill> : null}
              </span>
              <span className="mt-1 text-[12.5px] text-slate">
                {l.type}
                {l.article_count ? ` · ${l.article_count.toLocaleString("ar-SA")} مادة` : ""}
                {l.tool ? ` · ${l.tool}` : ""}
              </span>
              {l.summary ? <span className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate">{l.summary}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function LawArticles({ wsId, law, onBack }: { wsId: string; law: LawRow; onBack: () => void }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [law.serial]);
  const data = useLoad(() => getLawArticles({ data: { workspaceId: wsId, serial: law.serial, page } }), [wsId, law.serial, page]);
  return (
    <>
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep">
        <ArrowRight className="size-4" aria-hidden="true" />
        كل الأنظمة
      </button>
      <Card className="mb-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[17px] font-extrabold text-pine-deep">{law.name}</h2>
          <Pill tone={law.status === "ملغي" ? "neutral" : "pine"}>{law.status || law.type}</Pill>
        </div>
        <p className="mt-1 text-[13px] text-slate">
          {[law.type, law.tool, law.issued ? `صدر ${law.issued.replaceAll("-", "/")}هـ` : null].filter(Boolean).join(" · ")}
        </p>
        {law.summary ? <p className="mt-3 text-[13.5px] leading-relaxed text-pine-deep">{law.summary}</p> : null}
        <a href={law.url} target="_blank" rel="noopener noreferrer" className={cn(buttonClass("secondary"), "mt-3")}>
          <ExternalLink className="size-4" aria-hidden="true" />
          المصدر الرسمي
        </a>
      </Card>
      {data.error ? (
        <ErrorCard title="تعذّر تحميل المواد" message={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          <ul className="space-y-3">
            {data.data.articles.map((a) => (
              <ArticleCard key={a.ord} a={a} open />
            ))}
          </ul>
          <div className="mt-4">
            <Pagination page={page} total={data.data.total} pageSize={50} onPage={setPage} />
          </div>
        </>
      )}
    </>
  );
}
