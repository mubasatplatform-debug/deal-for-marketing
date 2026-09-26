import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * One public address. The host's own subdomain (`*.onrender.com`) serves the
 * same app; send people and crawlers to the canonical origin instead, so
 * sessions, links and search results all live on one domain. The target comes
 * from BETTER_AUTH_URL (the deployment's public origin); without it nothing
 * is redirected.
 */
const canonicalHost = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  const url = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host).toLowerCase();
  if (host.endsWith(".onrender.com")) {
    const target = process.env.BETTER_AUTH_URL?.trim();
    if (target) {
      try {
        const origin = new URL(target);
        if (origin.host.toLowerCase() !== host) {
          return new Response(null, {
            status: 308,
            headers: { Location: `${origin.origin}${url.pathname}${url.search}` },
          });
        }
      } catch {
        // A malformed BETTER_AUTH_URL: serve as-is rather than break the site.
      }
    }
  }
  return next();
});

export const startInstance = createStart(() => ({ requestMiddleware: [canonicalHost] }));
