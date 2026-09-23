import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Grain, PlayMarks } from "@/components/brand-marks";
import { DealWordmark } from "@/components/logo";
import { TRIAL_DAYS } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

/**
 * Split layout for «مكتب المحامي» onboarding and invite acceptance: the form on
 * the light paper panel, and the DEAL brand board on the other side (paper-grain
 * lime, the play-triangle geometry, pine wordmark and baseline) — a compact
 * lime band on phones. No stock photography.
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

      <aside className="relative isolate order-first overflow-hidden bg-lime text-pine-deep lg:order-last lg:m-3 lg:min-h-[calc(100dvh-1.5rem)]">
        <Grain id="onboarding-grain" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-0 hidden w-[62%] lg:block">
          <PlayMarks tone="on-lime" />
        </div>
        <div className="relative flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-10 lg:pt-8">
          <a href="/" aria-label="ديل — الرئيسية" className="inline-flex min-h-11 items-center lg:hidden">
            <DealWordmark className="h-7 w-auto text-pine" />
          </a>
          <a href="/law" className="inline-flex min-h-11 items-center gap-1.5 font-display text-sm text-pine hover:opacity-75 lg:hidden">
            <ArrowRight className="size-4" aria-hidden="true" />
            مكتب المحامي
          </a>
        </div>
        <div className="relative px-4 pt-3 pb-6 sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:px-10 lg:pt-0 lg:pb-10">
          <p className="font-display text-sm text-pine">{side.kicker} //</p>
          <p className="mt-1 font-display text-2xl leading-snug text-pine-deep lg:mt-3 lg:text-[2.6rem] lg:leading-[1.3]">
            {side.title}
          </p>
          <ul className="mt-8 hidden max-w-md space-y-3 lg:block">
            {side.points.map((p) => (
              <li key={p} className="flex items-start gap-3 font-display text-pine-deep">
                <span aria-hidden="true" className="mt-3 h-px w-6 shrink-0 bg-pine" />
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
          <div dir="ltr" className="mt-10 hidden items-center gap-3 lg:flex">
            <DealWordmark className="h-8 w-auto shrink-0 text-pine" />
            <span className="h-px flex-1 bg-pine" />
          </div>
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
