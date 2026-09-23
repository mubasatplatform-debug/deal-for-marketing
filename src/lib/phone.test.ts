import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone } from "./phone.ts";

test("Saudi mobiles in every common spelling normalise to E.164", () => {
  for (const input of [
    "0551234567",
    "551234567",
    "+966551234567",
    "966551234567",
    "00966551234567",
    "055 123 4567",
    "(055) 123-4567",
  ]) {
    assert.equal(normalizePhone(input), "+966551234567", input);
  }
});

test("Arabic-Indic and Persian digits are accepted", () => {
  assert.equal(normalizePhone("٠٥٥١٢٣٤٥٦٧"), "+966551234567");
  assert.equal(normalizePhone("۰۵۵۱۲۳۴۵۶۷"), "+966551234567");
});

test("Saudi landlines are accepted", () => {
  assert.equal(normalizePhone("0165107138"), "+966165107138");
});

test("foreign numbers need an explicit international prefix", () => {
  assert.equal(normalizePhone("+971501234567"), "+971501234567");
  assert.equal(normalizePhone("971501234567"), null);
});

test("junk is rejected", () => {
  for (const input of ["", "   ", "abc", "05512", "0551234567890", "+966 12", "+123"]) {
    assert.equal(normalizePhone(input), null, input);
  }
});
