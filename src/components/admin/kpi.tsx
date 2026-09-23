import type { ComponentType, ReactNode } from "react";
import { Card, Skeleton } from "@/components/dash/ui";
import { cn } from "@/lib/utils";

/**
 * Admin KPI tile. Same anatomy as the kit's Kpi, tuned for a two-up grid on
 * phones: the icon steps aside below `sm` so Arabic labels keep one line.
 */
export function AdminKpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] leading-5 font-semibold text-slate sm:text-[13px]">{label}</p>
        <span
          className={cn(
            "hidden size-8 shrink-0 place-items-center rounded-lg sm:grid",
            accent ? "bg-lime-50 text-lime-600" : "bg-pine-50 text-pine",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-3 h-3 w-24" />
        </>
      ) : (
        <>
          <p className="mt-2 font-ui text-[26px] leading-none font-bold tracking-tight text-pine-deep tabular-nums sm:mt-3 sm:text-[28px]">
            {value}
          </p>
          {hint ? <p className="mt-2.5 text-xs leading-5 text-slate">{hint}</p> : null}
        </>
      )}
    </Card>
  );
}
