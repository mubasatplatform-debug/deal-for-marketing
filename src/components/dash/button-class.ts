import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dark";
export type ButtonSize = "sm" | "md";

/** Shared button look, also for links styled as buttons. */
export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md") =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
    variant === "primary" && "bg-lime text-pine-deep hover:bg-[#b3bf28]",
    variant === "dark" && "bg-pine text-snow hover:bg-pine-deep",
    variant === "secondary" && "border border-line bg-surface text-pine-deep hover:bg-paper",
    variant === "ghost" && "text-slate hover:bg-paper hover:text-pine-deep",
  );
