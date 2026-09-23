import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, LogOut } from "lucide-react";
import { DealSignIn, type SignInMode } from "@/components/deal-sign-in";
import { DealLogo } from "@/components/logo";
import { Photo } from "@/components/site-ui";
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
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 text-xs leading-relaxed text-slate">
            <a
              href="/forgot-password"
              className="inline-flex min-h-11 items-center font-semibold text-pine underline underline-offset-4"
            >
              نسيت كلمة المرور؟
            </a>
            <span className="inline-flex min-h-11 items-center gap-1">
              تحتاج مساعدة؟
              <a
                href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent("أحتاج مساعدة في الدخول لحسابي في ديل")}`}
                className="font-semibold text-pine underline underline-offset-4"
              >
                راسلنا واتساب
              </a>
            </span>
          </p>
          <a
            href="/start"
            className="mx-auto mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-pine hover:underline lg:hidden"
          >
            اطلب خدمتك بدون حساب
          </a>
        </div>
      </main>

      {/* Brand panel — on phones a compact pine band above the form; from lg a full-height photograph. */}
      <aside className="on-dark relative isolate order-first overflow-hidden bg-pine-deep text-snow lg:order-last lg:m-3 lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-3xl">
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden lg:block">
          <Photo name="team-talk" alt="" sizes="52vw" position="62% 40%" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-pine-deep)_12%,color-mix(in_oklab,var(--color-pine-deep)_55%,transparent)_52%,transparent_80%)]" />
        </div>
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-10 lg:pt-8">
          <DealLogo tone="dark" />
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-snow/75 hover:text-lime lg:hidden"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            الموقع
          </a>
        </div>

        <div className="px-4 pt-4 pb-7 sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-10">
          <p className="text-sm font-bold text-lime">حساب العميل</p>
          <p className="mt-1 font-display text-2xl leading-snug text-snow lg:mt-3 lg:text-[2.6rem] lg:leading-[1.3]">
            كل طلباتك مع ديل
            <br className="hidden lg:block" /> في مكان واحد.
          </p>

          <ul className="mt-8 hidden max-w-md space-y-3 lg:block">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-snow/85">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-pine-deep">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden gap-3 text-sm lg:flex">
            <a href={`tel:${phone.tel}`} className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm hover:bg-white/15">
              <span className="block text-xs text-snow/60">هاتف</span>
              <span dir="ltr" className="mt-0.5 block font-ui text-lg font-bold text-snow">
                {phone.display}
              </span>
            </a>
            <a
              href={`https://wa.me/${mobile.wa}`}
              className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm hover:bg-white/15"
            >
              <span className="block text-xs text-snow/60">جوال وواتساب</span>
              <span dir="ltr" className="mt-0.5 block font-ui text-lg font-bold text-snow">
                {mobile.display}
              </span>
            </a>
          </div>
        </div>
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
