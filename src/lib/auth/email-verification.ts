export const VERIFY_EMAIL_COOLDOWN_MS = 60_000;

const FALLBACK_CALLBACK = "/client";

function relativeSameOriginPath(value: string, origin: string): string | null {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//")) return null;
    if (path === "/verify-email" || path.startsWith("/verify-email?")) return null;
    if (path.startsWith("/api/auth/verify-email")) return null;
    return path;
  } catch {
    return null;
  }
}

export function safeEmailVerificationCallback(
  value: unknown,
  origin = "https://deal.local",
  fallback = FALLBACK_CALLBACK,
): string {
  if (typeof value !== "string" || value.length > 1200) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\s\u0000-\u001f]/.test(value)) return fallback;
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) return fallback;
  return relativeSameOriginPath(value, origin) ?? fallback;
}

export function emailVerificationCooldownRemainingMs(
  nowMs: number,
  lastSentAtMs: number,
  cooldownMs = VERIFY_EMAIL_COOLDOWN_MS,
): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastSentAtMs) || !Number.isFinite(cooldownMs)) return 0;
  if (lastSentAtMs <= 0 || cooldownMs <= 0) return 0;
  return Math.max(0, Math.ceil(lastSentAtMs + cooldownMs - nowMs));
}

export function emailVerificationCooldownRemainingSeconds(
  nowMs: number,
  lastSentAtMs: number,
  cooldownMs = VERIFY_EMAIL_COOLDOWN_MS,
): number {
  return Math.ceil(emailVerificationCooldownRemainingMs(nowMs, lastSentAtMs, cooldownMs) / 1000);
}
