import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { LawAssistant } from "@/components/law/assistant";
import { ErrorCard, ListSkeleton, useLoad } from "@/components/law/kit";
import { agentStatus } from "@/lib/law/agent/agent";

export const Route = createFileRoute("/app/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  const { active } = useLawApp();
  const status = useLoad(() => agentStatus({ data: { workspaceId: active.workspace.id } }), [active.workspace.id]);

  return (
    <>
      <PageHead title="مساعد المكتب" subtitle="ذكاء اصطناعي يعرف مكتبك: يبحث ويلخّص ويصيغ، ويضيف ويعدّل بعد تأكيدك" />
      {status.error && !status.data ? (
        <ErrorCard title="تعذّر تحميل المساعد" message={status.error} onRetry={() => void status.reload()} />
      ) : !status.data ? (
        <ListSkeleton />
      ) : !status.data.planAllows ? (
        <EmptyState
          icon={Sparkles}
          title="المساعد الذكي ضمن خطتي «احترافي» و«مؤسسي»"
          body="رقِّ خطتك لتستخدم المساعد في البحث والتلخيص والصياغة وإدارة بيانات المكتب."
          action={
            <Link to="/app/billing" className="inline-flex min-h-11 items-center rounded-xl bg-pine px-5 text-sm font-bold text-snow">
              ترقية الخطة
            </Link>
          }
        />
      ) : !status.data.configured ? (
        <EmptyState icon={Sparkles} title="المساعد قيد التجهيز" body="سيتاح المساعد لمكتبك قريبًا." />
      ) : (
        <LawAssistant />
      )}
    </>
  );
}
