import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { edfapayProvider, edfapayWebhookSignatureOk } from "./edfapay.ts";

const SECRET = "whsec_test_edfapay";
const sign = (body: string) => createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

test("edfapay is disabled unless EDFAPAY_API_KEY is set", () => {
  const prev = process.env.EDFAPAY_API_KEY;
  delete process.env.EDFAPAY_API_KEY;
  assert.equal(edfapayProvider.enabled(), false);
  process.env.EDFAPAY_API_KEY = "test-key";
  assert.equal(edfapayProvider.enabled(), true);
  if (prev === undefined) delete process.env.EDFAPAY_API_KEY;
  else process.env.EDFAPAY_API_KEY = prev;
});

test("edfapay webhook signature: accepts the right HMAC, rejects everything else", () => {
  const prev = process.env.EDFAPAY_WEBHOOK_SECRET;
  process.env.EDFAPAY_WEBHOOK_SECRET = SECRET;
  const body = JSON.stringify({ orderId: "abc", status: "Success", amount: 1149 });

  assert.equal(edfapayWebhookSignatureOk(body, sign(body)), true, "valid signature");
  assert.equal(edfapayWebhookSignatureOk(body, sign(body).toUpperCase()), true, "case-insensitive hex");
  assert.equal(edfapayWebhookSignatureOk(body, "deadbeef"), false, "wrong signature");
  assert.equal(edfapayWebhookSignatureOk(body, null), false, "missing signature");
  assert.equal(edfapayWebhookSignatureOk(body + " ", sign(body)), false, "body tampered");

  // With no secret configured, even a plausible signature is refused.
  delete process.env.EDFAPAY_WEBHOOK_SECRET;
  assert.equal(edfapayWebhookSignatureOk(body, sign(body)), false, "no secret configured");

  if (prev === undefined) delete process.env.EDFAPAY_WEBHOOK_SECRET;
  else process.env.EDFAPAY_WEBHOOK_SECRET = prev;
});
