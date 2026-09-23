import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SITE_URL } from "@/lib/seo";
import site from "@/lib/og/site.json";
import appCss from "../styles.css?url";

const APP_NAME = site.title;

/**
 * Share card + static manifest, for standalone builds only (DEAL_STANDALONE=1:
 * Render / a VPS, where no platform middleware runs). On Grok-hosted builds the
 * PWA injector (server/middleware/grok-pwa.ts) owns og:* / twitter:* and the
 * /__grok/manifest.webmanifest + apple-touch-icon links, so the root must emit
 * none of them (AGENTS.md: never put og:* / twitter:card in __root.tsx there).
 * Identity comes from src/lib/og/site.json — the same file the injector reads.
 */
const standaloneMeta = __DEAL_STANDALONE__
  ? [
      { property: "og:locale", content: "ar_SA" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: site.title },
      { property: "og:title", content: site.title },
      { property: "og:description", content: site.description },
      { property: "og:image", content: `${SITE_URL}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: site.title },
      { name: "twitter:description", content: site.description },
      { name: "twitter:image", content: `${SITE_URL}/og.jpg` },
    ]
  : [];

const standaloneLinks = __DEAL_STANDALONE__
  ? [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ]
  : [];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "حيث يبقى التأثير — التأثير لا يأتي صدفة… نحن نصنعه. وكالة ديل للتسويق.",
      },
      { name: "theme-color", content: "#050505" },
      ...standaloneMeta,
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      ...standaloneLinks,
      // Brand fonts are self-hosted (no third-party request, no Google outage).
      { rel: "preload", href: "/fonts/Deal-Font.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "/fonts/fonts.css" },
    ],
  }),
  component: () => (
    <html lang="ar" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-ink text-snow font-display">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
