import { createFileRoute } from "@tanstack/react-router";

const handler = () => import("@/lib/law/documents-routes.server");

/**
 * POST /api/law/documents/upload?ws=<office id> — upload office documents
 * (multipart/form-data: `files` ×1–10, optional `clientId`, `caseId`).
 * Session auth + office membership; see documents-routes.server.ts.
 */
export const Route = createFileRoute("/api/law/documents/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => (await handler()).uploadDocumentsRoute(request),
    },
  },
});
