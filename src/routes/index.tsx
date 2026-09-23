import { createFileRoute } from "@tanstack/react-router";
import { IdentityBreak } from "@/components/identity-break";
import { SiteChrome } from "@/components/site-chrome";
import { organizationJsonLd, pageHead } from "@/lib/seo";
import {
  About,
  Clients,
  DealLineBand,
  Hero,
  Leadership,
  Services,
  Systems,
  Works,
} from "@/components/home-sections";

export const Route = createFileRoute("/")({
  head: () => ({
    ...pageHead({ path: "/" }),
    scripts: [{ type: "application/ld+json", children: JSON.stringify(organizationJsonLd) }],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteChrome>
      <main>
        <Hero />
        <Clients />
        <Systems />
        <DealLineBand />
        <Services />
        <About />
        <Works />
        <Leadership />
        <IdentityBreak />
      </main>
    </SiteChrome>
  );
}
