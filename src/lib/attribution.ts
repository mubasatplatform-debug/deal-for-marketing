import { z } from "zod";

/**
 * First-touch lead attribution — shared by the browser (capture) and the
 * server (validation + normalization). No cookies, no third-party scripts:
 * the landing URL's utm_* parameters, the referring site's host and the
 * landing path are kept in web storage for 30 days, first touch wins, and
 * sent along with a lead.
 */

export const ATTRIBUTION_KEY = "deal-first-touch";
export const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const LEAD_SOURCES = [
  "snapchat",
  "instagram",
  "tiktok",
  "x",
  "google",
  "whatsapp",
  "linkedin",
  "direct",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const sourceLabels: Record<LeadSource, string> = {
  snapchat: "سناب شات",
  instagram: "إنستقرام",
  tiktok: "تيك توك",
  x: "إكس",
  google: "قوقل",
  whatsapp: "واتساب",
  linkedin: "لينكدإن",
  direct: "مباشر",
  other: "أخرى",
};

/** Label for a stored source; null/unknown values read "غير محدد". */
export function sourceLabel(source: string | null | undefined): string {
  return source && source in sourceLabels ? sourceLabels[source as LeadSource] : "غير محدد";
}

export const ATTRIBUTION_LIMITS = {
  utm: 100,
  campaign: 150,
  host: 253,
  path: 300,
} as const;

/** Printable text only: no control characters, no angle brackets. */
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\p{Cc}<>]+$/u, "invalid characters");

const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(ATTRIBUTION_LIMITS.host)
  .regex(/^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*$/, "invalid host");

const pathSchema = z
  .string()
  .max(ATTRIBUTION_LIMITS.path)
  .regex(/^\/[^\s\p{Cc}<>]*$/u, "invalid path");

/** What the browser sends with a lead. Unknown keys are rejected. */
export const attributionSchema = z
  .object({
    utm_source: safeText(ATTRIBUTION_LIMITS.utm).optional(),
    utm_medium: safeText(ATTRIBUTION_LIMITS.utm).optional(),
    utm_campaign: safeText(ATTRIBUTION_LIMITS.campaign).optional(),
    referrer_host: hostSchema.optional(),
    landing_path: pathSchema.optional(),
  })
  .strict();

export type Attribution = z.infer<typeof attributionSchema>;

const UTM_ALIASES: Record<string, LeadSource> = {
  snapchat: "snapchat",
  snap: "snapchat",
  sc: "snapchat",
  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  x: "x",
  twitter: "x",
  "t.co": "x",
  google: "google",
  "google-ads": "google",
  google_ads: "google",
  googleads: "google",
  adwords: "google",
  gads: "google",
  whatsapp: "whatsapp",
  wa: "whatsapp",
  linkedin: "linkedin",
  li: "linkedin",
  direct: "direct",
};

/** Map a referring host to a source; null when it is not a known network. */
export function sourceFromHost(rawHost: string): LeadSource | null {
  const host = rawHost.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is("snapchat.com")) return "snapchat";
  if (is("instagram.com")) return "instagram";
  if (is("tiktok.com")) return "tiktok";
  if (host === "t.co" || is("x.com") || is("twitter.com")) return "x";
  if (/(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) || is("googleadservices.com"))
    return "google";
  if (host === "wa.me" || is("whatsapp.com")) return "whatsapp";
  if (is("linkedin.com") || host === "lnkd.in") return "linkedin";
  return null;
}

/**
 * The normalized source for a lead: utm_source first, else the referring
 * host, else "direct". Anything present but unrecognized is "other".
 */
export function normalizeSource(a: Attribution | null | undefined): LeadSource {
  const utm = a?.utm_source?.trim().toLowerCase();
  if (utm) {
    const key = utm.replace(/\s+/g, "_");
    return UTM_ALIASES[key] ?? sourceFromHost(utm) ?? "other";
  }
  const host = a?.referrer_host?.trim();
  if (host) return sourceFromHost(host) ?? "other";
  return "direct";
}

