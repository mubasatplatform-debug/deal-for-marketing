import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { TwoFactorState } from "./otp-core";

/**
 * Two-step sign-in over WhatsApp for «مكتب المحامي» members.
 *
 *   - Settings: enter a WhatsApp number → code → on (`sendEnrollCode`,
 *     `confirmEnroll`); off again with a fresh code (`disableTwoFactor`).
 *   - Every new session: a code to the saved number (`sendLoginCode`,
 *     `verifyLoginCode`) before any office data is served — enforced in
 *     `requireWorkspace` / `getAppContext`, not just by this UI.
 *
 * Sends are rate-limited per user; Twilio Verify also caps sends and attempts
 * per number. Codes never touch our database.
 */

export type { TwoFactorState };

const code = z.string().trim().regex(/^\d{6}$/);

async function ctx() {
  const [{ getSql }, { currentSessionId }, core, srv, rl] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/auth/verify.server"),
    import("./otp-core"),
    import("./otp.server"),
    import("@/lib/rate-limit.server"),
  ]);
  const sql = (await getSql()) as unknown as import("@/lib/saas/tenancy-core").SqlTag;
  return { sql, sessionId: currentSessionId(), core, sender: srv.otpSender(), rl };
}

type Ctx = Awaited<ReturnType<typeof ctx>>;

async function throttle(c: Ctx, key: string, limit: number, windowSeconds: number) {
  try {
    await c.rl.takeHit(key, limit, windowSeconds);
  } catch (err) {
    if (err instanceof c.rl.RateLimitError) throw new c.core.OtpError("rate_limited");
    throw err;
  }
}

function need(c: Ctx) {
  if (!c.sender) throw new c.core.OtpError("unavailable");
  return c.sender;
}

export const getTwoFactor = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TwoFactorState & { available: boolean }> => {
    const c = await ctx();
    const state = await c.core.twoFactorStateCore(c.sql, context.userId, c.sessionId);
    return { ...state, available: Boolean(c.sender) };
  });

/** A code to the saved number, for this session's sign-in. */
export const sendLoginCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ phone: string }> => {
    const c = await ctx();
    const phone = await c.core.enrolledPhoneCore(c.sql, context.userId);
    if (!phone) throw new c.core.OtpError("not_enabled");
    const sender = need(c);
    await throttle(c, `otp-send:${context.userId}`, 5, 900);
    await throttle(c, "otp-send:all", 1000, 86_400);
    await sender.start(phone);
    return { phone: c.core.maskPhone(phone) };
  });

export const verifyLoginCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ code }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const c = await ctx();
    const phone = await c.core.enrolledPhoneCore(c.sql, context.userId);
    if (!phone || !c.sessionId) throw new c.core.OtpError("not_enabled");
    const sender = need(c);
    await throttle(c, `otp-check:${context.userId}`, 10, 900);
    if (!(await sender.check(phone, data.code))) throw new c.core.OtpError("bad_code");
    await c.core.markSessionCore(c.sql, context.userId, c.sessionId);
    return { ok: true };
  });

/** Start turning it on (or changing the number): a code to the new number. */
export const sendEnrollCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ phone: z.string().max(40) }).parse(input))
  .handler(async ({ context, data }): Promise<{ phone: string }> => {
    const c = await ctx();
    const phone = c.core.whatsappPhone(data.phone);
    if (!phone) throw new c.core.OtpError("bad_phone");
    // Changing the number needs this session to have passed the current one.
    const state = await c.core.twoFactorStateCore(c.sql, context.userId, c.sessionId);
    if (state.enabled && !state.verified) throw new c.core.OtpError("not_enabled");
    // Only office members protect office data with it; without this, any new
    // account could send paid codes to arbitrary numbers.
    const [m] = await c.sql<{ n: number }>`select count(*)::int as n from workspace_members where user_id = ${context.userId}`;
    if (!m?.n) throw new c.core.OtpError("no_office");
    const sender = need(c);
    await throttle(c, `otp-send:${context.userId}`, 5, 900);
    await throttle(c, "otp-send:all", 1000, 86_400);
    await sender.start(phone);
    return { phone: c.core.maskPhone(phone) };
  });

export const confirmEnroll = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ phone: z.string().max(40), code }).parse(input))
  .handler(async ({ context, data }): Promise<TwoFactorState> => {
    const c = await ctx();
    const phone = c.core.whatsappPhone(data.phone);
    if (!phone) throw new c.core.OtpError("bad_phone");
    const state = await c.core.twoFactorStateCore(c.sql, context.userId, c.sessionId);
    if (state.enabled && !state.verified) throw new c.core.OtpError("not_enabled");
    const sender = need(c);
    await throttle(c, `otp-check:${context.userId}`, 10, 900);
    if (!(await sender.check(phone, data.code))) throw new c.core.OtpError("bad_code");
    await c.core.enableCore(c.sql, context.userId, phone, c.sessionId);
    return c.core.twoFactorStateCore(c.sql, context.userId, c.sessionId);
  });

/** Turn it off — needs a fresh code to the saved number. */
export const disableTwoFactor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ code }).parse(input))
  .handler(async ({ context, data }): Promise<TwoFactorState> => {
    const c = await ctx();
    const phone = await c.core.enrolledPhoneCore(c.sql, context.userId);
    if (!phone) throw new c.core.OtpError("not_enabled");
    const sender = need(c);
    await throttle(c, `otp-check:${context.userId}`, 10, 900);
    if (!(await sender.check(phone, data.code))) throw new c.core.OtpError("bad_code");
    await c.core.disableCore(c.sql, context.userId);
    return c.core.twoFactorStateCore(c.sql, context.userId, c.sessionId);
  });
