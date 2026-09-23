/**
 * Arabic messages for the tenancy error codes (`WS:<code>`, thrown by
 * tenancy-core.ts and carried to the browser as the error message). Client-safe.
 */
const MESSAGES: Record<string, string> = {
  forbidden: "لا تملك صلاحية الوصول إلى هذا المكتب.",
  role: "هذا الإجراء يحتاج صلاحية أعلى في المكتب.",
  read_only: "المكتب موقوف حاليًا وهو للقراءة فقط. جدّد الاشتراك لإعادة التفعيل.",
  seat_limit: "وصلت إلى حد المقاعد في خطتك. رقِّ الخطة أو ألغِ دعوة معلّقة.",
  already_member: "صاحب هذا البريد عضو في المكتب بالفعل.",
  last_owner: "لا بد أن يبقى للمكتب مالك واحد على الأقل. عيّن مالكًا آخر أولًا.",
  not_member: "هذا الشخص لم يعد عضوًا في المكتب.",
  too_many: "وصلت إلى الحد الأقصى لعدد المكاتب في حسابك. تواصل معنا لزيادته.",
  invite_invalid: "رابط الدعوة غير صحيح.",
  invite_expired: "انتهت صلاحية الدعوة. اطلب من مدير المكتب دعوة جديدة.",
  invite_used: "استُخدمت هذه الدعوة من قبل.",
  invite_revoked: "ألغى المكتب هذه الدعوة.",
  email_mismatch: "هذه الدعوة لبريد آخر. ادخل بالبريد الذي وصلته الدعوة.",
  invoice_not_found: "طلب الدفع غير موجود.",
  not_found: "العنصر غير موجود.",
};

export function workspaceErrorCode(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = /^WS:([a-z_]+)$/.exec(msg);
  return m ? m[1] : null;
}

/** A human message for any error from the law-office server functions. */
export function workspaceErrorMessage(err: unknown): string {
  const code = workspaceErrorCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const msg = err instanceof Error ? err.message : "";
  if (msg === "Unauthorized") return "انتهت جلستك. سجّل الدخول مرة أخرى.";
  return "تعذّر إتمام الطلب. تحقق من الاتصال وحاول مرة أخرى.";
}
