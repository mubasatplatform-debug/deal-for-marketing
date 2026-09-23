import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import { officeInitial } from "@/components/law/format";

/**
 * Shell of the client-facing pages (/o/<slug>/book, /meet/<token>): the
 * OFFICE is the brand here; «مكتب المحامي» only signs the footer.
 */
export function PublicShell({
  office,
  city,
  eyebrow,
  children,
}: {
  office: string | null;
  city?: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper font-dash text-pine-deep">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 md:px-8">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine text-lg font-bold text-lime">
            {office ? officeInitial(office) || <Scale className="size-5" /> : <Scale className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate">{eyebrow}</p>
            <p className="truncate text-[17px] leading-tight font-extrabold">{office ?? "مكتب المحامي"}</p>
          </div>
          {city ? <span className="ms-auto hidden text-[13px] text-slate sm:inline">{city}</span> : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-line py-5 text-center text-[12px] text-slate">
        يعمل عبر{" "}
        <a href="/law" className="font-semibold text-pine hover:underline">
          مكتب المحامي
        </a>{" "}
        من ديل ·{" "}
        <a href="/privacy#law" className="hover:underline">
          الخصوصية
        </a>
      </footer>
    </div>
  );
}
