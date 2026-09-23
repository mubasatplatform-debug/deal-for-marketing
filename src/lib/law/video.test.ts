import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { TokenVerifier } from "livekit-server-sdk";
import { validateExternalUrl } from "./video/external.ts";
import { activeProviderId, providerById, providerFor, roomOf } from "./video/index.ts";
import { JITSI_BASE, jitsiProvider } from "./video/jitsi.ts";
import { grantFor, httpUrl, liveKitConfig, liveKitProvider, ttlSeconds, wsUrl } from "./video/livekit.ts";

const ENV = {
  LIVEKIT_URL: "wss://deal-test.livekit.cloud",
  LIVEKIT_API_KEY: "APItestkey",
  LIVEKIT_API_SECRET: "a-very-long-test-secret-for-livekit-tokens-1234567890",
};
const cfg = liveKitConfig(ENV)!;
const verifier = new TokenVerifier(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET);
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("provider selection: LiveKit only with all three settings, else Jitsi; a pasted link wins", () => {
  assert.equal(activeProviderId(ENV), "livekit");
  assert.equal(activeProviderId({ ...ENV, LIVEKIT_API_SECRET: "" }), "jitsi");
  assert.equal(activeProviderId({ LIVEKIT_URL: "wss://x.livekit.cloud" }), "jitsi");
  assert.equal(activeProviderId({}), "jitsi");
  assert.equal(activeProviderId({ ...ENV, LIVEKIT_URL: "not a url" }), "jitsi");
  assert.equal(providerFor({ external_url: null }, ENV).id, "livekit");
  assert.equal(providerFor({ external_url: null }, {}).id, "jitsi");
  assert.equal(providerFor({ external_url: "https://zoom.us/j/1" }, ENV).id, "external");
  assert.throws(() => providerById("livekit", {}));
  assert.throws(() => providerById("external", ENV, null));
  assert.equal(wsUrl("https://a.livekit.cloud"), "wss://a.livekit.cloud");
  assert.equal(httpUrl("wss://a.livekit.cloud"), "https://a.livekit.cloud");
});

test("LiveKit rooms are unguessable and rebuilt from the stored name", async () => {
  const p = liveKitProvider(cfg);
  const room = await p.createRoom({ consultationId: "c1", startsAt: "", endsAt: "" });
  assert.equal(room.provider, "livekit");
  assert.match(room.roomName, /^maktab-[a-z0-9]{32}$/);
  assert.equal(room.roomUrl, "wss://deal-test.livekit.cloud");
  const again = roomOf(p, { video_room: room.roomName, external_url: null }, ENV);
  assert.equal(again?.roomName, room.roomName);
  assert.equal(roomOf(p, { video_room: null, external_url: null }, ENV), null);
});

test("LiveKit tokens: identity, name, TTL until end + 30 min, and the right grants", async () => {
  const p = liveKitProvider(cfg);
  const room = { provider: "livekit" as const, roomName: "maktab-abcdefghijklmnopqrstuvwxyz012345", roomUrl: cfg.url };
  const now = Date.now();
  const endsAt = new Date(now + 45 * 60_000).toISOString();

  const host = await p.joinUrl(room, { role: "host", identity: "lawyer:u1", name: "أ. سارة", admitted: true }, { endsAt, now });
  assert.equal(host.kind, "embed");
  if (host.kind !== "embed") return;
  assert.equal(host.serverUrl, "wss://deal-test.livekit.cloud");
  assert.equal(host.lobby, false);
  const h = await verifier.verify(host.token);
  assert.equal(h.sub, "lawyer:u1");
  assert.equal(h.name, "أ. سارة");
  assert.equal(h.video?.room, room.roomName);
  assert.equal(h.video?.roomJoin, true);
  assert.equal(h.video?.roomAdmin, true);
  assert.equal(h.video?.canPublish, true);
  assert.equal(h.video?.canSubscribe, true);
  assert.equal(h.video?.canPublishData, true);
  assert.equal(h.video?.canUpdateOwnMetadata, false);
  const ttl = (h.exp ?? 0) - Math.floor(now / 1000);
  assert.ok(Math.abs(ttl - 75 * 60) <= 2, `ttl ${ttl}`);
  assert.equal(Date.parse(host.expiresAt), now + ttlSeconds(endsAt, now) * 1000);

  const lobby = await p.joinUrl(room, { role: "guest", identity: "client:c1", name: "محمد", admitted: false }, { endsAt, now });
  assert.equal(lobby.kind === "embed" && lobby.lobby, true);
  const g = await verifier.verify(lobby.kind === "embed" ? lobby.token : "");
  assert.equal(g.sub, "client:c1");
  assert.equal(g.video?.roomJoin, true);
  assert.equal(g.video?.roomAdmin, undefined);
  assert.equal(g.video?.canPublish, false);
  assert.equal(g.video?.canSubscribe, false);
  assert.equal(g.video?.canPublishData, false);

  const admitted = await p.joinUrl(room, { role: "guest", identity: "client:c1", name: "محمد", admitted: true }, { endsAt, now });
  const a = await verifier.verify(admitted.kind === "embed" ? admitted.token : "");
  assert.equal(a.video?.canPublish, true);
  assert.equal(a.video?.canSubscribe, true);
  assert.equal(a.video?.roomAdmin, undefined);
  assert.equal(admitted.kind === "embed" && admitted.lobby, false);

  // A token is never shorter than 5 minutes, even at the very end of the window.
  assert.equal(ttlSeconds(new Date(now - 29 * 60_000).toISOString(), now), 300);
  assert.deepEqual(grantFor("r", { role: "guest", identity: "x", name: "x", admitted: false }), {
    room: "r",
    roomJoin: true,
    canUpdateOwnMetadata: false,
    canPublish: false,
    canSubscribe: false,
    canPublishData: false,
  });
});

