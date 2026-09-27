import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireUserId } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { contentDisposition } from "@/lib/files/validate";
import { resolveMembership, type SqlTag } from "@/lib/saas/tenancy-core";
import { draftFileName, getDraftCore } from "./drafts-core";
import { draftToDocx } from "./docx.server";

/**
 * GET /api/law/drafts/<id>?ws=<office id> — the draft as a Word file, for
 * members of that office who may manage drafts. Same checks as document
 * downloads: same-site, session, membership + second factor, then the core's
 * role and office filter.
 */
function plain(status: number, text: string) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function downloadDraftRoute(request: Request, id: string): Promise<Response> {
  let userId: string;
  try {
    assertSameSiteRequest();
    userId = await requireUserId();
  } catch {
    return plain(401, "Unauthorized");
  }
  const ws = new URL(request.url).searchParams.get("ws") ?? "";
  const sql = (await getSql()) as unknown as SqlTag;
  try {
    const access = await resolveMembership(sql, userId, ws, "staff");
    const { assertSecondFactor } = await import("@/lib/otp/otp.server");
    await assertSecondFactor(userId);
    const d = await getDraftCore(sql, access, id);
    if (d.status !== "ready") return plain(409, "Not ready");
    const bytes = await draftToDocx(d.body, { title: d.title, office: access.workspace.name });
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": contentDisposition(draftFileName(d.title), false),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return plain(404, "Not found");
  }
}
