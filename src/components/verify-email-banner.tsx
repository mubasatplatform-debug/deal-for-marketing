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

  // One slim line: it sits above every dashboard page, so it must not crowd the work.
  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-pine/15 bg-pine-50 py-1.5 ps-3 pe-1 text-pine-deep"
    >
      <MailCheck className="size-4 shrink-0 text-pine" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        <strong className="font-bold">أكّد بريدك</strong>
        <span className="text-slate sm:hidden"> — الرابط في بريدك</span>{" "}
        <span className="hidden text-slate sm:inline">
          — أرسلنا الرابط إلى{" "}
          <span dir="ltr" className="font-ui font-semibold text-pine-deep">
            {email}
          </span>
        </span>
        {message ? <span className="ms-2 text-slate">· {message}</span> : null}
      </p>
      <button
        type="button"
        disabled={busy || remaining > 0}
        onClick={() => void resend()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-bold text-pine hover:bg-surface disabled:cursor-not-allowed disabled:text-slate"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
        {remaining > 0 ? `أعد الإرسال بعد ${remaining} ث` : "أعد الإرسال"}
      </button>
      <button
        type="button"
        aria-label="إخفاء تنبيه تأكيد البريد"
        onClick={dismiss}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-slate hover:bg-surface hover:text-pine-deep"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
