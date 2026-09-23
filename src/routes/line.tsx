import { createFileRoute } from "@tanstack/react-router";
import { DealLine } from "@/components/deal-line";
import { SiteChrome } from "@/components/site-chrome";

export const Route = createFileRoute("/line")({ component: LinePage });

function LinePage() {
  return (
    <SiteChrome>
      <main className="bg-ink pt-16 md:pt-18">
        <DealLine />
      </main>
    </SiteChrome>
  );
}
