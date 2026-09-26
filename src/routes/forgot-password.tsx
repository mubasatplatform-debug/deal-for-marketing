import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { AuthCard, authButtonClass, authFieldClass } from "@/components/auth-card";
import { requestPasswordReset } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { pageHead } from "@/lib/seo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const Route = createFileRoute("/forgot-password")({
  head: () => pageHead({ title: "استعادة كلمة المرور", noindex: true }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value))
      return setErr("اكتب بريدك الإلكتروني بصيغة صحيحة، مثال: name@company.sa");
    setErr("");
    setBusy(true);
    const problem = await requestPasswordReset(value);
    setBusy(false);
    if (problem) return setErr(problem);
    setSentTo(value);
  }

  if (!emailAndPasswordEnabled) {
    return (
      <AuthCard title="لا تحتاج كلمة مرور" subtitle="الدخول إلى ديل يتم بحساب Google أو X مباشرة، بدون كلمة مرور.">
        <a href="/login" className={authButtonClass}>
          الذهاب لتسجيل الدخول
        </a>
      </AuthCard>
    );
  }

  if (sentTo) {
    return (
      <AuthCard title="تحقق من بريدك">
        <div className="flex gap-3 rounded-xl bg-pine-50 p-4 text-[15px] leading-relaxed">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-pine" aria-hidden="true" />
          <p role="status">
            إن كان{" "}
            <span className="font-semibold" dir="ltr">
              {sentTo}
            </span>{" "}
            مسجّلًا لدينا فستصلك رسالة فيها رابط لتعيين كلمة مرور جديدة خلال دقائق. الرابط صالح
            لساعة واحدة.
          </p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate">
          لم تصلك؟ تفقّد مجلد الرسائل غير المرغوبة، أو{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="inline-flex min-h-11 items-center font-semibold text-pine underline-offset-4 hover:underline"
          >
            أرسل الرابط مرة أخرى
          </button>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="نسيت كلمة المرور؟"
      subtitle="اكتب بريدك المسجّل وسنرسل لك رابطًا لتعيين كلمة مرور جديدة."
    >
      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="mb-1.5 block text-sm font-semibold">
            البريد الإلكتروني
          </label>
          <input
            id="reset-email"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(err)}
            aria-describedby={err ? "reset-email-err" : undefined}
            placeholder="name@company.sa"
            className={authFieldClass}
          />
          {err ? (
            <p id="reset-email-err" role="alert" className="mt-1.5 text-[13px] text-red-700">
              {err}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={busy} className={authButtonClass}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "جارٍ الإرسال…" : "أرسل رابط الاستعادة"}
        </button>
      </form>
    </AuthCard>
  );
}
