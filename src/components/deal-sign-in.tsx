import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { GROK_PROVIDERS, passwordSignIn, signIn, signInWithPassword, signUpWithPassword } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export type SignInMode = "in" | "up";

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Customer sign-in, styled for the light product surface (/login's form panel,
 * the same paper/pine/lime language as /client). Email + password when the
 * build sets `VITE_SIGNIN_MODE=password`, otherwise the upstream providers.
 */
export function DealSignIn({
  callbackURL = "/client",
  initialMode = "in",
  onModeChange,
}: {
  callbackURL?: string;
  initialMode?: SignInMode;
  onModeChange?: (mode: SignInMode) => void;
}) {
  if (passwordSignIn) return <PasswordSignIn callbackURL={callbackURL} initialMode={initialMode} onModeChange={onModeChange} />;
  return <ProviderSignIn callbackURL={callbackURL} />;
}

function ProviderSignIn({ callbackURL }: { callbackURL: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="flex w-full flex-col gap-3">
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy(p.providerId);
            void Promise.resolve(signIn(p.providerId, { callbackURL })).catch(() => setBusy(null));
          }}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-[15px] font-semibold text-pine-deep transition-colors hover:border-pine hover:bg-paper disabled:opacity-60"
        >
          {busy === p.providerId ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          الدخول عبر {p.label}
        </button>
      ))}
    </div>
  );
}

const fieldClass =
  "h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-pine-deep outline-none transition-[border-color,box-shadow] placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10";

type Errors = Partial<Record<"name" | "email" | "password", string>>;

