import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import {
  LawData,
  LawFaq,
  LawFeatures,
  LawFinalCta,
  LawHero,
  LawPricing,
  LawSteps,
  LawTrust,
} from "@/components/law/landing";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/law/")({
  head: () =>
    pageHead({
      title: "مكتب المحامي — نظام إدارة مكاتب المحاماة",
      description:
        "مكتب المحامي من ديل: نظام سعودي لإدارة مكتب المحاماة — الفريق والصلاحيات، ثم المواعيد والعملاء والقضايا والمستندات. جرّبه 14 يومًا مجانًا.",
      path: "/law",
    }),
  component: LawPage,
});

function LawPage() {
  return (
    <SiteChrome>
      <main>
        <LawHero />
        <LawTrust />
        <LawFeatures />
        <LawData />
        <LawSteps />
        <LawPricing />
        <LawFaq />
        <LawFinalCta />
      </main>
    </SiteChrome>
  );
}