// ---------------------------------------------------------------------------
// Capture (browser)

type Stored = { v: 1; at: number; data: Attribution };

const clip = (v: string | null, max: number) => {
  const s = v?.trim();
  return s ? s.slice(0, max) : undefined;
};

/**
 * First-touch data for a landing, from its URL and `document.referrer`.
 * A referrer on our own host is internal navigation, not a source.
 */
export function attributionFromLanding(href: string, referrer: string): Attribution {
  const url = new URL(href);
  const p = url.searchParams;
  let referrerHost: string | undefined;
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r && /^https?:$/.test(r.protocol) && r.hostname !== url.hostname) {
      referrerHost = r.hostname.toLowerCase();
    }
  } catch {
    /* malformed referrer: ignore */
  }
  const raw: Record<string, string | undefined> = {
    utm_source: clip(p.get("utm_source"), ATTRIBUTION_LIMITS.utm),
    utm_medium: clip(p.get("utm_medium"), ATTRIBUTION_LIMITS.utm),
    utm_campaign: clip(p.get("utm_campaign"), ATTRIBUTION_LIMITS.campaign),
    referrer_host: referrerHost,
    landing_path: clip(url.pathname, ATTRIBUTION_LIMITS.path),
  };
  return sanitizeAttribution(raw) ?? {};
}

/** Keep only the fields that validate; null when nothing usable is left. */
export function sanitizeAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const out: Record<string, string> = {};
  const shape = attributionSchema.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const res = shape[key].safeParse((input as Record<string, unknown>)[key]);
    if (res.success && res.data) out[key] = res.data;
  }
  return Object.keys(out).length ? (out as Attribution) : null;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function readStored(storage: StorageLike | null, now: number): Attribution | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (s?.v !== 1 || typeof s.at !== "number" || now - s.at > ATTRIBUTION_TTL_MS || s.at > now) {
      storage.removeItem(ATTRIBUTION_KEY);
      return null;
    }
    return sanitizeAttribution(s.data);
  } catch {
    return null;
  }
}

/**
 * Record the first touch unless an unexpired one is already stored (in either
 * storage). Returns the attribution in effect.
 */
export function captureFirstTouch(opts: {
  href: string;
  referrer: string;
  now: number;
  local: StorageLike | null;
  session: StorageLike | null;
}): Attribution {
  const existing = readStored(opts.local, opts.now) ?? readStored(opts.session, opts.now);
  if (existing) return existing;
  const data = attributionFromLanding(opts.href, opts.referrer);
  const value = JSON.stringify({ v: 1, at: opts.now, data } satisfies Stored);
  for (const s of [opts.local, opts.session]) {
    try {
      s?.setItem(ATTRIBUTION_KEY, value);
    } catch {
      /* storage full or blocked */
    }
  }
  return data;
}

/** The stored first touch, if any and unexpired. */
export function storedFirstTouch(opts: {
  now: number;
  local: StorageLike | null;
  session: StorageLike | null;
}): Attribution | null {
  return readStored(opts.local, opts.now) ?? readStored(opts.session, opts.now);
}

const safeStorage = (get: () => Storage): StorageLike | null => {
  try {
    return get();
  } catch {
    return null;
  }
};

let capturedThisLoad = false;

/**
 * Browser wrapper for the public site. Runs once per page load: after a
 * client-side navigation the URL is ours and `document.referrer` still names
 * the original site, which would misattribute the landing.
 */
export function captureFromBrowser(): void {
  if (typeof window === "undefined" || capturedThisLoad) return;
  capturedThisLoad = true;
  captureFirstTouch({
    href: window.location.href,
    referrer: document.referrer,
    now: Date.now(),
    local: safeStorage(() => window.localStorage),
    session: safeStorage(() => window.sessionStorage),
  });
}

/** Browser wrapper: the attribution to send with a lead (undefined if none). */
export function attributionForLead(): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    storedFirstTouch({
      now: Date.now(),
      local: safeStorage(() => window.localStorage),
      session: safeStorage(() => window.sessionStorage),
    }) ?? undefined
  );
}
