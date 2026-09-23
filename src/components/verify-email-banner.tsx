import { useEffect, useState } from "react";
import { Loader2, MailCheck, X } from "lucide-react";
import { sendAccountVerificationEmail } from "@/lib/auth/client";
import {
  emailVerificationCooldownRemainingSeconds,
  safeEmailVerificationCallback,
} from "@/lib/auth/email-verification";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const DISMISS_KEY = "deal.verify-email-banner.dismissed";

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* storage unavailable — ignore */
  }
}

export function VerifyEmailBanner() {
  const { user, isPending } = useCurrentUserState();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const email = user?.primaryEmail;
  const remaining = emailVerificationCooldownRemainingSeconds(now, lastSentAt);

  useEffect(() => setDismissed(readDismissed()), []);

  useEffect(() => {
    if (!lastSentAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastSentAt]);

  if (isPending || dismissed || !email || user?.emailVerified !== false) return null;

  async function resend() {
    if (!email || busy || remaining > 0) return;
    setBusy(true);
    setMessage("");
    const callbackURL = safeEmailVerificationCallback(
      `${window.location.pathname}${window.location.search}`,
      window.location.origin,
    );
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

  function dismiss() {
    writeDismissed();
    setDismissed(true);
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-pine/15 bg-pine-50 px-4 py-3 text-pine-deep shadow-sm sm:px-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-pine">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">أكّد بريدك الإلكتروني لحماية حسابك.</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-slate">
            أرسلنا رابط التأكيد إلى{" "}
            <span dir="ltr" className="font-ui font-semibold text-pine-deep">
              {email}
            </span>
            .
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              disabled={busy || remaining > 0}
              onClick={() => void resend()}
              className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-pine underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate disabled:no-underline"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {remaining > 0 ? `أعد الإرسال بعد ${remaining} ث` : "أعد إرسال رابط التأكيد"}
            </button>
            {message ? <span className="text-[13px] text-slate">{message}</span> : null}
          </div>
        </div>
        <button
          type="button"
          aria-label="إخفاء تنبيه تأكيد البريد"
          onClick={dismiss}
          className="-ms-1 grid size-11 shrink-0 place-items-center rounded-xl text-slate hover:bg-surface hover:text-pine-deep"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
