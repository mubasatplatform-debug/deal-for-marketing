import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, MessageCircle, MessagesSquare, Search, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardHeader, Num, Segmented, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import type { RequestRow } from "@/lib/requests";
import { cn } from "@/lib/utils";
import { formatDate, isoDate, relativeDate } from "./format";
import { ServiceTile } from "./service-icon";
import { Stepper } from "./stepper";
import { StatusPill } from "./status-pill";
import { followUpText, isDelivered, nextStepText, stepIndex, waLink } from "./status";

type Filter = "all" | "active" | "delivered";

/** Search appears once the list is long enough to need it. */
const SEARCH_FROM = 6;

export function RequestList({
  rows,
  now,
  openId,
  onToggle,
}: {
  rows: RequestRow[];
  now: Date;
  openId: number | null;
  onToggle: (id: number) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const delivered = rows.filter((r) => isDelivered(r.status)).length;
    return { all: rows.length, active: rows.length - delivered, delivered };
  }, [rows]);

  // Opening a row from elsewhere (the active card) must not be hidden by a filter.
  useEffect(() => {
    if (openId === null) return;
    const row = rows.find((r) => r.id === openId);
    if (!row) return;
    const hidden =
      (filter === "active" && isDelivered(row.status)) || (filter === "delivered" && !isDelivered(row.status));
    if (hidden) setFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to a new openId
  }, [openId]);

  const q = query.trim().toLowerCase().replace(/^#/, "");
  const visible = rows.filter((r) => {
    if (filter === "active" && isDelivered(r.status)) return false;
    if (filter === "delivered" && !isDelivered(r.status)) return false;
    if (!q) return true;
    return [String(r.id), r.service_title, r.company, r.brief].some((v) => v.toLowerCase().includes(q));
  });

  const showSearch = rows.length >= SEARCH_FROM;

  return (
    <Card>
      <CardHeader
        title={<span id="requests">طلباتي</span>}
        description="كل طلب أرسلته وهو مسجّل في حسابك."
        className="scroll-mt-24"
      />
      <div className="mt-4 flex flex-col gap-3 px-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="[&>[role=group]]:w-full md:[&>[role=group]]:w-auto [&_button]:flex-1 [&_button]:justify-center md:[&_button]:flex-none">
        <Segmented
          label="تصفية الطلبات"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "الكل", count: counts.all },
            { value: "active", label: "قيد التنفيذ", count: counts.active },
            { value: "delivered", label: "تم التسليم", count: counts.delivered },
          ]}
        />
        </div>
        {showSearch ? (
          <label className="relative block md:w-64">
            <span className="sr-only">ابحث في طلباتك</span>
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالخدمة أو الرقم"
              className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-9 text-sm text-pine-deep placeholder:text-slate/70 focus:border-pine focus:ring-2 focus:ring-pine-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setQuery("")}
                className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <ul className="mt-4 border-t border-line" aria-live="polite">
          {visible.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <RequestRowItem row={r} now={now} open={openId === r.id} onToggle={() => onToggle(r.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 border-t border-line px-6 py-12 text-center" aria-live="polite">
          <p className="text-sm font-semibold text-pine-deep">
            {q ? "لا توجد طلبات تطابق بحثك." : "لا توجد طلبات في هذا التصنيف."}
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
            className={cn(buttonClass("ghost", "sm"), "mt-2 text-pine")}
          >
            عرض كل الطلبات
          </button>
        </div>
      )}
    </Card>
  );
}

function RequestRowItem({
  row,
  now,
  open,
  onToggle,
}: {
  row: RequestRow;
  now: Date;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const brief = row.brief.trim();

  // When opened from the active card, bring the row into view.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current && ref.current) {
      const r = ref.current.getBoundingClientRect();
      if (r.top < 64 || r.top > window.innerHeight - 120) {
        ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div ref={ref} className="scroll-mt-24">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "group flex w-full items-center gap-3.5 px-5 py-4 text-start transition-colors md:gap-4 md:px-6",
          "focus-visible:bg-paper focus-visible:outline-none",
          open ? "bg-paper/70" : "hover:bg-paper/60",
        )}
      >
        <ServiceTile slug={row.service_slug} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-pine-deep">{row.service_title}</span>
            {row.unread > 0 ? <UnreadBadge count={row.unread} /> : null}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-x-2 text-[13px] text-slate sm:mt-0.5">
            <span className="shrink-0 sm:hidden">
              <StatusPill status={row.status} />
            </span>
            <Num className="shrink-0">
              <bdi>#{row.id}</bdi>
            </Num>
            <span aria-hidden="true" className="text-line-strong">·</span>
            <time dateTime={isoDate(row.created_at)} className="shrink-0">
              <Num>{relativeDate(row.created_at, now)}</Num>
            </time>
            {row.company ? (
              <>
                <span aria-hidden="true" className="hidden text-line-strong sm:inline">·</span>
                <span className="hidden truncate sm:inline">{row.company}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden sm:inline-flex">
            <StatusPill status={row.status} />
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-slate transition-transform duration-200 group-hover:text-pine-deep",
              open && "rotate-180 text-pine-deep",
            )}
          />
        </span>
      </button>

      {open ? (
        <div id={panelId} className="bg-paper/70 px-5 pb-5 md:px-6">
          <div className="rounded-xl border border-line bg-surface">
            <div className="px-4 pt-5 pb-4 md:px-6">
              <Stepper current={stepIndex(row.status)} size="sm" />
              <p className="mt-4 text-center text-[13px] text-slate">{nextStepText(row.status)}</p>
            </div>
            {brief ? (
              <div className="border-t border-line px-4 py-4 md:px-6">
                <p className="text-xs font-semibold text-slate">تفاصيل الطلب</p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-pine-deep">
                  {brief}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <p className="text-xs text-slate">
                أُرسل في{" "}
                <time dateTime={isoDate(row.created_at)}>
                  <Num>{formatDate(row.created_at, now)}</Num>
                </time>
                {row.company ? <> · {row.company}</> : null}
              </p>
              <div className="flex gap-2">
                <a
                  href={waLink(followUpText(row.id, row.service_title))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonClass("secondary", "sm"), "flex-1 sm:flex-none")}
                >
                  <MessageCircle className="size-3.5" />
                  واتساب
                </a>
                <Link
                  to="/client/requests/$id"
                  params={{ id: String(row.id) }}
                  className={cn(buttonClass("primary", "sm"), "flex-1 sm:flex-none")}
                >
                  <MessagesSquare className="size-3.5" />
                  المحادثة والملفات
                  {row.unread > 0 ? (
                    <Num className="rounded-full bg-pine-deep px-1.5 text-[11px] leading-5 text-lime">{row.unread}</Num>
                  ) : null}
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "2 جديد" chip for unread team messages on a request. */
export function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-[11px] leading-4 font-bold text-pine-deep"
      title={count === 1 ? "رسالة جديدة من فريق ديل" : `${count} رسائل جديدة من فريق ديل`}
    >
      <MessagesSquare aria-hidden="true" className="size-3" />
      <Num>{count}</Num>
      <span className="sr-only">رسائل جديدة</span>
    </span>
  );
}

export function RequestListSkeleton() {
  return (
    <div aria-hidden="true">
      <Card>
        <div className="px-5 pt-5 md:px-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-3 w-48" />
          <Skeleton className="mt-5 h-10 w-72 max-w-full rounded-xl" />
        </div>
        <ul className="mt-4 border-t border-line">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 md:px-6">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
