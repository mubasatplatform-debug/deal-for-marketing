import { createFileRoute, notFound } from "@tanstack/react-router";
import { CrmDesk, type CrmView } from "@/components/crm-desk";

const views = ["home", "inbox", "calls", "ai"] as const;

export const Route = createFileRoute("/desk/crm/$view")({
  component: DeskCrm,
});

function DeskCrm() {
  const { view } = Route.useParams();
  if (!views.includes(view as CrmView)) throw notFound();
  return <CrmDesk view={view as CrmView} />;
}
