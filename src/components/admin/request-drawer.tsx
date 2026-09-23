import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Eye,
  Globe,
  Link2,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  RotateCw,
  StickyNote,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, Button, Num, Pill, Select, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import {
  NOTE_MAX,
  type AdminRequestRow,
  type EventRow,
  type NoteRow,
  type RequestActivity,
  type TeamMember,
} from "@/lib/admin";
import { cn } from "@/lib/utils";
import { sourceLabel } from "@/lib/attribution";
import type { Thread } from "@/lib/thread";
import { ThreadPanel } from "@/components/thread/thread-panel";
import { SourcePill } from "./source";
import {
  STATUS_ORDER,
  displayPhone,
  formatAbsolute,
  formatRelative,
  initialsName,
  statusLabel,
  statusTone,
  whatsappHref,
} from "./format";

const FOCUSABLE =
  'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Request detail sheet. It opens at the inline end (left in RTL) so the
 * sidebar stays in view, traps focus, closes on Esc or backdrop click and
 * hands focus back to the row that opened it.
 */
export function RequestDrawer({
  row,
  now,
  pending,
  team,
  me,
  onClose,
  onStatus,
  onAssign,
  loadActivity,
  onAddNote,
  loadThread,
  onThreadRead,
}: {
  row: AdminRequestRow;
  now: number;
  pending: boolean;
  /** Who the request can be assigned to. */
  team: TeamMember[];
  /** The signed-in team member's id. */
  me: string;
  onClose: () => void;
  /** Resolve when saved; reject when not (the panel rolls back and says so). */
  onStatus: (status: string) => Promise<void>;
  onAssign: (assigneeId: string | null) => Promise<void>;
  loadActivity: () => Promise<RequestActivity>;
  onAddNote: (body: string) => Promise<NoteRow>;
  /** The customer conversation (visible to the customer). */
  loadThread: () => Promise<Thread>;
  /** The team side of the thread was marked read. */
  onThreadRead: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus();
    };
  }, []);

  const [activity, setActivity] = useState<RequestActivity | null>(null);
  const [activityState, setActivityState] = useState<"loading" | "error" | "ready">("loading");
  // Relative times in the sheet count from its latest fetch, so entries made
  // after the dashboard loaded never read as "in a minute".
  const [clock, setClock] = useState(now);
  const loadRef = useRef(loadActivity);
  loadRef.current = loadActivity;
  const refresh = useCallback((quiet = false) => {
    if (!quiet) setActivityState("loading");
    loadRef
      .current()
      .then((a) => {
        setActivity(a);
        setClock(Date.now());
        setActivityState("ready");
      })
      .catch(() => {
        if (!quiet) setActivityState("error");
      });
  }, []);
  useEffect(() => refresh(), [refresh]);

  const changeStatus = (s: string) =>
    onStatus(s).then(
      () => refresh(true),
      () => {},
    );
  const changeAssignee = (id: string | null) =>
    onAssign(id).then(
      () => refresh(true),
      () => {},
    );
  const addNote = async (body: string) => {
    const note = await onAddNote(body);
    setClock(Date.now());
    setActivity((a) => (a ? { ...a, notes: [note, ...a.notes] } : a));
    refresh(true);
  };

  const created = new Date(row.created_at);
  const wa = whatsappHref(row);
  const name = initialsName(row);
  const titleId = `req-${row.id}-title`;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-pine-deep/35 backdrop-blur-[1px] motion-safe:animate-[admin-fade_160ms_ease-out]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 end-0 flex w-full max-w-[480px] flex-col bg-surface shadow-[0_0_0_1px_rgba(16,38,40,0.06),0_24px_64px_-12px_rgba(16,38,40,0.3)] motion-safe:animate-[admin-sheet_220ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <style>{`@keyframes admin-fade{from{opacity:0}}@keyframes admin-sheet{from{transform:translateX(-24px);opacity:0}}`}</style>
        <header className="flex items-start gap-3 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate">
              طلب <Num>#{row.id}</Num>
            </p>
            <h2 id={titleId} className="mt-0.5 text-lg font-extrabold text-pine-deep">
              {row.service_title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone={statusTone[row.status] ?? "neutral"}>{statusLabel(row.status)}</Pill>
              <SourcePill source={row.source} />
            </div>
          </div>
          <button
            type="button"
            data-autofocus
            aria-label="إغلاق التفاصيل"
            onClick={onClose}
            className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate transition-colors hover:bg-paper hover:text-pine-deep focus-visible:outline-2 focus-visible:outline-pine"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <section className="px-6 py-5">
            <div className="flex items-center gap-3">
              <Avatar name={name} className="size-11 text-[15px]" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-pine-deep">{name}</p>
                {row.company ? (
                  <p className="flex items-center gap-1.5 truncate text-[13px] text-slate">
                    <Building2 className="size-3.5 shrink-0" />
                    {row.company}
                  </p>
                ) : null}
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-[13px]">
              {row.phone ? (
                <Detail icon={<Phone className="size-3.5" />} label="الجوال">
                  <Num className="text-pine-deep">
                    <span dir="ltr">{displayPhone(row.phone)}</span>
                  </Num>
                </Detail>
              ) : null}
              {row.account_email ? (
                <Detail icon={<Mail className="size-3.5" />} label="الحساب">
                  <span dir="ltr" className="font-ui text-pine-deep">
                    {row.account_email}
                  </span>
                </Detail>
              ) : null}
            </dl>
            {row.phone ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={`tel:+${displayPhone(row.phone).replace(/\D/g, "")}`}
                  className={buttonClass("secondary")}
                >
                  <Phone className="size-4" />
                  اتصال
                </a>
                {wa ? (
                  <a href={wa} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
                    <MessageCircle className="size-4" />
                    واتساب
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="border-t border-line px-6 py-5">
            <h3 id={`${titleId}-status`} className="text-[13px] font-bold text-pine-deep">
              حالة الطلب
            </h3>
            <div
              role="radiogroup"
              aria-labelledby={`${titleId}-status`}
              className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-paper p-1"
            >
              {STATUS_ORDER.map((s) => {
                const active = row.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={pending && !active}
                    onClick={() => !active && void changeStatus(s)}
                    className={cn(
                      "h-9 rounded-lg px-1 text-[12px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-pine",
                      active
                        ? "bg-surface text-pine-deep shadow-sm ring-1 ring-line"
                        : "text-slate hover:text-pine-deep disabled:opacity-50",
                    )}
                  >
                    {statusLabel(s)}
                  </button>
                );
              })}
            </div>
          </section>

          <AssigneeSection
            row={row}
            team={team}
            me={me}
            pending={pending}
            onAssign={(id) => void changeAssignee(id)}
          />

          <section className="border-t border-line px-6 py-5">
            <h3 className="text-[13px] font-bold text-pine-deep">تفاصيل الطلب</h3>
            <p className="mt-2 text-sm leading-7 whitespace-pre-line text-pine-deep/90">
              {row.brief.trim() || "لم يُضف العميل تفاصيل."}
            </p>
          </section>

          <ThreadSection row={row} wa={wa} load={loadThread} onRead={onThreadRead} />

          <NotesSection
            titleId={titleId}
            state={activityState}
            notes={activity?.notes ?? []}
            now={clock}
            me={me}
            onRetry={() => refresh()}
            onAdd={addNote}
          />

          <SourceSection row={row} />

          <section className="border-t border-line px-6 py-5">
            <h3 className="text-[13px] font-bold text-pine-deep">السجل</h3>
            {activityState === "loading" && !activity ? (
              <div className="mt-3 space-y-3" aria-hidden="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="mt-1 size-[11px] rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol className="mt-3">
                {(activity?.events ?? []).map((e) => (
                  <TimelineItem
                    key={e.id}
                    tone={e.kind === "note" ? "lime" : "pine"}
                    title={eventTitle(e, me)}
                    when={`${eventActor(e, me)} · ${formatRelative(new Date(e.created_at), clock)} · ${formatAbsolute(new Date(e.created_at))}${e.via === "api" ? " · عبر API" : ""}`}
                  />
                ))}
                {row.notified_at ? (
                  <TimelineItem
                    tone="pine"
                    title="أُشعر الفريق"
                    when={formatAbsolute(new Date(row.notified_at))}
                  />
                ) : (
                  <TimelineItem tone="danger" title="لم يصل إشعار الفريق" when="تابع الطلب يدويًا" />
                )}
                <TimelineItem
                  tone="pine"
                  title={`وصل الطلب${row.source ? ` من ${sourceLabel(row.source)}` : ""}`}
                  when={`${formatRelative(created, clock)} · ${formatAbsolute(created)}`}
                  last
                />
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const FORMER = "عضو سابق في الفريق";

function eventActor(e: EventRow, me: string): string {
  return e.actor_id === me ? "أنت" : (e.actor_name ?? FORMER);
}

function eventTitle(e: EventRow, me: string): string {
  switch (e.kind) {
    case "status":
      return `نُقل من «${statusLabel(e.from_value ?? "")}» إلى «${statusLabel(e.to_value ?? "")}»`;
    case "assign": {
      if (!e.to_value) return "أُلغي الإسناد";
      if (e.to_value === e.actor_id) return "استلم الطلب";
      return `أُسند ${e.to_value === me ? "لك" : `إلى ${e.to_name ?? FORMER}`}`;
    }
    case "note":
      return "أُضيفت ملاحظة داخلية";
    default:
      return "";
  }
}

function AssigneeSection({
  row,
  team,
  me,
  pending,
  onAssign,
}: {
  row: AdminRequestRow;
  team: TeamMember[];
  me: string;
  pending: boolean;
  onAssign: (id: string | null) => void;
}) {
  const id = `req-${row.id}-assignee`;
  // A former member stays visible as the current value until reassigned.
  const known = !row.assignee_id || team.some((m) => m.id === row.assignee_id);
  const mine = row.assignee_id === me;
  const meOnTeam = team.some((m) => m.id === me);
  return (
    <section className="border-t border-line px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-bold text-pine-deep">
          المسؤول عن الطلب
        </label>
        {!mine && meOnTeam ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onAssign(me)}
            className="text-xs font-semibold text-pine underline-offset-4 hover:underline disabled:opacity-50"
          >
            استلمه أنا
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {row.assignee_id ? (
          <Avatar name={row.assignee_name ?? "؟"} className="size-10 text-[13px]" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-slate">
            <UserRound className="size-4" />
          </span>
        )}
        <Select
          id={id}
          className="min-w-0 flex-1"
          value={row.assignee_id ?? ""}
          disabled={pending}
          onChange={(e) => onAssign(e.target.value || null)}
        >
          <option value="">غير مسند</option>
          {!known ? (
            <option value={row.assignee_id ?? ""}>{row.assignee_name ?? FORMER}</option>
          ) : null}
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === me ? `${m.name} (أنت)` : m.name}
            </option>
          ))}
        </Select>
      </div>
      {team.length === 0 ? (
        <p className="mt-2 text-xs text-slate">
          لا يوجد أعضاء فريق بحسابات بعد. يظهر العضو هنا بعد إنشاء حسابه.
        </p>
      ) : null}
    </section>
  );
}

function SourceSection({ row }: { row: AdminRequestRow }) {
  const rows: { icon: ReactNode; label: string; value: string | null; ltr?: boolean }[] = [
    { icon: <Megaphone className="size-3.5" />, label: "الحملة", value: row.utm_campaign },
    {
      icon: <Link2 className="size-3.5" />,
      label: "utm",
      value:
        [row.utm_source, row.utm_medium].filter(Boolean).join(" / ") || null,
      ltr: true,
    },
    { icon: <Globe className="size-3.5" />, label: "أحالته", value: row.referrer_host, ltr: true },
    { icon: <Link2 className="size-3.5" />, label: "أول صفحة", value: row.landing_path, ltr: true },
  ];
  const shown = rows.filter((r) => r.value);
  return (
    <section className="border-t border-line px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold text-pine-deep">مصدر الطلب</h3>
        <SourcePill source={row.source} />
      </div>
      {shown.length ? (
        <dl className="mt-3 space-y-2 text-[13px]">
          {shown.map((r) => (
            <Detail key={r.label} icon={r.icon} label={r.label}>
              <span
                dir={r.ltr ? "ltr" : undefined}
                className={cn("text-pine-deep", r.ltr && "font-ui")}
                title={r.value ?? undefined}
              >
                {r.value}
              </span>
            </Detail>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-slate">
          {row.source === "direct"
            ? "دخل الموقع مباشرة، دون حملة أو موقع محيل."
            : "لم يُسجَّل مصدر لهذا الطلب."}
        </p>
      )}
    </section>
  );
}

function NotesSection({
  titleId,
  state,
  notes,
  now,
  me,
  onRetry,
  onAdd,
}: {
  titleId: string;
  state: "loading" | "error" | "ready";
  notes: NoteRow[];
  now: number;
  me: string;
  onRetry: () => void;
  onAdd: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const id = `${titleId}-note`;
  const left = NOTE_MAX - text.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(body);
      setText("");
    } catch {
      setError("تعذر حفظ الملاحظة. تحقق من الاتصال ثم حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t border-line bg-paper/60 px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold text-pine-deep">
          ملاحظات الفريق <span className="font-semibold text-slate">— لا يراها العميل</span>
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-slate ring-1 ring-line">
          <Lock className="size-3" aria-hidden="true" />
          داخلية
        </span>
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-3">
        <label htmlFor={id} className="sr-only">
          ملاحظة داخلية جديدة
        </label>
        <textarea
          id={id}
          value={text}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit(e);
            }
          }}
          placeholder="اكتب ملاحظة للفريق: ما تم الاتفاق عليه، الخطوة التالية…"
          className="block w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-pine-deep placeholder:text-slate/70 focus:border-pine/40 focus:ring-4 focus:ring-pine/10 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <Num
            className={cn("text-[11px]", left < 100 ? "text-red-700" : "text-slate/70")}
          >
            {left < 300 ? `${left} حرفًا متبقيًا` : ""}
          </Num>
          <Button
            type="submit"
            size="sm"
            variant="dark"
            icon={StickyNote}
            disabled={saving || !text.trim()}
          >
            {saving ? "جارٍ الحفظ…" : "إضافة ملاحظة"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </form>

      {state === "error" ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            تعذر تحميل الملاحظات والسجل
          </span>
          <Button size="sm" variant="ghost" icon={RotateCw} onClick={onRetry}>
            إعادة
          </Button>
        </div>
      ) : state === "loading" && notes.length === 0 ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : notes.length ? (
        <ul className="mt-4 space-y-2.5" aria-label="الملاحظات، الأحدث أولًا">
          {notes.map((n) => {
            const at = new Date(n.created_at);
            const author = n.author_id === me ? "أنت" : (n.author_name ?? FORMER);
            return (
              <li key={n.id} className="rounded-xl bg-paper px-3.5 py-3 ring-1 ring-line/70">
                <p className="text-sm leading-6 break-words whitespace-pre-line text-pine-deep">
                  {n.body}
                </p>
                <p className="mt-1.5 text-[11px] text-slate">
                  <span className="font-semibold">{author}</span> ·{" "}
                  <time dateTime={at.toISOString()} title={formatAbsolute(at)}>
                    {formatRelative(at, now)}
                  </time>
                </p>
              </li>
            );
          })}
        </ul>
      ) : state === "ready" ? (
        <p className="mt-3 text-xs text-slate">لا ملاحظات بعد.</p>
      ) : null}
    </section>
  );
}

function ThreadSection({
  row,
  wa,
  load,
  onRead,
}: {
  row: AdminRequestRow;
  wa: string | null;
  load: () => Promise<Thread>;
  onRead: () => void;
}) {
  return (
    <section className="border-t border-line px-6 py-5" aria-labelledby={`req-${row.id}-thread`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`req-${row.id}-thread`} className="text-[13px] font-bold text-pine-deep">
          المحادثة مع العميل
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-50 px-2 py-0.5 text-[11px] font-bold text-lime-600 ring-1 ring-lime/40">
          <Eye className="size-3" aria-hidden="true" />
          يراها العميل
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate">
        ما يُكتب ويُرفق هنا يظهر للعميل في حسابه، ويصله بريد بالرد.
      </p>
      <div className="mt-2">
        <ThreadPanel
          side="team"
          variant="drawer"
          requestId={row.id}
          load={load}
          onRead={onRead}
          peerName={initialsName(row)}
          unavailable={(t) =>
            t.clientHasAccount ? null : (
              <div className="rounded-xl bg-paper px-3.5 py-3 ring-1 ring-line">
                <p className="text-[13px] font-semibold text-pine-deep">العميل ليس لديه حساب</p>
                <p className="mt-0.5 text-xs leading-5 text-slate">
                  أرسل الطلب دون تسجيل دخول، فلا يستطيع قراءة المحادثة. تواصل معه على جواله.
                </p>
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonClass("primary", "sm"), "mt-2.5")}
                  >
                    <MessageCircle className="size-3.5" />
                    مراسلة على واتساب
                  </a>
                ) : null}
              </div>
            )
          }
        />
      </div>
    </section>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="flex w-20 shrink-0 items-center gap-1.5 text-slate">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

function TimelineItem({
  title,
  when,
  tone,
  last,
}: {
  title: string;
  when: string;
  tone: "pine" | "lime" | "danger";
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? (
        <span aria-hidden="true" className="absolute start-[5px] top-4 bottom-0 w-px bg-line" />
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "relative mt-1.5 size-[11px] shrink-0 rounded-full ring-[3px] ring-surface",
          tone === "pine" && "bg-pine",
          tone === "lime" && "bg-lime",
          tone === "danger" && "bg-red-500",
        )}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-pine-deep">{title}</p>
        <p className="mt-0.5 text-xs text-slate">{when}</p>
      </div>
    </li>
  );
}
