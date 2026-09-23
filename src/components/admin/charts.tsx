import { useEffect, useId, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Num } from "@/components/dash/ui";
import { countOf, formatDay, formatLongDay, requestsWord } from "./format";

const PINE = "#24484c";
const LIME = "#c2cf30";
const LINE = "#e3e6dc";
const SLATE = "#5e6f6d";

type Point = { t: number; count: number };

function LeadsTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 font-dash shadow-[0_8px_24px_-12px_rgba(16,38,40,0.25)]">
      <p className="text-[11px] text-slate">{formatLongDay(new Date(p.t))}</p>
      <p className="mt-0.5 text-[13px] font-bold text-pine-deep">
        {p.count === 0 ? "لا طلبات" : countOf(p.count, requestsWord)}
      </p>
    </div>
  );
}

/** Daily leads, newest at the inline end so time reads right-to-left. */
export function LeadsChart({ data }: { data: Point[] }) {
  const id = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(4, ...data.map((d) => d.count));
  const step = narrow ? 10 : 7;
  const ticks = data.filter((_, i) => (data.length - 1 - i) % step === 0).map((d) => d.t);
  return (
    <div ref={box} className="h-[220px] w-full sm:h-[244px]" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LIME} stopOpacity={0.32} />
              <stop offset="100%" stopColor={LIME} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="0" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            reversed
            ticks={ticks}
            tickFormatter={(t: number) => formatDay(new Date(t))}
            tickLine={false}
            axisLine={{ stroke: LINE }}
            tick={{ fill: SLATE, fontSize: 11, fontFamily: "Cairo, Manrope, sans-serif" }}
            tickMargin={10}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            orientation="right"
            allowDecimals={false}
            domain={[0, max]}
            tickCount={5}
            tickLine={false}
            axisLine={false}
            width={28}
            tick={{ fill: SLATE, fontSize: 11, fontFamily: "Manrope, sans-serif" }}
          />
          <Tooltip
            content={<LeadsTooltip />}
            cursor={{ stroke: PINE, strokeOpacity: 0.25, strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={PINE}
            strokeWidth={2}
            fill={`url(#fill-${id})`}
            activeDot={{ r: 4.5, fill: PINE, stroke: "#fff", strokeWidth: 2 }}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ServiceBars({
  data,
  total,
}: {
  data: { title: string; count: number }[];
  total: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-3.5">
      {data.map((d) => {
        const pct = total ? Math.round((d.count / total) * 100) : 0;
        return (
          <li key={d.title} title={`${d.title}: ${countOf(d.count, requestsWord)}`}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-semibold text-pine-deep">{d.title}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <Num className="font-bold text-pine-deep">{d.count}</Num>
                <Num className="w-9 text-end text-[11px] text-slate">{pct}%</Num>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-pine"
                style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
