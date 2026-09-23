import { ArrowDown, ArrowUp, BellOff, BellRing, ChevronLeft, MessagesSquare, UserRound } from "lucide-react";
import { Avatar, Num, Pill, Skeleton } from "@/components/dash/ui";
import type { AdminRequestRow } from "@/lib/admin";
import { cn } from "@/lib/utils";
import {
  displayPhone,
  formatAbsolute,
  formatRelative,
  initialsName,
  statusLabel,
  statusTone,
} from "./format";
import { SourcePill } from "./source";

export type SortDir = "desc" | "asc";

function NotifyState({ at }: { at: string | null }) {
  const label = at ? `أُشعر الفريق ${formatAbsolute(new Date(at))}` : "لم يصل إشعار الفريق";
  return (
    <span
      title={label}
      className={cn(
        "inline-grid size-7 place-items-center rounded-lg",
        at ? "text-pine/60" : "bg-red-50 text-red-600",
      )}
    >
      {at ? <BellRing className="size-3.5" /> : <BellOff className="size-3.5" />}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Thread state: lime count of unread customer messages, else the total. */
function Messages({ r }: { r: AdminRequestRow }) {
  if (r.team_unread > 0) {
    return (
      <span
        title={`${r.team_unread} رسائل غير مقروءة من العميل`}
        className="inline-flex items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-pine-deep"
      >
        <MessagesSquare className="size-3" aria-hidden="true" />
        <Num>{r.team_unread}</Num>
        <span className="sr-only">رسائل غير مقروءة</span>
      </span>
    );
  }
  if (r.message_count > 0) {
    return (
      <span title={`${r.message_count} رسائل في المحادثة`} className="inline-flex items-center gap-1 text-xs text-slate">
        <MessagesSquare className="size-3.5" aria-hidden="true" />
        <Num>{r.message_count}</Num>
        <span className="sr-only">رسائل</span>
      </span>
    );
  }
  return <span className="text-xs text-slate/40" aria-label="لا رسائل">—</span>;
}

function Customer({ r }: { r: AdminRequestRow }) {
  const name = initialsName(r);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} className="size-8 bg-pine-50 text-[12px] text-pine" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-pine-deep">{name}</p>
        <p className="truncate text-xs text-slate">{r.company || "—"}</p>
      </div>
    </div>
  );
}

function Assignee({ r, me }: { r: AdminRequestRow; me: string }) {
  if (!r.assignee_id) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate/80">
        <span className="grid size-6 place-items-center rounded-full border border-dashed border-line-strong">
          <UserRound className="size-3" />
        </span>
        غير مسند
      </span>
    );
  }
  const name = r.assignee_name ?? "عضو سابق";
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={`المسؤول: ${name}`}>
      <Avatar name={name} className="size-6 text-[10px]" />
      <span className="truncate text-[13px] font-semibold text-pine-deep">
        {r.assignee_id === me ? "أنت" : name}
      </span>
    </span>
  );
}

