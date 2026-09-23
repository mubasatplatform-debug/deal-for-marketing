import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emailVerificationCooldownRemainingMs,
  emailVerificationCooldownRemainingSeconds,
  safeEmailVerificationCallback,
} from "./email-verification.ts";

describe("safeEmailVerificationCallback", () => {
  const origin = "https://deal.example";

  it("keeps same-origin relative paths", () => {
    assert.equal(safeEmailVerificationCallback("/client?tab=requests#latest", origin), "/client?tab=requests#latest");
  });

  it("normalizes same-origin absolute URLs", () => {
    assert.equal(safeEmailVerificationCallback("https://deal.example/app?ws=abc", origin), "/app?ws=abc");
  });

  it("falls back for unsafe or cross-origin values", () => {
    assert.equal(safeEmailVerificationCallback("https://evil.example/client", origin), "/client");
    assert.equal(safeEmailVerificationCallback("//evil.example/client", origin), "/client");
    assert.equal(safeEmailVerificationCallback("/client\nx", origin), "/client");
    assert.equal(safeEmailVerificationCallback("/verify-email?verified=1", origin), "/client");
  });
});

describe("email verification cooldown", () => {
  it("returns zero without a previous send", () => {
    assert.equal(emailVerificationCooldownRemainingMs(10_000, 0), 0);
  });

  it("counts down and rounds seconds up", () => {
    assert.equal(emailVerificationCooldownRemainingMs(10_500, 10_000, 60_000), 59_500);
    assert.equal(emailVerificationCooldownRemainingSeconds(10_500, 10_000, 60_000), 60);
  });

  it("expires at the end of the cooldown", () => {
    assert.equal(emailVerificationCooldownRemainingMs(70_000, 10_000, 60_000), 0);
    assert.equal(emailVerificationCooldownRemainingSeconds(70_000, 10_000, 60_000), 0);
  });
});
