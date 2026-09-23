import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Loader2,
  MessagesSquare,
  Paperclip,
  RotateCw,
  SendHorizontal,
  UploadCloud,
  X,
} from "lucide-react";
import { Button, Num, Skeleton } from "@/components/dash/ui";
import { getBearerToken } from "@/lib/auth/client";
import {
  ACCEPT_ATTR,
  ALLOWED_LABEL,
  FILE_PROBLEM_TEXT,
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
  checkFile,
  formatBytes,
} from "@/lib/files/validate";
import {
  MESSAGE_MAX,
  markThreadRead,
  postThreadMessage,
  type Side,
  type Thread,
  type ThreadMessage,
} from "@/lib/thread";
import { cn } from "@/lib/utils";
import { Attachments } from "./attachments";
import { extLabel, fileIcon } from "./file-meta";
import { dayLabel, fullLabel, riyadhDay, timeLabel } from "./format";

const POLL_MS = 20_000;
/** Consecutive messages from one side within this gap share a header. */
const GROUP_GAP_MS = 5 * 60_000;

type Pending = {
  key: string;
  file: File;
  problem: string | null;
  checking: boolean;
};

/**
 * The conversation on one request, for either side. Loads, polls while the
 * tab is visible, marks the viewer's side read, and posts messages with
 * attachments (drag & drop, paste, or the paperclip) with upload progress.
 */
