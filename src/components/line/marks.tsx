import { cn } from "@/lib/utils";

/** The DEAL play-triangle, as drawn in identity-break.tsx. Always points right, like the wordmark. */
export function PlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 20" className={cn("h-3 w-auto", className)} aria-hidden="true" focusable="false">
      <polygon points="0,0 18,10 0,20" fill="currentColor" />
    </svg>
  );
}

/** Outlined + filled triangle pair from the brand board, for the header mark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative flex size-10 shrink-0 items-center justify-center bg-lime text-pine", className)}
    >
      <svg viewBox="0 0 24 24" className="size-6" focusable="false">
        <polygon points="4,2 22,12 4,22" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <polygon points="7.5,7.5 15.5,12 7.5,16.5" fill="currentColor" />
      </svg>
    </span>
  );
}

/** Assistant avatar: lime mark on a pine square. */
export function LineAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-8 shrink-0 items-center justify-center border border-pine-soft bg-pine text-lime", className)}
    >
      <PlayMark className="h-3" />
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative flex size-2", className)}>
      <span className="absolute inset-0 bg-lime opacity-60 motion-safe:animate-ping" />
      <span className="relative size-2 bg-lime" />
    </span>
  );
}
