import { Link } from "@tanstack/react-router";
import { ChevronLeft, FilePenLine, Loader2, Sparkles } from "lucide-react";
import { Button, Card, Pill, type Tone } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { dateAr } from "@/components/law/format";
import { ListSkeleton, useCan, useLoad } from "@/components/law/kit";
import { DRAFT_KIND_LABEL, DRAFT_STATUS_LABEL } from "@/components/law/ai/draft-kinds";
import { usePollPending } from "@/components/law/ai/use-poll-pending";
import { listDrafts } from "@/lib/law/ai/ai";
import type { DraftRow, DraftStatus } from "@/lib/law/ai/drafts-core";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<DraftStatus, Tone> = { pending: "lime", ready: "pine", failed: "danger" };

export function DraftStatusPill({ status }: { status: DraftStatus }) {
  return (
    <Pill tone={STATUS_TONE[status]}>
      {status === "pending" ? <Loader2 className="-ms-0.5 size-3 motion-safe:animate-spin" aria-hidden="true" /> : null}
      {DRAFT_STATUS_LABEL[status]}
    </Pill>
  );
}

/** Rows of drafts linking to the editor. */
export function DraftRows({ rows, showTarget = true }: { rows: DraftRow[]; showTarget?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((d) => {
        const target = d.case_id ? `#${d.case_ref ?? ""} ${d.case_title ?? ""}`.trim() : d.client_name;
        return (
          <li key={d.id}>
            <Link
              to="/app/drafts/$id"
              params={{ id: d.id }}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper md:px-6"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  d.status === "failed" ? "bg-red-50 text-red-700" : "bg-pine-50 text-pine",
                )}
              >
                <FilePenLine className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug font-bold break-words">{d.title}</p>
                <p className="mt-0.5 truncate text-xs text-slate">
                  {[
                    DRAFT_KIND_LABEL[d.kind],
                    showTarget ? target : null,
                    d.created_by_name,
                    dateAr(d.created_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <DraftStatusPill status={d.status} />
              <ChevronLeft className="hidden size-4 shrink-0 text-slate sm:block" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** «مسودات هذه القضية / هذا العميل» — a compact list on the case / client page. */
export function FileDraftsCard({
  caseId,
  clientId,
  onNew,
}: {
  caseId?: string;
  clientId?: string;
  onNew?: () => void;
}) {
  const { active } = useLawApp();
  const allowed = useCan();
  const canView = allowed("draft.manage", { write: false });
  const list = useLoad(
    () =>
      canView
        ? listDrafts({ data: { workspaceId: active.workspace.id, caseId: caseId ?? null, clientId: caseId ? null : (clientId ?? null) } })
        : Promise.resolve([] as DraftRow[]),
    [active.workspace.id, caseId, clientId, canView],
  );
  usePollPending(list.data, list.reload);
  if (!canView) return null;
  const rows = list.data ?? [];
  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 md:px-6">
        <h2 className="text-[15px] font-bold text-pine-deep">مسودات {caseId ? "هذه القضية" : "هذا العميل"}</h2>
        {onNew ? (
          <Button size="sm" icon={Sparkles} onClick={onNew} className="h-10">
            صياغة مستند
          </Button>
        ) : null}
      </header>
      {list.error && !list.data ? (
        <p className="px-5 pb-5 text-[13px] text-red-700 md:px-6">{list.error}</p>
      ) : !list.data ? (
        <ListSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] leading-relaxed text-slate md:px-6">
          لا مسودات بعد. يكتب المساعد صحف الدعاوى والمذكرات والعقود والخطابات من بيانات الملف ومستنداته.
        </p>
      ) : (
        <div className="border-t border-line">
          <DraftRows rows={rows.slice(0, 8)} showTarget={!caseId} />
          {rows.length > 8 ? (
            <Link
              to="/app/drafts"
              className="flex min-h-11 items-center justify-center border-t border-line text-[13px] font-semibold text-pine hover:bg-paper"
            >
              كل المسودات ({rows.length})
            </Link>
          ) : null}
        </div>
      )}
    </Card>
  );
}
