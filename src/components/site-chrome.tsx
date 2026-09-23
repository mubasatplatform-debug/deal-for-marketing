import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Instagram, Youtube } from "lucide-react";
import { DealLogo } from "@/components/logo";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Chrome = {
  menu: boolean;
  open: () => void;
  close: () => void;
};

const ChromeCtx = createContext<Chrome | null>(null);

export function useChrome() {
  const v = useContext(ChromeCtx);
  if (!v) throw new Error("chrome");
  return v;
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-lock", menu);
    return () => document.documentElement.classList.remove("menu-lock");
  }, [menu]);

  const open = useCallback(() => setMenu(true), []);
  const close = useCallback(() => setMenu(false), []);
  const value: Chrome = { menu, open, close };

  return (
    <ChromeCtx.Provider value={value}>
      <header
        dir="ltr"
        className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-hair/60 bg-ink px-5 md:h-18 md:px-8"
      >
        <button
          type="button"
          aria-label="القائمة"
          onClick={value.open}
          className="flex size-11 items-center justify-center text-snow touch-manipulation"
        >
          <span className="flex w-6 flex-col gap-1.5">
            <span className="h-px w-full bg-snow" />
            <span className="h-px w-full bg-snow" />
            <span className="h-px w-full bg-snow" />
          </span>
        </button>
        <div className="flex items-center gap-4">
          <AuthSlot />
          <DealLogo />
        </div>
      </header>

      <span
        aria-hidden="true"
        className="edge-tick pointer-events-none fixed top-24 left-3 z-40 h-16 w-px bg-lime/80 md:left-5"
      />

      <button
        type="button"
        aria-label="العودة للأعلى"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "fixed bottom-24 left-3 z-40 flex size-12 items-center justify-center bg-ink text-lime outline outline-hair transition-opacity duration-300 md:left-5",
          showTop ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>

      <MenuOverlay />
      {children}
    </ChromeCtx.Provider>
  );
}

function AuthSlot() {
  const { isPending } = useCurrentUserState();
  if (isPending) return <span className="inline-block h-8 w-14 bg-hair" />;
  return (
    <>
      <SignedOut>
        <a href="/login" className="inline-flex h-11 items-center px-2 font-display text-sm text-lime">
          دخول
        </a>
      </SignedOut>
      <SignedIn>
        <div className="max-w-40 text-snow [&_button]:text-lime [&_span]:truncate">
          <UserButton />
        </div>
      </SignedIn>
    </>
  );
}

function MenuOverlay() {
  const { menu, close } = useChrome();

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, close]);

  return (
    <div className={cn("menu-root fixed inset-0 z-50", menu ? "is-open" : "pointer-events-none")} inert={menu ? undefined : true}>
      <button
        type="button"
        aria-label="إغلاق القائمة"
        tabIndex={menu ? 0 : -1}
        onClick={close}
        className="menu-scrim absolute inset-0 bg-ink/70"
      />
      <div className="menu-panel absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-ink shadow-[1px_0_0_0_rgba(198,255,61,0.35)]">
        <div dir="ltr" className="flex shrink-0 items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={close}
            className="flex size-11 items-center justify-center text-lime touch-manipulation"
          >
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <DealLogo onClick={close} />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pt-6 pb-4 text-right">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={close}
              className="menu-link flex min-h-12 w-full items-center justify-end px-3 font-display text-xl font-semibold text-snow active:bg-lime active:text-ink"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#services"
            onClick={close}
            className="menu-link mt-2 flex min-h-12 w-full items-center justify-end px-3 font-display text-xl font-semibold text-lime active:bg-lime active:text-ink"
          >
            خدماتنا
          </a>
        </nav>
      </div>
    </div>
  );
}

export function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M14.7 10.3 22 2h-2.2l-6.1 6.9L8.7 2H2l7.7 10.9L2 22h2.2l6.6-7.5L15.3 22H22l-7.3-11.7Zm-2.3 2.6-.8-1.1-6-8.5h2.6l4.8 6.9.8 1.1 6.3 9h-2.6l-5.1-7.4Z" />
    </svg>
  );
}

export function SocialRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-5 text-mist", className)}>
      <a href="https://youtube.com" aria-label="YouTube" className="inline-flex size-11 items-center justify-center hover:text-lime">
        <Youtube className="size-5" strokeWidth={1.4} />
      </a>
      <a href="https://instagram.com" aria-label="Instagram" className="inline-flex size-11 items-center justify-center hover:text-lime">
        <Instagram className="size-5" strokeWidth={1.4} />
      </a>
      <a href="https://x.com/deal_adv_sa" aria-label="X" className="inline-flex size-11 items-center justify-center hover:text-lime">
        <XMark className="size-4" />
      </a>
    </div>
  );
}
