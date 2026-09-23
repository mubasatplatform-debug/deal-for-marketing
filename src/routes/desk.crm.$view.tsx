import { createFileRoute, notFound } from "@tanstack/react-router";
import { CrmDesk, type CrmView } from "@/components/crm-desk";
import { pageHead } from "@/lib/seo";

const views = ["home", "inbox", "calls", "ai"] as const;

export const Route = createFileRoute("/desk/crm/$view")({
  // Internal screenshot stage for the product stills — never indexed.
  head: () => pageHead({ noindex: true }),
  component: DeskCrm,
});

function DeskCrm() {
  const { view } = Route.useParams();
  if (!views.includes(view as CrmView)) throw notFound();
  return <CrmDesk view={view as CrmView} />;
}
