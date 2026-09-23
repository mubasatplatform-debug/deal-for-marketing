import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  ADMIN_SCOPES,
  CLIENT_SCOPES,
  SCOPES,
  SCOPE_INFO,
  ScopeError,
  effectiveScopes,
  grantableScopes,
  hasScope,
  isKeyActive,
  normalizeRequestedScopes,
} from "./scopes.ts";
import {
  DISPLAY_PREFIX_LENGTH,
  KEY_PREFIX,
  bearerFromHeader,
  displayPrefix,
  generateApiKey,
  hashApiKey,
  isWellFormedKey,
} from "./secret.server.ts";

test("generated keys are deal_live_ + 32 random bytes in base64url", () => {
  const { secret } = generateApiKey();
  assert.ok(secret.startsWith(KEY_PREFIX));
  const body = secret.slice(KEY_PREFIX.length);
  assert.match(body, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(body, "base64url").length, 32);
  assert.ok(isWellFormedKey(secret));
});

test("every key is different", () => {
  const seen = new Set(Array.from({ length: 500 }, () => generateApiKey().secret));
  assert.equal(seen.size, 500);
});

test("only the SHA-256 hex of the full secret is stored", () => {
  const { secret, hash, prefix } = generateApiKey();
  assert.equal(hash, createHash("sha256").update(secret).digest("hex"));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashApiKey(secret), hash);
  assert.notEqual(hashApiKey(secret + "x"), hash);
  assert.ok(!hash.includes(secret.slice(KEY_PREFIX.length)));
  // The display prefix is a strict, short head of the key — most of it stays secret.
  assert.equal(prefix, displayPrefix(secret));
  assert.equal(prefix.length, DISPLAY_PREFIX_LENGTH);
  assert.ok(secret.startsWith(prefix));
  assert.ok(secret.length - prefix.length >= 32);
});

test("malformed keys are rejected before any lookup", () => {
  const { secret } = generateApiKey();
  for (const bad of [
    "",
    "deal_live_",
    secret.slice(0, -1),
    secret + "A",
    secret.replace(KEY_PREFIX, "deal_test_"),
    `${KEY_PREFIX}${"!".repeat(43)}`,
    ` ${secret}`,
  ]) {
    assert.equal(isWellFormedKey(bad), false, JSON.stringify(bad));
  }
});

test("bearer header parsing", () => {
  assert.equal(bearerFromHeader("Bearer abc"), "abc");
  assert.equal(bearerFromHeader("bearer abc"), "abc");
  assert.equal(bearerFromHeader("  BEARER   abc  "), "abc");
  assert.equal(bearerFromHeader("Basic abc"), null);
  assert.equal(bearerFromHeader("Bearer"), null);
  assert.equal(bearerFromHeader("Bearer a b"), null);
  assert.equal(bearerFromHeader(null), null);
  assert.equal(bearerFromHeader(undefined), null);
});

test("scope catalogue: client and admin scopes partition the list", () => {
  assert.deepEqual([...CLIENT_SCOPES], ["services:read", "requests:read", "requests:write"]);
  assert.deepEqual([...ADMIN_SCOPES], ["admin:requests:read", "admin:requests:write"]);
  assert.equal(SCOPE_INFO.length, SCOPES.length);
  for (const info of SCOPE_INFO) assert.ok(info.label && info.body, info.scope);
});

test("clients can grant only client scopes; the team can grant all", () => {
  assert.deepEqual(grantableScopes(false), [...CLIENT_SCOPES]);
  assert.deepEqual(grantableScopes(true), [...SCOPES]);
  assert.deepEqual(normalizeRequestedScopes(["requests:write", "services:read"], false), [
    "services:read",
    "requests:write",
  ]);
  assert.throws(() => normalizeRequestedScopes(["admin:requests:read"], false), ScopeError);
  assert.deepEqual(normalizeRequestedScopes(["admin:requests:write"], true), [
    "admin:requests:write",
  ]);
});

test("scope requests are validated", () => {
  assert.throws(() => normalizeRequestedScopes([], true), ScopeError);
  assert.throws(() => normalizeRequestedScopes("services:read", true), ScopeError);
  assert.throws(() => normalizeRequestedScopes(["services:write"], true), ScopeError);
  assert.throws(() => normalizeRequestedScopes([42], true), ScopeError);
  // Duplicates collapse.
  assert.deepEqual(normalizeRequestedScopes(["services:read", "services:read"], false), [
    "services:read",
  ]);
});

test("team scopes only work while the owner is on the team", () => {
  const stored = ["services:read", "admin:requests:read", "admin:requests:write", "bogus"];
  assert.deepEqual(effectiveScopes(stored, true), [
    "services:read",
    "admin:requests:read",
    "admin:requests:write",
  ]);
  assert.deepEqual(effectiveScopes(stored, false), ["services:read"]);
});

test("hasScope is exact — no prefix or wildcard matching", () => {
  assert.ok(hasScope(["requests:read"], "requests:read"));
  assert.ok(!hasScope(["requests:read"], "requests:write"));
  assert.ok(!hasScope(["requests:read"], "admin:requests:read"));
  assert.ok(!hasScope(["admin:requests:read"], "requests:read"));
  assert.ok(!hasScope([], "services:read"));
});

test("revoked or expired keys are not active", () => {
  const now = Date.parse("2026-01-10T00:00:00Z");
  assert.ok(isKeyActive({ revoked_at: null, expires_at: null }, now));
  assert.ok(isKeyActive({ revoked_at: null, expires_at: "2026-01-11T00:00:00Z" }, now));
  assert.ok(!isKeyActive({ revoked_at: null, expires_at: "2026-01-10T00:00:00Z" }, now));
  assert.ok(!isKeyActive({ revoked_at: null, expires_at: new Date(now - 1) }, now));
  assert.ok(!isKeyActive({ revoked_at: "2026-01-01T00:00:00Z", expires_at: null }, now));
});
