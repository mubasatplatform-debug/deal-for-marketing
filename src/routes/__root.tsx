import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "ديل | DEAL FOR MARKETING";

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
      { property: "og:locale", content: "ar_SA" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
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
