import { mobile, phone } from "@/lib/content";

/** Public origin used for canonical links, the sitemap and JSON-LD. */
export const SITE_URL = "https://dealadv.sa";
export const SITE_NAME = "ديل | DEAL FOR MARKETING";

type PageHead = { title?: string; description?: string; path?: string; noindex?: boolean };

/**
 * Per-route `head()` payload. Share-card `og:*`/`twitter:*` tags are owned by
 * the platform injector (server/middleware/grok-pwa.ts), so only standard
 * tags are set here.
 */
export function pageHead({ title, description, path, noindex }: PageHead) {
  return {
    meta: [
      ...(title ? [{ title: `${title} | ديل` }] : []),
      ...(description ? [{ name: "description", content: description }] : []),
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links: path && !noindex ? [{ rel: "canonical", href: `${SITE_URL}${path}` }] : [],
  };
}

/** schema.org Organization + LocalBusiness for the home page. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  "@id": `${SITE_URL}/#org`,
  name: SITE_NAME,
  alternateName: ["ديل للتسويق", "DEAL FOR MARKETING"],
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/images/logo-deal.png`,
  image: `${SITE_URL}/og.jpg`,
  email: "info@dealadv.sa",
  telephone: phone.tel,
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: phone.tel,
      contactType: "customer service",
      areaServed: "SA",
      availableLanguage: "ar",
    },
    {
      "@type": "ContactPoint",
      telephone: mobile.tel,
      contactType: "sales",
      areaServed: "SA",
      availableLanguage: "ar",
    },
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "بريدة",
    addressRegion: "القصيم",
    addressCountry: "SA",
  },
  areaServed: "SA",
  sameAs: ["https://x.com/deal_adv_sa"],
};
