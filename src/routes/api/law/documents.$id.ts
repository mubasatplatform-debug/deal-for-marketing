import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/law/documents-routes.server");

/**
 * GET /api/law/documents/:id?ws=<office id>[&inline=1] — download an office
 * document, for members of that office only (others get 403/404).
 */
export const Route = createFileRoute("/api/law/documents/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => (await handler()).downloadDocumentRoute(request, params.id),
    },
  },
});
