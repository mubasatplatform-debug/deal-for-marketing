import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { lineStarters, serviceBySlug } from "@/lib/content";
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
import { cn } from "@/lib/utils";

function loadSession(): LineSession {
  try {
    const raw = sessionStorage.getItem(LINE_SESSION_KEY);
    if (!raw) return { messages: [], file: null };
    const parsed = JSON.parse(raw) as LineSession;
    if (!Array.isArray(parsed.messages)) return { messages: [], file: null };
    return {
      messages: parsed.messages.slice(0, 16),
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

export function DealLine() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

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
      const res = await routeLine({ data: { messages: next } });
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(text);
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

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-ink md:h-[calc(100dvh-4.5rem)]">
      <header className="shrink-0 border-b border-hair px-5 py-4 md:px-10 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-kicker text-lime">خط ديل //</p>
            <h1 className="mt-1 font-display text-xl text-snow md:mt-2 md:text-poster">خدمة عملاء. بلهجتك.</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-2 font-display text-xs text-lime">
              <span className="line-live size-1.5 bg-lime" />
              على الخط
            </span>
            {hydrated && messages.length > 0 ? (
              <button type="button" onClick={reset} className="inline-flex h-11 items-center font-display text-xs text-mist hover:text-lime">
                ابدأ من جديد
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 hidden max-w-lg text-sm leading-loose text-mist md:block">
          تكلّم كزبون: يراجع السداد والطلب والموعد. أو اطلب تشغيل الخط على محلك.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="flex min-h-0 flex-col border-hair md:border-l">
          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-6 md:px-10">
            {messages.length === 0 && !busy ? (
              <EmptyStarters onPick={(t) => void send(t)} />
            ) : (
              <>
                {messages.map((m, i) => (
                  <p
                    key={`${m.role}-${i}`}
                    className={cn(
                      "max-w-[88%] px-4 py-3 text-sm leading-relaxed",
                      m.role === "user" ? "me-auto bg-lime text-ink" : "ms-auto bg-card text-snow",
                    )}
                  >
                    {m.content}
                  </p>
                ))}
                {busy ? <Typing /> : null}
              </>
            )}
            {err ? <p className="text-sm text-lime">{err}</p> : null}
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-hair bg-ink px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-10 md:py-4"
          >
            <label className="sr-only" htmlFor="line-input">
              رسالتك لخط ديل
            </label>
            <textarea
              id="line-input"
              ref={inputRef}
              rows={2}
              maxLength={LINE_MAX_CHARS}
              value={text}
              disabled={busy || capped}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              placeholder={capped ? "بلغت حد الجلسة — حوّل الملف أو ابدأ من جديد." : "اكتب بلهجتك…"}
              className="w-full resize-none bg-transparent font-display text-base leading-relaxed text-snow outline-none placeholder:text-dim"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="font-ui text-micro tracking-widest text-dim">
                {remaining} / {LINE_MAX_TURNS}
              </p>
              <button
                type="submit"
                disabled={busy || capped || !text.trim()}
                className="h-11 min-w-28 border border-lime bg-lime px-6 font-display text-sm text-ink disabled:opacity-40"
              >
                {busy ? "يسمع…" : "أرسل"}
              </button>
            </div>
          </form>
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-t border-hair md:block md:border-t-0">
          <Thubut file={file} onFile={fileAsRequest} />
        </aside>
      </div>

      <div className="shrink-0 border-t border-hair md:hidden">
        <button
          type="button"
          onClick={() => setFileOpen(true)}
          className="flex h-14 w-full items-center justify-between bg-card px-5 text-right"
        >
          <span className="font-display text-sm text-snow">ملف الثبوت</span>
          <span className="font-display text-xs text-lime">{file ? file.route_label || "يتكوّن" : "فارغ"}</span>
        </button>
      </div>

      {fileOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/70 md:hidden" onClick={() => setFileOpen(false)}>
          <div
            className="max-h-[78dvh] w-full overflow-y-auto bg-ink pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex h-14 items-center justify-between border-b border-hair bg-ink px-5">
              <p className="font-display text-sm text-snow">ملف الثبوت</p>
              <button type="button" onClick={() => setFileOpen(false)} className="inline-flex h-11 items-center font-display text-sm text-lime">
                إغلاق
              </button>
            </div>
            <Thubut file={file} onFile={fileAsRequest} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyStarters({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div>
      <p className="text-sm leading-loose text-mist">ابدأ كزبون يتصل، أو كصاحب محل يبي الخط:</p>
      <ul className="mt-5 grid gap-px bg-hair sm:grid-cols-2">
        {lineStarters.map((s) => (
          <li key={s.label} className="bg-ink">
            <button
              type="button"
              onClick={() => onPick(s.text)}
              className="flex min-h-24 w-full flex-col items-start p-5 text-right hover:bg-card"
            >
              <span className="font-display text-xs text-lime">{s.label}</span>
              <span className="mt-2 text-sm leading-relaxed text-snow">{s.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex h-8 items-end gap-1 px-1" aria-live="polite" aria-label="الخط يكتب">
      <span className="line-wait-bar h-2 w-px bg-lime" />
      <span className="line-wait-bar h-4 w-px bg-lime" />
      <span className="line-wait-bar h-6 w-px bg-lime" />
      <span className="line-wait-bar h-3 w-px bg-lime" />
    </div>
  );
}

function Thubut({ file, onFile }: { file: LineTurn | null; onFile: () => void }) {
  const service = file && file.service_slug !== "unknown" ? serviceBySlug(file.service_slug) : undefined;
  const canFile = Boolean(file && service && (file.brief_so_far.trim().length >= 8 || file.intent.length >= 8));

  return (
    <div className="flex h-full flex-col px-5 py-6 md:px-6">
      <p className="text-kicker text-lime">ملف الثبوت //</p>
      <p className="mt-2 text-sm text-mist">يتكوّن مع كل رسالة. هذا ما يسمعه الفريق.</p>

      <dl className="mt-6 space-y-5">
        <Row k="اللهجة" v={file?.dialect_label} />
        <Row k="التوجيه" v={file?.route_label} accent />
        <Row k="الثقة" v={file ? `${Math.round(file.confidence)}٪` : undefined} />
        <Row k="النية" v={file?.intent} />
        <Row k="الخدمة" v={service?.title} accent />
        <div>
          <dt className="font-display text-xs text-dim">الحزمة</dt>
          <dd className="mt-2">
            {file && file.stack.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {file.stack.map((item) => (
                  <li key={item} className="file-in border border-hair px-2 py-1 font-display text-xs text-snow">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <Dash />
            )}
          </dd>
        </div>
        <div>
          <dt className="font-display text-xs text-dim">الموجز</dt>
          <dd className="mt-2 text-sm leading-loose text-snow">
            {file?.brief_so_far ? <span className="file-in block">{file.brief_so_far}</span> : <Dash />}
          </dd>
        </div>
        {file?.next_need ? (
          <Row k="ينقص" v={file.next_need} />
        ) : null}
      </dl>

      <div className="mt-auto pt-8">
        <button
          type="button"
          disabled={!canFile}
          onClick={onFile}
          className="h-12 w-full border border-lime bg-lime font-display text-sm text-ink disabled:border-hair disabled:bg-transparent disabled:text-dim"
        >
          {canFile ? "حوّل الملف لطلب" : "الملف يتكوّن…"}
        </button>
        {file?.company ? <p className="mt-3 text-center text-xs text-dim">{file.company}</p> : null}
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v?: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-display text-xs text-dim">{k}</dt>
      <dd className={cn("text-left font-display text-sm", accent ? "text-lime" : "text-snow")}>
        {v ? (
          <span key={v} className="file-in">
            {v}
          </span>
        ) : (
          <Dash />
        )}
      </dd>
    </div>
  );
}

function Dash() {
  return <span className="text-dim">—</span>;
}
