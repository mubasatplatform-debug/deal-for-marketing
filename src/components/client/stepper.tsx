import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS, statusLabel } from "./status";

type StepState = "done" | "current" | "todo";

/**
 * Horizontal progress through the four request steps. Completed steps carry a
 * check, the current one is lime, the rest stay quiet. Reads right-to-left.
 */
export function Stepper({
  current,
  size = "md",
  className,
}: {
  current: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const sm = size === "sm";
  return (
    <ol aria-label="مراحل الطلب" className={cn("flex", className)}>
      {STEPS.map((step, i) => {
        const state: StepState = i < current ? "done" : i === current ? "current" : "todo";
        const last = i === STEPS.length - 1;
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
          >
            {/* Connector to the next step (drawn from this node's centre). */}
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute start-1/2 end-[-50%] h-0.5 rounded-full",
                  sm ? "top-[9px]" : "top-[13px]",
                  i < current ? "bg-pine" : "bg-line",
                )}
              />
            ) : null}
            <Node state={state} sm={sm} />
            <span
              className={cn(
                "mt-2 block leading-tight",
                sm ? "text-[11px]" : "text-xs md:text-[13px]",
                state === "current" && "font-bold text-pine-deep",
                state === "done" && "font-semibold text-pine",
                state === "todo" && "font-medium text-slate/70",
              )}
            >
              {statusLabel(step)}
            </span>
            <span className="sr-only">
              {state === "done" ? "(مكتملة)" : state === "current" ? "(المرحلة الحالية)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Node({ state, sm }: { state: StepState; sm: boolean }) {
  const box = sm ? "size-5" : "size-7";
  if (state === "done") {
    return (
      <span aria-hidden="true" className={cn("relative grid place-items-center rounded-full bg-pine text-snow", box)}>
        <Check className={sm ? "size-3" : "size-4"} strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "relative grid place-items-center rounded-full bg-lime ring-lime-50",
          sm ? "ring-[3px]" : "ring-[5px]",
          box,
        )}
      >
        <span className={cn("rounded-full bg-pine-deep", sm ? "size-1.5" : "size-2")} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("relative grid place-items-center rounded-full border-2 border-line-strong bg-surface", box)}
    />
  );
}
