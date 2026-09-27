import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowUp, Copy, FileText, Loader2, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Skeleton } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { documentUrl } from "@/components/law/documents-ui";
import { TextArea } from "@/components/law/kit";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { LightText } from "@/components/law/ai/light-text";
import { parseMarker } from "@/components/law/ai/text-utils";
import { askDocuments, getFilesStatus, type FilesStatus } from "@/lib/law/ai/ai";
import type { AskResult, SourceDoc } from "@/lib/law/ai/docai-core";
import { can } from "@/lib/law/permissions";
import { cn } from "@/lib/utils";

/**
 * «اسأل ملفات القضية» — questions over a case's (or a client's) own files,
 * answered only from their text with [مN صP] citations that open the file at
 * that page. Asking is reading, so it stays available in a read-only office.
 */

const SUGGESTIONS = [
  "لخّص القضية من المستندات",
  "ما طلبات كل طرف؟",
  "استخرج التواريخ والمهل المهمة",
  "ما نقاط الضعف في موقف الخصم؟",
  "ما المستندات الناقصة؟",
];

const POLL_MS = 5000;
const POLL_FOR_MS = 2 * 60_000;
const HISTORY_MAX = 6;

/** Same rule as the server's reader (docai-core `readable`). */
const readable = (name: string) => /\.(pdf|docx|jpe?g|png|webp)$/i.test(name);
const filesWord = (n: number) => (n < 3 ? "ملف" : n <= 10 ? "ملفات" : "ملفًا");
const unread = (d: SourceDoc) => d.text_status === null && readable(d.name);

type Turn = { id: number; q: string; result?: AskResult; error?: string };

const SKIP_REASON: Record<string, string> = {
  empty: "لا نص فيه",
  unsupported: "نوع لا يُقرأ",
  failed: "تعذّرت قراءته",
};

