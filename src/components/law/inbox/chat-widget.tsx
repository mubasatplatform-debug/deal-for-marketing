import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Loader2, MessagesSquare, SendHorizontal, UserRound, X } from "lucide-react";
import { timeAr } from "@/components/law/format";
import { pollChat, sendChat, startChat } from "@/lib/law/inbox-public";
import type { ConvStatus, VisitorMessage, VisitorPoll } from "@/lib/law/inbox-core";
import { normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * «الدردشة المباشرة» — the office's web-chat widget on its public booking
 * page. A floating launcher opens a panel (a full-screen sheet on phones):
 * the visitor starts with their name, optional phone and first message, then
 * chats with the office (or its AI first responder). The conversation token
 * stays in this tab's sessionStorage; new messages arrive by polling every 4s
 * while the panel is open (slower when the tab is hidden or the panel is
 * closed). Focus is trapped in the panel, Esc closes it, and new replies are
 * announced to screen readers.
 */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const OPEN_MS = 4000;
const HIDDEN_MS = 20_000;
const CLOSED_MS = 30_000;

function storageKey(slug: string) {
  return `law-chat:${slug}`;
}
function readToken(slug: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(slug));
  } catch {
    return null;
  }
}
function writeToken(slug: string, token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(storageKey(slug), token);
    else window.sessionStorage.removeItem(storageKey(slug));
  } catch {
    /* private mode: the chat still works for this page view */
  }
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  return /[؀-ۿ]/.test(msg) ? msg : "تعذّر الإرسال. تحقق من الاتصال وأعد المحاولة.";
}

