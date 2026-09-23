import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { DealWordmark } from "@/components/logo";
import { mobile, phone } from "@/lib/content";

/**
 * The quiet single-card layout for account recovery pages (forgot / reset
 * password): same light product surface as /login's form panel and /client.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper font-dash text-pine-deep">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <a href="/" aria-label="ديل — الرئيسية" className="inline-flex min-h-11 items-center">
          <span className="grid h-10 place-items-center rounded-xl bg-pine-deep px-3">
            <DealWordmark className="h-[18px] w-auto text-lime" />
          </span>
        </a>
        <a
          href="/login"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate hover:text-pine-deep"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          تسجيل الدخول
        </a>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:pt-0">
        <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-[15px] leading-relaxed text-slate">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
      </main>

      <footer className="px-4 pb-8 text-center text-[13px] text-slate">
        تحتاج مساعدة؟ اتصل على{" "}
        <a href={`tel:${phone.tel}`} className="font-semibold text-pine-deep" dir="ltr">
          {phone.display}
        </a>{" "}
        أو واتساب{" "}
        <a href={`https://wa.me/${mobile.wa}`} className="font-semibold text-pine-deep" dir="ltr">
          {mobile.display}
        </a>
      </footer>
    </div>
  );
}

export const authFieldClass =
  "h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-left font-ui text-[15px] text-pine-deep outline-none transition-[border-color,box-shadow] placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10";

export const authButtonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep transition-colors hover:bg-[#b3bf28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:cursor-wait disabled:opacity-70";
