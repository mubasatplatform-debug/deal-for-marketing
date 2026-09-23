import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTRIBUTION_KEY,
  ATTRIBUTION_TTL_MS,
  attributionFromLanding,
  attributionSchema,
  captureFirstTouch,
  normalizeSource,
  sanitizeAttribution,
  sourceFromHost,
  sourceLabel,
  storedFirstTouch,
} from "./attribution.ts";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}

// --- normalization ---------------------------------------------------------

test("utm_source wins and maps common aliases", () => {
  assert.equal(normalizeSource({ utm_source: "snapchat" }), "snapchat");
  assert.equal(normalizeSource({ utm_source: "Snap" }), "snapchat");
  assert.equal(normalizeSource({ utm_source: "IG" }), "instagram");
  assert.equal(normalizeSource({ utm_source: "tiktok" }), "tiktok");
  assert.equal(normalizeSource({ utm_source: "twitter" }), "x");
  assert.equal(normalizeSource({ utm_source: "google_ads" }), "google");
  assert.equal(normalizeSource({ utm_source: "wa" }), "whatsapp");
  assert.equal(normalizeSource({ utm_source: "linkedin" }), "linkedin");
  // utm beats the referrer
  assert.equal(
    normalizeSource({ utm_source: "snapchat", referrer_host: "www.google.com" }),
    "snapchat",
  );
});

test("an unknown utm_source is other; a host-shaped one is mapped", () => {
  assert.equal(normalizeSource({ utm_source: "newsletter" }), "other");
  assert.equal(normalizeSource({ utm_source: "l.instagram.com" }), "instagram");
});

test("referrer hosts map to their network", () => {
  const cases: [string, string | null][] = [
    ["snapchat.com", "snapchat"],
    ["www.snapchat.com", "snapchat"],
    ["instagram.com", "instagram"],
    ["l.instagram.com", "instagram"],
    ["www.tiktok.com", "tiktok"],
    ["t.co", "x"],
    ["x.com", "x"],
    ["mobile.twitter.com", "x"],
    ["www.google.com", "google"],
    ["google.com.sa", "google"],
    ["www.google.co.uk", "google"],
    ["wa.me", "whatsapp"],
    ["web.whatsapp.com", "whatsapp"],
    ["www.linkedin.com", "linkedin"],
    ["lnkd.in", "linkedin"],
    ["example.com", null],
    ["notgoogle.com", null],
    ["google.evil.example", null],
    ["fakesnapchat.com", null],
  ];
  for (const [host, want] of cases) assert.equal(sourceFromHost(host), want, host);
});

test("no utm and no referrer is direct; an unknown referrer is other", () => {
  assert.equal(normalizeSource(undefined), "direct");
  assert.equal(normalizeSource({}), "direct");
  assert.equal(normalizeSource({ landing_path: "/" }), "direct");
  assert.equal(normalizeSource({ referrer_host: "blog.example.com" }), "other");
});

test("labels are Arabic, unknown reads غير محدد", () => {
  assert.equal(sourceLabel("snapchat"), "سناب شات");
  assert.equal(sourceLabel(null), "غير محدد");
  assert.equal(sourceLabel("bogus"), "غير محدد");
});

// --- validation ------------------------------------------------------------

test("valid attribution passes the strict schema", () => {
  const ok = attributionSchema.safeParse({
    utm_source: "snapchat",
    utm_medium: "paid",
    utm_campaign: "launch-2026",
    referrer_host: "L.Instagram.com",
    landing_path: "/start/crm",
  });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.referrer_host, "l.instagram.com");
});

test("the schema rejects unknown keys, long strings and bad shapes", () => {
  const bad: unknown[] = [
    { utm_source: "x", extra: "nope" },
    { utm_source: "a".repeat(101) },
    { utm_campaign: "a".repeat(151) },
    { utm_source: "" },
    { utm_source: "<script>" },
    { utm_source: "line\nbreak" },
    { referrer_host: "not a host" },
    { referrer_host: "https://google.com" },
    { landing_path: "start" },
    { landing_path: "/has space" },
    { landing_path: `/${"a".repeat(300)}` },
    { utm_source: 42 },
  ];
  for (const b of bad) assert.equal(attributionSchema.safeParse(b).success, false, JSON.stringify(b));
});

test("sanitize keeps only valid fields", () => {
  assert.deepEqual(
    sanitizeAttribution({ utm_source: "snapchat", referrer_host: "bad host", junk: 1 }),
    { utm_source: "snapchat" },
  );
  assert.equal(sanitizeAttribution({ junk: 1 }), null);
  assert.equal(sanitizeAttribution("nope"), null);
});

// --- capture ---------------------------------------------------------------

test("landing capture reads utm params, external referrer host and path", () => {
  const a = attributionFromLanding(
    "https://deal.mubasat.net/?utm_source=snapchat&utm_campaign=launch",
    "https://www.snapchat.com/some/page",
  );
  assert.deepEqual(a, {
    utm_source: "snapchat",
    utm_campaign: "launch",
    referrer_host: "www.snapchat.com",
    landing_path: "/",
  });
  // Our own host is internal navigation, not a source.
  const internal = attributionFromLanding(
    "https://deal.mubasat.net/start/crm",
    "https://deal.mubasat.net/",
  );
  assert.deepEqual(internal, { landing_path: "/start/crm" });
});

test("first touch wins and expires after 30 days", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  const t0 = 1_800_000_000_000;
  captureFirstTouch({
    href: "https://deal.mubasat.net/?utm_source=snapchat",
    referrer: "",
    now: t0,
    local,
    session,
  });
  captureFirstTouch({
    href: "https://deal.mubasat.net/start",
    referrer: "https://www.google.com/",
    now: t0 + 1000,
    local,
    session,
  });
  assert.equal(storedFirstTouch({ now: t0 + 2000, local, session })?.utm_source, "snapchat");
  // Session storage alone still carries it (localStorage blocked/cleared).
  local.map.clear();
  assert.equal(storedFirstTouch({ now: t0 + 2000, local, session })?.utm_source, "snapchat");
  // Expired: a new landing becomes the first touch.
  const later = t0 + ATTRIBUTION_TTL_MS + 1;
  assert.equal(storedFirstTouch({ now: later, local, session }), null);
  assert.equal(session.map.has(ATTRIBUTION_KEY), false);
  captureFirstTouch({
    href: "https://deal.mubasat.net/",
    referrer: "https://www.google.com/",
    now: later,
    local,
    session,
  });
  assert.equal(
    normalizeSource(storedFirstTouch({ now: later + 1, local, session })),
    "google",
  );
});

test("capture survives unavailable or throwing storage", () => {
  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  };
  const a = captureFirstTouch({
    href: "https://deal.mubasat.net/?utm_source=tiktok",
    referrer: "",
    now: 1,
    local: throwing,
    session: null,
  });
  assert.equal(a.utm_source, "tiktok");
});
