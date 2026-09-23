import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthCard, authButtonClass, authFieldClass } from "@/components/auth-card";
import { resetPassword } from "@/lib/auth/client";
import { pageHead } from "@/lib/seo";

const MIN_PASSWORD = 8;

export const Route = createFileRoute("/reset-password")({
  head: () => pageHead({ title: "تعيين كلمة مرور جديدة", noindex: true }),
  // Better Auth redirects here with ?token=… (valid link) or ?error=INVALID_TOKEN.
  validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
    token:
      typeof search.token === "string" && /^[\w-]{8,200}$/.test(search.token)
        ? search.token
        : undefined,
    error: typeof search.error === "string" ? search.error.slice(0, 40) : undefined,
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token, error } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  if (!token || error) {
    return (
      <AuthCard
        title="الرابط غير صالح"
        subtitle="انتهت صلاحية رابط الاستعادة أو استُخدم من قبل. الروابط صالحة لساعة واحدة ولمرة واحدة."
      >
        <a href="/forgot-password" className={authButtonClass}>
          اطلب رابطًا جديدًا
        </a>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="تم تعيين كلمة المرور">
        <div className="flex gap-3 rounded-xl bg-pine-50 p-4 text-[15px] leading-relaxed">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-pine" aria-hidden="true" />
          <p role="status">
            كلمة مرورك الجديدة جاهزة. سجّلنا خروجك من أي جهاز آخر للحماية، ادخل الآن بكلمة المرور
            الجديدة.
          </p>
        </div>
        <a href="/login" className={`${authButtonClass} mt-5`}>
          تسجيل الدخول
        </a>
      </AuthCard>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !token) return;
    if (password.length < MIN_PASSWORD)
      return setErr(`كلمة المرور قصيرة — ${MIN_PASSWORD} أحرف على الأقل.`);
    if (password !== confirm) return setErr("كلمتا المرور غير متطابقتين.");
    setErr("");
    setBusy(true);
    const problem = await resetPassword(token, password).catch(
      () => "تعذر الاتصال، حاول مرة أخرى.",
    );
    setBusy(false);
    if (problem) return setErr(problem);
    setDone(true);
  }

  return (
    <AuthCard title="كلمة مرور جديدة" subtitle={`اختر كلمة مرور لا تقل عن ${MIN_PASSWORD} أحرف.`}>
      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold">
            كلمة المرور الجديدة
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={show ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authFieldClass} pe-12`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={show}
              className="absolute inset-y-0 end-0 grid w-12 place-items-center rounded-e-xl text-slate hover:text-pine-deep"
            >
              {show ? (
                <EyeOff className="size-5" aria-hidden="true" />
              ) : (
                <Eye className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold">
            تأكيد كلمة المرور
          </label>
          <input
            id="confirm-password"
            type={show ? "text" : "password"}
            dir="ltr"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authFieldClass}
          />
        </div>
        {err ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {err}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={authButtonClass}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "جارٍ الحفظ…" : "احفظ كلمة المرور"}
        </button>
      </form>
    </AuthCard>
  );
}
