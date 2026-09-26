import { createFileRoute } from "@tanstack/react-router";

const hook = () => import("@/lib/saas/edfapay-webhook.server");

/** POST /api/law/edfapay — EdfaPay payment webhook (disabled without EDFAPAY_API_KEY). */
export const Route = createFileRoute("/api/law/edfapay")({
  server: {
    handlers: {
      POST: async ({ request }) => (await hook()).handleEdfapayWebhook(request),
      ANY: async () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
