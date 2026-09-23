import { ApiError } from "./errors";
import { RATE_LIMIT, audit, authenticate, requireScope, type ApiCaller } from "./auth.server";
import type { Scope } from "./scopes";
import * as ops from "./ops.server";

/**
 * REST plumbing for /api/v1 — **server-only**. Every response is JSON with
 * one envelope: `{ data, meta? }` on success, `{ error: { code, message,
 * details? } }` on failure.
 *
 * CORS: `*` without credentials. These endpoints authenticate by bearer key
 * only and never read cookies, so a cross-origin page gains nothing it does
 * not already hold.
 */

const MAX_BODY_BYTES = 32 * 1024;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit",
  "Access-Control-Max-Age": "600",
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...CORS,
      ...extra,
    },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const { status, code, message, details, retryAfter } = err;
    return json(
      status,
      { error: { code, message, ...(details ? { details } : {}) } },
      retryAfter ? { "Retry-After": String(retryAfter) } : {},
    );
  }
  console.error("[api] unhandled error:", err);
  return json(500, {
    error: { code: "internal_error", message: "Something went wrong on our side. Try again shortly." },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function methodNotAllowed(request: Request, allow: string[]): Response {
  if (request.method === "OPTIONS") return preflight();
  return errorResponse(
    new ApiError(405, "method_not_allowed", `${request.method} is not supported here. Allowed: ${allow.join(", ")}.`),
  );
}

export function notFoundResponse(request: Request): Response {
  const path = new URL(request.url).pathname;
  return errorResponse(
    new ApiError(404, "not_found", `No endpoint at ${request.method} ${path}. See /developers for the endpoint list.`),
  );
}

/**
 * The body as text, refusing more than `maxBytes` — checked against
 * Content-Length up front and again while streaming, so a missing or lying
 * header can not make the server buffer an unbounded body.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<string> {
  const tooLarge = () =>
    new ApiError(413, "payload_too_large", `Request body is over ${Math.round(maxBytes / 1024)} KB.`);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw tooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

async function readJson(request: Request): Promise<unknown> {
  const text = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!text.trim()) throw new ApiError(400, "invalid_json", "Request body is empty; send a JSON object.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
}

type Result = { status?: number; data: unknown; meta?: unknown };

/**
 * Authenticate, check the scope, run, and audit one call. Audit rows are
 * written for every call made with a valid key — including 403/404/422 — so
 * the team sees failed attempts too.
 */
async function withKey(
  request: Request,
  scope: Scope,
  run: (caller: ApiCaller) => Promise<Result>,
): Promise<Response> {
  let keyId: number | undefined;
  let response: Response;
  try {
    const caller = await authenticate(request);
    keyId = caller.keyId;
    requireScope(caller, scope);
    const { status = 200, data, meta } = await run(caller);
    response = json(status, meta ? { data, meta } : { data }, {
      "X-RateLimit-Limit": String(RATE_LIMIT),
    });
  } catch (err) {
    if (err instanceof ApiError && err.keyId) keyId = err.keyId;
    response = errorResponse(err);
  }
  if (keyId) await audit(keyId, request.method, new URL(request.url).pathname, response.status);
  if (response.status === 401) {
    response.headers.set("WWW-Authenticate", 'Bearer realm="deal-api", error="invalid_token"');
  }
  return response;
}

const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

function pageResult<T>(p: ops.Page<T>): Result {
  const { items, ...meta } = p;
  return { data: items, meta };
}

// ---------------------------------------------------------------------------
// Endpoints

export const rest = {
  /** Public: no key needed. */
  listServices(): Response {
    return json(200, { data: ops.listServices() }, { "Cache-Control": "public, max-age=300" });
  },

  listRequests: (request: Request) =>
    withKey(request, "requests:read", async (c) =>
      pageResult(await ops.listOwnRequests(c, query(request))),
    ),

  createRequest: (request: Request) =>
    withKey(request, "requests:write", async (c) => ({
      status: 201,
      data: await ops.createOwnRequest(c, await readJson(request)),
    })),

  getRequest: (request: Request, id: string) =>
    withKey(request, "requests:read", async (c) => ({ data: await ops.getOwnRequest(c, id) })),

  adminListRequests: (request: Request) =>
    withKey(request, "admin:requests:read", async () =>
      pageResult(await ops.adminListRequests(query(request))),
    ),

  adminUpdateRequest: (request: Request, id: string) =>
    withKey(request, "admin:requests:write", async () => ({
      data: await ops.adminUpdateStatus(id, await readJson(request)),
    })),
};
