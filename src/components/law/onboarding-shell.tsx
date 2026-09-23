import type { ReactNode } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { DealLogo } from "@/components/logo";
import { Photo } from "@/components/site-ui";
import { TRIAL_DAYS } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

/**
 * Split layout for «مكتب المحامي» onboarding and invite acceptance — the same
 * construction as /login: the form on the light paper panel, a photograph
 * with the promise on the other side (a compact pine band on phones).
 */
export function OnboardingShell({
  step,
  steps = ["الحساب", "المكتب", "ابدأ"],
  aside,
  children,
}: {
  /** 0-based current step; omit to hide the stepper. */
  step?: number;
  steps?: string[];
  aside?: { kicker: string; title: ReactNode; points: string[] };
  children: ReactNode;
}) {
  const side = aside ?? {
    kicker: "مكتب المحامي",
    title: (
      <>
        مكتبك القانوني،
        <br className="hidden lg:block" /> مرتّب في مكان واحد.
      </>
    ),
    points: [
      `${TRIAL_DAYS} يومًا مجانًا بكامل مزايا الخطة الاحترافية.`,
      "بدون بطاقة ائتمان للتجربة.",
      "بيانات مكتبك معزولة عن غيره، ولا تُحذف تلقائيًا.",
    ],
  };
  return (
    <div className="flex min-h-dvh flex-col bg-paper font-dash text-pine-deep lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <main className="flex flex-1 flex-col px-4 pt-6 pb-10 sm:px-8 lg:min-h-dvh lg:px-16 lg:pt-8">
        <div className="hidden items-center justify-between lg:flex">
          <a href="/law" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate hover:text-pine-deep">
            <ArrowRight className="size-4" aria-hidden="true" />
            مكتب المحامي
          </a>
          <a href="/desk/law/home" className="inline-flex min-h-11 items-center text-sm font-semibold text-pine hover:underline">
            شاهد العرض التوضيحي
          </a>
        </div>

        <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col justify-center py-6 lg:py-10">
          {step !== undefined ? <Stepper steps={steps} current={step} /> : null}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,38,40,0.04),0_12px_32px_-16px_rgba(16,38,40,0.14)] sm:p-8">
            {children}
          </div>
          <p className="mt-5 text-center text-xs leading-relaxed text-slate">
            بالمتابعة أنت توافق على{" "}
            <a href="/law/terms" className="font-semibold text-pine underline underline-offset-4">
              شروط الاستخدام
            </a>{" "}
            و
            <a href="/privacy#law" className="font-semibold text-pine underline underline-offset-4">
              سياسة الخصوصية
            </a>
            .
          </p>
        </div>
      </main>

      <aside className="on-dark relative isolate order-first overflow-hidden bg-pine-deep text-snow lg:order-last lg:m-3 lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-3xl">
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden lg:block">
          <Photo name="handshake" alt="" sizes="50vw" position="50% 50%" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-pine-deep)_14%,color-mix(in_oklab,var(--color-pine-deep)_60%,transparent)_55%,color-mix(in_oklab,var(--color-pine-deep)_20%,transparent)_85%)]" />
        </div>
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-10 lg:pt-8">
          <DealLogo tone="dark" />
          <a href="/law" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-snow/75 hover:text-lime lg:hidden">
            <ArrowRight className="size-4" aria-hidden="true" />
            مكتب المحامي
          </a>
        </div>
        <div className="px-4 pt-3 pb-6 sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-10">
          <p className="text-sm font-bold text-lime">{side.kicker}</p>
          <p className="mt-1 font-display text-2xl leading-snug text-snow lg:mt-3 lg:text-[2.5rem] lg:leading-[1.3]">
            {side.title}
          </p>
          <ul className="mt-8 hidden max-w-md space-y-3 lg:block">
            {side.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-snow/85">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-pine-deep">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 hidden items-center gap-2 text-sm text-snow/60 lg:flex">
            <ShieldCheck className="size-4 text-lime" aria-hidden="true" />
            من ديل للتسويق — بريدة، القصيم
          </p>
        </div>
      </aside>
    </div>
  );
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="خطوات التسجيل" className="mb-5 flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s} aria-current={now ? "step" : undefined} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full font-ui text-xs font-bold",
                done && "bg-pine text-lime",
                now && "bg-lime text-pine-deep",
                !done && !now && "bg-surface text-slate ring-1 ring-line",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-[13px] font-semibold whitespace-nowrap", now ? "text-pine-deep" : "text-slate")}>{s}</span>
            {i < steps.length - 1 ? <span aria-hidden="true" className={cn("h-px flex-1", done ? "bg-pine" : "bg-line-strong")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
