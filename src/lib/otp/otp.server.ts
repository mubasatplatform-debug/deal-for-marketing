import { getSql } from "@/lib/db";
import { currentSessionId } from "@/lib/auth/verify.server";
import { WorkspaceError, type SqlTag } from "@/lib/saas/tenancy-core";
import { devSender, relaySender, secondFactorMissingCore, type Sender } from "./otp-core";

/**
 * WhatsApp codes — **server-only** wiring.
 *
 *   - `OTP_RELAY_URL` + `OTP_RELAY_TOKEN` set → the `deal-otp` relay (Twilio
 *     Verify over WhatsApp).
 *   - Neither set, outside production → a dev sender (code 000000, nothing
 *     sent), so local runs and tests work.
 *   - Neither set in production → null: WhatsApp checks are off (booking works
 *     without them; two-step sign-in can't be turned on).
 */
export function otpSender(): Sender | null {
  const url = process.env.OTP_RELAY_URL?.trim();
  const token = process.env.OTP_RELAY_TOKEN?.trim();
  if (url && token) return relaySender(url, token);
  if (process.env.NODE_ENV !== "production") return devSender();
  return null;
}

/**
 * Booking-form phone checks: on when a sender exists and, in production,
 * `OTP_BOOKING=on` — so client bookings never depend on WhatsApp delivery
 * before it has been proven on the live sender.
 */
export function bookingOtpSender(): Sender | null {
  const sender = otpSender();
  if (!sender) return null;
  if (process.env.NODE_ENV === "production" && process.env.OTP_BOOKING?.trim() !== "on") return null;
  return sender;
}

/**
 * The office-data half of two-step sign-in: a session that has not passed its
 * WhatsApp code gets `WS:otp_required`. API-key requests (MCP) carry no
 * session and are not affected — the key is their credential.
 */
export async function assertSecondFactor(userId: string): Promise<void> {
  const sessionId = currentSessionId();
  if (!sessionId) return;
  const sql = (await getSql()) as unknown as SqlTag;
  if (await secondFactorMissingCore(sql, userId, sessionId)) throw new WorkspaceError("otp_required", 403);
}
