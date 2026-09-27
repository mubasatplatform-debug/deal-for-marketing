import { Link } from "@tanstack/react-router";
import { ChevronLeft, FileSearch, Loader2 } from "lucide-react";
import { Button, Card, Pill } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { dateAr } from "@/components/law/format";
import { ListSkeleton, useCan, useLoad } from "@/components/law/kit";
import { usePollPending } from "@/components/law/ai/use-poll-pending";
import { listReviews } from "@/lib/law/ai/reviews";
import type { ReviewRow, Risk } from "@/lib/law/ai/review-core";
import { RISK_LABEL, RISK_STYLE } from "@/components/law/ai/review-kinds";
import { cn } from "@/lib/utils";

/**
 * «مراجعة العقود» — shared pieces (risk vocabulary, rows, the case card).
 * Client-safe: only types come from review-core.
 */

export function RiskPill({ risk, className }: { risk: Risk; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        RISK_STYLE[risk].pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", RISK_STYLE[risk].dot)} />
      {RISK_LABEL[risk]}
    </span>
  );
}

/** The verdict when ready, otherwise the review's state. */
export function ReviewStatePill({ row }: { row: Pick<ReviewRow, "status" | "overall"> }) {
  if (row.status === "ready" && row.overall) return <RiskPill risk={row.overall} />;
  if (row.status === "pending") {
    return (
      <Pill tone="lime">
        <Loader2 className="-ms-0.5 size-3 motion-safe:animate-spin" aria-hidden="true" />
        قيد المراجعة
      </Pill>
    );
  }
  if (row.status === "failed") return <Pill tone="danger">تعذّرت</Pill>;
  return <Pill tone="neutral">جاهزة</Pill>;
}

/** Rows of reviews linking to the report. */
export function ReviewRows({ rows, showTarget = true }: { rows: ReviewRow[]; showTarget?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const target = showTarget ? (r.case_title ?? r.client_name) : null;
        return (
          <li key={r.id}>
            <Link
              to="/app/reviews/$id"
              params={{ id: r.id }}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper md:px-6"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  r.status === "failed"
                    ? "bg-red-50 text-red-700"
                    : r.status === "ready" && r.overall
                      ? cn(RISK_STYLE[r.overall].soft, RISK_STYLE[r.overall].text, "ring-1 ring-inset")
                      : "bg-pine-50 text-pine",
                )}
              >
                <FileSearch className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm leading-snug font-bold" title={r.document_name}>
                  {r.document_name}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed break-words text-slate sm:truncate">
                  {[
                    `لصالح: ${r.perspective}`,
                    r.contract_type || null,
                    target,
                    r.created_by_name,
                    dateAr(r.created_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ReviewStatePill row={r} />
              <ChevronLeft className="hidden size-4 shrink-0 text-slate sm:block" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** «مراجعات العقود» on the case page — a compact list like the drafts card. */
export function FileReviewsCard({ caseId, onNew }: { caseId: string; onNew?: () => void }) {
  const { active } = useLawApp();
  const allowed = useCan();
  const canView = allowed("draft.manage", { write: false });
  const list = useLoad(
    () =>
      canView
        ? listReviews({ data: { workspaceId: active.workspace.id, caseId } })
        : Promise.resolve([] as ReviewRow[]),
    [active.workspace.id, caseId, canView],
  );
  usePollPending(list.data, list.reload);
  if (!canView) return null;
  const rows = list.data ?? [];
  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 md:px-6">
        <h2 className="text-[15px] font-bold text-pine-deep">مراجعات العقود</h2>
        {onNew ? (
          <Button size="sm" icon={FileSearch} onClick={onNew} className="h-10">
            مراجعة عقد
          </Button>
        ) : null}
      </header>
      {list.error && !list.data ? (
        <p className="px-5 pb-5 text-[13px] text-red-700 md:px-6">{list.error}</p>
      ) : !list.data ? (
        <ListSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] leading-relaxed text-slate md:px-6">
          لا مراجعات بعد. ارفع العقد في مستندات القضية ثم راجعه بندًا بندًا مع مستوى الخطر والصياغة المقترحة.
        </p>
      ) : (
        <div className="border-t border-line">
          <ReviewRows rows={rows.slice(0, 6)} showTarget={false} />
          {rows.length > 6 ? (
            <Link
              to="/app/reviews"
              className="flex min-h-11 items-center justify-center border-t border-line text-[13px] font-semibold text-pine hover:bg-paper"
            >
              كل المراجعات
            </Link>
          ) : null}
        </div>
      )}
    </Card>
  );
}
