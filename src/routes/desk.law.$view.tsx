import { createFileRoute, notFound } from "@tanstack/react-router";
import { LawDesk, type LawView } from "@/components/law-desk";
import { pageHead } from "@/lib/seo";

const views = ["home", "book", "crm", "staff", "docs", "cases", "video"] as const;

export const Route = createFileRoute("/desk/law/$view")({
  // Internal screenshot stage for the product stills — never indexed.
  head: () => pageHead({ noindex: true }),
  component: DeskLaw,
});

function DeskLaw() {
  const { view } = Route.useParams();
  if (!views.includes(view as LawView)) throw notFound();
  return <LawDesk view={view as LawView} />;
}
