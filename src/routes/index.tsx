import { createFileRoute } from "@tanstack/react-router";
import {
  About,
  AiUse,
  AmgFilm,
  Clients,
  Footer,
  Hero,
  Instant,
  Lawyers,
  Leadership,
  Quote,
  Services,
  Story,
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
        <Instant />
        <Lawyers />
        <AiUse />
        <AmgFilm />
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
