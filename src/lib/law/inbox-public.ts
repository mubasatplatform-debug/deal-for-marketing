import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { slugField } from "./schemas";
import type { VisitorPoll } from "./inbox-core";

/**
 * Public web-chat server functions (the widget on /o/<slug>/book) — no
 * account needed, like the booking functions in public.ts:
 *
 *   startChat → a new conversation + an unguessable visitor token;
 *   sendChat / pollChat → only with that token, only in that office.
 *
 * The token lives in the visitor's sessionStorage; the database keeps its
 * SHA-256. Writes are same-site only, throttled per visitor (hashed IP) and
 * per office per day; the start form carries a honeypot and a minimum fill
 * time. The AI first responder may only reply or hand off — no tool on this
 * side writes office data.
 */

const core = () => import("./inbox-core");

/** Messages the widget shows as-is (the server throws them). */
export const CHAT_ERRORS = {
  closed: "الدردشة غير متاحة لهذا المكتب حاليًا.",
  busy: "رسائل كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.",
  invalid: "راجع البيانات وأعد المحاولة.",
  phone: "رقم الجوال غير صحيح. مثال: 0501234567",
  tooFast: "أُرسل النموذج بسرعة كبيرة. أعد المحاولة.",
  gone: "انتهت هذه المحادثة. ابدأ محادثة جديدة.",
} as const;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const MIN_FILL_MS = 1500;
const AI_DAILY_CAP = () => Number(process.env.INBOX_AI_DAILY_CAP) || 200;

async function sameSite() {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  assertSameSiteRequest();
}

async function throttle(key: string, limit: number, windowSeconds: number, perVisitor = true) {
  const { takeHit, visitorId, RateLimitError } = await import("@/lib/rate-limit.server");
  try {
    await takeHit(perVisitor ? `${key}:${visitorId()}` : key, limit, windowSeconds);
  } catch (err) {
    if (err instanceof RateLimitError) throw new Error(CHAT_ERRORS.busy);
    throw err;
  }
}

async function sqlTag() {
  const { getSql } = await import("@/lib/db");
  return (await getSql()) as never;
}

async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

async function openOffice(slug: string) {
  const { chatOfficeCore } = await core();
  const office = await chatOfficeCore(await sqlTag(), slug);
  if (!office?.open) throw new Error(CHAT_ERRORS.closed);
  return office;
}

/** Let the AI answer when the conversation is in 'bot' (never throws). */
async function aiTurn(office: Awaited<ReturnType<typeof openOffice>>, conversationId: string) {
  try {
    const { aiFirstReplyCore } = await core();
    const { agentLlm } = await import("./agent/llm.server");
    const { bookingUrlFor } = await import("./consult.server");
    const { planHas } = await import("@/lib/saas/plans");
    await aiFirstReplyCore(await sqlTag(), office, conversationId, agentLlm(), {
      bookingUrl: office.hours.bookingEnabled ? bookingUrlFor(office.slug) : null,
      dailyCap: AI_DAILY_CAP(),
      aiAllowed: planHas(office.plan, "aiDrafting"),
    });
  } catch (err) {
    console.error("[inbox] AI first reply failed:", err);
  }
}

export type ChatStart = VisitorPoll & { token: string };

export const startChat = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const r = z
      .object({
        slug: slugField,
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).nullish(),
        message: z.string().trim().min(1).max(2000),
        website: z.string().max(200).optional(),
        fillMs: z.number().int().min(0).max(86_400_000),
      })
      .safeParse(input);
    if (!r.success) throw new Error(CHAT_ERRORS.invalid);
    return r.data;
  })
  .handler(async ({ data }): Promise<ChatStart> => {
    await sameSite();
    const { randomBytes } = await import("node:crypto");
    // Only bots fill the honeypot: a convincing answer, nothing stored.
    if (data.website) {
      return { token: randomBytes(32).toString("base64url"), status: "open", messages: [], serverNow: new Date().toISOString() };
    }
    if (data.fillMs < MIN_FILL_MS) throw new Error(CHAT_ERRORS.tooFast);
    const { normalizePhone } = await import("@/lib/phone");
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new Error(CHAT_ERRORS.phone);
    await throttle("chat-start", 5, 3600);
    const office = await openOffice(data.slug);
    await throttle(`chat-start-office:${office.id}`, 300, 86_400, false);
    const { startChatCore, visitorPollCore } = await core();
    const { planHas } = await import("@/lib/saas/plans");
    const { agentLlm } = await import("./agent/llm.server");
    const aiFirst = office.settings.aiFirstReply && planHas(office.plan, "aiDrafting") && agentLlm() !== null;
    const token = randomBytes(32).toString("base64url");
    const sql = await sqlTag();
    const conv = await startChatCore(sql, office, { name: data.name, phone, message: data.message, tokenHash: await hashToken(token) }, { aiFirst });
    if (conv.status === "bot") await aiTurn(office, conv.id);
    return { token, ...(await visitorPollCore(sql, conv, null)) };
  });

async function visitorConv(slug: string, token: string) {
  const office = await openOffice(slug);
  const { visitorConversationCore } = await core();
  const conv = await visitorConversationCore(await sqlTag(), office.id, await hashToken(token));
  return { office, conv };
}

const tokenInput = z.object({ slug: slugField, token: z.string().regex(TOKEN_RE) });

export const sendChat = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const r = tokenInput.extend({ message: z.string().trim().min(1).max(2000), since: z.string().datetime().nullish() }).safeParse(input);
    if (!r.success) throw new Error(CHAT_ERRORS.invalid);
    return r.data;
  })
  .handler(async ({ data }): Promise<VisitorPoll> => {
    await sameSite();
    await throttle("chat-send", 30, 600);
    const { office, conv } = await visitorConv(data.slug, data.token);
    if (!conv) throw new Error(CHAT_ERRORS.gone);
    await throttle(`chat-send-office:${office.id}`, 5000, 86_400, false);
    const { visitorSendCore, visitorPollCore } = await core();
    const sql = await sqlTag();
    const after = await visitorSendCore(sql, conv, data.message);
    if (after.status === "bot") await aiTurn(office, conv.id);
    return visitorPollCore(sql, after, data.since ?? null);
  });

/** New messages since `since` (null: the latest 100). Null when the token is unknown. */
export const pollChat = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const r = tokenInput.extend({ since: z.string().datetime().nullish() }).safeParse(input);
    if (!r.success) throw new Error(CHAT_ERRORS.invalid);
    return r.data;
  })
  .handler(async ({ data }): Promise<VisitorPoll | null> => {
    await sameSite();
    await throttle("chat-poll", 1500, 3600);
    const { conv } = await visitorConv(data.slug, data.token);
    if (!conv) return null;
    const { visitorPollCore } = await core();
    return visitorPollCore(await sqlTag(), conv, data.since ?? null);
  });