export function ThreadPanel({
  side,
  requestId,
  load,
  initial,
  onRead,
  variant = "page",
  peerName,
  unavailable,
}: {
  side: Side;
  requestId: number;
  load: () => Promise<Thread>;
  /** Already-loaded thread (skips the first fetch). */
  initial?: Thread | null;
  /** Called after the viewer's side was marked read. */
  onRead?: () => void;
  variant?: "page" | "drawer";
  /** How the other side is named ("فريق ديل", the customer's name). */
  peerName: string;
  /** Shown instead of the composer when the other side cannot read the thread. */
  unavailable?: (thread: Thread) => ReactNode;
}) {
  const [thread, setThread] = useState<Thread | null>(initial ?? null);
  const [state, setState] = useState<"loading" | "error" | "ready">(initial ? "ready" : "loading");
  const [now, setNow] = useState(() => new Date());
  /** The read marker when first opened: the "new messages" line stays put. */
  const firstRead = useRef<number | null>(initial ? initial.readId : null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const markedUpTo = useRef(0);

  const refresh = useCallback((quiet = false) => {
    if (!quiet) setState("loading");
    return loadRef
      .current()
      .then((t) => {
        if (firstRead.current === null) firstRead.current = t.readId;
        setThread(t);
        setNow(new Date());
        setState("ready");
      })
      .catch(() => {
        if (!quiet) setState("error");
      });
  }, []);

  useEffect(() => {
    if (!initial) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only
  }, [refresh]);

  // Poll while visible, and catch up as soon as the tab comes back.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Mark the other side's messages read once they are on screen.
  useEffect(() => {
    if (!thread) return;
    const last = thread.messages.at(-1);
    if (!last) return;
    const hasNew = thread.messages.some((m) => m.role !== side && m.id > thread.readId);
    if (!hasNew || markedUpTo.current >= last.id) return;
    markedUpTo.current = last.id;
    markThreadRead({ data: { id: requestId, side, upTo: last.id } })
      .then(() => onReadRef.current?.())
      .catch(() => {
        markedUpTo.current = 0;
      });
  }, [thread, requestId, side]);

  // Keep the newest message in view unless the reader scrolled up.
  const count = thread?.messages.length ?? 0;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [count, state]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const append = (m: ThreadMessage) => {
    stickToBottom.current = true;
    setNow(new Date());
    setThread((t) =>
      t
        ? {
            ...t,
            messages: t.messages.some((x) => x.id === m.id) ? t.messages : [...t.messages, m],
            usedBytes: t.usedBytes + m.files.reduce((s, f) => s + f.size, 0),
          }
        : t,
    );
  };

  const blocked = thread && unavailable ? unavailable(thread) : null;
  const drawer = variant === "drawer";

  return (
    <div className="flex min-h-0 flex-col">
      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="الرسائل"
        className={cn(
          "overflow-y-auto overscroll-contain",
          drawer ? "max-h-[440px] min-h-[180px] px-1" : "max-h-[min(60vh,620px)] min-h-[260px] px-4 md:px-6",
        )}
      >
        {state === "loading" && !thread ? (
          <ThreadSkeleton />
        ) : state === "error" && !thread ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="size-5" />
            </span>
            <p className="text-sm font-semibold text-pine-deep">تعذر تحميل المحادثة</p>
            <Button size="sm" icon={RotateCw} onClick={() => void refresh()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : thread && thread.messages.length === 0 ? (
          <EmptyThread side={side} blocked={Boolean(blocked)} />
        ) : thread ? (
          <MessageList
            thread={thread}
            side={side}
            now={now}
            firstRead={firstRead.current ?? thread.readId}
            peerName={peerName}
          />
        ) : null}
      </div>

      {blocked ? (
        <div className={cn("pt-3", !drawer && "px-4 pb-4 md:px-6")}>{blocked}</div>
      ) : thread ? (
        <Composer
          side={side}
          requestId={requestId}
          usedBytes={thread.usedBytes}
          drawer={drawer}
          onSent={append}
        />
      ) : null}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4 py-6" aria-hidden="true">
      <Skeleton className="h-14 w-2/3 rounded-2xl" />
      <Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" />
      <Skeleton className="h-20 w-3/5 rounded-2xl" />
    </div>
  );
}

function EmptyThread({ side, blocked }: { side: Side; blocked: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-lime-50 text-lime-600 ring-1 ring-lime/40">
        <MessagesSquare className="size-6" />
      </span>
      <p className="mt-3 text-[15px] font-bold text-pine-deep">
        {side === "client" ? "ابدأ المحادثة مع فريق ديل" : blocked ? "لا محادثة لهذا الطلب" : "لا رسائل بعد"}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-6 text-slate">
        {side === "client"
          ? "اكتب سؤالك أو أرفق ملفاتك (الشعار، الهوية، المراجع). نردّ هنا ونرسل لك بريدًا عند كل رد."
          : blocked
            ? "المحادثة متاحة للطلبات المرسلة من حساب عميل."
            : "ما تكتبه هنا يظهر للعميل في حسابه، ونرسل له بريدًا بالرد."}
      </p>
    </div>
  );
}

function MessageList({
  thread,
  side,
  now,
  firstRead,
  peerName,
}: {
  thread: Thread;
  side: Side;
  now: Date;
  firstRead: number;
  peerName: string;
}) {
  const lastOwn = [...thread.messages].reverse().find((m) => m.role === side);
  const firstNew = thread.messages.find((m) => m.role !== side && m.id > firstRead)?.id;
  let prev: ThreadMessage | null = null;
  return (
    <ol className="space-y-1 py-4">
      {thread.messages.map((m) => {
        const at = new Date(m.created_at);
        const newDay = !prev || riyadhDay(new Date(prev.created_at)) !== riyadhDay(at);
        const grouped =
          !newDay &&
          prev !== null &&
          prev.role === m.role &&
          prev.author === m.author &&
          at.getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS &&
          m.id !== firstNew;
        prev = m;
        return (
          <Fragment key={m.id}>
            {newDay ? (
              <li className="flex justify-center py-3">
                <span className="rounded-full bg-paper px-3 py-1 text-[11px] font-bold text-slate ring-1 ring-line">
                  {dayLabel(at, now)}
                </span>
              </li>
            ) : null}
            {m.id === firstNew ? (
              <li className="flex items-center gap-3 py-2" aria-label="رسائل جديدة">
                <span className="h-px flex-1 bg-lime" />
                <span className="text-[11px] font-bold text-lime-600">رسائل جديدة</span>
                <span className="h-px flex-1 bg-lime" />
              </li>
            ) : null}
            <Bubble
              m={m}
              own={m.role === side}
              grouped={grouped}
              peerName={peerName}
              seen={m === lastOwn ? thread.peerReadId >= m.id : null}
            />
          </Fragment>
        );
      })}
    </ol>
  );
}

function Bubble({
  m,
  own,
  grouped,
  peerName,
  seen,
}: {
  m: ThreadMessage;
  own: boolean;
  grouped: boolean;
  peerName: string;
  /** Only for the viewer side's latest message: whether the peer read it. */
  seen: boolean | null;
}) {
  const at = new Date(m.created_at);
  const who = own
    ? m.mine
      ? "أنت"
      : (m.author ?? "الفريق")
    : m.role === "team"
      ? m.author
        ? `${m.author} · فريق ديل`
        : "فريق ديل"
      : (m.author ?? peerName);
  return (
    <li className={cn("flex flex-col", own ? "items-end" : "items-start", !grouped && "pt-2")}>
      {!grouped ? (
        <span className="mb-1 px-1 text-[11px] font-semibold text-slate">{who}</span>
      ) : null}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%]",
          own
            ? "rounded-se-md bg-pine text-snow shadow-[0_1px_2px_rgba(16,38,40,0.12)]"
            : "rounded-ss-md bg-surface text-pine-deep ring-1 ring-line shadow-[0_1px_2px_rgba(16,38,40,0.04)]",
          m.files.length > 0 && "w-[min(85%,300px)] sm:w-[300px]",
        )}
      >
        {m.body ? (
          <p className="text-[14px] leading-6 break-words whitespace-pre-line" dir="auto">
            {m.body}
          </p>
        ) : null}
        {m.files.length ? (
          <div className={cn(m.body && "mt-2")}>
            <Attachments files={m.files} own={own} />
          </div>
        ) : null}
      </div>
      <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-slate/80">
        <time dateTime={m.created_at} title={fullLabel(at)}>
          <Num>{timeLabel(at)}</Num>
        </time>
        {seen !== null ? (
          seen ? (
            <span className="inline-flex items-center gap-0.5 text-pine">
              <CheckCheck className="size-3.5" aria-hidden="true" />
              قُرئت
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <Check className="size-3.5" aria-hidden="true" />
              أُرسلت
            </span>
          )
        ) : null}
      </span>
    </li>
  );
}

