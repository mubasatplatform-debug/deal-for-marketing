import { createFileRoute, notFound } from "@tanstack/react-router";
import { CrmDesk, type CrmView } from "@/components/crm-desk";
import { crmDeskTitle } from "@/components/desks/navs";
import { pageHead } from "@/lib/seo";

const views = ["home", "inbox", "calls", "ai"] as const;

export const Route = createFileRoute("/desk/crm/$view")({
  // Internal screenshot stage for the product stills — never indexed.
  beforeLoad: ({ params }) => {
    if (!views.includes(params.view as CrmView)) throw notFound();
  },
  head: ({ params }) => pageHead({ title: crmDeskTitle(params.view), noindex: true }),
  component: DeskCrm,
});

function DeskCrm() {
  const { view } = Route.useParams();
  return <CrmDesk view={view as CrmView} />;
}
