import { createFileRoute } from "@tanstack/react-router";

const api = () => import("@/lib/api/rest.server");

/** GET /api/v1/requests/:id (requests:read) — one of the key owner's requests. */
export const Route = createFileRoute("/api/v1/requests/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => (await api()).rest.getRequest(request, params.id),
      ANY: async ({ request }) => (await api()).methodNotAllowed(request, ["GET"]),
    },
  },
});
