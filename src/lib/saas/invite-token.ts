import { createHash, randomBytes } from "node:crypto";

/**
 * Invite tokens — **server-only** (node:crypto). A token is 32 random bytes,
 * base64url (43 chars), shown once in the invite link; the database keeps
 * only its SHA-256, so a leaked table cannot be replayed into invites.
 */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isInviteTokenShape(token: unknown): token is string {
  return typeof token === "string" && INVITE_TOKEN_RE.test(token);
}
