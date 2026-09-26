import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Info,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RotateCcw,
  Scale,
  SendHorizontal,
  Sparkles,
  StickyNote,
  Tags,
  UserPlus,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Pill, Select } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { dayAr, phoneAr, shortDateAr, timeAr } from "@/components/law/format";
import { ClientPicker, useCan, useMembers } from "@/components/law/kit";
import { inboxChanged } from "@/components/law/inbox/inbox-events";
import { CallButton } from "@/components/law/voice/softphone";
import { useSoftphone } from "@/components/law/voice/softphone-context";
import {
  assignInbox,
  clientFromInbox,
  inboxAi,
  linkInboxClient,
  noteInbox,
  replyInbox,
  setInboxIntent,
  setInboxStatus,
  type InboxSetup,
} from "@/lib/law/inbox";
import { CHANNEL_LABELS, CHANNEL_SHORT, type ChannelId } from "@/lib/law/inbox-channels";
import type { ConversationDetail, ConversationRow, MessageRow, QuickReply, ThreadView } from "@/lib/law/inbox-core";
import { CONV_STATUS_LABELS, INTENTS, INTENT_LABELS, type ConvStatus, type Intent } from "@/lib/law/inbox-options";
import { CASE_STAGE_LABELS, type CaseStage } from "@/lib/law/options";
import { saudiPhone } from "@/lib/law/voice-options";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

/**
 * The pieces of «مركز التواصل»: the conversation list, the thread (bubbles,
 * internal notes, system events, the composer with quick replies and AI
 * suggestions) and the details panel (contact, client, assignee, status, AI
 * summary / intent, the client's cases).
 */

/* ------------------------------------------------------------------------ */
/* Small bits                                                                */
/* ------------------------------------------------------------------------ */

const CHANNEL_ICON: Record<ChannelId, typeof Globe> = {
  webchat: Globe,
  whatsapp: MessageCircle,
  sms: MessageSquareText,
  email: Mail,
  voice: Phone,
};

export function ChannelIcon({ channel, className }: { channel: ChannelId; className?: string }) {
  const Icon = CHANNEL_ICON[channel] ?? Globe;
  return <Icon className={className} aria-label={CHANNEL_LABELS[channel]} />;
}

