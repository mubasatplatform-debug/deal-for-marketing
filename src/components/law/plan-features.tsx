import { Check } from "lucide-react";
import { FEATURE_LABELS, type FeatureFlag, type Plan } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

const SHOWN_FEATURES: FeatureFlag[] = [
  "appointments",
  "clients",
  "cases",
  "documents",
  "videoSessions",
  "aiDrafting",
  "multiBranch",
  "prioritySupport",
];

/** Seats + the feature list of a plan (billing page and the /law pricing). */
export function PlanFeatures({ plan, dark }: { plan: Plan; dark?: boolean }) {
  return (
    <ul className="space-y-2.5 text-sm">
      <li className="flex items-center gap-2.5 font-semibold">
        <span className={cn("grid size-5 place-items-center rounded-full", dark ? "bg-lime text-pine-deep" : "bg-pine text-lime")}>
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
        حتى {plan.seats} {plan.seats <= 10 ? "أعضاء" : "عضوًا"} في الفريق
      </li>
      {SHOWN_FEATURES.map((f) => (
        <li
          key={f}
          className={cn(
            "flex items-center gap-2.5",
            !plan.features[f] && (dark ? "text-snow/35 line-through" : "text-slate/60 line-through"),
          )}
        >
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full",
              plan.features[f] ? (dark ? "bg-white/10 text-lime" : "bg-lime-50 text-lime-600") : "opacity-0",
            )}
          >
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
          {FEATURE_LABELS[f]}
        </li>
      ))}
    </ul>
  );
}

