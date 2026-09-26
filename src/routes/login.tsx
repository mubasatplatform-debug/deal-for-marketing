import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, LogOut } from "lucide-react";
import { DealSignIn, type SignInMode } from "@/components/deal-sign-in";
import { DealLogo } from "@/components/logo";
import { LimeWave } from "@/components/lime-wave";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { mobile, phone } from "@/lib/content";
import { pageHead } from "@/lib/seo";

/** Only same-origin relative paths ("/x" — not "//host", "/\\host" or anything with whitespace/control chars). */
function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\\\s\u0000-\u001f]/.test(value)) return undefined;
  // Never bounce back to the sign-in page itself.
  if (value === "/login" || value.startsWith("/login?")) return undefined;
  return value;
}

export const Route = createFileRoute("/login")({
  head: () => pageHead({ title: "دخول العميل", noindex: true }),
  validateSearch: (search: Record<string, unknown>): { redirect?: string; mode?: SignInMode } => ({
    redirect: safeRedirect(search.redirect),
    mode: search.mode === "up" ? "up" : undefined,
  }),
  component: Login,
});

/** What the visitor is about to get back to, so the page can say it. */
function destinationLabel(path: string): string {
  if (path.startsWith("/client")) return "حسابك";
  if (path.startsWith("/start")) return "طلب الخدمة";
  if (path.startsWith("/line")) return "خط ديل";
  if (path.startsWith("/admin")) return "لوحة الإدارة";
  if (path.startsWith("/app")) return "مكتبك";
  return "الصفحة التي كنت فيها";
}

const perks = [
  "تابع حالة كل طلب من الاستلام حتى التسليم.",
  "اطلب خدمة جديدة في دقيقة، وبياناتك محفوظة.",
  "تواصل مباشر مع فريق ديل عند كل خطوة.",
];

function Login() {
  const { redirect, mode } = Route.useSearch();
  const callbackURL = redirect ?? "/client";
  const { user, isPending } = useCurrentUserState();
  const [current, setCurrent] = useState<SignInMode>(mode ?? "in");

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-dash text-pine-deep lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Form panel — the light product surface the customer lands in. */}
      <main className="flex flex-1 flex-col px-4 pt-6 pb-10 sm:px-8 lg:min-h-dvh lg:px-16 lg:pt-8">
        <div className="hidden items-center justify-between lg:flex">
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate hover:text-pine-deep"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            العودة للموقع
          </a>
          <a href="/start" className="inline-flex min-h-11 items-center text-sm font-semibold text-pine hover:underline">
            اطلب خدمتك بدون حساب
          </a>
        </div>

        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-6 lg:py-10">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,38,40,0.04),0_12px_32px_-16px_rgba(16,38,40,0.14)] sm:p-8">
            {isPending ? (
              <div className="grid min-h-72 place-items-center" aria-busy="true" aria-live="polite">
                <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
                <span className="sr-only">جارٍ التحقق من الجلسة…</span>
              </div>
            ) : user ? (
              <SignedInCard
                name={user.displayName ?? user.primaryEmail ?? ""}
                email={user.primaryEmail}
                next={callbackURL}
              />
            ) : (
              <>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {current === "in" ? "مرحبًا بعودتك" : "أنشئ حسابك في ديل"}
                </h1>
                <p className="mt-1.5 mb-6 text-sm leading-relaxed text-slate">
                  {redirect
                    ? `سجّل الدخول للمتابعة إلى ${destinationLabel(redirect)}.`
                    : current === "in"
                      ? "ادخل لحسابك لمتابعة طلباتك مع فريق ديل."
                      : "حساب واحد لكل طلباتك — تتابعها وتطلب الجديد منه."}
                </p>
                <DealSignIn callbackURL={callbackURL} initialMode={mode ?? "in"} onModeChange={setCurrent} />
              </>
            )}
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-slate">
            بالمتابعة أنت توافق على{" "}
            <a href="/privacy" className="font-semibold text-pine underline underline-offset-4">
              سياسة الخصوصية
            </a>
            .
          </p>
          <p className="mt-2 text-center text-xs leading-relaxed text-slate">
            <a href="/forgot-password" className="font-semibold text-pine underline underline-offset-4">
              نسيت كلمة المرور؟
            </a>{" "}
            · تحتاج مساعدة؟{" "}
            <a
              href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent("أحتاج مساعدة في الدخول لحسابي في ديل")}`}
              className="font-semibold text-pine underline underline-offset-4"
            >
              راسلنا واتساب
            </a>
          </p>
          <a
            href="/start"
            className="mx-auto mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-pine hover:underline lg:hidden"
          >
            اطلب خدمتك بدون حساب
          </a>
        </div>
      </main>

      {/* Brand panel — on phones a compact band above the form. */}
      <aside className="on-dark relative isolate order-first overflow-hidden bg-ink text-snow lg:order-last lg:min-h-dvh">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_100%,rgba(36,72,76,0.85),transparent_60%),radial-gradient(70%_60%_at_100%_0%,rgba(194,207,48,0.10),transparent_70%)]"
        />
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-14 lg:pt-8">
          <DealLogo />
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 font-display text-sm text-mist hover:text-lime lg:hidden"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            الموقع
          </a>
        </div>

        <div className="px-4 pt-6 pb-8 sm:px-8 lg:flex lg:min-h-[calc(100dvh-6rem)] lg:flex-col lg:justify-center lg:px-14 lg:pt-0 lg:pb-32">
          <p className="text-kicker text-lime">حساب العميل //</p>
          <p className="mt-2 font-display text-2xl leading-snug text-snow lg:mt-5 lg:text-5xl lg:leading-[1.25]">
            كل طلباتك مع ديل
            <br className="hidden lg:block" /> في مكان واحد.
          </p>

          <ul className="mt-10 hidden max-w-md space-y-4 lg:block">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-mist">
                <span className="mt-1 grid size-6 shrink-0 place-items-center bg-lime text-ink">
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12 hidden gap-8 text-sm lg:flex">
            <div>
              <p className="text-dim">هاتف</p>
              <a href={`tel:${phone.tel}`} dir="ltr" className="mt-1 inline-block font-ui text-lg text-snow hover:text-lime">
                {phone.display}
              </a>
            </div>
            <div>
              <p className="text-dim">جوال وواتساب</p>
              <a
                href={`https://wa.me/${mobile.wa}`}
                dir="ltr"
                className="mt-1 inline-block font-ui text-lg text-snow hover:text-lime"
              >
                {mobile.display}
              </a>
            </div>
          </div>
        </div>
        <LimeWave className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 lg:block" />
      </aside>
    </div>
  );
}

function SignedInCard({ name, email, next }: { name: string; email: string | null; next: string }) {
  const [leaving, setLeaving] = useState(false);
  const initial = (name || "؟").trim().charAt(0).toUpperCase();
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-pine text-lg font-bold text-lime">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">أنت مسجّل الدخول</h1>
          <p className="truncate text-sm text-slate" dir={email ? "ltr" : undefined}>
            {email ?? name}
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <a
          href={next}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-lime text-[15px] font-bold text-pine-deep hover:bg-[#b3bf28]"
        >
          {next.startsWith("/client") ? "الذهاب إلى حسابي" : `متابعة إلى ${destinationLabel(next)}`}
        </a>
        {authEnabled ? (
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void signOut("/login").catch(() => setLeaving(false));
            }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-pine-deep hover:bg-paper disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {leaving ? "جارٍ الخروج…" : "الدخول بحساب آخر"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