/** "الآن" / "10:30 ص" today / "27 سبتمبر". */
function whenShort(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "الآن";
  if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} د`;
  const day = (ms: number) => new Date(ms + 3 * 3_600_000).toISOString().slice(0, 10);
  return day(t) === day(Date.now()) ? timeAr(iso) : shortDateAr(iso);
}

const STATUS_TONE: Record<ConvStatus, "pine" | "lime" | "neutral" | "info"> = {
  bot: "info",
  open: "lime",
  pending: "pine",
  closed: "neutral",
};

export function ConvStatusPill({ status }: { status: ConvStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{CONV_STATUS_LABELS[status]}</Pill>;
}

function displayName(c: Pick<ConversationRow, "contact_name" | "contact_phone" | "contact_email">) {
  return c.contact_name.trim() || phoneAr(c.contact_phone) || c.contact_email || "زائر";
}

function actionError(err: unknown) {
  toast.error(workspaceErrorMessage(err));
}

/* ------------------------------------------------------------------------ */
/* Conversation list                                                         */
/* ------------------------------------------------------------------------ */

export function ConversationList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-line" aria-label="المحادثات">
      {rows.map((c) => {
        const on = c.id === selectedId;
        const unread = c.unread_count > 0 && c.status !== "bot";
        const name = displayName(c);
        return (
          <li key={c.id}>
            <button
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => onSelect(c.id)}
              className={cn(
                "relative flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors",
                on ? "bg-pine-50" : "hover:bg-paper",
              )}
            >
              {on ? <span aria-hidden="true" className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-pine" /> : null}
              <span className="relative">
                <Avatar name={name} className="size-10 text-[13px]" />
                <span className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full bg-surface text-pine ring-1 ring-line">
                  <ChannelIcon channel={c.channel} className="size-3" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-[14px]", unread ? "font-extrabold" : "font-bold")}>{name}</span>
                  <span className={cn("shrink-0 font-ui text-[11px]", unread ? "font-bold text-pine" : "text-slate")}>
                    {whenShort(c.last_message_at)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "text-pine-deep" : "text-slate")}>
                    {c.preview_from === "out" ? <span className="text-slate">أنت: </span> : null}
                    {c.preview ?? c.subject ?? ""}
                  </span>
                  {unread ? (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-lime px-1.5 font-ui text-[11px] font-bold text-pine-deep">
                      <span className="sr-only">غير مقروءة: </span>
                      {c.unread_count}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {c.status === "bot" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pine px-2 py-0.5 text-[10.5px] font-semibold text-snow">
                      <Bot className="size-3" aria-hidden="true" /> المساعد الآلي
                    </span>
                  ) : null}
                  {c.status === "pending" ? (
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-semibold text-slate ring-1 ring-line">بانتظار العميل</span>
                  ) : null}
                  {c.ai_intent ? (
                    <span className="rounded-full bg-lime-50 px-2 py-0.5 text-[10.5px] font-semibold text-lime-600 ring-1 ring-lime/40">
                      {INTENT_LABELS[c.ai_intent]}
                    </span>
                  ) : null}
                  {c.assignee_name ? (
                    <span className="inline-flex max-w-[9rem] items-center gap-1 truncate text-[11px] text-slate">
                      <UserRound className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{c.assignee_name}</span>
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------------ */
/* Thread                                                                    */
/* ------------------------------------------------------------------------ */

export type ThreadProps = {
  view: ThreadView;
  setup: InboxSetup | null;
  readOnly: boolean;
  loadingOlder: boolean;
  onOlder: () => void;
  onBack: () => void;
  onDetails: () => void;
  onChanged: () => void;
};

export function Thread({ view, setup, readOnly, loadingOlder, onOlder, onBack, onDetails, onChanged }: ThreadProps) {
  const { active } = useLawApp();
  const c = view.conversation;
  const list = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastId = view.messages[view.messages.length - 1]?.id;
  const [busy, setBusy] = useState(false);

  // Stay pinned to the newest message unless the reader scrolled up.
  useEffect(() => {
    const el = list.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);
  useEffect(() => {
    nearBottom.current = true;
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [c.id]);

  const setStatus = async (status: "open" | "pending" | "closed") => {
    setBusy(true);
    try {
      await setInboxStatus({ data: { workspaceId: active.workspace.id, id: c.id, status } });
      onChanged();
    } catch (err) {
      actionError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 md:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="العودة إلى المحادثات"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-pine-deep hover:bg-paper lg:hidden"
        >
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold">{displayName(c)}</h2>
          <p className="flex items-center gap-1.5 text-[12px] text-slate">
            <ChannelIcon channel={c.channel} className="size-3.5" />
            {CHANNEL_LABELS[c.channel]}
            <span aria-hidden="true">·</span>
            {CONV_STATUS_LABELS[c.status]}
          </p>
        </div>
        {!readOnly ? (
          c.status === "closed" ? (
            <Button size="sm" icon={RotateCcw} disabled={busy} onClick={() => void setStatus("open")}>
              إعادة فتح
            </Button>
          ) : (
            <Button size="sm" icon={CheckCircle2} disabled={busy} onClick={() => void setStatus("closed")}>
              إغلاق
            </Button>
          )
        ) : null}
        <button
          type="button"
          onClick={onDetails}
          aria-label="تفاصيل المحادثة"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-pine-deep hover:bg-paper xl:hidden"
        >
          <Info className="size-[18px]" />
        </button>
      </header>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain bg-paper px-3 py-4 md:px-5"
      >
        {view.hasMore ? (
          <button
            type="button"
            onClick={onOlder}
            disabled={loadingOlder}
            className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[12px] font-semibold text-pine ring-1 ring-line hover:bg-pine-50 disabled:opacity-60"
          >
            {loadingOlder ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            عرض الرسائل الأقدم
          </button>
        ) : null}
        <Messages messages={view.messages} />
      </div>

      <Composer
        conversation={c}
        quickReplies={setup?.quickReplies ?? []}
        aiReady={Boolean(setup?.ai.configured && setup.ai.planAllows)}
        readOnly={readOnly}
        onSent={() => {
          nearBottom.current = true;
          onChanged();
        }}
      />
    </div>
  );
}

function Messages({ messages }: { messages: MessageRow[] }) {
  const out: ReactNode[] = [];
  let lastDay = "";
  for (const m of messages) {
    const d = new Date(Date.parse(m.created_at) + 3 * 3_600_000).toISOString().slice(0, 10);
    if (d !== lastDay) {
      lastDay = d;
      out.push(
        <p key={`d-${d}`} className="my-2 self-center rounded-full bg-surface px-3 py-1 text-[11.5px] font-semibold text-slate ring-1 ring-line">
          {dayAr(d)}
        </p>,
      );
    }
    out.push(<Message key={m.id} m={m} />);
  }
  return <>{out}</>;
}

function Message({ m }: { m: MessageRow }) {
  if (m.direction === "system") {
    return (
      <p className="mx-auto my-1 flex max-w-[90%] items-center gap-1.5 text-center text-[12px] text-slate">
        {m.public ? <Globe className="size-3 shrink-0" aria-label="ظاهر للعميل" /> : null}
        <span>
          {m.body} <span className="font-ui text-[10.5px] text-slate/70">{timeAr(m.created_at)}</span>
        </span>
      </p>
    );
  }
  if (m.direction === "note") {
    return (
      <div className="mx-auto w-full max-w-[92%] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-amber-950">
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-amber-800">
          <StickyNote className="size-3.5" aria-hidden="true" />
          ملاحظة داخلية · {m.author_name ?? "عضو"}
          <span className="ms-auto font-ui font-normal">{timeAr(m.created_at)}</span>
        </p>
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
      </div>
    );
  }
  const incoming = m.direction === "in";
  const ai = m.author_kind === "ai";
  return (
    <div className={cn("flex max-w-[82%] flex-col gap-0.5", incoming ? "items-start self-start" : "items-end self-end")}>
      {!incoming ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate">
          {ai ? <Bot className="size-3" aria-hidden="true" /> : null}
          {ai ? "المساعد الآلي" : (m.author_name ?? "المكتب")}
        </span>
      ) : null}
      <p
        className={cn(
          "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words",
          incoming && "rounded-ss-md bg-surface text-pine-deep ring-1 ring-line",
          !incoming && !ai && "rounded-es-md bg-pine text-snow",
          ai && "rounded-es-md bg-lime-50 text-pine-deep ring-1 ring-lime/40",
        )}
      >
        {m.body}
      </p>
      <span className="font-ui text-[10.5px] text-slate/80">{timeAr(m.created_at)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Composer                                                                  */
/* ------------------------------------------------------------------------ */

function Composer({
  conversation: c,
  quickReplies,
  aiReady,
  readOnly,
  onSent,
}: {
  conversation: ConversationDetail;
  quickReplies: QuickReply[];
  aiReady: boolean;
  readOnly: boolean;
  onSent: () => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const canReply = c.can_send;
  const [mode, setMode] = useState<"reply" | "note">(canReply ? "reply" : "note");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const menuBox = useRef<HTMLDivElement>(null);

  // A new conversation starts with an empty composer in the right mode.
  useEffect(() => {
    setText("");
    setMode(c.can_send ? "reply" : "note");
  }, [c.id, c.can_send]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuBox.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [menu]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const data = { workspaceId: active.workspace.id, id: c.id, body };
      if (mode === "reply") await replyInbox({ data });
      else await noteInbox({ data });
      setText("");
      onSent();
      inboxChanged();
    } catch (err) {
      actionError(err);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }, [text, busy, mode, active.workspace.id, c.id, onSent]);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await inboxAi({ data: { workspaceId: active.workspace.id, id: c.id, task: "suggest" } });
      if (r.task === "suggest") {
        setMode("reply");
        setText(r.draft);
        box.current?.focus();
        toast.success("جهّز المساعد مسودة رد. راجعها قبل الإرسال.");
      }
    } catch (err) {
      actionError(err);
    } finally {
      setSuggesting(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  };

  if (readOnly) {
    return (
      <p className="flex items-center gap-2 border-t border-line bg-surface px-4 py-3 text-[13px] text-slate">
        <Lock className="size-4" aria-hidden="true" /> المكتب للقراءة فقط حاليًا، فلا يمكن الرد.
      </p>
    );
  }

  const note = mode === "note";
  return (
    <div className={cn("border-t px-3 pt-2 pb-3 md:px-4", note ? "border-amber-200 bg-amber-50/60" : "border-line bg-surface")}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-label="نوع الرسالة" className="flex gap-1 rounded-xl bg-paper p-1">
          <ModeButton on={!note} disabled={!canReply} onClick={() => setMode("reply")}>
            رد للعميل
          </ModeButton>
          <ModeButton on={note} onClick={() => setMode("note")}>
            ملاحظة داخلية
          </ModeButton>
        </div>
        <div ref={menuBox} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-pine hover:bg-paper"
          >
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            ردود جاهزة
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
          {menu ? (
            <div
              role="menu"
              className="absolute bottom-full start-0 z-30 mb-1.5 max-h-72 w-72 max-w-[80vw] overflow-y-auto rounded-xl bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(16,38,40,0.35)] ring-1 ring-line"
            >
              {quickReplies.length === 0 ? (
                <p className="px-3 py-2.5 text-[12.5px] text-slate">لا ردود جاهزة بعد. يضيفها مدير المكتب من إعدادات مركز التواصل.</p>
              ) : (
                quickReplies.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setText((t) => (t.trim() ? `${t.trimEnd()}\n${q.body}` : q.body));
                      setMenu(false);
                      box.current?.focus();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-start hover:bg-paper"
                  >
                    <span className="block text-[13px] font-bold">{q.title}</span>
                    <span className="line-clamp-2 block text-[12px] text-slate">{q.body}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {aiReady && canReply ? (
          <button
            type="button"
            onClick={() => void suggest()}
            disabled={suggesting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-pine hover:bg-paper disabled:opacity-60"
          >
            {suggesting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Wand2 className="size-3.5" aria-hidden="true" />}
            اقترح ردًا
          </button>
        ) : null}
      </div>
      {!canReply ? (
        <p className="mb-2 text-[12px] text-slate">
          قناة {CHANNEL_LABELS[c.channel]} غير متصلة بعد، فلا يمكن الرد عبرها. يمكنك إضافة ملاحظات داخلية.
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor={`${uid}-text`} className="sr-only">
          {note ? "ملاحظة داخلية" : "رد للعميل"}
        </label>
        <textarea
          id={`${uid}-text`}
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          maxLength={4000}
          placeholder={note ? "ملاحظة يراها الفريق فقط…" : "اكتب ردك… (Ctrl+Enter للإرسال)"}
          className={cn(
            "max-h-48 min-h-14 flex-1 resize-y rounded-xl border bg-surface px-3 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-slate/60 focus:ring-4",
            note ? "border-amber-300 focus:border-amber-500 focus:ring-amber-200/50" : "border-line-strong focus:border-pine focus:ring-pine/10",
          )}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          aria-label={note ? "حفظ الملاحظة" : "إرسال الرد"}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl disabled:opacity-50",
            note ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-pine text-snow hover:bg-pine-deep",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : note ? <StickyNote className="size-4" /> : <SendHorizontal className="size-4 rotate-180" />}
        </button>
      </div>
    </div>
  );
}

function ModeButton({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px] font-semibold transition-colors disabled:opacity-40",
        on ? "bg-surface text-pine-deep shadow-sm ring-1 ring-line" : "text-slate hover:text-pine-deep",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Details panel                                                             */
/* ------------------------------------------------------------------------ */

export function Details({
  view,
  setup,
  readOnly,
  onChanged,
}: {
  view: ThreadView;
  setup: InboxSetup | null;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const { active, ctx } = useLawApp();
  const me = ctx.user.id;
  const allowed = useCan();
  const members = useMembers();
  const c = view.conversation;
  const ws = active.workspace.id;
  const [busy, setBusy] = useState<string | null>(null);
  const aiReady = Boolean(setup?.ai.configured && setup.ai.planAllows);

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) toast.success(done);
      onChanged();
      inboxChanged();
    } catch (err) {
      actionError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 p-4">
      <section aria-labelledby="inbox-contact" className="rounded-xl bg-paper p-4 ring-1 ring-line">
        <div className="flex items-center gap-3">
          <Avatar name={displayName(c)} className="size-11" />
          <div className="min-w-0">
            <h3 id="inbox-contact" className="truncate text-[15px] font-bold">
              {displayName(c)}
            </h3>
            <p className="flex items-center gap-1.5 text-[12px] text-slate">
              <ChannelIcon channel={c.channel} className="size-3.5" /> {CHANNEL_SHORT[c.channel]} · منذ {shortDateAr(c.created_at)}
            </p>
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-[13px]">
          {c.contact_phone ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate">الجوال</dt>
              <dd>
                <a href={`tel:${c.contact_phone}`} dir="ltr" className="font-ui font-semibold text-pine hover:underline">
                  {phoneAr(c.contact_phone)}
                </a>
              </dd>
            </div>
          ) : null}
          {c.contact_email ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate">البريد</dt>
              <dd className="truncate font-semibold" dir="ltr">
                {c.contact_email}
              </dd>
            </div>
          ) : null}
          {c.subject ? (
            <div>
              <dt className="text-slate">أول رسالة</dt>
              <dd className="mt-0.5 line-clamp-3 text-pine-deep">{c.subject}</dd>
            </div>
          ) : null}
        </dl>
        {c.contact_phone && !readOnly ? (
          <ContactCall phone={c.contact_phone} label={displayName(c)} clientId={c.client_id} conversationId={c.id} />
        ) : null}
      </section>

      <Block title="ملف العميل">
        {c.client_id ? (
          <div className="flex items-center justify-between gap-2">
            <Link to="/app/clients/$id" params={{ id: c.client_id }} className="flex min-w-0 items-center gap-2 font-bold text-pine hover:underline">
              <UserRound className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{c.client_name ?? "العميل"}</span>
            </Link>
            {!readOnly ? (
              <button
                type="button"
                aria-label="فك الربط بملف العميل"
                disabled={busy === "unlink"}
                onClick={() => void act("unlink", () => linkInboxClient({ data: { workspaceId: ws, id: c.id, clientId: null } }))}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ) : readOnly ? (
          <p className="text-[13px] text-slate">غير مرتبطة بعميل.</p>
        ) : (
          <div className="space-y-2">
            <ClientPicker
              value={null}
              placeholder="اربط بعميل موجود…"
              onChange={(picked) => {
                if (picked) void act("link", () => linkInboxClient({ data: { workspaceId: ws, id: c.id, clientId: picked.id } }), "رُبطت المحادثة بملف العميل.");
              }}
            />
            {allowed("client.create") ? (
              <Button
                size="sm"
                icon={busy === "create" ? Loader2 : UserPlus}
                disabled={busy === "create"}
                className="w-full"
                onClick={() =>
                  void act("create", async () => {
                    const r = await clientFromInbox({ data: { workspaceId: ws, id: c.id } });
                    toast.success(r.existed ? "وُجد عميل بالرقم نفسه فرُبطت المحادثة به." : "أُنشئ ملف العميل ورُبطت المحادثة به.");
                  })
                }
              >
                إنشاء ملف عميل من المحادثة
              </Button>
            ) : null}
          </div>
        )}
        {view.cases.length ? (
          <ul className="mt-3 space-y-1">
            {view.cases.map((k) => (
              <li key={k.id}>
                <Link
                  to="/app/cases/$id"
                  params={{ id: k.id }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-paper"
                >
                  <Scale className="size-3.5 shrink-0 text-slate" aria-hidden="true" />
                  <span className="font-ui text-[12px] text-slate">#{k.ref_no}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{k.title}</span>
                  <span className="shrink-0 text-[11px] text-slate">{CASE_STAGE_LABELS[k.stage as CaseStage] ?? k.stage}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Block>

      <Block title="الإسناد والحالة">
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate">المسؤول</span>
            <Select
              className="w-full"
              value={c.assignee_id ?? ""}
              disabled={readOnly || busy === "assign"}
              onChange={(e) =>
                void act("assign", () => assignInbox({ data: { workspaceId: ws, id: c.id, assigneeId: e.target.value || null } }))
              }
            >
              <option value="">غير مسند</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                  {m.user_id === me ? " (أنت)" : ""}
                </option>
              ))}
            </Select>
          </label>
          {!readOnly && c.assignee_id !== me ? (
            <button
              type="button"
              onClick={() => void act("assign", () => assignInbox({ data: { workspaceId: ws, id: c.id, assigneeId: me } }))}
              className="text-[12.5px] font-semibold text-pine hover:underline"
            >
              تولَّ المحادثة
            </button>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate">الحالة</span>
            <Select
              className="w-full"
              value={c.status}
              disabled={readOnly || busy === "status"}
              onChange={(e) =>
                void act("status", () =>
                  setInboxStatus({ data: { workspaceId: ws, id: c.id, status: e.target.value as "open" | "pending" | "closed" } }),
                )
              }
            >
              {c.status === "bot" ? <option value="bot">{CONV_STATUS_LABELS.bot}</option> : null}
              <option value="open">{CONV_STATUS_LABELS.open}</option>
              <option value="pending">{CONV_STATUS_LABELS.pending}</option>
              <option value="closed">{CONV_STATUS_LABELS.closed}</option>
            </Select>
          </label>
        </div>
      </Block>

      <Block
        title={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-lime-600" aria-hidden="true" /> الذكاء الاصطناعي
          </span>
        }
      >
        {!setup ? null : !setup.ai.planAllows ? (
          <p className="text-[12.5px] leading-relaxed text-slate">
            التلخيص واقتراح الردود والتصنيف ضمن خطتي «احترافي» و«مؤسسي».{" "}
            <Link to="/app/billing" className="font-semibold text-pine hover:underline">
              ترقية الخطة
            </Link>
          </p>
        ) : !setup.ai.configured ? (
          <p className="text-[12.5px] text-slate">المساعد الذكي قيد التجهيز لمكتبك.</p>
        ) : null}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate">ملخص المحادثة</span>
              {aiReady ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={busy === "summary" ? Loader2 : FileText}
                  disabled={busy === "summary" || readOnly}
                  onClick={() => void act("summary", () => inboxAi({ data: { workspaceId: ws, id: c.id, task: "summary" } }))}
                >
                  لخّص المحادثة
                </Button>
              ) : null}
            </div>
            {c.ai_summary ? (
              <p className="mt-1.5 rounded-lg bg-lime-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-pine-deep ring-1 ring-lime/40">
                {c.ai_summary}
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] text-slate">لا ملخص بعد.</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate">نوع الطلب</span>
              {aiReady ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={busy === "classify" ? Loader2 : Tags}
                  disabled={busy === "classify" || readOnly}
                  onClick={() => void act("classify", () => inboxAi({ data: { workspaceId: ws, id: c.id, task: "classify" } }))}
                >
                  صنّف الطلب
                </Button>
              ) : null}
            </div>
            <Select
              className="mt-1.5 w-full"
              aria-label="نوع الطلب"
              value={c.ai_intent ?? ""}
              disabled={readOnly || busy === "intent"}
              onChange={(e) =>
                void act("intent", () =>
                  setInboxIntent({ data: { workspaceId: ws, id: c.id, intent: (e.target.value || null) as Intent | null } }),
                )
              }
            >
              <option value="">غير مصنّف</option>
              {INTENTS.map((k) => (
                <option key={k} value={k}>
                  {INTENT_LABELS[k]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Block>
    </div>
  );
}

/** «اتصال من المتصفح» for the contact, when calls are available and the number is Saudi. */
function ContactCall({ phone, label, clientId, conversationId }: { phone: string; label: string; clientId: string | null; conversationId: string }) {
  const sp = useSoftphone();
  if (!sp.ready || !saudiPhone(phone)) return null;
  return (
    <CallButton
      phone={phone}
      label={label}
      clientId={clientId}
      conversationId={conversationId}
      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-pine-deep hover:bg-paper"
    />
  );
}

function Block({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-bold text-pine-deep">{title}</h3>
      {children}
    </section>
  );
}
