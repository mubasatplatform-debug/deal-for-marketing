import { useEffect, useId, useState, type FormEvent } from "react";
import { Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Pill } from "@/components/dash/ui";
import { CodeInput, Resend, SentTo } from "@/components/otp/code-input";
import { TextInput } from "@/components/law/fields";
import { toLatinDigits } from "@/components/law/office-options";
import { OTP_MESSAGES, otpErrorCode } from "@/lib/otp/messages";
import {
  confirmEnroll,
  disableTwoFactor,
  getTwoFactor,
  sendEnrollCode,
  sendLoginCode,
  verifyLoginCode,
  type TwoFactorState,
} from "@/lib/otp/two-factor";

/**
 * Two-step sign-in over WhatsApp: the gate a new session passes before the
 * office opens, and the settings card that turns it on or off.
 */

function otpMessage(err: unknown, fallback = "تعذّر إتمام الطلب. حاول مرة أخرى."): string {
  const code = otpErrorCode(err);
  if (code) return OTP_MESSAGES[code];
  const msg = err instanceof Error ? err.message : "";
  return /[؀-ۿ]/.test(msg) ? msg : fallback;
}

/* ------------------------------------------------------------------------ */
/* Gate                                                                      */
/* ------------------------------------------------------------------------ */

export function TwoFactorGate({ onPassed, onSignOut }: { onPassed: () => void; onSignOut?: () => void }) {
  const uid = useId();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const r = await sendLoginCode();
      setSentTo(r.phone);
      setCode("");
    } catch (err) {
      setError(otpMessage(err, "تعذّر إرسال الرمز. حاول مرة أخرى."));
    } finally {
      setSending(false);
    }
  }

  // One code on arrival; resends are the person's choice.
  useEffect(() => {
    void send();
  }, []);

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (code.length !== 6) {
      setError("أدخل الرمز المكوّن من ٦ أرقام.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyLoginCode({ data: { code } });
      onPassed();
    } catch (err) {
      setError(otpMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={verify} noValidate className="text-start">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
        <ShieldCheck className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-center text-xl font-extrabold">التحقق بخطوتين</h1>
      <p className="mt-2 text-center text-sm leading-6 text-slate">حسابك محمي برمز يصل جوالك عند كل دخول جديد.</p>
      <div className="mt-6 space-y-3">
        {sentTo ? (
          <SentTo phone={sentTo} />
        ) : sending ? (
          <p className="flex items-center gap-2 text-sm text-slate">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            جارٍ إرسال الرمز…
          </p>
        ) : null}
        <label htmlFor={`${uid}-code`} className="sr-only">
          رمز التحقق
        </label>
        <CodeInput
          id={`${uid}-code`}
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          invalid={Boolean(error)}
          describedBy={error ? `${uid}-err` : undefined}
          autoFocus
        />
        {error ? (
          <p id={`${uid}-err`} role="alert" className="text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep transition-colors hover:bg-[#b3bf28] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "جارٍ التحقق…" : "دخول"}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Resend onResend={() => void send()} busy={sending} />
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              تسجيل الخروج
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Settings card                                                             */
/* ------------------------------------------------------------------------ */

type Step = { kind: "idle" } | { kind: "phone" } | { kind: "code"; phone: string; sentTo: string } | { kind: "disable"; sentTo: string };

export function TwoFactorCard() {
  const uid = useId();
  const [state, setState] = useState<(TwoFactorState & { available: boolean }) | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTwoFactor()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state) return null;

  const reset = () => {
    setStep({ kind: "idle" });
    setCode("");
    setError(null);
  };

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(otpMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const sendEnroll = () =>
    run(async () => {
      const r = await sendEnrollCode({ data: { phone: phone.trim() } });
      setStep({ kind: "code", phone: phone.trim(), sentTo: r.phone });
      setCode("");
    });

  const sendDisable = () =>
    run(async () => {
      const r = await sendLoginCode();
      setStep({ kind: "disable", sentTo: r.phone });
      setCode("");
    });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step.kind === "phone") return void sendEnroll();
    if (code.length !== 6) return setError("أدخل الرمز المكوّن من ٦ أرقام.");
    if (step.kind === "code")
      return void run(async () => {
        const s = await confirmEnroll({ data: { phone: step.phone, code } });
        setState({ ...s, available: state!.available });
        reset();
        toast.success("فُعّل التحقق بخطوتين.");
      });
    if (step.kind === "disable")
      return void run(async () => {
        const s = await disableTwoFactor({ data: { code } });
        setState({ ...s, available: state!.available });
        reset();
        toast.success("أُوقف التحقق بخطوتين.");
      });
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[15px] font-bold">
          <Smartphone className="size-[18px] text-pine" aria-hidden="true" />
          التحقق بخطوتين
        </p>
        <Pill tone={state.enabled ? "pine" : "neutral"}>{state.enabled ? "مفعّل" : "غير مفعّل"}</Pill>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate">
        {state.enabled ? (
          <>
            يصلك رمز على جوالك{" "}
            <span dir="ltr" className="inline-block font-ui font-semibold whitespace-nowrap text-pine-deep">
              {state.phone}
            </span>{" "}
            عند كل دخول من جهاز أو جلسة جديدة.
          </>
        ) : (
          "احمِ حسابك وبيانات عملائك: رمز يصل جوالك عند كل دخول جديد، فلا تكفي كلمة المرور وحدها."
        )}
      </p>

      {!state.available && !state.enabled ? (
        <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-slate">التحقق برمز الجوال غير متاح حاليًا.</p>
      ) : step.kind === "idle" ? (
        <div className="mt-4">
          {state.enabled ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep({ kind: "phone" })}>
                تغيير الرقم
              </Button>
              <Button variant="ghost" onClick={() => void sendDisable()} disabled={busy}>
                إيقاف
              </Button>
            </div>
          ) : (
            <Button variant="dark" icon={ShieldCheck} onClick={() => setStep({ kind: "phone" })}>
              تفعيل التحقق بخطوتين
            </Button>
          )}
          {error ? <p className="mt-2 text-[13px] text-red-700">{error}</p> : null}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
          {step.kind === "phone" ? (
            <div>
              <label htmlFor={`${uid}-phone`} className="mb-1.5 block text-sm font-semibold text-pine-deep">
                رقم الجوال
              </label>
              <TextInput
                id={`${uid}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(toLatinDigits(e.target.value))}
                invalid={Boolean(error)}
                className="text-left font-ui"
                autoFocus
              />
            </div>
          ) : (
            <>
              <SentTo phone={step.sentTo} />
              <label htmlFor={`${uid}-code`} className="sr-only">
                رمز التحقق
              </label>
              <CodeInput
                id={`${uid}-code`}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError(null);
                }}
                invalid={Boolean(error)}
                autoFocus
              />
            </>
          )}
          {error ? (
            <p role="alert" className="text-[13px] text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-semibold text-snow hover:bg-pine-deep disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {step.kind === "phone" ? "أرسل الرمز" : step.kind === "disable" ? "تأكيد الإيقاف" : "تأكيد وتفعيل"}
            </button>
            <Button variant="ghost" onClick={reset}>
              إلغاء
            </Button>
            {step.kind === "code" ? <Resend onResend={() => void sendEnroll()} busy={busy} /> : null}
            {step.kind === "disable" ? <Resend onResend={() => void sendDisable()} busy={busy} /> : null}
          </div>
        </form>
      )}
    </Card>
  );
}
