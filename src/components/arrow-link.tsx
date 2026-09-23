import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold text-lime transition-opacity hover:opacity-80",
        className,
      )}
    >
      {children}
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </a>
  );
}
