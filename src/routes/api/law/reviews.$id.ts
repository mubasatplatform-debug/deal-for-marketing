import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/law/ai/draft-routes.server");

/** GET /api/law/reviews/:id?ws=<office id> — download a contract review as a Word file. */
export const Route = createFileRoute("/api/law/reviews/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => (await handler()).downloadReviewRoute(request, params.id),
    },
  },
});
