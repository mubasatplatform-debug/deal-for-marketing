import { createFileRoute } from "@tanstack/react-router";

const hook = () => import("@/lib/saas/moyasar-webhook.server");

/** POST /api/law/moyasar — Moyasar payment webhook (disabled without MOYASAR_SECRET_KEY). */
export const Route = createFileRoute("/api/law/moyasar")({
  server: {
    handlers: {
      POST: async ({ request }) => (await hook()).handleMoyasarWebhook(request),
      ANY: async () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
