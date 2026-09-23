import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/thread-routes.server");

/**
 * POST /api/requests/:id/messages?as=client|team — post a thread message with
 * up to 5 attachments (multipart/form-data: `body`, `files`). Session auth.
 */
export const Route = createFileRoute("/api/requests/$id/messages")({
  server: {
    handlers: {
      POST: async ({ request, params }) => (await handler()).postMessageRoute(request, params.id),
    },
  },
});