function merge(cur: VisitorMessage[], next: VisitorMessage[]): VisitorMessage[] {
  if (next.length === 0) return cur;
  const byId = new Map(cur.map((m) => [m.id, m]));
  for (const m of next) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function ChatWidget({ slug, office, welcome }: { slug: string; office: string; welcome: string }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<VisitorMessage[]>([]);
  const [status, setStatus] = useState<ConvStatus>("open");
  const [unseen, setUnseen] = useState(0);
  const [announce, setAnnounce] = useState("");
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const openRef = useRef(open);
  openRef.current = open;

  // Restore this tab's conversation.
  useEffect(() => setToken(readToken(slug)), [slug]);

  const apply = useCallback((poll: VisitorPoll, initial = false) => {
    setStatus(poll.status);
    setMessages((cur) => merge(cur, poll.messages));
    const fresh = poll.messages.filter((m) => m.from !== "me" && !seen.current.has(m.id));
    for (const m of poll.messages) seen.current.add(m.id);
    if (!initial && fresh.length) {
      const last = fresh[fresh.length - 1];
      setAnnounce(`${last.from === "ai" ? "رد المساعد الآلي" : "رد من المكتب"}: ${last.body}`);
      if (!openRef.current) setUnseen((n) => n + fresh.length);
    }
  }, []);

  const since = messages.length ? messages[messages.length - 1].at : null;
  const sinceRef = useRef(since);
  sinceRef.current = since;

  // Poll: every 4s while open, slower when hidden or closed.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = sinceRef.current === null;
    const tick = async () => {
      try {
        const poll = await pollChat({ data: { slug, token, since: sinceRef.current } });
        if (!alive) return;
        if (poll === null) {
          writeToken(slug, null);
          setToken(null);
          setMessages([]);
          seen.current.clear();
          return;
        }
        apply(poll, first);
        first = false;
      } catch {
        /* keep polling; a transient failure is not the visitor's problem */
      }
      if (!alive) return;
      const delay = document.hidden ? HIDDEN_MS : openRef.current ? OPEN_MS : CLOSED_MS;
      timer = setTimeout(tick, delay);
    };
    void tick();
    const onVisible = () => {
      if (!document.hidden && openRef.current) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, slug, open, apply]);

  // Focus trap, Esc, and the phone sheet's scroll lock.
  useEffect(() => {
    if (!open) return;
    setUnseen(0);
    const btn = launcher.current;
    const t = setTimeout(() => {
      const el =
        panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus();
    }, 30);
    const small = window.matchMedia("(max-width: 639px)").matches;
    const prev = document.body.style.overflow;
    if (small) document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      btn?.focus();
    };
  }, [open]);

  const titleId = `${uid}-title`;

  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      {open ? (
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          dir="rtl"
          className="fixed inset-0 z-50 flex flex-col bg-surface font-dash text-pine-deep sm:inset-auto sm:end-5 sm:bottom-24 sm:h-[min(600px,calc(100dvh-8rem))] sm:w-[380px] sm:rounded-2xl sm:shadow-[0_0_0_1px_rgba(16,38,40,0.08),0_24px_64px_-12px_rgba(16,38,40,0.35)]"
        >
          <header className="flex items-center gap-3 border-b border-line bg-pine px-4 py-3 text-snow sm:rounded-t-2xl">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime text-pine-deep">
              <MessagesSquare className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-[15px] font-bold">
                {office}
              </h2>
              <p className="text-[12px] text-snow/70">
                {status === "bot" ? "يرد المساعد الآلي الآن" : "الدردشة المباشرة مع المكتب"}
              </p>
            </div>
            <button
              type="button"
              aria-label="إغلاق الدردشة"
              onClick={() => setOpen(false)}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-snow/80 hover:bg-white/10 hover:text-snow"
            >
              <X className="size-5" />
            </button>
          </header>
          {token ? (
            <Conversation
              slug={slug}
              token={token}
              welcome={welcome}
              messages={messages}
              status={status}
              since={since}
              onPoll={(p) => apply(p)}
            />
          ) : (
            <StartForm
              slug={slug}
              welcome={welcome}
              onStarted={(t, poll) => {
                writeToken(slug, t);
                for (const m of poll.messages) seen.current.add(m.id);
                setMessages(poll.messages);
                setStatus(poll.status);
                setToken(t);
              }}
            />
          )}
        </div>
      ) : null}
      <button
        ref={launcher}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "إغلاق الدردشة" : unseen ? `الدردشة مع المكتب — ${unseen} رسائل جديدة` : "الدردشة مع المكتب"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed end-5 bottom-5 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-pine px-5 font-dash text-[15px] font-bold text-snow shadow-[0_12px_32px_-8px_rgba(16,38,40,0.55)] transition-transform hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine motion-safe:hover:-translate-y-0.5",
          open && "hidden sm:inline-flex",
        )}
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <MessagesSquare className="size-5 text-lime" aria-hidden="true" />}
        <span>{open ? "إغلاق" : "تحدّث معنا"}</span>
        {unseen && !open ? (
          <span aria-hidden="true" className="grid h-5 min-w-5 place-items-center rounded-full bg-lime px-1 font-ui text-[11px] text-pine-deep">
            {unseen}
          </span>
        ) : null}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function StartForm({
  slug,
  welcome,
  onStarted,
}: {
  slug: string;
  welcome: string;
  onStarted: (token: string, poll: VisitorPoll) => void;
}) {
  const uid = useId();
  const opened = useRef(Date.now());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "message", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "اكتب اسمك.";
    if (phone.trim() && !normalizePhone(phone)) next.phone = "رقم الجوال غير صحيح. مثال: 0501234567";
    if (!message.trim()) next.message = "اكتب رسالتك.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await startChat({
        data: { slug, name: name.trim(), phone: phone.trim() || null, message: message.trim(), website, fillMs: Date.now() - opened.current },
      });
      const { token, ...poll } = r;
      onStarted(token, poll);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        <Bubble from="office" body={welcome.trim() || "أهلًا بك. اكتب سؤالك وسنرد عليك في أقرب وقت."} />
        <div>
          <label htmlFor={`${uid}-name`} className="mb-1 block text-[13px] font-semibold">
            الاسم
          </label>
          <input
            id={`${uid}-name`}
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${uid}-name-err` : undefined}
            className={inputClass(Boolean(errors.name))}
          />
          {errors.name ? <FieldError id={`${uid}-name-err`} text={errors.name} /> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className="mb-1 flex items-baseline gap-1.5 text-[13px] font-semibold">
            رقم الجوال <span className="text-[12px] font-normal text-slate">(اختياري)</span>
          </label>
          <input
            id={`${uid}-phone`}
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="05XXXXXXXX"
            maxLength={40}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? `${uid}-phone-err` : undefined}
            className={cn(inputClass(Boolean(errors.phone)), "text-end")}
          />
          {errors.phone ? <FieldError id={`${uid}-phone-err`} text={errors.phone} /> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-msg`} className="mb-1 block text-[13px] font-semibold">
            رسالتك
          </label>
          <textarea
            id={`${uid}-msg`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? `${uid}-msg-err` : undefined}
            className={cn(inputClass(Boolean(errors.message)), "h-auto min-h-20 resize-none py-2.5 leading-relaxed")}
          />
          {errors.message ? <FieldError id={`${uid}-msg-err`} text={errors.message} /> : null}
        </div>
        {/* Honeypot: hidden from people and assistive tech. */}
        <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
          <label>
            الموقع
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        <p className="text-[12px] leading-relaxed text-slate">
          لا نقدّم استشارات قانونية عبر الدردشة. نستخدم بياناتك للرد عليك فقط.
        </p>
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {error}
          </p>
        ) : null}
      </div>
      <div className="border-t border-line p-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep hover:bg-[#b3bf28] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4 rotate-180" aria-hidden="true" />}
          {busy ? "جارٍ الإرسال…" : "ابدأ المحادثة"}
        </button>
      </div>
    </form>
  );
}