/** Email + password sign-in / sign-up for off-platform deploys. */
function PasswordSignIn({
  callbackURL,
  initialMode,
  onModeChange,
}: {
  callbackURL: string;
  initialMode: SignInMode;
  onModeChange?: (mode: SignInMode) => void;
}) {
  const uid = useId();
  const [mode, setModeState] = useState<SignInMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const shownMode = useRef<SignInMode | null>(null);

  // Focus the first field: on first paint only on large screens (a phone
  // keyboard popping over the page on arrival hides the context), and on
  // every mode switch. Keyed on the mode actually shown, so StrictMode's
  // double effect run doesn't count as a switch.
  useEffect(() => {
    const first = shownMode.current === null;
    if (shownMode.current === mode) return;
    shownMode.current = mode;
    if (first && !window.matchMedia("(min-width: 1024px)").matches) return;
    (mode === "up" ? nameRef : emailRef).current?.focus();
  }, [mode]);

  function setMode(next: SignInMode) {
    setModeState(next);
    setErr("");
    setErrors({});
    onModeChange?.(next);
  }

  function validate(): Errors {
    const e: Errors = {};
    if (mode === "up" && name.trim().length < 2) e.name = "اكتب اسمك (حرفان على الأقل).";
    if (!email.trim()) e.email = "اكتب بريدك الإلكتروني.";
    else if (!EMAIL_RE.test(email.trim())) e.email = "صيغة البريد غير صحيحة، مثال: name@company.sa";
    if (!password) e.password = "اكتب كلمة المرور.";
    else if (mode === "up" && password.length < MIN_PASSWORD) e.password = `كلمة المرور قصيرة — ${MIN_PASSWORD} أحرف على الأقل.`;
    return e;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    const found = validate();
    setErrors(found);
    if (found.name) return nameRef.current?.focus();
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setBusy(true);
    let problem: string | null;
    try {
      problem =
        mode === "in"
          ? await signInWithPassword(email.trim(), password)
          : await signUpWithPassword(name.trim(), email.trim(), password);
    } catch {
      problem = "تعذر الاتصال، تحقق من الإنترنت وحاول مرة أخرى.";
    }
    if (problem) {
      setErr(problem);
      setBusy(false);
      if (mode === "in") {
        setPassword("");
        passwordRef.current?.focus();
      }
      return;
    }
    // Full navigation so the new session cookie is read from the start.
    window.location.assign(callbackURL);
  }

  const alreadyExists = mode === "up" && /مسجّل مسبقًا/.test(err);
  const describe = (key: keyof Errors, hint?: string) =>
    [errors[key] ? `${uid}-${key}-err` : null, hint ?? null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      <div role="tablist" aria-label="نوع الدخول" className="grid grid-cols-2 gap-1 rounded-xl bg-pine-50 p-1">
        {(
          [
            ["in", "تسجيل الدخول"],
            ["up", "حساب جديد"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            id={`${uid}-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={mode === value}
            aria-controls={`${uid}-form`}
            onClick={() => setMode(value)}
            className={cn(
              "h-11 rounded-lg text-sm font-semibold transition-colors",
              mode === value ? "bg-surface text-pine-deep shadow-sm" : "text-slate hover:text-pine-deep",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        id={`${uid}-form`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${mode}`}
        onSubmit={onSubmit}
        noValidate
        aria-busy={busy}
        className="mt-6 space-y-4 text-start"
      >
        {mode === "up" ? (
          <Field id={`${uid}-name`} label="الاسم" error={errors.name} errorId={`${uid}-name-err`}>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              name="name"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describe("name")}
              placeholder="مثال: عبدالله الحربي"
              className={cn(fieldClass, errors.name ? "border-red-500" : "border-line-strong")}
            />
          </Field>
        ) : null}

        <Field id={`${uid}-email`} label="البريد الإلكتروني" error={errors.email} errorId={`${uid}-email-err`}>
          <input
            ref={emailRef}
            id={`${uid}-email`}
            name="email"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete={mode === "in" ? "username" : "email"}
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describe("email")}
            placeholder="name@company.sa"
            className={cn(fieldClass, "text-left font-ui", errors.email ? "border-red-500" : "border-line-strong")}
          />
        </Field>

        <Field
          id={`${uid}-password`}
          label="كلمة المرور"
          error={errors.password}
          errorId={`${uid}-password-err`}
          hint={mode === "up" && !errors.password ? `${MIN_PASSWORD} أحرف على الأقل.` : undefined}
          hintId={`${uid}-password-hint`}
        >
          <div className="relative">
            <input
              ref={passwordRef}
              id={`${uid}-password`}
              name="password"
              type={show ? "text" : "password"}
              dir="ltr"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={describe("password", mode === "up" && !errors.password ? `${uid}-password-hint` : undefined)}
              className={cn(fieldClass, "pe-12 text-left font-ui", errors.password ? "border-red-500" : "border-line-strong")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={show}
              className="absolute inset-y-0 end-0 grid w-12 place-items-center rounded-e-xl text-slate hover:text-pine-deep"
            >
              {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </Field>
        {mode === "in" ? (
          <div className="-mt-3 flex justify-start">
            <a
              href="/forgot-password"
              className="inline-flex min-h-11 items-center text-[13px] font-semibold text-pine underline-offset-4 hover:underline"
            >
              نسيت كلمة المرور؟
            </a>
          </div>
        ) : null}

        {err ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
            {err}
            {alreadyExists ? (
              <>
                {" "}
                <button type="button" onClick={() => setMode("in")} className="font-semibold underline underline-offset-4">
                  انتقل لتسجيل الدخول
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep transition-colors hover:bg-[#b3bf28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? (mode === "in" ? "جارٍ الدخول…" : "جارٍ إنشاء الحساب…") : mode === "in" ? "دخول" : "إنشاء الحساب"}
        </button>

        <p className="text-center text-sm text-slate">
          {mode === "in" ? "ليس لديك حساب؟ " : "لديك حساب؟ "}
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="inline-flex min-h-11 items-center font-semibold text-pine underline-offset-4 hover:underline"
          >
            {mode === "in" ? "أنشئ حسابًا جديدًا" : "سجّل الدخول"}
          </button>
        </p>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  errorId,
  hint,
  hintId,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  errorId: string;
  hint?: string;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-pine-deep">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
