import { createFileRoute, Link } from "@tanstack/react-router";
import { FilePenLine, LockKeyhole, Scale } from "lucide-react";
import { Card, EmptyState } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { ErrorCard, ListSkeleton, useCan, useLoad } from "@/components/law/kit";
import { DRAFT_DISCLAIMER } from "@/components/law/ai/draft-kinds";
import { DraftRows } from "@/components/law/ai/drafts-ui";
import { usePollPending } from "@/components/law/ai/use-poll-pending";
import { listDrafts } from "@/lib/law/ai/ai";
import type { DraftRow } from "@/lib/law/ai/drafts-core";

export const Route = createFileRoute("/app/drafts/")({
  component: DraftsPage,
});

function DraftsPage() {
  const { active } = useLawApp();
  const allowed = useCan();
  const canView = allowed("draft.manage", { write: false });
  const list = useLoad(
    () => (canView ? listDrafts({ data: { workspaceId: active.workspace.id } }) : Promise.resolve([] as DraftRow[])),
    [active.workspace.id, canView],
  );
  usePollPending(list.data, list.reload);
  const rows = list.data;

  return (
    <>
      <PageHead
        title="المسودات"
        subtitle="صحف دعاوى ومذكرات وعقود وخطابات يكتبها المساعد من ملفات القضايا والعملاء، لتراجعها وتنزّلها Word."
        actions={
          canView ? (
            <Link to="/app/cases" className={buttonClass("secondary")}>
              <Scale className="size-4" aria-hidden="true" />
              ابدأ من قضية
            </Link>
          ) : null
        }
      />
      {!canView ? (
        <Card>
          <EmptyState
            icon={LockKeyhole}
            title="المسودات للمحامين"
            body="صياغة المستندات ومراجعتها متاحة للمحامين ومديري المكتب."
          />
        </Card>
      ) : list.error && !rows ? (
        <ErrorCard title="تعذّر تحميل المسودات" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          {!rows ? (
            <ListSkeleton rows={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FilePenLine}
              title="لا مسودات بعد"
              body="افتح قضية أو ملف عميل واضغط «صياغة مستند»: اختر النوع (صحيفة دعوى، مذكرة، عقد، إنذار…) وأضف تعليماتك، فيكتب المساعد مسودة من بيانات الملف ومستنداته خلال دقيقة تقريبًا."
              action={
                <Link to="/app/cases" className={buttonClass("primary")}>
                  <Scale className="size-4" aria-hidden="true" />
                  اذهب إلى القضايا
                </Link>
              }
            />
          ) : (
            <DraftRows rows={rows} />
          )}
        </Card>
      )}
      {canView && rows?.length ? <p className="text-center text-xs text-slate">{DRAFT_DISCLAIMER}</p> : null}
    </>
  );
}