test("admitting a waiting client upgrades the live participant via RoomService (mocked)", async () => {
  const calls: { url: string; auth: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get("authorization") ?? "", body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ identity: "client:c1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const p = liveKitProvider(cfg);
  const room = { provider: "livekit" as const, roomName: "maktab-room", roomUrl: cfg.url };
  assert.equal(await p.admit!(room, "client:c1"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://deal-test.livekit.cloud/twirp/livekit.RoomService/UpdateParticipant");
  assert.equal(calls[0].body.room, "maktab-room");
  assert.equal(calls[0].body.identity, "client:c1");
  const perm = calls[0].body.permission as Record<string, unknown>;
  assert.equal(perm.canPublish ?? perm.can_publish, true);
  assert.equal(perm.canSubscribe ?? perm.can_subscribe, true);
  assert.equal(perm.canPublishData ?? perm.can_publish_data, true);
  const claims = await verifier.verify(calls[0].auth.replace(/^Bearer /, ""));
  assert.equal(claims.video?.roomAdmin, true);
  assert.equal(claims.video?.room, "maktab-room");

  // Not connected right now: not an error (their next token is a full one).
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: "not_found", msg: "participant not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  assert.equal(await p.admit!(room, "client:c1"), false);

  // Anything else surfaces.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: "unauthenticated", msg: "bad key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  await assert.rejects(p.admit!(room, "client:c1"));
});

test("Jitsi fallback: a new-tab link on meet.jit.si with the display name, and an Arabic note", async () => {
  const p = jitsiProvider(() => "maktab-abcdefghijklmnopqrstuvwxyz012345");
  const room = await p.createRoom({ consultationId: "c1", startsAt: "", endsAt: "" });
  assert.equal(room.roomUrl, `${JITSI_BASE}/maktab-abcdefghijklmnopqrstuvwxyz012345`);
  const host = await p.joinUrl(room, { role: "host", identity: "h", name: 'أ. "سارة"', admitted: true }, { endsAt: "" });
  assert.equal(host.kind, "link");
  if (host.kind !== "link") return;
  assert.ok(host.url.startsWith(`${JITSI_BASE}/maktab-abcdefghijklmnopqrstuvwxyz012345#`));
  assert.ok(host.url.includes("userInfo.displayName="));
  assert.ok(!decodeURIComponent(host.url).includes('"سارة"'), "quotes are stripped from the name");
  assert.match(host.note ?? "", /تسجيل الدخول/);
  const guest = await p.joinUrl(room, { role: "guest", identity: "g", name: "محمد", admitted: false }, { endsAt: "" });
  assert.match(guest.kind === "link" ? (guest.note ?? "") : "", /لا تحتاج حسابًا/);
});

test("external links: https on allow-listed meeting hosts only", () => {
  assert.equal(validateExternalUrl("https://us02web.zoom.us/j/123?pwd=x"), "https://us02web.zoom.us/j/123?pwd=x");
  assert.ok(validateExternalUrl("https://meet.google.com/abc-defg-hij"));
  assert.ok(validateExternalUrl("https://teams.microsoft.com/l/meetup-join/x"));
  assert.ok(validateExternalUrl(" https://zoom.us/j/1 "));
  assert.equal(validateExternalUrl("http://zoom.us/j/1"), null, "plain http");
  assert.equal(validateExternalUrl("https://zoom.us.evil.com/j/1"), null, "look-alike host");
  assert.equal(validateExternalUrl("https://evil.com/?u=https://zoom.us"), null);
  assert.equal(validateExternalUrl("https://user:pw@zoom.us/j/1"), null, "credentials");
  assert.equal(validateExternalUrl("https://zoom.us:8443/j/1"), null, "odd port");
  assert.equal(validateExternalUrl("javascript:alert(1)"), null);
  assert.equal(validateExternalUrl(""), null);
  assert.equal(validateExternalUrl(`https://zoom.us/${"a".repeat(600)}`), null);
});
