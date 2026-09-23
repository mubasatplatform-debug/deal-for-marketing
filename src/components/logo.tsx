import { cn } from "@/lib/utils";

export function DealLogo({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <a
      href="/"
      onClick={onClick}
      className={cn("flex items-center gap-3 select-none", className)}
      aria-label="ديل DEAL FOR MARKETING"
    >
      <span className="font-display text-xl text-lime md:text-2xl">ديل</span>
      <img src="/images/logo-deal.png" alt="DEAL FOR MARKETING" className="h-8 w-auto md:h-9" />
    </a>
  );
}

/**
 * The DEAL wordmark as vector (D with the play-mark cut out, triangular A with
 * its notch), drawn in `currentColor` so it can sit pine on the lime band like
 * the brand board. Cut-outs are transparent and show the surface behind.
 */
export function DealWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 40" role="img" aria-label="DEAL" className={className}>
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M0 0H17A20 20 0 0 1 17 40H0Z M7 11L23 20L7 29Z M41 0H63V8H50V16H61V24H50V32H63V40H41Z M66 40L82 0L98 40H89L82 22L75 40Z M101 0H110V32H125V40H101Z"
      />
      <path fill="currentColor" d="M79 40L82 33.5L85 40Z" />
    </svg>
  );
}
