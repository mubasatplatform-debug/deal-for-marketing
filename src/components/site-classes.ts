import { cn } from "@/lib/utils";

/**
 * Public-site class helpers (kept out of site-ui.tsx so that file only exports
 * components). Same radii and colours as src/components/dash/button-class.ts.
 */
/** Page gutter and measure, shared by every public section. */
export const wrap = "mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8";

export type SiteButton = "primary" | "secondary" | "dark" | "ghost-dark";

export const siteButton = (variant: SiteButton = "primary", size: "md" | "lg" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-dash font-bold whitespace-nowrap transition-colors touch-manipulation",
    size === "lg" ? "h-13 px-6 text-base" : "h-12 px-5 text-[15px]",
    variant === "primary" && "bg-lime text-pine-deep hover:bg-[#b3bf28]",
    variant === "secondary" &&
      "border border-line-strong bg-surface text-pine-deep hover:border-pine hover:bg-paper",
    variant === "dark" && "bg-pine-deep text-snow hover:bg-pine",
    variant === "ghost-dark" &&
      "border border-white/20 text-snow hover:border-lime hover:text-lime",
  );