export function RequestsTable({
  rows,
  now,
  me,
  sort,
  onSort,
  onOpen,
}: {
  rows: AdminRequestRow[];
  now: number;
  /** Signed-in team member's id, shown as "أنت" in the assignee column. */
  me: string;
  sort: SortDir;
  onSort: () => void;
  onOpen: (id: number) => void;
}) {
  const SortIcon = sort === "desc" ? ArrowDown : ArrowUp;
  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-start">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="hidden w-[14%] xl:table-column" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="border-y border-line bg-paper/60 text-[12px] font-semibold text-slate">
              <th scope="col" className="h-10 ps-5 text-start font-semibold md:ps-6">
                الطلب
              </th>
              <th scope="col" className="text-start font-semibold">
                العميل
              </th>
              <th scope="col" className="hidden text-start font-semibold xl:table-cell">
                التواصل
              </th>
              <th scope="col" className="text-start font-semibold">
                المسؤول
              </th>
              <th scope="col" className="text-start font-semibold">
                الحالة
              </th>
              <th scope="col" className="text-start font-semibold">
                رسائل
              </th>
              <th
                scope="col"
                aria-sort={sort === "desc" ? "descending" : "ascending"}
                className="text-start font-semibold"
              >
                <button
                  type="button"
                  onClick={onSort}
                  className="-ms-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 hover:bg-line/60 hover:text-pine-deep"
                >
                  التاريخ
                  <SortIcon className="size-3.5" />
                  <span className="sr-only">
                    {sort === "desc" ? "الأحدث أولًا" : "الأقدم أولًا"}
                  </span>
                </button>
              </th>
              <th scope="col" className="pe-5 text-end font-semibold md:pe-6">
                إشعار
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const created = new Date(r.created_at);
              return (
                <tr
                  key={r.id}
                  onClick={() => onOpen(r.id)}
                  className="group cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-paper/70"
                >
                  <td className="py-3.5 ps-5 md:ps-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                      }}
                      className="block max-w-full text-start focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pine"
                    >
                      <span className="block truncate text-[13px] font-semibold text-pine-deep">
                        {r.service_title}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <Num className="text-xs text-slate">#{r.id}</Num>
                        <SourcePill source={r.source} />
                      </span>
                    </button>
                  </td>
                  <td className="py-3.5 pe-4">
                    <Customer r={r} />
                  </td>
                  <td className="hidden py-3.5 xl:table-cell">
                    {r.phone ? (
                      <Num className="text-[13px] whitespace-nowrap text-pine-deep">
                        <span dir="ltr">{displayPhone(r.phone)}</span>
                      </Num>
                    ) : (
                      <span className="font-ui text-xs text-slate" dir="ltr">
                        {r.account_email ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pe-3">
                    <Assignee r={r} me={me} />
                  </td>
                  <td className="py-3.5">
                    <Pill tone={statusTone[r.status] ?? "neutral"}>{statusLabel(r.status)}</Pill>
                  </td>
                  <td className="py-3.5">
                    <Messages r={r} />
                  </td>
                  <td className="py-3.5">
                    <time
                      dateTime={created.toISOString()}
                      title={formatAbsolute(created)}
                      className="text-[13px] whitespace-nowrap text-slate"
                    >
                      {formatRelative(created, now)}
                    </time>
                  </td>
                  <td className="py-3.5 pe-5 text-end md:pe-6">
                    <NotifyState at={r.notified_at} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: stacked cards */}
      <ul className="divide-y divide-line border-t border-line md:hidden">
        {rows.map((r) => {
          const created = new Date(r.created_at);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                className="flex w-full items-start gap-3 px-4 py-4 text-start active:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-pine-deep">{initialsName(r)}</span>
                      {r.team_unread > 0 ? <Messages r={r} /> : null}
                    </p>
                    <Pill tone={statusTone[r.status] ?? "neutral"}>{statusLabel(r.status)}</Pill>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-slate">
                    {r.service_title}
                    {r.company ? ` · ${r.company}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate">
                    <Num>#{r.id}</Num>
                    <span aria-hidden="true">·</span>
                    <time dateTime={created.toISOString()}>{formatRelative(created, now)}</time>
                    <SourcePill source={r.source} />
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" aria-hidden="true" />
                      {r.assignee_id
                        ? r.assignee_id === me
                          ? "أنت"
                          : (r.assignee_name ?? "عضو سابق")
                        : "غير مسند"}
                    </span>
                    {!r.notified_at ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <BellOff className="size-3" />
                          لم يصل الإشعار
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <ChevronLeft className="mt-1 size-4 shrink-0 text-slate/60" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function TableSkeleton() {
  return (
    <div className="border-t border-line" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 md:px-6"
        >
          <div className="w-[26%] space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full md:block" />
          <Skeleton className="hidden h-3.5 w-16 md:block" />
        </div>
      ))}
    </div>
  );
}
