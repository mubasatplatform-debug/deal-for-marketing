import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/voice/events — progress of a call, from the `deal-voice` relay.
 *
 * Headers `x-deal-voice-timestamp` (unix seconds) and `x-deal-voice-signature`
 * = hex(HMAC-SHA256(VOICE_SIGNING_SECRET, `${timestamp}.${rawBody}`)); a bad
 * signature or a timestamp more than 300 s away is refused (401). Bodies:
 *
 *   {type:'status', callId, callSid, status, duration?}
 *   {type:'recording', callId, recordingSid, recordingDuration, recordingStatus}
 *
 * Unknown calls answer 200 (no-op) and repeats are harmless (voice-core.ts).
 * A completed recording starts the transcript + AI summary in the background.
 * Phone numbers are never logged.
 */

const MAX_BODY = 16 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function handle(request: Request): Promise<Response> {
  const { voiceConfigured, verifyRelayEvent, summarizeInBackground } = await import("@/lib/law/voice.server");
  if (!voiceConfigured()) return json({ error: "voice_disabled" }, 503);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "too_large" }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  const check = verifyRelayEvent(
    request.headers.get("x-deal-voice-timestamp"),
    request.headers.get("x-deal-voice-signature"),
    raw,
  );
  if (!check.ok) {
    console.warn(`[voice] event refused: ${check.reason}`);
    return json({ error: "unauthorized" }, 401);
  }
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!event || typeof event !== "object") return json({ error: "bad_request" }, 400);
  try {
    const { getSql } = await import("@/lib/db");
    const { applyVoiceEventCore } = await import("@/lib/law/voice-core");
    type Sql = Parameters<typeof applyVoiceEventCore>[0];
    type Event = Parameters<typeof applyVoiceEventCore>[1];
    const sql = (await getSql()) as unknown as Sql;
    const outcome = await applyVoiceEventCore(sql, event as Event);
    if (outcome.recordingReady && outcome.callId) summarizeInBackground(outcome.callId);
    return json({ ok: true, applied: outcome.applied });
  } catch (err) {
    console.error("[voice] event failed:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "failed" }, 500);
  }
}

export const Route = createFileRoute("/api/voice/events")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      ANY: async () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
