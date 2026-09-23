import { Num } from "@/components/dash/ui";
import { sourceLabel } from "@/lib/attribution";
import { cn } from "@/lib/utils";
import { countOf, requestsWord } from "./format";

/**
 * One quiet mark per channel, so sources are told apart at a glance without
 * adding brand colours to the dashboard palette.
 */
const SOURCE_DOT: Record<string, string> = {
  snapchat: "bg-lime",
  instagram: "bg-pine",
  tiktok: "bg-pine-deep",
  x: "bg-slate",
  google: "bg-lime-600",
  whatsapp: "bg-pine/60",
  linkedin: "bg-pine/40",
  direct: "bg-line-strong",
  other: "bg-slate/50",
};

export function SourcePill({ source, className }: { source: string | null; className?: string }) {
  return (
    <span
      title={`المصدر: ${sourceLabel(source)}`}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md bg-paper px-1.5 text-[11px] font-semibold whitespace-nowrap text-slate ring-1 ring-line ring-inset",
        !source && "text-slate/70",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", SOURCE_DOT[source ?? ""] ?? "bg-line-strong")}
      />
      <span className="sr-only">المصدر: </span>
      {sourceLabel(source)}
    </span>
  );
}

/**
 * Requests per source from the SQL totals. Each row filters the requests
 * table to that source.
 */
export function SourceBreakdown({
  data,
  total,
  active,
  onPick,
}: {
  data: { source: string | null; count: number }[];
  total: number;
  active: string;
  onPick: (source: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="grid gap-x-8 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
      {data.map((d) => {
        const key = d.source ?? "unknown";
        const pct = total ? Math.round((d.count / total) * 100) : 0;
        const on = active === key;
        return (
          <li key={key}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? "all" : key)}
              title={`${sourceLabel(d.source)}: ${countOf(d.count, requestsWord)} — اعرضها في الجدول`}
              className={cn(
                "-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-start transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-pine",
                on && "bg-lime-50 ring-1 ring-lime/50 hover:bg-lime-50",
              )}
            >
              <span className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-pine-deep">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      SOURCE_DOT[d.source ?? ""] ?? "bg-line-strong",
                    )}
                  />
                  <span className="truncate">{sourceLabel(d.source)}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <Num className="font-bold text-pine-deep">{d.count}</Num>
                  <Num className="w-9 text-end text-[11px] text-slate">{pct}%</Num>
                </span>
              </span>
              <span className="mt-1.5 block h-1.5 rounded-full bg-paper">
                <span
                  className={cn("block h-full rounded-full", d.source ? "bg-pine" : "bg-slate/40")}
                  style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
