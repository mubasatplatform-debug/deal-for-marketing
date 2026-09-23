import type { ComponentProps, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form controls for «مكتب المحامي» (onboarding, settings, team): the same
 * 48px fields as the sign-in form, pine focus ring, errors in red below.
 */
export const fieldClass =
  "h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-pine-deep outline-none transition-[border-color,box-shadow] placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10 disabled:cursor-not-allowed disabled:bg-paper disabled:text-slate";

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-pine-deep">
        {label}
        {optional ? <span className="text-xs font-normal text-slate">(اختياري)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-[13px] text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  invalid,
  className,
  ...rest
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(fieldClass, invalid ? "border-red-500" : "border-line-strong", className)}
    />
  );
}

export function SelectInput({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <span className={cn("relative block", className)}>
      <select
        {...rest}
        aria-invalid={invalid || undefined}
        className={cn(fieldClass, "cursor-pointer appearance-none pe-10", invalid ? "border-red-500" : "border-line-strong")}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-slate"
      />
    </span>
  );
}
