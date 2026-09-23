import { createFileRoute } from "@tanstack/react-router";

const api = () => import("@/lib/api/rest.server");

/** GET /api/v1/services — public catalogue of DEAL services. */
export const Route = createFileRoute("/api/v1/services")({
  server: {
    handlers: {
      GET: async () => (await api()).rest.listServices(),
      ANY: async ({ request }) => (await api()).methodNotAllowed(request, ["GET"]),
    },
  },
});
