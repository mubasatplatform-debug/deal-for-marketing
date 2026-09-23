import { createFileRoute } from "@tanstack/react-router";

const mcp = () => import("@/lib/api/mcp.server");

/** MCP server — Streamable HTTP (stateless JSON-RPC over POST), bearer API keys. */
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      ANY: async ({ request }) => (await mcp()).handleMcp(request),
    },
  },
});
