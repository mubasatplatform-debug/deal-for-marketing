/**
 * Signatures shared with the `deal-voice` relay — **server-only** (node:crypto;
 * the secret never reaches the browser). Pure otherwise, so node tests import it.
 *
 *   - dial:   sig = hex(HMAC-SHA256(secret, `${callId}|${to}|${rec}`)), computed
 *             here when a member starts a call; the browser passes it through
 *             to the relay, which refuses a dial whose parameters were changed.
 *   - events: the relay signs `${timestamp}.${rawBody}` the same way and sends
 *             `x-deal-voice-timestamp` / `x-deal-voice-signature`; we accept a
 *             matching signature within ±300 s (constant-time comparison).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const EVENT_WINDOW_SEC = 300;

export function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export function signDial(secret: string, callId: string, to: string, rec: "1" | "0"): string {
  return hmacHex(secret, `${callId}|${to}|${rec}`);
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "stale" | "signature" };

/** Check a relay event's timestamp and signature against the raw request body. */
export function verifyEventSignature(
  secret: string,
  timestamp: string | null | undefined,
  signature: string | null | undefined,
  rawBody: string,
  nowSec = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!secret || !timestamp || !signature) return { ok: false, reason: "missing" };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "stale" };
  if (Math.abs(nowSec - Number(timestamp)) > EVENT_WINDOW_SEC) return { ok: false, reason: "stale" };
  const given = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return { ok: false, reason: "signature" };
  const expected = Buffer.from(hmacHex(secret, `${timestamp}.${rawBody}`), "hex");
  const actual = Buffer.from(given, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: "signature" };
  return { ok: true };
}
