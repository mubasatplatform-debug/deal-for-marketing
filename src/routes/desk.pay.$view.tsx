import { createFileRoute, notFound } from "@tanstack/react-router";
import { PayDesk, type PayView } from "@/components/pay-desk";
import { pageHead } from "@/lib/seo";

const views = ["home", "pay", "bills", "pos"] as const;

export const Route = createFileRoute("/desk/pay/$view")({
  // Internal screenshot stage for the product stills — never indexed.
  head: () => pageHead({ noindex: true }),
  component: DeskPay,
});

function DeskPay() {
  const { view } = Route.useParams();
  if (!views.includes(view as PayView)) throw notFound();
  return <PayDesk view={view as PayView} />;
}
