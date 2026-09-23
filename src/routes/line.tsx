import { createFileRoute } from "@tanstack/react-router";
import { DealLine } from "@/components/deal-line";
import { SiteChrome } from "@/components/site-chrome";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/line")({
  head: () =>
    pageHead({
      title: "خط ديل",
      description:
        "جرّب خط ديل: خدمة عملاء وكول سنتر بالذكاء الاصطناعي، يرد بلهجتك ويحوّل المحادثة لطلب.",
      path: "/line",
    }),
  component: LinePage,
});

function LinePage() {
  return (
    <SiteChrome footer={false}>
      {/* The chrome's fixed edge tick would sit on top of the Line header; hide it on this page only. */}
      <main className="bg-ink pt-16 md:pt-18 [:root:has(&)_.edge-tick]:hidden">
        <DealLine />
      </main>
    </SiteChrome>
  );
}
