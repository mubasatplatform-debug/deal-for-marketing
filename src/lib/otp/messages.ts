/** WhatsApp-code error codes and their Arabic messages (`OTP:<code>`). Client-safe. */

export type OtpErrorCode = "bad_phone" | "rate_limited" | "send_failed" | "bad_code" | "unavailable" | "not_enabled" | "no_office";

/** Arabic messages the pages show for `OTP:<code>` errors. Client-safe. */
export const OTP_MESSAGES: Record<OtpErrorCode, string> = {
  bad_phone: "أدخل رقم جوال صحيحًا. مثال: 0501234567",
  rate_limited: "طلبت رموزًا كثيرة خلال وقت قصير. انتظر بضع دقائق ثم حاول مجددًا.",
  send_failed: "تعذّر إرسال الرمز. تأكد من الرقم وحاول بعد لحظات.",
  bad_code: "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.",
  unavailable: "التحقق برمز الجوال غير متاح حاليًا.",
  not_enabled: "التحقق بخطوتين غير مفعّل لهذا الحساب.",
  no_office: "التحقق بخطوتين متاح لأعضاء المكاتب. أنشئ مكتبك أو اقبل دعوة أولًا.",
};

export function otpErrorCode(err: unknown): OtpErrorCode | null {
  const msg = err instanceof Error ? err.message : "";
  const m = /^OTP:([a-z_]+)$/.exec(msg);
  return m && m[1] in OTP_MESSAGES ? (m[1] as OtpErrorCode) : null;
}