export function FilesAiPanel({ caseId, clientId }: { caseId?: string; clientId?: string }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const uid = useId();
  const target = caseId ? { caseId } : { clientId: clientId ?? null };
  const targetKey = caseId ?? clientId ?? "";

  const [status, setStatus] = useState<FilesStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const seq = useRef(0);
  const pollUntil = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const s = await getFilesStatus({ data: { workspaceId: wsId, ...target } });
      setStatus(s);
      setStatusError(null);
    } catch (err) {
      setStatusError(aiErrorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, targetKey]);

  useEffect(() => {
    pollUntil.current = Date.now() + POLL_FOR_MS;
    setStatus(null);
    setTurns([]);
    void loadStatus();
  }, [loadStatus]);

  // Re-check while files are still being read (the server reads them in the background).
  const reading = status?.docs.filter(unread).length ?? 0;
  useEffect(() => {
    if (!reading || Date.now() > pollUntil.current) return;
    const t = setTimeout(() => void loadStatus(), POLL_MS);
    return () => clearTimeout(t);
  }, [status, reading, loadStatus]);

  useEffect(() => {
    if (!asking) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [asking]);

  if (!can(active.role, "ai.documents")) return null;

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 2 || asking) return;
    const id = (seq.current += 1);
    setAsking(true);
    setQuestion("");
    setTurns((t) => [{ id, q: text }, ...t].slice(0, HISTORY_MAX));
    try {
      const result = await askDocuments({ data: { workspaceId: wsId, ...target, question: text } });
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, result } : x)));
    } catch (err) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: aiErrorMessage(err) } : x)));
    } finally {
      setAsking(false);
      pollUntil.current = Date.now() + POLL_FOR_MS;
      void loadStatus();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  const docs = status?.docs ?? [];
  const ready = docs.filter((d) => d.text_status === "ready").length;
  const other = docs.length - ready - reading;
  const noun = caseId ? "القضية" : "العميل";

  return (
    <Card className="overflow-hidden">
      <header className="flex items-start gap-3 px-5 pt-5 md:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime-50 text-lime-600">
          <Sparkles className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-pine-deep">اسأل ملفات {noun}</h2>
          <p className="mt-0.5 text-[13px] text-slate" aria-live="polite">
            {status === null && !statusError ? (
              <Skeleton className="mt-1 h-3.5 w-40" />
            ) : statusError ? (
              <span className="text-red-700">{statusError}</span>
            ) : docs.length === 0 ? (
              `لا ملفات بعد — ارفع مستندات ${noun} لتسأل عنها.`
            ) : (
              <>
                قُرئ <Num>{ready}</Num> من <Num>{docs.length}</Num> {filesWord(docs.length)}
                {reading ? (
                  <>
                    {" · "}
                    <span className="inline-flex items-center gap-1 text-pine">
                      <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />
                      <Num>{reading}</Num> قيد القراءة
                    </span>
                  </>
                ) : null}
                {other > 0 ? (
                  <>
                    {" · "}
                    <Num>{other}</Num> لا يُقرأ
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        {statusError ? (
          <button
            type="button"
            aria-label="إعادة تحميل حالة الملفات"
            onClick={() => void loadStatus()}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
          >
            <RotateCw className="size-4" />
          </button>
        ) : null}
      </header>

      {status && !status.aiAvailable ? (
        <div className="mx-5 my-5 flex items-start gap-3 rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-slate ring-1 ring-line md:mx-6">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            المساعد القانوني غير متاح لمكتبك حاليًا — ليس ضمن الخطة أو لم يُفعَّل بعد.
            {active.role === "owner" || active.role === "admin" ? (
              <>
                {" "}
                <Link to="/app/billing" className="font-semibold text-pine hover:underline">
                  عرض الخطط
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : (
        <div className="px-5 pt-4 pb-5 md:px-6">
          <form onSubmit={submit} className="space-y-3">
            <label htmlFor={`${uid}-q`} className="sr-only">
              سؤالك عن ملفات {noun}
            </label>
            <div className="relative">
              <TextArea
                id={`${uid}-q`}
                rows={2}
                maxLength={2000}
                value={question}
                disabled={!status || asking}
                placeholder="اسأل عن الوقائع، المبالغ، التواريخ، أو اطلب ملخصًا…"
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey) && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void ask(question);
                  }
                }}
                className="min-h-[88px] pe-14 text-[14.5px]"
              />
              <button
                type="submit"
                aria-label="اسأل"
                disabled={!status || asking || question.trim().length < 2}
                className="absolute end-2.5 bottom-2.5 grid size-10 place-items-center rounded-xl bg-lime text-pine-deep transition-colors hover:bg-[#b3bf28] disabled:opacity-40"
              >
                {asking ? <Loader2 className="size-4 motion-safe:animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
            <div className="-mx-1 flex flex-wrap gap-2 px-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!status || asking || docs.length === 0}
                  onClick={() => void ask(s)}
                  className="inline-flex min-h-10 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-pine-deep transition-colors hover:border-pine/30 hover:bg-paper disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </form>

          {turns.length ? (
            <ol className="mt-5 space-y-4" aria-label="الأسئلة والإجابات">
              {turns.map((t, i) => (
                <TurnView key={t.id} turn={t} wsId={wsId} elapsed={elapsed} latest={i === 0} />
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="font-ui tabular-nums">{children}</span>;
}

function TurnView({ turn, wsId, elapsed, latest }: { turn: Turn; wsId: string; elapsed: number; latest: boolean }) {
  const [open, setOpen] = useState(latest);
  useEffect(() => setOpen(latest), [latest]);
  const r = turn.result;
  const byN = new Map(r?.sources.map((s) => [s.n, s]) ?? []);

  const cite = (raw: string, key: string) => {
    const refs = parseMarker(raw).filter((x) => byN.has(x.n));
    if (!refs.length) return <span key={key}>{raw}</span>;
    return (
      <span key={key} className="whitespace-nowrap">
        {refs.map((x, i) => {
          const s = byN.get(x.n)!;
          const where = x.page ? (s.method === "docx" ? `جزء ${x.page}` : `ص${x.page}`) : "";
          const href = documentUrl(wsId, s.documentId, true) + (x.page && s.method !== "docx" ? `#page=${x.page}` : "");
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener"
              title={`${s.name}${where ? ` — ${where}` : ""}`}
              aria-label={`فتح «${s.name}»${where ? ` عند ${where}` : ""}`}
              className="mx-0.5 inline-flex h-6 items-center gap-1 rounded-md bg-pine-50 px-1.5 align-middle text-[11.5px] leading-none font-bold text-pine ring-1 ring-pine-100 ring-inset hover:bg-pine hover:text-snow"
            >
              م<span className="font-ui tabular-nums">{x.n}</span>
              {x.page ? (
                <span className="font-normal opacity-80">
                  {s.method === "docx" ? "ج" : "ص"}
                  <span className="font-ui tabular-nums">{x.page}</span>
                </span>
              ) : null}
            </a>
          );
        })}
      </span>
    );
  };

  return (
    <li className="rounded-2xl ring-1 ring-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-start gap-2 rounded-t-2xl bg-paper px-4 py-2.5 text-start text-[13.5px] font-bold text-pine-deep"
      >
        <span className="text-slate" aria-hidden="true">
          س:
        </span>
        <span className="min-w-0 flex-1 break-words">{turn.q}</span>
      </button>
      {open ? (
        <div className="px-4 py-4">
          {!r && !turn.error ? (
            <div className="flex items-start gap-3 text-[13.5px] text-slate" role="status">
              <Loader2 className="mt-0.5 size-4 shrink-0 text-pine motion-safe:animate-spin" aria-hidden="true" />
              <div>
                <p className="font-semibold text-pine-deep">يقرأ المساعد المستندات ويكتب الإجابة…</p>
                <p className="mt-0.5">
                  قد يستغرق ذلك حتى 40 ثانية{elapsed > 2 ? <> · <Num>{elapsed}</Num> ث</> : null}
                </p>
                <div className="mt-3 space-y-2" aria-hidden="true">
                  <Skeleton className="h-3 w-72 max-w-full" />
                  <Skeleton className="h-3 w-60 max-w-full" />
                  <Skeleton className="h-3 w-44 max-w-full" />
                </div>
              </div>
            </div>
          ) : turn.error ? (
            <p className="flex items-start gap-2 text-[13.5px] text-red-700" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {turn.error}
            </p>
          ) : r ? (
            <>
              <LightText text={r.answer} cite={cite} />
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Copy}
                  className="h-10"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(r.answer)
                      .then(() => toast.success("نُسخت الإجابة"))
                      .catch(() => toast.error("تعذّر النسخ"))
                  }
                >
                  نسخ الإجابة
                </Button>
              </div>
              {r.sources.length ? (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[12px] font-semibold text-slate">المصادر</p>
                  <ol className="mt-1.5 space-y-0.5">
                    {r.sources.map((s) => (
                      <li key={s.n}>
                        <a
                          href={documentUrl(wsId, s.documentId, true)}
                          target="_blank"
                          rel="noopener"
                          className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-[13px] hover:bg-paper"
                        >
                          <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-md bg-pine-50 px-1.5 text-[11.5px] font-bold whitespace-nowrap text-pine">
                            م<Num>{s.n}</Num>
                          </span>
                          <FileText className="size-4 shrink-0 text-slate" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate font-semibold text-pine-deep">{s.name}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <Notes r={r} />
              <p className="mt-3 text-[11.5px] text-slate">إجابة آلية من نصوص الملفات فقط — تحقّق منها بالرجوع إلى المستند.</p>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Notes({ r }: { r: AskResult }) {
  const notes: string[] = [];
  if (r.partial) notes.push("الملفات طويلة، فأُرسل منها أقرب المقاطع للسؤال — قد تفوت الإجابةَ تفاصيل في مواضع أخرى.");
  if (r.pending.length) notes.push(`قيد القراءة ولم تدخل في الإجابة: ${r.pending.map((p) => `«${p.name}»`).join("، ")}.`);
  if (r.skipped.length) {
    notes.push(
      `لم تُقرأ: ${r.skipped.map((s) => `«${s.name}» (${SKIP_REASON[s.reason] ?? "لا يُقرأ"})`).join("، ")}.`,
    );
  }
  if (!notes.length) return null;
  return (
    <ul className={cn("mt-3 space-y-1.5 rounded-xl bg-lime-50/60 px-4 py-3 text-[12.5px] leading-relaxed text-pine-deep ring-1 ring-lime/40")}>
      {notes.map((n) => (
        <li key={n} className="flex gap-2">
          <span aria-hidden="true">•</span>
          <span className="min-w-0 flex-1 break-words">{n}</span>
        </li>
      ))}
    </ul>
  );
}
