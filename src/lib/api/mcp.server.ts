import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { services } from "@/lib/content";
import { audit, authenticate, type ApiCaller } from "./auth.server";
import { ApiError } from "./errors";
import * as ops from "./ops.server";
import { hasScope, type Scope } from "./scopes";

/**
 * DEAL MCP server (`deal-mcp-server`) — **server-only**. Streamable HTTP,
 * stateless: every POST authenticates its bearer key, builds a server holding
 * only the tools that key's scopes allow, answers with plain JSON, and is
 * dropped. No sessions, no SSE stream (GET answers 405, as the spec allows).
 */

const SERVER_INFO = { name: "deal-mcp-server", version: "1.0.0" };

const INSTRUCTIONS = `DEAL FOR MARKETING (ديل) — a Saudi marketing & business-systems agency.
Tools act on behalf of the account that owns the API key. Only the tools the key's scopes allow are listed.
Typical flow: deal_list_services → deal_create_request (with a service slug and the contact's explicit consent) → deal_get_request to follow its status.
Request statuses: new → review → production → delivered.`;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "600",
};

function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...headers },
  });
}

// ---------------------------------------------------------------------------
// Tool output helpers

type Format = "markdown" | "json";

const formatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe('Output format: "markdown" (readable, default) or "json" (structured).');

const pagingShape = {
  limit: z.number().int().min(1).max(100).default(20).describe("Max items to return (1–100, default 20)."),
  offset: z.number().int().min(0).default(0).describe("Items to skip, for paging (default 0). Use next_offset from the previous page."),
  status: z
    .enum(ops.STATUSES)
    .optional()
    .describe("Only requests in this status: new | review | production | delivered."),
  response_format: formatSchema,
};

const asJson = (value: unknown) => JSON.stringify(value, null, 2);

function ok(markdown: string, structured: Record<string, unknown>, format: Format): CallToolResult {
  return {
    content: [{ type: "text", text: format === "json" ? asJson(structured) : markdown }],
    structuredContent: structured,
  };
}

const day = (isoDate: string) => isoDate.slice(0, 16).replace("T", " ") + " UTC";

function requestMd(r: ops.ApiRequest | ops.ApiAdminRequest): string {
  const lines = [
    `### #${r.id} — ${r.service.title} (${r.service.slug})`,
    `- Status: **${r.status}** (${r.status_label})`,
    `- Created: ${day(r.created_at)}`,
  ];
  if ("contact_name" in r) {
    lines.push(`- Contact: ${r.contact_name} · ${r.phone}${r.account_email ? ` · ${r.account_email}` : ""}`);
  }
  if (r.company) lines.push(`- Company: ${r.company}`);
  lines.push(`- Brief: ${r.brief.length > 280 ? `${r.brief.slice(0, 280)}…` : r.brief}`);
  return lines.join("\n");
}

function pageMd<T extends ops.ApiRequest>(title: string, p: ops.Page<T>): string {
  if (p.total === 0) return `## ${title}\nNo requests found.`;
  const head = `## ${title}\nShowing ${p.items.length} of ${p.total} (offset ${p.offset}).`;
  const more = p.has_more ? `\n\nMore available: call again with offset=${p.next_offset}.` : "";
  return `${head}\n\n${p.items.map(requestMd).join("\n\n")}${more}`;
}

// ---------------------------------------------------------------------------
// Server

