import { createFileRoute } from "@tanstack/react-router";

const api = () => import("@/lib/api/rest.server");

/** PATCH /api/v1/admin/requests/:id { status } (admin:requests:write) */
export const Route = createFileRoute("/api/v1/admin/requests/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) =>
        (await api()).rest.adminUpdateRequest(request, params.id),
      ANY: async ({ request }) => (await api()).methodNotAllowed(request, ["PATCH"]),
    },
  },
});
