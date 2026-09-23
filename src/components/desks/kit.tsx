import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, Num } from "@/components/dash/ui";
import { cn } from "@/lib/utils";
import { chart, fmt } from "@/components/desks/tokens";

/**
 * Small pieces shared by the product desks. They sit on top of the DEAL UI kit
 * (Card, Pill, Num…) and only add what a showcase dashboard needs: KPI cards
 * with a delta and sparkline, table cells, chart tooltips and legends.
 */

export function Money({
  value,
  className,
  unitClass,
}: {
  value: number;
  className?: string;
  unitClass?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <Num>{fmt(value)}</Num>
      <span className={cn("text-[0.78em] font-semibold text-slate", unitClass)}>ر.س</span>
    </span>
  );
}

/** A masked phone number — never a full real-looking mobile. */
export function Masked({ tail, className }: { tail: string; className?: string }) {
  return (
    <span dir="ltr" className={cn("font-ui tabular-nums", className)}>
      05•• ••• {tail}
    </span>
  );
}

export function Delta({
  value,
  down = false,
  soft = false,
}: {
  value: string;
  down?: boolean;
  soft?: boolean;
}) {
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px font-ui whitespace-nowrap text-[11px] font-bold tabular-nums",
        soft ? "bg-pine-50 text-pine" : "bg-lime-50 text-lime-600",
      )}
      dir="ltr"
    >
      <Icon className="size-3" />
      {value}
    </span>
  );
}

/** Pure SVG sparkline: deterministic, no layout pass needed. */
export function Spark({
  data,
  className,
  tone = "pine",
}: {
  data: number[];
  className?: string;
  tone?: "pine" | "lime";
}) {
  const w = 96;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 3 - ((v - min) / (max - min || 1)) * (h - 6),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const stroke = tone === "lime" ? chart.limeDeep : chart.pine;
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-24 overflow-visible", className)}
      aria-hidden="true"
    >
      <path d={`${line} L0 ${h} L${w} ${h}Z`} fill={stroke} opacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={stroke} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

export function Stat({
  label,
  value,
  delta,
  deltaDown,
  deltaSoft,
  foot,
  spark,
  side,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaDown?: boolean;
  deltaSoft?: boolean;
  foot?: ReactNode;
  spark?: number[];
  /** Anything to sit at the inline end of the figure instead of a sparkline. */
  side?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="px-5 pt-4 pb-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-slate" /> : null}
        <p className="text-[13px] font-semibold text-slate">{label}</p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-ui text-[26px] leading-none font-bold tracking-tight whitespace-nowrap text-pine-deep tabular-nums">
          {value}
        </p>
        {spark ? <Spark data={spark} className="shrink-0" /> : side}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate">
        {delta ? <Delta value={delta} down={deltaDown} soft={deltaSoft} /> : null}
        {foot ? <span className="truncate">{foot}</span> : null}
      </div>
    </Card>
  );
}

export const th = "px-4 py-2.5 text-start text-xs font-semibold text-slate whitespace-nowrap";
export const td = "px-4 py-3 text-[13px] whitespace-nowrap";

export function TableHead({ cols, className }: { cols: readonly string[]; className?: string }) {
  return (
    <thead className={cn("border-y border-line bg-paper/60", className)}>
      <tr>
        {cols.map((c, i) => (
          <th key={c + i} className={th}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function LegendDot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  );
}

type TipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

/** Tooltip body for recharts: white card, text in ink tokens, series by swatch. */
export function ChartTip({
  active,
  payload,
  label,
  unit,
  names,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
  unit?: string;
  names?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-line bg-surface px-3 py-2 font-dash text-xs shadow-lg"
      dir="rtl"
    >
      <p className="mb-1 font-semibold text-pine-deep">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          {names?.[String(p.dataKey)] ?? p.name}
          <Num className="ms-auto font-bold text-pine-deep">
            {typeof p.value === "number" ? fmt(p.value) : p.value}
            {unit ? ` ${unit}` : ""}
          </Num>
        </p>
      ))}
    </div>
  );
}

/** Thin progress bar for workloads, confidence, shares. */
export function Meter({
  value,
  tone = "pine",
  className,
}: {
  value: number;
  tone?: "pine" | "lime";
  className?: string;
}) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-pine-50", className)}>
      <span
        className={cn("block h-full rounded-full", tone === "lime" ? "bg-lime" : "bg-pine")}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </span>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg border border-line bg-surface text-slate",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

/** One-letter avatar: skips kunya and article so "أبو فهد" reads ف, not "أف". */
export function Face({
  name,
  tone = "soft",
  className,
}: {
  name: string;
  tone?: "soft" | "pine" | "lime";
  className?: string;
}) {
  const letter =
    name
      .trim()
      .replace(/^(أبو|أم|مؤسسة|مكتب|شركة|دار)\s+/, "")
      .replace(/^ال/, "")
      .charAt(0) || "؟";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold",
        tone === "soft" && "bg-pine-50 text-pine ring-1 ring-pine-100 ring-inset",
        tone === "pine" && "bg-pine text-lime",
        tone === "lime" && "bg-lime text-pine-deep",
        className,
      )}
    >
      {letter}
    </span>
  );
}
