import { cn } from "@/lib/utils";

/**
 * Site logo: the DEAL wordmark in a pine tile (as in the dashboards' sidebar and
 * the account pages) next to the Arabic name. `tone="dark"` for pine bands.
 */
export function DealLogo({
  className,
  onClick,
  tone = "light",
}: {
  className?: string;
  onClick?: () => void;
  tone?: "light" | "dark";
}) {
  return (
    <a
      href="/"
      onClick={onClick}
      className={cn("inline-flex min-h-11 items-center gap-2.5 select-none", className)}
      aria-label="ديل للتسويق — DEAL FOR MARKETING، الرئيسية"
    >
      <span
        className={cn(
          "grid h-10 place-items-center rounded-xl px-3",
          tone === "light" ? "bg-pine-deep text-lime" : "bg-lime text-pine-deep",
        )}
      >
        <DealWordmark className="h-[17px] w-auto" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-[19px]", tone === "light" ? "text-pine-deep" : "text-snow")}>ديل</span>
        <span className={cn("mt-1 text-[11px] font-bold", tone === "light" ? "text-slate" : "text-snow/60")}>
          للتسويق
        </span>
      </span>
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
