import { createFileRoute } from "@tanstack/react-router";

const api = () => import("@/lib/api/rest.server");

/** GET /api/v1/admin/requests (admin:requests:read) — every client's requests. */
export const Route = createFileRoute("/api/v1/admin/requests")({
  server: {
    handlers: {
      GET: async ({ request }) => (await api()).rest.adminListRequests(request),
      ANY: async ({ request }) => (await api()).methodNotAllowed(request, ["GET"]),
    },
  },
});
