import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonClass, type ButtonVariant, type ButtonSize } from "@/components/dash/button-class";

/**
 * DEAL product UI kit — the one visual language for every dashboard.
 * Light paper canvas, white cards with a hairline border and a soft shadow,
 * pine for text and structure, lime as the single action accent.
 * Arabic UI text is Cairo (font-dash); figures are Manrope with tabular nums.
 */

export type Tone = "pine" | "lime" | "neutral" | "info" | "danger";

const toneClass: Record<Tone, string> = {
  pine: "bg-pine-50 text-pine ring-pine-100",
  lime: "bg-lime-50 text-lime-600 ring-lime/40",
  neutral: "bg-paper text-slate ring-line",
  info: "bg-pine text-snow ring-pine",
  danger: "bg-red-50 text-red-700 ring-red-200",
};

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,38,40,0.04),0_8px_24px_-12px_rgba(16,38,40,0.08)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-5 pt-5 md:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-pine-deep">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-slate">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Pill({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentType<{ className?: string }>;
};

export function Button({ variant, size, icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cn(buttonClass(variant, size), className)} {...rest}>
      {Icon ? <Icon className={size === "sm" ? "size-3.5" : "size-4"} /> : null}
      {children}
    </button>
  );
}

/** Figures read best in Latin digits with tabular spacing. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-ui tabular-nums", className)}>{children}</span>;
}

export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "pine",
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: "pine" | "lime";
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-slate">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl",
              tone === "lime" ? "bg-lime-50 text-lime-600" : "bg-pine-50 text-pine",
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 font-ui text-[28px] leading-none font-bold tracking-tight text-pine-deep tabular-nums">
          {value}
        </p>
      )}
      {hint ? <p className="mt-2 text-xs text-slate">{hint}</p> : null}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block rounded-lg bg-pine-50 motion-safe:animate-pulse", className)}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon ? (
        <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
          <Icon className="size-6" />
        </span>
      ) : null}
      <p className="mt-4 text-[15px] font-bold text-pine-deep">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-slate">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("") || "؟";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-pine text-sm font-bold text-lime",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Segmented control for filters (aria-pressed buttons). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-paper p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
              active
                ? "bg-surface text-pine-deep shadow-sm ring-1 ring-line"
                : "text-slate hover:text-pine-deep",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <Num className={cn("text-[11px]", active ? "text-lime-600" : "text-slate/70")}>
                {o.count}
              </Num>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
