import { createFileRoute, notFound } from "@tanstack/react-router";
import { LawDesk, type LawView } from "@/components/law-desk";

const views = ["home", "book", "crm", "staff", "docs", "cases", "video"] as const;

export const Route = createFileRoute("/desk/law/$view")({
  component: DeskLaw,
});

function DeskLaw() {
  const { view } = Route.useParams();
  if (!views.includes(view as LawView)) throw notFound();
  return <LawDesk view={view as LawView} />;
}
