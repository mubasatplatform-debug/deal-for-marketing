import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/voice/recording/:id — play a call's recording, for members of the
 * office that placed the call (session, membership and second factor, as for
 * office documents). The audio stays at Twilio and is streamed through the
 * relay; nothing is cached. Another office's call looks like a missing one.
 */

const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

async function handle(id: string): Promise<Response> {
  const { requireUserId } = await import("@/lib/auth/verify.server");
  const { getSql } = await import("@/lib/db");
  const { resolveMembership, UUID_RE, WorkspaceError } = await import("@/lib/saas/tenancy-core");
  const { callRecordingCore, callWorkspaceCore } = await import("@/lib/law/voice-core");
  const { relayAudio, voiceConfigured } = await import("@/lib/law/voice.server");

  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  try {
    assertSameSiteRequest();
  } catch {
    return plain(403, "Forbidden");
  }
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return plain(401, "Unauthorized");
  }
  if (!UUID_RE.test(id)) return plain(404, "Not found");
  const sql = (await getSql()) as unknown as Parameters<typeof callWorkspaceCore>[0];
  const ws = await callWorkspaceCore(sql, id);
  if (!ws) return plain(404, "Not found");
  let recordingSid: string | null;
  try {
    const access = await resolveMembership(sql, userId, ws, "staff");
    const { assertSecondFactor } = await import("@/lib/otp/otp.server");
    await assertSecondFactor(userId);
    recordingSid = await callRecordingCore(sql, access, id);
  } catch (err) {
    if (err instanceof WorkspaceError && err.code === "otp_required") return plain(403, "Forbidden");
    return plain(404, "Not found");
  }
  if (!recordingSid || !voiceConfigured()) return plain(404, "Not found");
  let upstream: Response;
  try {
    upstream = await relayAudio(recordingSid);
  } catch {
    return plain(502, "Recording unavailable");
  }
  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
  const length = upstream.headers.get("content-length");
  if (length && /^\d+$/.test(length)) headers["Content-Length"] = length;
  return new Response(upstream.body, { status: 200, headers });
}

export const Route = createFileRoute("/api/voice/recording/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => handle(params.id),
    },
  },
});
