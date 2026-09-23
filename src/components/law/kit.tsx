import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type DependencyList,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCw, Search, X } from "lucide-react";
import { Button, Card, EmptyState, Pill, Skeleton, type Tone } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { fieldClass } from "@/components/law/fields";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { can, type Action } from "@/lib/law/permissions";
import {
  APPOINTMENT_STATUS_LABELS,
  CASE_STAGE_LABELS,
  MODE_SHORT,
  type AppointmentStatus,
  type CaseStage,
  type ConsultMode,
} from "@/lib/law/options";
import { getLawMembers, pickClients } from "@/lib/law/practice";
import type { MemberOption } from "@/lib/law/practice-core";
import { cn } from "@/lib/utils";

/**
 * Shared pieces of the practice pages (clients, cases, schedule, documents):
 * data loading, search, pagination, pickers, status pills and confirmations,
 * all in the DEAL dashboard vocabulary (Card, Pill, Button, fieldClass).
 */

/* ------------------------------------------------------------------------ */
/* Data                                                                      */
/* ------------------------------------------------------------------------ */

export type Loaded<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
};

/** Load with a server function; keeps the last data while reloading. */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    const n = (seq.current += 1);
    setLoading(true);
    try {
      const v = await run();
      if (n === seq.current) {
        setData(v);
        setError(null);
      }
    } catch (err) {
      if (n === seq.current) setError(workspaceErrorMessage(err));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}

/** Debounced value (search boxes). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** `can(action)` for the signed-in member (UI only; the server re-checks). */
export function useCan() {
  const { active } = useLawApp();
  const readOnly = active.lifecycle.readOnly;
  return useCallback(
    (action: Action, opts: { write?: boolean } = { write: true }) =>
      can(active.role, action) && !(opts.write !== false && readOnly && !action.endsWith(".view")),
    [active.role, readOnly],
  );
}

const memberCache = new Map<string, Promise<MemberOption[]>>();

/** The office's members (pickers), cached per office for the session. */
export function useMembers(): MemberOption[] {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const [members, setMembers] = useState<MemberOption[]>([]);
  useEffect(() => {
    let alive = true;
    let p = memberCache.get(wsId);
    if (!p) {
      p = getLawMembers({ data: { workspaceId: wsId } });
      memberCache.set(wsId, p);
      p.catch(() => memberCache.delete(wsId));
    }
    p.then((m) => alive && setMembers(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [wsId]);
  return members;
}

/** Members who can carry legal work (owner / admin / lawyer). */
export function lawyersOf(members: MemberOption[]): MemberOption[] {
  return members.filter((m) => m.role !== "staff");
}

/* ------------------------------------------------------------------------ */
/* Layout bits                                                               */
/* ------------------------------------------------------------------------ */

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-line bg-surface ps-10 pe-9 text-[14px] text-pine-deep outline-none placeholder:text-slate/70 focus:border-pine/40 focus:ring-4 focus:ring-pine/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="مسح البحث"
          onClick={() => onChange("")}
          className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="الصفحات" className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 md:px-6">
      <p className="text-[13px] text-slate">
        <span className="font-ui tabular-nums">
          {from}–{to}
        </span>{" "}
        من <span className="font-ui tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="الصفحة السابقة"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="grid size-9 place-items-center rounded-lg border border-line text-pine-deep hover:bg-paper disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="min-w-14 text-center font-ui text-[13px] font-semibold tabular-nums">
          {page} / {pages}
        </span>
        <button
          type="button"
          aria-label="الصفحة التالية"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="grid size-9 place-items-center rounded-lg border border-line text-pine-deep hover:bg-paper disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    </nav>
  );
}

export function ErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Card>
      <EmptyState
        title={title}
        body={message}
        action={
          <Button icon={RotateCw} onClick={onRetry}>
            إعادة المحاولة
          </Button>
        }
      />
    </Card>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4 md:px-6">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TextArea({ invalid, className, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldClass,
        "h-auto min-h-24 resize-y py-3 leading-relaxed",
        invalid ? "border-red-500" : "border-line-strong",
        className,
      )}
    />
  );
}

export function InfoRow({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-slate">{k}</dt>
      <dd className="min-w-0 text-end font-semibold break-words">{v}</dd>
    </div>
  );
}

