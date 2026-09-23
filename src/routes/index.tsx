import { createFileRoute } from "@tanstack/react-router";
import { IdentityBreak } from "@/components/identity-break";
import { SiteChrome } from "@/components/site-chrome";
import { organizationJsonLd, pageHead } from "@/lib/seo";
import {
  About,
  AiUse,
  Clients,
  DealLineTeaser,
  Footer,
  Hero,
  Instant,
  Lawyers,
  Leadership,
  Pay,
  Pledge,
  Quote,
  Services,
  Story,
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
        <IdentityBreak />
        <Story />
        <Systems />
        <Instant />
        <DealLineTeaser />
        <Lawyers />
        <AiUse />
        <Pay />
        <Pledge />
        <Services />
        <About />
        <Works />
        <Clients />
        <Leadership />
        <Quote />
        <Footer />
      </main>
    </SiteChrome>
  );
}
