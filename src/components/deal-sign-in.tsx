import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, passwordSignIn, signIn, signInWithPassword, signUpWithPassword } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export function DealSignIn({ callbackURL = "/client" }: { callbackURL?: string }) {
  if (passwordSignIn) return <PasswordSignIn callbackURL={callbackURL} />;
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          onClick={() => signIn(p.providerId, { callbackURL })}
          className="h-12 border border-hair bg-card font-ui text-sm tracking-wide text-snow transition-colors hover:border-lime hover:text-lime"
        >
          الدخول عبر {p.label}
        </button>
      ))}
    </div>
  );
}

const field =
  "mt-2 h-12 w-full border border-hair bg-card px-4 text-snow outline-none focus-visible:border-lime focus-visible:outline-2 focus-visible:outline-lime";

/** Email + password sign-in / sign-up for off-platform deploys. */
function PasswordSignIn({ callbackURL }: { callbackURL: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const problem =
      mode === "in"
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(name.trim(), email.trim(), password);
    if (problem) {
      setErr(problem);
      setBusy(false);
      return;
    }
    // Full navigation so the new session cookie is read from the start.
    window.location.assign(callbackURL);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-5 text-start">
      <div role="tablist" aria-label="الحساب" className="grid grid-cols-2 border border-hair">
        {(
          [
            ["in", "تسجيل الدخول"],
            ["up", "حساب جديد"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setErr("");
            }}
            className={cn(
              "h-11 font-display text-sm transition-colors",
              mode === value ? "bg-lime text-ink" : "text-mist hover:text-snow",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "up" ? (
        <label className="block">
          <span className="text-sm text-dim">الاسم</span>
          <input
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
      ) : null}
      <label className="block">
        <span className="text-sm text-dim">البريد الإلكتروني</span>
        <input
          required
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(field, "text-end font-ui")}
        />
      </label>
      <label className="block">
        <span className="text-sm text-dim">كلمة المرور</span>
        <input
          required
          type="password"
          dir="ltr"
          minLength={8}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={cn(field, "text-end font-ui")}
        />
      </label>

      {err ? (
        <p role="alert" className="text-sm text-red-400">
          {err}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full border border-lime bg-lime font-display text-ink disabled:opacity-60"
      >
        {busy ? "لحظة…" : mode === "in" ? "دخول" : "إنشاء الحساب"}
      </button>
    </form>
  );
}