/** Simple tab strip (buttons with aria-selected). */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line px-3 md:px-4">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3 text-[13.5px] font-semibold transition-colors",
              on ? "text-pine-deep" : "text-slate hover:text-pine-deep",
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 font-ui text-[11px] leading-5 tabular-nums",
                  on ? "bg-lime text-pine-deep" : "bg-paper text-slate",
                )}
              >
                {t.count}
              </span>
            ) : null}
            {on ? <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-pine" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Pills                                                                     */
/* ------------------------------------------------------------------------ */

const STAGE_TONE: Record<CaseStage, Tone> = {
  consultation: "neutral",
  study: "neutral",
  filed: "pine",
  hearings: "pine",
  judgment: "lime",
  enforcement: "lime",
  closed: "neutral",
};

export function StagePill({ stage }: { stage: CaseStage }) {
  return (
    <Pill tone={STAGE_TONE[stage]} dot={stage !== "closed"} className={stage === "closed" ? "text-slate/80" : undefined}>
      {CASE_STAGE_LABELS[stage]}
    </Pill>
  );
}

const STATUS_TONE: Record<AppointmentStatus, Tone> = {
  pending: "lime",
  confirmed: "pine",
  done: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{APPOINTMENT_STATUS_LABELS[status]}</Pill>;
}

export function ModePill({ mode }: { mode: ConsultMode }) {
  return (
    <Pill tone={mode === "video" ? "info" : "neutral"} dot={false}>
      {MODE_SHORT[mode]}
    </Pill>
  );
}

/* ------------------------------------------------------------------------ */
/* Confirm                                                                   */
/* ------------------------------------------------------------------------ */

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      busy={busy}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            تراجع
          </Button>
          <Button
            variant={danger ? "dark" : "primary"}
            icon={busy ? Loader2 : undefined}
            disabled={busy}
            className={danger ? "bg-red-700 hover:bg-red-800" : undefined}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-slate">{body}</div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* Pickers                                                                   */
/* ------------------------------------------------------------------------ */

export type PickedClient = { id: string; name: string };

/** Search-as-you-type client picker (combobox). */
export function ClientPicker({
  id,
  value,
  onChange,
  invalid,
  placeholder = "ابحث باسم العميل…",
}: {
  id?: string;
  value: PickedClient | null;
  onChange: (c: PickedClient | null) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const { active } = useLawApp();
  const auto = useId();
  const inputId = id ?? auto;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const dq = useDebounced(q, 200);
  const [options, setOptions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    pickClients({ data: { workspaceId: active.workspace.id, q: dq } })
      .then((r) => {
        if (alive) {
          setOptions(r);
          setHi(0);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dq, open, active.workspace.id]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (value) {
    return (
      <div className={cn(fieldClass, "flex items-center justify-between gap-2 border-line-strong")}>
        <span className="truncate font-semibold">{value.name}</span>
        <button
          type="button"
          aria-label="تغيير العميل"
          onClick={() => onChange(null)}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }
  const listId = `${inputId}-list`;
  return (
    <div ref={box} className="relative">
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        autoComplete="off"
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(options.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" && open && options[hi]) {
            e.preventDefault();
            onChange({ id: options[hi].id, name: options[hi].name });
            setOpen(false);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={cn(fieldClass, invalid ? "border-red-500" : "border-line-strong")}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(16,38,40,0.3)] ring-1 ring-line"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-slate">{dq ? "لا نتائج مطابقة." : "لا عملاء بعد."}</li>
          ) : (
            options.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === hi}>
                <button
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => {
                    onChange({ id: o.id, name: o.name });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm",
                    i === hi ? "bg-pine-50" : "hover:bg-paper",
                  )}
                >
                  <span className="truncate font-semibold">{o.name}</span>
                  {o.phone ? (
                    <span dir="ltr" className="shrink-0 font-ui text-xs text-slate">
                      {o.phone.replace(/^\+966/, "0")}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Checkbox list of members (case lawyers). */
export function MemberChecklist({
  members,
  value,
  onChange,
}: {
  members: MemberOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const set = useMemo(() => new Set(value), [value]);
  if (members.length === 0) return <p className="text-[13px] text-slate">لا يوجد محامون في الفريق بعد.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = set.has(m.user_id);
        return (
          <button
            key={m.user_id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== m.user_id) : [...value, m.user_id])}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              on ? "border-pine bg-pine text-snow" : "border-line-strong bg-surface text-pine-deep hover:bg-paper",
            )}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
