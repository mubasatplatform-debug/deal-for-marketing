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