function buildServer(caller: ApiCaller): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });

  /** Register a tool only when the key holds `scope`; audit every call. */
  const tool = <Shape extends z.ZodRawShape>(
    name: string,
    scope: Scope,
    config: {
      title: string;
      description: string;
      inputSchema: Shape;
      annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
      };
    },
    run: (args: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>,
  ) => {
    if (!hasScope(caller.scopes, scope)) return;
    const handler = async (args: z.infer<z.ZodObject<Shape>>): Promise<CallToolResult> => {
      let status = 200;
      try {
        return await run(args);
      } catch (err) {
        if (err instanceof ApiError) {
          status = err.status;
          return { isError: true, content: [{ type: "text", text: `Error (${err.code}): ${err.message}` }] };
        }
        status = 500;
        console.error(`[mcp] ${name} failed:`, err);
        return {
          isError: true,
          content: [{ type: "text", text: "Error (internal_error): DEAL's server hit a problem. Try again shortly." }],
        };
      } finally {
        await audit(caller.keyId, "MCP", name, status);
      }
    };
    // The SDK's generic callback type does not narrow through our wrapper.
    server.registerTool(name, config, handler as never);
  };

  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  tool(
    "deal_list_services",
    "services:read",
    {
      title: "List DEAL services",
      description:
        "List the services DEAL offers (slug, title, description). Use a slug from here as `slug` in deal_create_request.\n" +
        "يعرض خدمات ديل المتاحة للطلب مع معرّف كل خدمة (slug).",
      inputSchema: { response_format: formatSchema },
      annotations: readOnly,
    },
    async ({ response_format }) => {
      const list = ops.listServices();
      const md = `## DEAL services\n\n${list.map((s) => `- **${s.title}** — \`${s.slug}\`\n  ${s.description}`).join("\n")}`;
      return ok(md, { services: list }, response_format);
    },
  );

  const slugs = services.map((s) => s.slug) as [string, ...string[]];
  const lead = ops.apiRequestSchema.shape;
  tool(
    "deal_create_request",
    "requests:write",
    {
      title: "Create a service request",
      description:
        "Submit a new service request to the DEAL team on behalf of the key's account. The team is notified immediately and follows up with the contact by phone. " +
        "Only call this after the contact has explicitly agreed to be contacted (consent: true). Limited to 20 new requests per key per hour.\n" +
        "ينشئ طلب خدمة جديدًا لفريق ديل باسم الحساب، ويتواصل الفريق مع صاحب الطلب على جواله.",
      inputSchema: {
        slug: z.enum(slugs).describe(`Service slug, from deal_list_services. One of: ${slugs.join(", ")}.`),
        name: lead.name.describe("Contact person's full name (2–80 chars). اسم صاحب الطلب."),
        phone: lead.phone.describe("Saudi mobile for the team to call, e.g. 0551234567 or +966551234567."),
        company: lead.company.default("").describe("Company or shop name (optional, up to 120 chars)."),
        brief: lead.brief.describe("What the client needs, in their words (8–2000 chars). Arabic or English."),
        consent: lead.consent.describe("Must be true: the contact agreed that DEAL may contact them about this request (PDPL)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      const r = await ops.createOwnRequest(caller, args);
      return ok(
        `Request #${r.id} created for **${r.service.title}** — status: ${r.status} (${r.status_label}). The DEAL team has been notified.\nTrack it with deal_get_request { "id": ${r.id} }.`,
        { request: r },
        "markdown",
      );
    },
  );

  tool(
    "deal_list_my_requests",
    "requests:read",
    {
      title: "List my requests",
      description:
        "List the service requests owned by the key's account, newest first, with paging and an optional status filter.\n" +
        "يعرض طلبات الحساب صاحب المفتاح فقط، الأحدث أولًا.",
      inputSchema: pagingShape,
      annotations: readOnly,
    },
    async ({ response_format, ...q }) => {
      const p = await ops.listOwnRequests(caller, q);
      return ok(pageMd("My requests", p), p, response_format);
    },
  );

  tool(
    "deal_get_request",
    "requests:read",
    {
      title: "Get one of my requests",
      description:
        "Get one request owned by the key's account by its numeric id (as returned by deal_create_request or deal_list_my_requests), including its current status.\n" +
        "يعرض طلبًا واحدًا من طلبات الحساب وحالته الحالية.",
      inputSchema: {
        id: z.number().int().positive().describe("Request id, e.g. 42."),
        response_format: formatSchema,
      },
      annotations: readOnly,
    },
    async ({ id, response_format }) => {
      const r = await ops.getOwnRequest(caller, id);
      return ok(requestMd(r), { request: r }, response_format);
    },
  );

  tool(
    "deal_admin_list_requests",
    "admin:requests:read",
    {
      title: "List all client requests (team)",
      description:
        "DEAL team only. List every client's requests with contact details (name, phone, account email), newest first, with paging and an optional status filter.\n" +
        "لفريق ديل: يعرض طلبات كل العملاء مع بيانات التواصل.",
      inputSchema: pagingShape,
      annotations: readOnly,
    },
    async ({ response_format, ...q }) => {
      const p = await ops.adminListRequests(q);
      return ok(pageMd("All requests", p), p, response_format);
    },
  );

  tool(
    "deal_admin_update_request_status",
    "admin:requests:write",
    {
      title: "Move a request to another status (team)",
      description:
        "DEAL team only. Set a request's status: new → review → production → delivered. The client sees the new status in their dashboard. " +
        "Overwrites the previous status (can be set back).\n" +
        "لفريق ديل: ينقل الطلب إلى مرحلة أخرى، ويظهر التغيير للعميل في لوحته.",
      inputSchema: {
        id: z.number().int().positive().describe("Request id, from deal_admin_list_requests."),
        status: z.enum(ops.STATUSES).describe("New status: new | review | production | delivered."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, status }) => {
      const r = await ops.adminUpdateStatus(id, { status });
      return ok(`Request #${r.id} is now **${r.status}** (${r.status_label}).`, { request: r }, "markdown");
    },
  );

  return server;
}

/** Streamable HTTP clients must accept both; some generic clients omit it. */
function withAcceptHeader(request: Request): Request {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json") && accept.includes("text/event-stream")) return request;
  const headers = new Headers(request.headers);
  headers.set("accept", "application/json, text/event-stream");
  return new Request(request, { headers });
}

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") {
    return rpcError(405, -32000, "Method not allowed: this MCP server is stateless; send JSON-RPC over POST.", {
      Allow: "POST, OPTIONS",
    });
  }

  let caller: ApiCaller;
  try {
    caller = await authenticate(request);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.keyId) await audit(err.keyId, "MCP", "(rate limited)", err.status);
      return rpcError(err.status, -32001, err.message, {
        ...(err.status === 401 ? { "WWW-Authenticate": 'Bearer realm="deal-mcp"' } : {}),
        ...(err.retryAfter ? { "Retry-After": String(err.retryAfter) } : {}),
      });
    }
    console.error("[mcp] auth failed:", err);
    return rpcError(500, -32603, "Internal error.");
  }

  const server = buildServer(caller);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(withAcceptHeader(request));
    for (const [k, v] of Object.entries(CORS)) response.headers.set(k, v);
    return response;
  } finally {
    await server.close().catch(() => {});
  }
}
