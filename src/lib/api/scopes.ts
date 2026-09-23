/**
 * API key scopes — isomorphic and dependency-free, so the keys UI, the docs
 * page, the REST/MCP servers and the unit tests all read the same table.
 */

export const SCOPES = [
  "services:read",
  "requests:read",
  "requests:write",
  "admin:requests:read",
  "admin:requests:write",
] as const;

export type Scope = (typeof SCOPES)[number];

export type ScopeInfo = {
  scope: Scope;
  /** Short Arabic name for the checkbox. */
  label: string;
  /** What a key with this scope can do, in the owner's words. */
  body: string;
  /** Only DEAL team accounts may grant it. */
  admin: boolean;
  /** Can change data. */
  write: boolean;
};

export const SCOPE_INFO: readonly ScopeInfo[] = [
  {
    scope: "services:read",
    label: "قراءة الخدمات",
    body: "يعرض قائمة خدمات ديل المتاحة للطلب. بيانات عامة لا تخص حسابك.",
    admin: false,
    write: false,
  },
  {
    scope: "requests:read",
    label: "قراءة طلباتي",
    body: "يقرأ طلباتك أنت فقط وحالة كل طلب. لا يرى طلبات أي عميل آخر.",
    admin: false,
    write: false,
  },
  {
    scope: "requests:write",
    label: "إنشاء طلبات",
    body: "ينشئ طلبات خدمة جديدة باسم حسابك، ويصل كل طلب لفريق ديل كأنه من النموذج.",
    admin: false,
    write: true,
  },
  {
    scope: "admin:requests:read",
    label: "قراءة كل الطلبات",
    body: "لفريق ديل: يقرأ طلبات كل العملاء مع بيانات التواصل.",
    admin: true,
    write: false,
  },
  {
    scope: "admin:requests:write",
    label: "تغيير حالة الطلبات",
    body: "لفريق ديل: ينقل أي طلب بين المراحل (جديد، مراجعة، تنفيذ، تسليم).",
    admin: true,
    write: true,
  },
];

export const CLIENT_SCOPES: readonly Scope[] = SCOPE_INFO.filter((s) => !s.admin).map(
  (s) => s.scope,
);
export const ADMIN_SCOPES: readonly Scope[] = SCOPE_INFO.filter((s) => s.admin).map(
  (s) => s.scope,
);

/** Most keys one user may hold at a time (revoked and expired keys do not count). */
export const MAX_ACTIVE_KEYS = 10;

/** Lifetimes offered for a new key, in days; `null` = until revoked. */
export const KEY_EXPIRY_OPTIONS = [
  { days: 30, label: "30 يومًا" },
  { days: 90, label: "90 يومًا" },
  { days: 365, label: "سنة" },
  { days: null, label: "بلا انتهاء" },
] as const;
export type KeyExpiryDays = (typeof KEY_EXPIRY_OPTIONS)[number]["days"];
export const DEFAULT_KEY_EXPIRY_DAYS: KeyExpiryDays = 90;

/** Is the key usable at `now`: not revoked and not past its expiry. */
export function isKeyActive(
  k: { revoked_at: string | Date | null; expires_at: string | Date | null },
  now: number = Date.now(),
): boolean {
  if (k.revoked_at) return false;
  return !k.expires_at || new Date(k.expires_at).getTime() > now;
}

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && (SCOPES as readonly string[]).includes(value);
}

export function scopeInfo(scope: string): ScopeInfo | undefined {
  return SCOPE_INFO.find((s) => s.scope === scope);
}

/** Scopes a user may put on a new key. */
export function grantableScopes(isAdmin: boolean): Scope[] {
  return isAdmin ? [...SCOPES] : [...CLIENT_SCOPES];
}

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

/**
 * Validate the scopes requested for a new key: known, at least one, no
 * duplicates, and no team-only scope unless the caller is on the team.
 * Returns them in canonical order.
 */
export function normalizeRequestedScopes(requested: unknown, isAdmin: boolean): Scope[] {
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new ScopeError("اختر صلاحية واحدة على الأقل.");
  }
  const unknown = requested.filter((s) => !isScope(s));
  if (unknown.length) throw new ScopeError(`صلاحية غير معروفة: ${unknown.join(", ")}`);
  const allowed = new Set(grantableScopes(isAdmin));
  const denied = (requested as Scope[]).filter((s) => !allowed.has(s));
  if (denied.length) throw new ScopeError("صلاحيات الإدارة متاحة لفريق ديل فقط.");
  const set = new Set(requested as Scope[]);
  return SCOPES.filter((s) => set.has(s));
}

/**
 * Scopes a key can actually use right now. Team-only scopes stay on the key
 * row but only take effect while its owner is still on the team, so removing
 * someone from ADMIN_EMAILS disarms their keys immediately.
 */
export function effectiveScopes(stored: readonly string[], ownerIsAdmin: boolean): Scope[] {
  const adminOnly = new Set<string>(ADMIN_SCOPES);
  return SCOPES.filter((s) => stored.includes(s) && (ownerIsAdmin || !adminOnly.has(s)));
}

export function hasScope(granted: readonly string[], needed: Scope): boolean {
  return granted.includes(needed);
}
