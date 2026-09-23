import { Check, Copy, MessageCircle } from "lucide-react";
import { useCopy } from "@/components/keys/use-copy";
import { cn } from "@/lib/utils";

/** A read-only link with copy + WhatsApp share (booking page, client meeting link). */
export function ShareLink({
  url,
  label,
  message,
  className,
}: {
  url: string;
  label: string;
  /** WhatsApp text; the URL is appended. */
  message: string;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-line bg-paper px-3">
        <span className="sr-only">{label}</span>
        <code dir="ltr" className="truncate font-ui text-[13px] text-pine-deep select-all">
          {url}
        </code>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void copy(url)}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-semibold text-snow hover:bg-pine-deep sm:flex-none"
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "نُسخ" : "نسخ"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-paper sm:flex-none"
        >
          <MessageCircle className="size-4 text-pine" aria-hidden="true" />
          واتساب
        </a>
      </div>
    </div>
  );
}
