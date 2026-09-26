/**
 * WhatsApp one-time codes — the pure core (no framework imports), shared by
 * the server functions and the tests.
 *
 * Codes are sent and checked by Twilio Verify through the `deal-otp` relay
 * (Supabase edge function; Twilio keys stay in its vault). This module only
 * knows a `Sender`: start a code for a phone, check a code for a phone.
 */
import { createHash } from "node:crypto";
import { normalizePhone } from "../phone.ts";
import type { SqlTag } from "../saas/tenancy-core.ts";
import type { OtpErrorCode } from "./messages.ts";

export { OTP_MESSAGES, otpErrorCode, type OtpErrorCode } from "./messages.ts";

export type Sender = {
  start(phone: string): Promise<void>;
  check(phone: string, code: string): Promise<boolean>;
};

export class OtpError extends Error {
  code: OtpErrorCode;
  constructor(code: OtpErrorCode) {
    super(`OTP:${code}`);
    this.name = "OtpError";
    this.code = code;
  }
}

/**
 * A phone that can receive WhatsApp, in E.164. Saudi numbers must be mobiles
 * (+9665XXXXXXXX) — landlines have no WhatsApp; other countries pass as typed.
 */
export function whatsappPhone(input: string): string | null {
  const e164 = normalizePhone(input);
  if (!e164) return null;
  if (e164.startsWith("+966") && !/^\+9665\d{8}$/.test(e164)) return null;
  return e164;
}

/** "+966501234591" → "+966 5•• ••• •91" (enough to recognise, not to reuse). */
export function maskPhone(e164: string): string {
  const tail = e164.slice(-2);
  if (e164.startsWith("+966")) return `+966 5•• ••• •${tail}`;
  return `${e164.slice(0, 3)}•••••${tail}`;
}

export const CODE_RE = /^\d{6}$/;

/* ------------------------------------------------------------------------ */
/* Senders                                                                   */
/* ------------------------------------------------------------------------ */

/** The production sender: the `deal-otp` relay (channel pinned to WhatsApp). */
export function relaySender(url: string, token: string, fetchImpl: typeof fetch = fetch): Sender {
  async function call(body: Record<string, string>): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new OtpError("send_failed");
    }
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 429) throw new OtpError("rate_limited");
    if (res.status === 422) throw new OtpError(body.action === "check" ? "bad_code" : "bad_phone");
    if (!res.ok) {
      console.error("[otp] relay", res.status, out.code ?? out.error);
      throw new OtpError("send_failed");
    }
    return out;
  }
  return {
    async start(phone) {
      await call({ action: "start", to: phone });
    },
    async check(phone, code) {
      const out = await call({ action: "check", to: phone, code });
      return out.approved === true;
    },
  };
}

/** Local development only: nothing is sent and the code is always 000000. */
export const DEV_CODE = "000000";
export function devSender(): Sender {
  return {
    async start(phone) {
      console.info(`[otp] dev mode — code for ${phone} is ${DEV_CODE}`);
    },
    async check(_phone, code) {
      return code === DEV_CODE;
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Two-step sign-in                                                          */
/* ------------------------------------------------------------------------ */

export type TwoFactorState = {
  enabled: boolean;
  /** Masked number the codes go to, when enabled. */
  phone: string | null;
  /** This session already passed a code. */
  verified: boolean;
};

export async function twoFactorStateCore(sql: SqlTag, userId: string, sessionId: string | null): Promise<TwoFactorState> {
  const rows = await sql.query<{ phone: string; verified: boolean }>(
    `select t.phone, exists(select 1 from session_second_factor s where s.session_id = $2 and s.user_id = $1) as verified
     from user_whatsapp_2fa t where t.user_id = $1`,
    [userId, sessionId ?? ""],
  );
  const row = rows[0];
  if (!row) return { enabled: false, phone: null, verified: true };
  return { enabled: true, phone: maskPhone(row.phone), verified: Boolean(row.verified) };
}

/** True when this user has two-step sign-in and this session has not passed it. */
export async function secondFactorMissingCore(sql: SqlTag, userId: string, sessionId: string): Promise<boolean> {
  const rows = await sql.query<{ missing: boolean }>(
    `select exists(select 1 from user_whatsapp_2fa where user_id = $1)
        and not exists(select 1 from session_second_factor where session_id = $2 and user_id = $1) as missing`,
    [userId, sessionId],
  );
  return Boolean(rows[0]?.missing);
}

export async function enrolledPhoneCore(sql: SqlTag, userId: string): Promise<string | null> {
  const rows = await sql.query<{ phone: string }>(`select phone from user_whatsapp_2fa where user_id = $1`, [userId]);
  return rows[0]?.phone ?? null;
}

/** The session passed a code (idempotent). */
export async function markSessionCore(sql: SqlTag, userId: string, sessionId: string): Promise<void> {
  await sql.query(
    `insert into session_second_factor (session_id, user_id) values ($1, $2)
     on conflict (session_id) do update set verified_at = now()
     where session_second_factor.user_id = excluded.user_id`,
    [sessionId, userId],
  );
}

/** Turn two-step sign-in on for a number that just passed a code. */
export async function enableCore(sql: SqlTag, userId: string, phone: string, sessionId: string | null): Promise<void> {
  await sql.query(
    `insert into user_whatsapp_2fa (user_id, phone) values ($1, $2)
     on conflict (user_id) do update set phone = excluded.phone, enabled_at = now()`,
    [userId, phone],
  );
  // Other sessions must pass the new number; this one just did.
  await sql.query(`delete from session_second_factor where user_id = $1`, [userId]);
  if (sessionId) await markSessionCore(sql, userId, sessionId);
}

export async function disableCore(sql: SqlTag, userId: string): Promise<void> {
  await sql.query(`delete from user_whatsapp_2fa where user_id = $1`, [userId]);
  await sql.query(`delete from session_second_factor where user_id = $1`, [userId]);
}

/* ------------------------------------------------------------------------ */
/* Booking-form phone checks                                                 */
/* ------------------------------------------------------------------------ */

const hashKey = (scope: string, phone: string, visitor: string) =>
  createHash("sha256").update(`${scope}|${phone}|${visitor}`).digest("hex");

/** Remember that `visitor` proved `phone` for `minutes`. */
export async function rememberPhoneCore(sql: SqlTag, scope: string, phone: string, visitor: string, minutes = 30): Promise<void> {
  await sql.query(`delete from verified_phones where expires_at < now()`);
  await sql.query(
    `insert into verified_phones (key, expires_at) values ($1, now() + ($2 || ' minutes')::interval)
     on conflict (key) do update set expires_at = excluded.expires_at`,
    [hashKey(scope, phone, visitor), String(minutes)],
  );
}

export async function phoneRememberedCore(sql: SqlTag, scope: string, phone: string, visitor: string): Promise<boolean> {
  const rows = await sql.query<{ ok: boolean }>(
    `select exists(select 1 from verified_phones where key = $1 and expires_at > now()) as ok`,
    [hashKey(scope, phone, visitor)],
  );
  return Boolean(rows[0]?.ok);
}
