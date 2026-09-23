import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CircleCheck, Loader2 } from "lucide-react";
import { AuthCard, authButtonClass } from "@/components/auth-card";
import { sendAccountVerificationEmail } from "@/lib/auth/client";
import {
  emailVerificationCooldownRemainingSeconds,
  safeEmailVerificationCallback,
} from "@/lib/auth/email-verification";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/seo";

type VerifySearch = {
  token?: string;
  callbackURL: string;
  verified?: boolean;
  error?: string;
};

export const Route = createFileRoute("/verify-email")({
  head: () => pageHead({ title: "تأكيد البريد الإلكتروني", noindex: true }),
  validateSearch: (search: Record<string, unknown>): VerifySearch => ({
    token:
      typeof search.token === "string" && /^[A-Za-z0-9_.-]{20,2000}$/.test(search.token)
        ? search.token
        : undefined,
    callbackURL: safeEmailVerificationCallback(search.callbackURL),
    verified: search.verified === "1" || search.verified === "true",
    error: typeof search.error === "string" ? search.error.slice(0, 60) : undefined,
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { token, callbackURL, verified, error } = Route.useSearch();

  useEffect(() => {
    if (!token || verified || error) return;
    const back = `/verify-email?verified=1&callbackURL=${encodeURIComponent(callbackURL)}`;
    const params = new URLSearchParams({ token, callbackURL: back });
    window.location.replace(`/api/auth/verify-email?${params.toString()}`);
  }, [token, callbackURL, verified, error]);

  if (error || (!token && !verified)) {
    return (
      <AuthCard title="الرابط غير صالح أو منتهي الصلاحية">
        <div className="flex gap-3 rounded-xl bg-red-50 p-4 text-[15px] leading-relaxed text-red-900">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
          <p role="alert">الرابط غير صالح أو منتهي الصلاحية. اطلب رابط تأكيد جديد من حسابك.</p>
        </div>
        <ResendVerification callbackURL={callbackURL} />
      </AuthCard>
    );
  }

  if (verified) {
    return (
      <AuthCard title="تم تأكيد بريدك">
        <div className="flex gap-3 rounded-xl bg-pine-50 p-4 text-[15px] leading-relaxed">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-pine" aria-hidden="true" />
          <p role="status">
            بريدك الإلكتروني مؤكد الآن. يمكنك المتابعة لحسابك ومتابعة طلباتك بأمان.
          </p>
        </div>
        <a href={callbackURL} className={`${authButtonClass} mt-5`}>
          المتابعة إلى الحساب
        </a>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="جارٍ تأكيد البريد الإلكتروني" subtitle="ثوانٍ قليلة وننهي تأكيد حسابك.">
      <div className="grid min-h-24 place-items-center" aria-busy="true" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
        <span className="sr-only">جارٍ تأكيد البريد الإلكتروني…</span>
      </div>
    </AuthCard>
  );
}

function ResendVerification({ callbackURL }: { callbackURL: string }) {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const email = user?.primaryEmail;
  const remaining = emailVerificationCooldownRemainingSeconds(now, lastSentAt);

  useEffect(() => {
    if (!lastSentAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastSentAt]);

  if (isPending) return null;
  if (!email || user?.emailVerified !== false) {
    return (
      <a href="/login" className={`${authButtonClass} mt-5`}>
        تسجيل الدخول
      </a>
    );
  }

  async function resend() {
    if (!email || busy || remaining > 0) return;
    setBusy(true);
    setMessage("");
    const problem = await sendAccountVerificationEmail(email, callbackURL).catch(
      () => "تعذر الاتصال، حاول مرة أخرى.",
    );
    setBusy(false);
    if (problem) {
      setMessage(problem);
      return;
    }
    setLastSentAt(Date.now());
    setNow(Date.now());
    setMessage("أرسلنا رابط تأكيد جديد إلى بريدك.");
  }

  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        disabled={busy || remaining > 0}
        onClick={() => void resend()}
        className={authButtonClass}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {remaining > 0 ? `أعد الإرسال بعد ${remaining} ث` : "أعد إرسال رابط التأكيد"}
      </button>
      {message ? <p className="text-center text-sm leading-relaxed text-slate">{message}</p> : null}
    </div>
  );
}
