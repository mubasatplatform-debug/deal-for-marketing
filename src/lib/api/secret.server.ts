import { createHash, randomBytes } from "node:crypto";

/**
 * API key secrets — **server-only**, no app imports so the unit tests can load
 * it directly.
 *
 * Format: `deal_live_` + 32 random bytes as base64url (43 chars). 256 bits of
 * entropy make a fast, unsalted SHA-256 the right storage hash: nothing to
 * brute-force, and it lets a request find its key with one indexed lookup.
 */

export const KEY_PREFIX = "deal_live_";
const SECRET_BYTES = 32;
/** 32 bytes → 43 base64url characters, no padding. */
const BODY_LENGTH = 43;
/**
 * Characters of the key kept in clear for display (`deal_live_` + 8). Eight
 * random characters (48 bits) keep the unique index free of collisions; the
 * other 35 characters stay secret.
 */
export const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 8;

const KEY_PATTERN = new RegExp(`^${KEY_PREFIX}[A-Za-z0-9_-]{${BODY_LENGTH}}$`);

export type GeneratedKey = {
  /** The full secret — return it to the owner once, never store it. */
  secret: string;
  prefix: string;
  hash: string;
};

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function displayPrefix(secret: string): string {
  return secret.slice(0, DISPLAY_PREFIX_LENGTH);
}

export function generateApiKey(): GeneratedKey {
  const secret = KEY_PREFIX + randomBytes(SECRET_BYTES).toString("base64url");
  return { secret, prefix: displayPrefix(secret), hash: hashApiKey(secret) };
}

/** Cheap shape check before any database work. */
export function isWellFormedKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/**
 * The key from an `Authorization: Bearer …` header, or null. The scheme is
 * case-insensitive (RFC 7235); surrounding whitespace is ignored.
 */
export function bearerFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^\s*bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}
