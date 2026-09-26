import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The 6-digit WhatsApp code field: one input (so paste, autofill and screen
 * readers just work), Arabic-Indic digits accepted, spaced for reading.
 */
export function CodeInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value
            .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
            .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
            .replace(/\D/g, "")
            .slice(0, 6),
        )
      }
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      dir="ltr"
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      placeholder="••••••"
      className={cn(
        "h-14 w-full rounded-xl border bg-surface text-center font-ui text-2xl font-bold tracking-[0.5em] text-pine-deep tabular-nums outline-none transition-colors placeholder:text-line-strong focus-visible:border-pine focus-visible:ring-2 focus-visible:ring-pine/20",
        invalid ? "border-red-500" : "border-line-strong",
      )}
    />
  );
}

/** "Sent to WhatsApp" line with the masked number. */
export function SentTo({ phone }: { phone: string }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed text-slate">
      <MessageCircle className="mt-0.5 size-4 shrink-0 text-[#1f9d55]" aria-hidden="true" />
      <span>
        أرسلنا رمزًا من ٦ أرقام إلى جوالك{" "}
        <span dir="ltr" className="inline-block font-ui font-semibold whitespace-nowrap text-pine-deep">
          {phone}
        </span>
      </span>
    </p>
  );
}

/** Resend link with a cool-down, so nobody hammers the send button. */
export function Resend({ onResend, seconds = 45, busy }: { onResend: () => void; seconds?: number; busy?: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <button
      type="button"
      disabled={left > 0 || busy}
      onClick={() => {
        setLeft(seconds);
        onResend();
      }}
      className="min-h-9 text-[13px] font-semibold text-pine underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate disabled:no-underline"
    >
      {left > 0 ? `إعادة الإرسال بعد ${left.toLocaleString("ar-SA")} ث` : "إعادة إرسال الرمز"}
    </button>
  );
}
