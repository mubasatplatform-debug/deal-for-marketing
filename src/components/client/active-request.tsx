import { ArrowLeft, MessageCircle, MessagesSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, Num, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import type { RequestRow } from "@/lib/requests";
import { formatDate, isoDate } from "./format";
import { ServiceTile } from "./service-icon";
import { Stepper } from "./stepper";
import { StatusPill } from "./status-pill";
import { followUpText, nextStepText, stepIndex, waLink } from "./status";

/** The one request that matters most right now: the latest not yet delivered. */
export function ActiveRequest({
  row,
  others,
  now,
  onOpen,
}: {
  row: RequestRow;
  /** Other open requests besides this one. */
  others: number;
  now: Date;
  onOpen: (id: number) => void;
}) {
  const current = stepIndex(row.status);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 md:px-6">
        <p className="text-[13px] font-semibold text-slate">
          {others > 0 ? "أحدث طلباتك الجارية" : "طلبك الجاري"}
        </p>
        {others > 0 ? (
          <a href="#requests" className="text-[13px] font-semibold text-pine hover:text-pine-deep">
            {others === 1 ? "وطلب آخر جارٍ" : others === 2 ? "وطلبان آخران" : `و${others} طلبات أخرى`}
          </a>
        ) : null}
      </div>

      <div className="px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex items-start gap-4">
          <ServiceTile slug={row.service_slug} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="text-lg leading-snug font-bold text-pine-deep md:text-xl">{row.service_title}</h2>
              <StatusPill status={row.status} />
            </div>
            <p className="mt-1 text-[13px] text-slate sm:flex sm:items-center sm:gap-x-2">
              {row.company ? (
                <>
                  <span className="block truncate">{row.company}</span>
                  <span aria-hidden="true" className="hidden text-line-strong sm:inline">·</span>
                </>
              ) : null}
              <span className="flex items-center gap-x-2">
              <Num>
                <bdi>#{row.id}</bdi>
              </Num>
              <span aria-hidden="true" className="text-line-strong">·</span>
              <time dateTime={isoDate(row.created_at)}>
                أُرسل في <Num>{formatDate(row.created_at, now)}</Num>
              </time>
              </span>
            </p>
          </div>
        </div>

        <Stepper current={current} className="mt-7 md:mt-8" />
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-line bg-paper/60 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate">الخطوة التالية</p>
          <p className="mt-0.5 text-sm font-semibold text-pine-deep">{nextStepText(row.status)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={waLink(followUpText(row.id, row.service_title))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary", "md") + " flex-1 md:flex-none"}
          >
            <MessageCircle className="size-4" />
            تابع على واتساب
          </a>
          <Link
            to="/client/requests/$id"
            params={{ id: String(row.id) }}
            onClick={() => onOpen(row.id)}
            className={buttonClass(row.unread > 0 ? "primary" : "ghost", "md") + " flex-1 md:flex-none"}
          >
            {row.unread > 0 ? (
              <>
                <MessagesSquare className="size-4" />
                {row.unread === 1 ? "رسالة جديدة" : `${row.unread} رسائل جديدة`}
              </>
            ) : (
              <>
                المحادثة والتفاصيل
                <ArrowLeft className="size-4" />
              </>
            )}
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function ActiveRequestSkeleton() {
  return (
    <div aria-hidden="true">
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-3.5 md:px-6">
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="px-5 py-6 md:px-6">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-[14px]" />
          <div className="flex-1 space-y-2.5 pt-1">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line bg-paper/60 px-5 py-5 md:px-6">
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    </Card>
    </div>
  );
}
