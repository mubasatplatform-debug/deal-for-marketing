import { useEffect, useRef, type ReactNode } from "react";
import { Building2, Mail, MessageCircle, Phone, X } from "lucide-react";
import { Avatar, Num, Pill } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import type { AdminRequestRow } from "@/lib/admin";
import { cn } from "@/lib/utils";
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
  onClose,
  onStatus,
}: {
  row: AdminRequestRow;
  now: number;
  pending: boolean;
  onClose: () => void;
  onStatus: (status: string) => void;
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
            <div className="mt-2">
              <Pill tone={statusTone[row.status] ?? "neutral"}>{statusLabel(row.status)}</Pill>
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
                    onClick={() => !active && onStatus(s)}
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

          <section className="border-t border-line px-6 py-5">
            <h3 className="text-[13px] font-bold text-pine-deep">تفاصيل الطلب</h3>
            <p className="mt-2 text-sm leading-7 whitespace-pre-line text-pine-deep/90">
              {row.brief.trim() || "لم يُضف العميل تفاصيل."}
            </p>
          </section>

          <section className="border-t border-line px-6 py-5">
            <h3 className="text-[13px] font-bold text-pine-deep">السجل</h3>
            <ol className="mt-3">
              <TimelineItem
                tone="pine"
                title="وصل الطلب"
                when={`${formatRelative(created, now)} · ${formatAbsolute(created)}`}
              />
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
                tone={row.status === "new" ? "lime" : "pine"}
                title={`الحالة الحالية: ${statusLabel(row.status)}`}
                when={row.status === "delivered" ? "اكتمل الطلب" : "بانتظار الخطوة التالية"}
                last
              />
            </ol>
          </section>
        </div>
      </div>
    </div>
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