let pendingSeq = 0;

function Composer({
  side,
  requestId,
  usedBytes,
  drawer,
  onSent,
}: {
  side: Side;
  requestId: number;
  usedBytes: number;
  drawer: boolean;
  onSent: (m: ThreadMessage) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  const pendingBytes = files.reduce((s, f) => s + f.file.size, 0);
  const left = MAX_REQUEST_BYTES - usedBytes;
  const invalid = files.some((f) => f.problem || f.checking);
  const canSend = !sending && !invalid && (text.trim().length > 0 || files.length > 0);

  // Grow the textarea with its content, up to ~8 lines.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const addFiles = (list: FileList | File[]) => {
    setError("");
    const incoming = [...list];
    const room = MAX_FILES_PER_MESSAGE - files.length;
    if (incoming.length > room) {
      setError(`يمكن إرفاق ${MAX_FILES_PER_MESSAGE} ملفات كحد أقصى في الرسالة.`);
    }
    const take = incoming.slice(0, Math.max(0, room));
    let budget = left - pendingBytes;
    const added: Pending[] = take.map((file) => {
      budget -= file.size;
      return {
        key: `f${(pendingSeq += 1)}`,
        file,
        checking: file.size > 0 && file.size <= MAX_FILE_BYTES,
        problem:
          file.size > MAX_FILE_BYTES
            ? FILE_PROBLEM_TEXT.size
            : budget < 0
              ? "تجاوز مساحة الطلب (100 ميجابايت)"
              : null,
      };
    });
    setFiles((cur) => [...cur, ...added]);
    // Same checks as the server (type, size, magic bytes), before uploading.
    for (const p of added) {
      if (!p.checking) {
        if (!p.problem) {
          const res = checkFile(p.file.name, new Uint8Array(), p.file.size);
          if (!res.ok) setFiles((cur) => cur.map((x) => (x.key === p.key ? { ...x, problem: FILE_PROBLEM_TEXT[res.problem] } : x)));
        }
        continue;
      }
      void p.file
        .arrayBuffer()
        .then((buf) => {
          const res = checkFile(p.file.name, new Uint8Array(buf), p.file.size);
          setFiles((cur) =>
            cur.map((x) =>
              x.key === p.key
                ? { ...x, checking: false, problem: x.problem ?? (res.ok ? null : FILE_PROBLEM_TEXT[res.problem]) }
                : x,
            ),
          );
        })
        .catch(() =>
          setFiles((cur) => cur.map((x) => (x.key === p.key ? { ...x, checking: false, problem: "تعذرت قراءة الملف" } : x))),
        );
    }
  };

  const remove = (key: string) => {
    setFiles((cur) => cur.filter((f) => f.key !== key));
    setError("");
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError("");
    setProgress(files.length ? { loaded: 0, total: pendingBytes } : null);
    const res = await postThreadMessage({
      requestId,
      side,
      body: text.trim(),
      files: files.map((f) => f.file),
      bearerToken: getBearerToken(),
      onProgress: (loaded, total) => setProgress({ loaded, total }),
    });
    setSending(false);
    setProgress(null);
    if (res.ok) {
      setText("");
      setFiles([]);
      onSent(res.message);
      area.current?.focus();
    } else {
      setError(res.message);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(0);
    if (sending) return;
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = [...e.clipboardData.files];
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  // Per-file share of the overall upload, in multipart order.
  const fileProgress = useMemo(() => {
    if (!progress || progress.total === 0) return null;
    const ratio = progress.loaded / progress.total;
    const sent = ratio * pendingBytes;
    let offset = 0;
    const out: Record<string, number> = {};
    for (const f of files) {
      out[f.key] = f.file.size ? Math.max(0, Math.min(1, (sent - offset) / f.file.size)) : 1;
      offset += f.file.size;
    }
    return out;
  }, [progress, files, pendingBytes]);

  const remaining = MESSAGE_MAX - text.length;

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onDragEnter={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) setDragging((n) => n + 1);
      }}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => setDragging((n) => Math.max(0, n - 1))}
      onDrop={onDrop}
      className={cn("relative border-t border-line", drawer ? "pt-3" : "px-4 pt-3 pb-4 md:px-6")}
    >
      {dragging > 0 ? (
        <div className="pointer-events-none absolute inset-1 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-pine/40 bg-pine-50/90">
          <span className="flex items-center gap-2 text-sm font-bold text-pine">
            <UploadCloud className="size-5" />
            أفلت الملفات هنا لإرفاقها
          </span>
        </div>
      ) : null}

      {files.length ? (
        <ul className="mb-2.5 grid gap-2 sm:grid-cols-2" aria-label="الملفات المرفقة">
          {files.map((f) => (
            <PendingChip
              key={f.key}
              p={f}
              progress={fileProgress?.[f.key] ?? null}
              disabled={sending}
              onRemove={() => remove(f.key)}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-1.5 transition-shadow focus-within:border-pine/40 focus-within:ring-4 focus-within:ring-pine/10">
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={sending || files.length >= MAX_FILES_PER_MESSAGE}
          aria-label="إرفاق ملفات"
          title={`إرفاق ملفات: ${ALLOWED_LABEL}`}
          className="grid size-10 shrink-0 place-items-center rounded-xl text-slate transition-colors hover:bg-paper hover:text-pine-deep disabled:opacity-40"
        >
          <Paperclip className="size-[18px]" />
        </button>
        <label htmlFor={id} className="sr-only">
          {side === "client" ? "رسالتك إلى فريق ديل" : "رسالتك إلى العميل"}
        </label>
        <textarea
          id={id}
          ref={area}
          value={text}
          maxLength={MESSAGE_MAX}
          rows={1}
          dir="auto"
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={side === "client" ? "اكتب رسالتك لفريق ديل…" : "اكتب ردك للعميل…"}
          className="min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[14px] leading-6 text-pine-deep placeholder:text-slate/70 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="إرسال"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-pine-deep transition-[background-color,opacity] hover:bg-[#d0dc45] disabled:bg-paper disabled:text-slate/50"
        >
          {sending ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <SendHorizontal className="size-[18px] -scale-x-100" />
          )}
        </button>
      </div>

      <div className="mt-1.5 flex min-h-5 items-start justify-between gap-3 px-1 text-[11px]">
        {error ? (
          <p role="alert" className="font-semibold text-red-700">
            {error}
          </p>
        ) : (
          <p className="text-slate/80">
            <span className="hidden sm:inline">اسحب الملفات إلى هنا أو </span>
            حتى {MAX_FILES_PER_MESSAGE} ملفات، 10 ميجابايت للملف
            <span className="hidden md:inline"> · Ctrl+Enter للإرسال</span>
          </p>
        )}
        {remaining < 300 ? (
          <Num className={cn("shrink-0", remaining < 100 ? "text-red-700" : "text-slate/70")}>{remaining}</Num>
        ) : left < 20 * 1024 * 1024 ? (
          <span className="shrink-0 text-slate/80">متبقٍ للطلب: <Num>{formatBytes(Math.max(0, left))}</Num></span>
        ) : null}
      </div>
    </form>
  );
}

function PendingChip({
  p,
  progress,
  disabled,
  onRemove,
}: {
  p: Pending;
  progress: number | null;
  disabled: boolean;
  onRemove: () => void;
}) {
  const Icon = fileIcon(p.file.name);
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(p.file.type) || p.file.size > MAX_FILE_BYTES) return;
    const url = URL.createObjectURL(p.file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [p.file]);
  return (
    <li
      className={cn(
        "relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 ring-1",
        p.problem ? "bg-red-50 ring-red-200" : "bg-paper ring-line",
      )}
    >
      {thumb && !p.problem ? (
        <img src={thumb} alt="" className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-line" />
      ) : (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            p.problem ? "bg-red-100 text-red-700" : "bg-pine-50 text-pine",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-pine-deep" dir="auto">
          {p.file.name}
        </span>
        <span className={cn("block text-[11px]", p.problem ? "font-semibold text-red-700" : "text-slate")}>
          {p.problem ??
            (p.checking ? (
              "جارٍ الفحص…"
            ) : progress !== null ? (
              <Num>{progress >= 1 ? "تم الرفع" : `${Math.round(progress * 100)}%`}</Num>
            ) : (
              <Num>
                <bdi>{extLabel(p.file.name)}</bdi> · <bdi>{formatBytes(p.file.size)}</bdi>
              </Num>
            ))}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`إزالة ${p.file.name}`}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-slate hover:bg-surface hover:text-pine-deep disabled:opacity-40"
      >
        <X className="size-3.5" />
      </button>
      {progress !== null ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          <span
            className="block h-full bg-lime transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      ) : null}
    </li>
  );
}
