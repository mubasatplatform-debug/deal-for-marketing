import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/law/ai/draft-routes.server");

/** GET /api/law/drafts/:id?ws=<office id> — download a draft as a Word file. */
export const Route = createFileRoute("/api/law/drafts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => (await handler()).downloadDraftRoute(request, params.id),
    },
  },
});
