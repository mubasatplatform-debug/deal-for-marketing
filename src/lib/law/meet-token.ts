import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Consultation meeting links — **server-only** (node:crypto).
 *
 * The client's link is /meet/<token>, a 32-byte base64url token (43 chars).
 * Like phase-1 invites, the database stores only the token's SHA-256
 * (`meet_token_hash`), so a leaked table cannot be replayed into links.
 *
 * Unlike an invite, the office needs to show and re-send the same link many
 * times (confirmation, reminder, "copy link"), so the token is not random-and-
 * forgotten: it is HMAC-SHA256(server secret, "meet:<id>:<nonce>"), where the
 * nonce is 16 random bytes stored on the row. Only the server (holding the
 * secret) can re-derive it; rotating the nonce revokes the old link. Changing
 * the secret revokes every link (they can be re-issued from the office).
 */
export const MEET_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newMeetNonce(): string {
  return randomBytes(16).toString("hex");
}

export function deriveMeetToken(secret: string, appointmentId: string, nonce: string): string {
  if (!secret) throw new Error("meet token secret missing");
  return createHmac("sha256", secret).update(`meet:${appointmentId}:${nonce}`, "utf8").digest("base64url");
}

export function hashMeetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isMeetTokenShape(v: unknown): v is string {
  return typeof v === "string" && MEET_TOKEN_RE.test(v);
}

/** Constant-time comparison of two hex hashes. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The secret links are derived with: LAW_MEET_SECRET, else BETTER_AUTH_SECRET (dev fallback). */
export function meetSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.LAW_MEET_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  // A guessable secret would make every meeting link forgeable: never in production.
  if (env.NODE_ENV === "production") throw new Error("LAW_MEET_SECRET or BETTER_AUTH_SECRET must be set");
  return "deal-for-marketing:dev-meet-secret";
}
