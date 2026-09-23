import { createFileRoute } from "@tanstack/react-router";

const api = () => import("@/lib/api/rest.server");

/** Unknown /api/v1/* paths answer in the API's JSON envelope, not the site's 404 page. */
export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => (await api()).preflight(),
      ANY: async ({ request }) => (await api()).notFoundResponse(request),
    },
  },
});
