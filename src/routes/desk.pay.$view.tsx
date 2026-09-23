import { createFileRoute, notFound } from "@tanstack/react-router";
import { PayDesk, type PayView } from "@/components/pay-desk";
import { payDeskTitle } from "@/components/desks/navs";
import { pageHead } from "@/lib/seo";

const views = ["home", "pay", "bills", "pos"] as const;

export const Route = createFileRoute("/desk/pay/$view")({
  // Internal screenshot stage for the product stills — never indexed.
  head: ({ params }) => pageHead({ title: payDeskTitle(params.view), noindex: true }),
  component: DeskPay,
});

function DeskPay() {
  const { view } = Route.useParams();
  if (!views.includes(view as PayView)) throw notFound();
  return <PayDesk view={view as PayView} />;
}
