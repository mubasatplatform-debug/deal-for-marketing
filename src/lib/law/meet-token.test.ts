import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  deriveMeetToken,
  hashMeetToken,
  isMeetTokenShape,
  meetSecret,
  newMeetNonce,
  sameHash,
} from "./meet-token.ts";
import { ROOM_NAME_RE, joinWindowState, randomRoomName } from "./video/types.ts";

test("meeting tokens: 32 bytes base64url, stable per (id, nonce), rotated by a new nonce", () => {
  const id = "0b7c4a36-3c35-4f7d-9e4c-1c2d3e4f5a6b";
  const nonce = newMeetNonce();
  assert.match(nonce, /^[0-9a-f]{32}$/);
  const t1 = deriveMeetToken("secret-1", id, nonce);
  assert.ok(isMeetTokenShape(t1));
  assert.equal(Buffer.from(t1, "base64url").length, 32);
  assert.equal(deriveMeetToken("secret-1", id, nonce), t1, "re-derivable for re-sending the link");
  assert.notEqual(deriveMeetToken("secret-1", id, newMeetNonce()), t1, "a new nonce revokes the link");
  assert.notEqual(deriveMeetToken("secret-2", id, nonce), t1, "bound to the server secret");
  assert.notEqual(deriveMeetToken("secret-1", "another", nonce), t1, "bound to the consultation");
  assert.throws(() => deriveMeetToken("", id, nonce));
});

test("only the SHA-256 of a token is stored and compared", () => {
  const t = deriveMeetToken("s", "id", "n");
  const h = hashMeetToken(t);
  assert.equal(h, createHash("sha256").update(t).digest("hex"));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(sameHash(h, hashMeetToken(t)));
  assert.equal(sameHash(h, hashMeetToken(`${t}x`)), false);
  assert.equal(sameHash(h, "short"), false);
  assert.equal(isMeetTokenShape("x".repeat(42)), false);
  assert.equal(isMeetTokenShape(`${"x".repeat(42)}=`), false);
  assert.equal(isMeetTokenShape(123), false);
});

test("the link secret prefers LAW_MEET_SECRET, then BETTER_AUTH_SECRET", () => {
  assert.equal(meetSecret({ LAW_MEET_SECRET: " a ", BETTER_AUTH_SECRET: "b" }), "a");
  assert.equal(meetSecret({ BETTER_AUTH_SECRET: "b" }), "b");
  assert.ok(meetSecret({}).length > 10);
});

test("room names are unguessable and well-formed", () => {
  const names = new Set(Array.from({ length: 200 }, () => randomRoomName()));
  assert.equal(names.size, 200);
  for (const n of names) assert.match(n, ROOM_NAME_RE);
  assert.match(randomRoomName("consult"), /^consult-[a-z0-9]{32}$/);
});

test("the join window opens 10 minutes before and closes 30 minutes after", () => {
  const start = "2026-09-27T07:00:00.000Z";
  const end = "2026-09-27T07:30:00.000Z";
  const t = (iso: string) => Date.parse(iso);
  assert.equal(joinWindowState(start, end, t("2026-09-27T06:49:59Z")), "early");
  assert.equal(joinWindowState(start, end, t("2026-09-27T06:50:00Z")), "open");
  assert.equal(joinWindowState(start, end, t("2026-09-27T08:00:00Z")), "open");
  assert.equal(joinWindowState(start, end, t("2026-09-27T08:00:01Z")), "ended");
});
