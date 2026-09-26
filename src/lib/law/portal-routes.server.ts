import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { readStored } from "@/lib/files/storage.server";
import { FILE_KINDS, contentDisposition, kindFromName } from "@/lib/files/validate";
import { RateLimitError, takeHit, visitorId } from "@/lib/rate-limit.server";
import type { SqlTag } from "@/lib/saas/tenancy-core";
import { hashPortalToken, isPortalTokenShape, portalDocumentCore } from "./portal-core";

/**
 * GET /api/portal/documents/<id>?t=<portal token> — a document the office
 * shared with this client, downloaded from the client portal — **server-only**.
 *
 * No session: the portal token is the credential. It must resolve to a live
 * link (not revoked, office not suspended), and the document must be filed
 * under that same client and marked shared; anything else is a plain 404.
 * Always an attachment, with the headers of the office download route.
 */

function plain(status: number, text: string) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function downloadPortalDocumentRoute(request: Request, rawId: string): Promise<Response> {
  try {
    assertSameSiteRequest();
  } catch {
    return plain(403, "Forbidden");
  }
  try {
    await takeHit(`portal-doc:${visitorId()}`, 60, 600);
  } catch (err) {
    if (err instanceof RateLimitError) return plain(429, "Too many requests");
    throw err;
  }
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!isPortalTokenShape(token)) return plain(404, "Not found");
  const sql = (await getSql()) as unknown as SqlTag;
  const doc = await portalDocumentCore(sql, hashPortalToken(token), rawId);
  if (!doc) return plain(404, "Not found");
  const body = await readStored({ storage: doc.storage, data: doc.data, blob_path: doc.blob_path });
  if (!body) return plain(404, "Not found");

  // Type comes from the validated extension, never the stored browser value.
  const kind = kindFromName(doc.name);
  const info = kind ? FILE_KINDS[kind] : null;
  const headers: Record<string, string> = {
    "Content-Type": info?.mime ?? "application/octet-stream",
    "Content-Disposition": contentDisposition(doc.name, false),
    "Content-Length": String(doc.size),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
  const payload: BodyInit = body instanceof Uint8Array ? new Uint8Array(body) : body;
  return new Response(payload, { status: 200, headers });
}
