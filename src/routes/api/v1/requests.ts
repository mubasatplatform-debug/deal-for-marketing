import { createFileRoute } from "@tanstack/react-router";

const api = () => import("@/lib/api/rest.server");

/** GET /api/v1/requests (requests:read) · POST /api/v1/requests (requests:write) */
export const Route = createFileRoute("/api/v1/requests")({
  server: {
    handlers: {
      GET: async ({ request }) => (await api()).rest.listRequests(request),
      POST: async ({ request }) => (await api()).rest.createRequest(request),
      ANY: async ({ request }) => (await api()).methodNotAllowed(request, ["GET", "POST"]),
    },
  },
});
