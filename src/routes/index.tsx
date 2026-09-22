import { createFileRoute } from "@tanstack/react-router";
import {
  About,
  AiUse,
  Clients,
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
import { SiteChrome } from "@/components/site-chrome";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <SiteChrome>
      <main>
        <Hero />
        <Story />
        <Systems />
        <Instant />
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
