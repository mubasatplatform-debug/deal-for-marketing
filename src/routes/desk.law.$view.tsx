import { createFileRoute, notFound } from "@tanstack/react-router";
import { LawDesk, type LawView } from "@/components/law-desk";
import { lawDeskTitle } from "@/components/desks/navs";
import { pageHead } from "@/lib/seo";

const views = ["home", "book", "crm", "staff", "docs", "cases", "video"] as const;

export const Route = createFileRoute("/desk/law/$view")({
  // Internal screenshot stage for the product stills — never indexed.
  beforeLoad: ({ params }) => {
    if (!views.includes(params.view as LawView)) throw notFound();
  },
  head: ({ params }) => pageHead({ title: lawDeskTitle(params.view), noindex: true }),
  component: DeskLaw,
});

function DeskLaw() {
  const { view } = Route.useParams();
  return <LawDesk view={view as LawView} />;
}
