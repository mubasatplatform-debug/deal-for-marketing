import { createFileRoute } from "@tanstack/react-router";
import {
  About,
  AmgFilm,
  Clients,
  Footer,
  Hero,
  Instant,
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