function Conversation({
  slug,
  token,
  welcome,
  messages,
  status,
  since,
  onPoll,
}: {
  slug: string;
  token: string;
  welcome: string;
  messages: VisitorMessage[];
  status: ConvStatus;
  since: string | null;
  onPoll: (p: VisitorPoll) => void;
}) {
  const uid = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  const send = async (body: string) => {
    const msg = body.trim();
    if (!msg || busy) return;
    setBusy(true);
    setError(null);
    setPending(msg);
    setText("");
    try {
      onPoll(await sendChat({ data: { slug, token, message: msg, since } }));
    } catch (err) {
      setText(msg);
      setError(errText(err));
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(text);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain bg-paper px-4 py-4">
        {welcome.trim() ? <Bubble from="office" body={welcome.trim()} /> : null}
        {messages.map((m) => (
          <Bubble key={m.id} from={m.from} body={m.body} at={m.at} />
        ))}
        {pending ? <Bubble from="me" body={pending} sending /> : null}
        {busy && status === "bot" ? (
          <p className="flex items-center gap-2 self-start text-[12px] text-slate">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            المساعد يكتب…
          </p>
        ) : null}
      </div>
      {status === "bot" ? (
        <div className="flex items-center justify-between gap-2 border-t border-line bg-lime-50 px-4 py-2 text-[12px] text-pine-deep">
          <span>يرد عليك المساعد الآلي للمكتب.</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("أريد التحدث مع أحد أعضاء الفريق")}
            className="shrink-0 rounded-lg px-2 py-1 font-bold text-pine underline underline-offset-2 hover:bg-lime/30 disabled:opacity-50"
          >
            التحدث مع الفريق
          </button>
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="border-t border-line p-3"
      >
        {error ? (
          <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-[12.5px] text-red-800">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label htmlFor={`${uid}-reply`} className="sr-only">
            اكتب رسالتك
          </label>
          <textarea
            id={`${uid}-reply`}
            data-autofocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            maxLength={2000}
            placeholder="اكتب رسالتك…"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] leading-snug outline-none placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10"
          />
          <button
            type="submit"
            aria-label="إرسال"
            disabled={busy || !text.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine text-snow hover:bg-pine-deep disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4 rotate-180" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ from, body, at, sending }: { from: VisitorMessage["from"] | "office"; body: string; at?: string; sending?: boolean }) {
  if (from === "system") {
    return <p className="mx-auto max-w-[90%] rounded-lg bg-surface/70 px-3 py-1.5 text-center text-[12.5px] text-slate ring-1 ring-line">{body}</p>;
  }
  const mine = from === "me";
  return (
    <div className={cn("flex max-w-[85%] flex-col gap-0.5", mine ? "self-end items-end" : "self-start items-start")}>
      {from === "ai" ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate">
          <Bot className="size-3" aria-hidden="true" /> المساعد الآلي
        </span>
      ) : !mine ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate">
          <UserRound className="size-3" aria-hidden="true" /> المكتب
        </span>
      ) : null}
      <p
        className={cn(
          "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words",
          mine ? "rounded-es-md bg-pine text-snow" : "rounded-ss-md bg-surface text-pine-deep ring-1 ring-line",
          from === "ai" && "bg-lime-50 ring-lime/40",
          sending && "opacity-60",
        )}
      >
        {body}
      </p>
      {at ? <span className="font-ui text-[10.5px] text-slate/80">{timeAr(at)}</span> : null}
    </div>
  );
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="mt-1 text-[12.5px] text-red-700">
      {text}
    </p>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    "h-11 w-full rounded-xl border bg-surface px-3 text-[15px] text-pine-deep outline-none placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10",
    invalid ? "border-red-500" : "border-line-strong",
  );
}
