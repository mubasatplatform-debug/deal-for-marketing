import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenText, FileSearch, LockKeyhole, PenLine, ShieldAlert } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { ErrorCard, ListSkeleton, useCan, useLoad } from "@/components/law/kit";
import { ReviewDialog } from "@/components/law/ai/review-dialog";
import { REVIEW_DISCLAIMER } from "@/components/law/ai/review-kinds";
import { ReviewRows } from "@/components/law/ai/reviews-ui";
import { usePollPending } from "@/components/law/ai/use-poll-pending";
import { listReviews } from "@/lib/law/ai/reviews";
import type { ReviewRow } from "@/lib/law/ai/review-core";

export const Route = createFileRoute("/app/reviews/")({
  component: ReviewsPage,
});

const HOW = [
  { icon: ShieldAlert, title: "مستوى خطر لكل بند", body: "مقبول، يحتاج تفاوضًا، أو خطر مرتفع — من جهة موكّلك." },
  { icon: BookOpenText, title: "دليل المكتب والأنظمة", body: "يطبّق مواقف مكتبك ويستند إلى مواد الأنظمة السعودية." },
  { icon: PenLine, title: "صياغة بديلة جاهزة", body: "نص مقترح لكل بند يحتاج تعديلًا، والبنود الغائبة." },
];

function ReviewsPage() {
  const { active } = useLawApp();
  const allowed = useCan();
  const canView = allowed("draft.manage", { write: false });
  const canStart = allowed("draft.manage");
  const [open, setOpen] = useState(false);
  const list = useLoad(
    () => (canView ? listReviews({ data: { workspaceId: active.workspace.id } }) : Promise.resolve([] as ReviewRow[])),
    [active.workspace.id, canView],
  );
  usePollPending(list.data, list.reload, 4000);
  const rows = list.data;

  return (
    <>
      <PageHead
        title="مراجعة العقود"
        subtitle="يراجع المساعد العقد بندًا بندًا لمصلحة موكّلك، ويحدد المخاطر ويقترح الصياغة البديلة."
        actions={
          canStart ? (
            <Button variant="primary" icon={FileSearch} onClick={() => setOpen(true)}>
              مراجعة عقد جديدة
            </Button>
          ) : null
        }
      />
      {!canView ? (
        <Card>
          <EmptyState
            icon={LockKeyhole}
            title="مراجعة العقود للمحامين"
            body="مراجعة العقود بالذكاء الاصطناعي متاحة للمحامين ومديري المكتب."
          />
        </Card>
      ) : list.error && !rows ? (
        <ErrorCard title="تعذّر تحميل المراجعات" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          {!rows ? (
            <ListSkeleton rows={4} />
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 md:px-8">
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
                  <FileSearch className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-4 text-[15px] font-bold text-pine-deep">لا مراجعات بعد</p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-slate">
                  اختر عقدًا من مستندات المكتب وحدّد الطرف الذي تمثّله، فيراجعه المساعد بندًا بندًا وفق دليل مكتبك ومكتبة
                  الأنظمة السعودية، مع مستوى الخطر لكل بند والصياغة المقترحة، خلال دقيقة أو دقيقتين.
                </p>
                <ul className="mt-6 grid w-full gap-3 text-start sm:grid-cols-3">
                  {HOW.map((h) => (
                    <li key={h.title} className="rounded-xl bg-paper p-4 ring-1 ring-line">
                      <h.icon className="size-5 text-pine" aria-hidden="true" />
                      <p className="mt-2 text-[13.5px] font-bold text-pine-deep">{h.title}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate">{h.body}</p>
                    </li>
                  ))}
                </ul>
                {canStart ? (
                  <Button variant="primary" icon={FileSearch} onClick={() => setOpen(true)} className="mt-6">
                    راجع أول عقد
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <ReviewRows rows={rows} />
          )}
        </Card>
      )}
      {canView && rows?.length ? <p className="text-center text-xs text-slate">{REVIEW_DISCLAIMER}</p> : null}
      {open ? <ReviewDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
