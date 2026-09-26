import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/law/portal-routes.server");

/**
 * GET /api/portal/documents/:id?t=<portal token> — download a document the
 * office shared with the client (see portal-routes.server.ts).
 */
export const Route = createFileRoute("/api/portal/documents/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => (await handler()).downloadPortalDocumentRoute(request, params.id),
    },
  },
});
