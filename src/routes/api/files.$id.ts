import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/thread-routes.server");

/**
 * GET /api/files/:id[?inline=1] — an attachment, for the request's customer
 * or the team only. Session auth.
 */
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => (await handler()).downloadFileRoute(request, params.id),
    },
  },
});
