import { createFileRoute } from "@tanstack/react-router";
import { SafetyCard } from "@/components/keys/connect-card";
import { LawKeysPanel } from "@/components/keys/keys-page";
import { PageHead } from "@/components/law/app-frame";
import { AiIntegrationsCard } from "@/components/law/ai-integrations";
import { pageHead } from "@/lib/seo";

/**
 * «الربط ومفاتيح API» inside the office: the member's own API keys (offered
 * with the law-office scopes only) and how to plug an AI client in over MCP.
 * Keys act as their owner, within the owner's role in each office.
 */
export const Route = createFileRoute("/app/keys")({
  head: () => pageHead({ title: "الربط ومفاتيح API", noindex: true }),
  component: KeysPage,
});

function KeysPage() {
  return (
    <>
      <PageHead
        title="الربط ومفاتيح API"
        subtitle="مفاتيحك لربط مساعدات الذكاء الاصطناعي والأنظمة الأخرى ببيانات المكتب، بصلاحيات دورك."
      />
      <div className="grid items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5 md:space-y-6">
          <LawKeysPanel />
          <AiIntegrationsCard />
        </div>
        <aside aria-label="الأمان" className="space-y-4 lg:sticky lg:top-24">
          <SafetyCard />
        </aside>
      </div>
    </>
  );
}
