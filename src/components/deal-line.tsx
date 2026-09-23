import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { serviceBySlug } from "@/lib/content";
import {
  LINE_DRAFT_KEY,
  LINE_MAX_CHARS,
  LINE_MAX_TURNS,
  LINE_SESSION_KEY,
  routeLine,
  type LineMessage,
  type LineSession,
  type LineTurn,
} from "@/lib/line";
import { Composer } from "@/components/line/composer";
import { FilePanel } from "@/components/line/file-panel";
import { FileSheet } from "@/components/line/file-sheet";
import { BrandMark, LiveDot, PlayMark } from "@/components/line/marks";
import { MessageList } from "@/components/line/messages";
import { EmptyStarters } from "@/components/line/starters";

/** Server accepts at most this many messages; always send (and keep) the latest ones. */
const LINE_MAX_MESSAGES = LINE_MAX_TURNS * 2;

function loadSession(): LineSession {
  try {
    const raw = sessionStorage.getItem(LINE_SESSION_KEY);
    if (!raw) return { messages: [], file: null };
    const parsed = JSON.parse(raw) as LineSession;
    if (!Array.isArray(parsed.messages)) return { messages: [], file: null };
    return {
      messages: parsed.messages.slice(-LINE_MAX_MESSAGES),
      file: parsed.file ?? null,
    };
  } catch {
    return { messages: [], file: null };
  }
}

function saveSession(session: LineSession) {
  try {
    sessionStorage.setItem(LINE_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota */
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DealLine() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sheetTrigger = useRef<HTMLButtonElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [file, setFile] = useState<LineTurn | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fileOpen, setFileOpen] = useState(false);

  useEffect(() => {
    const s = loadSession();
    setMessages(s.messages);
    setFile(s.file);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSession({ messages, file });
  }, [hydrated, messages, file]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || (messages.length === 0 && !busy && !err)) return;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, busy, err]);

  const closeSheet = useCallback(() => setFileOpen(false), []);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const remaining = Math.max(0, LINE_MAX_TURNS - userTurns);
  const capped = remaining === 0;

  async function send(raw: string) {
    const content = raw.trim().slice(0, LINE_MAX_CHARS);
    if (!content || busy || capped) return;
    const next: LineMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    setErr("");
    setBusy(true);
    try {
      const res = await routeLine({ data: { messages: next.slice(-LINE_MAX_MESSAGES) } });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setFile(res.turn);
      setMessages((prev) => [...prev, { role: "assistant", content: res.turn.reply }]);
    } catch {
      setErr("تعذر الوصول للخط. حاول مرة أخرى.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setMessages([]);
    setFile(null);
    setErr("");
    setText("");
    setFileOpen(false);
    try {
      sessionStorage.removeItem(LINE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
  }

  function fileAsRequest() {
    if (!file || file.service_slug === "unknown") return;
    const service = serviceBySlug(file.service_slug);
    if (!service) return;
    const brief = file.brief_so_far.trim() || file.intent;
    if (brief.length < 8) return;
    try {
      sessionStorage.setItem(
        LINE_DRAFT_KEY,
        JSON.stringify({
          slug: service.slug,
          company: file.company,
          brief,
        }),
      );
    } catch {
      /* ignore */
    }
    void navigate({ to: "/start/$slug", params: { slug: service.slug } });
  }

  const empty = messages.length === 0 && !busy;
  const confidence = file ? Math.round(file.confidence) : 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-paper md:h-[calc(100dvh-72px)]">
      <header className="relative shrink-0 border-b border-line bg-surface px-4 py-3 md:px-10 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-lg font-semibold leading-tight text-pine-deep md:text-xl">خط ديل</h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pine">
                  <LiveDot />
                  متصل
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs leading-snug text-slate">
                <span className="shrink-0 rounded border border-pine-soft bg-pine px-1 font-ui text-micro font-bold tracking-[0.14em] text-snow">
                  AI
                </span>
                <span>تجربة ذكاء اصطناعي — لا تشارك بيانات حساسة</span>
              </p>
            </div>
          </div>

          {hydrated && messages.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              aria-label="ابدأ محادثة جديدة"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-slate transition-colors hover:border-pine hover:text-pine-deep"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v3h3" />
              </svg>
              <span className="hidden sm:inline">ابدأ من جديد</span>
            </button>
          ) : null}
        </div>
        <span aria-hidden="true" className="absolute -bottom-px start-0 h-px w-16 bg-lime md:w-24" />
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_25rem]">
        <section aria-label="المحادثة" className="flex min-h-0 flex-col md:border-e md:border-line">
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-10 md:py-10">
            <div className="mx-auto w-full max-w-3xl">
              {empty ? (
                <EmptyStarters onPick={(t) => void send(t)} disabled={!hydrated} />
              ) : (
                <MessageList messages={messages} busy={busy} />
              )}
              {err ? (
                <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-lime bg-lime-50 px-4 py-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-lime-600" />
                  <p className="text-sm leading-relaxed text-pine-deep">{err}</p>
                </div>
              ) : null}
            </div>
          </div>

          <button
            ref={sheetTrigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={fileOpen}
            onClick={() => setFileOpen(true)}
            className="on-dark flex h-12 w-full shrink-0 items-center gap-3 border-t border-pine bg-pine-deep px-4 text-start md:hidden"
          >
            <span className="shrink-0 font-display text-sm font-semibold text-snow">ملف الثبوت</span>
            <span aria-hidden="true" className="h-[3px] min-w-6 flex-1 bg-pine">
              <span
                className="block h-full bg-lime motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${confidence}%` }}
              />
            </span>
            <span className="shrink-0 font-display text-xs text-lime">
              {file ? file.route_label || "يتكوّن" : <span className="text-mist">فارغ</span>}
            </span>
            {file ? (
              <span dir="ltr" className="shrink-0 font-ui text-xs font-semibold tabular-nums text-mist">
                {confidence}%
              </span>
            ) : null}
            <PlayMark className="h-2.5 shrink-0 -rotate-90 text-lime" />
          </button>

          <Composer
            inputRef={inputRef}
            text={text}
            onText={setText}
            onSend={() => void send(text)}
            busy={busy}
            capped={capped}
            remaining={remaining}
          />
        </section>

        <aside aria-labelledby="line-file-aside" className="on-dark hidden min-h-0 overflow-y-auto bg-pine-deep md:block">
          <FilePanel file={file} onFile={fileAsRequest} titleId="line-file-aside" />
        </aside>
      </div>

      <FileSheet open={fileOpen} onClose={closeSheet} file={file} onFile={fileAsRequest} trigger={sheetTrigger} />
    </div>
  );
}
