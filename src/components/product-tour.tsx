import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TourStep = {
  n: string;
  title: string;
  body: string;
  screen: ReactNode;
};

export function ProductTour({ kicker, steps }: { kicker: string; steps: TourStep[] }) {
  const [i, setI] = useState(0);
  const s = steps[i];

  return (
    <div className="bg-snow text-ink">
      <div className="px-6 pt-12 pb-6 md:px-16">
        <p className="text-kicker text-lime">{kicker}</p>
        <div className="mt-5 flex items-baseline justify-between gap-6">
          <h3 className="font-display text-poster text-ink">{s.title}</h3>
          <span className="font-display text-xl text-lime md:text-3xl">{s.n}</span>
        </div>
        <p className="mt-4 max-w-xl text-pretty leading-loose text-ink/55">{s.body}</p>
      </div>

      <div className="px-4 md:px-16">
        <div className="overflow-hidden border border-ink/10 bg-snow">{s.screen}</div>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-5 md:px-16">
        <div className="flex flex-wrap gap-1.5">
          {steps.map((step, idx) => (
            <button
              key={step.n}
              type="button"
              aria-label={step.title}
              onClick={() => setI(idx)}
              className={cn("h-1 transition-all", idx === i ? "w-8 bg-lime" : "w-4 bg-ink/15")}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="الخطوة التالية"
          onClick={() => setI((n) => (n + 1) % steps.length)}
          className="flex size-14 items-center justify-center bg-lime text-ink md:size-16"
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function AppBar({ title, crumb }: { title: string; crumb: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-lime" />
        <span className="font-display text-sm text-ink">{title}</span>
      </div>
      <span className="font-display text-xs text-ink/40">{crumb}</span>
    </div>
  );
}
