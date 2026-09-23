import assert from "node:assert/strict";
import { test } from "node:test";
import { firstName } from "./names.ts";

test("a plain name greets by its first word", () => {
  assert.equal(firstName("فيصل العتيبي"), "فيصل");
  assert.equal(firstName("عبدالله المطيري"), "عبدالله");
  assert.equal(firstName("  نورة  "), "نورة");
});

test("kunya and compound names keep their second word", () => {
  assert.equal(firstName("أبو فيصل"), "أبو فيصل");
  assert.equal(firstName("ابو فهد العنزي"), "ابو فهد");
  assert.equal(firstName("أم خالد"), "أم خالد");
  assert.equal(firstName("عبد الله السالم"), "عبد الله");
  assert.equal(firstName("بن سعد"), "بن سعد");
});

test("a bound word on its own, or no name at all", () => {
  assert.equal(firstName("أبو"), "أبو");
  assert.equal(firstName(""), "");
  assert.equal(firstName(null), "");
  assert.equal(firstName(undefined), "");
});
