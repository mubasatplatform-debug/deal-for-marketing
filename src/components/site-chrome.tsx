import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  const value: Chrome = {
    menu,
    open: () => setMenu(true),
    close: () => setMenu(false),
  };

  return (
    <ChromeCtx.Provider value={value}>
      <header
        dir="ltr"
        className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between bg-ink/95 px-5 backdrop-blur-sm md:h-18 md:px-8"
      >
        <button
          type="button"
          aria-label="القائمة"
          onClick={value.open}
          className="flex size-11 items-center justify-center text-snow"
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
        <a href="/login" className="font-ui text-xs tracking-[0.2em] text-lime">
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

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        menu ? "open translate-y-0" : "pointer-events-none -translate-y-full",
      )}
      aria-hidden={!menu}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-lime" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-lime" />

      <div dir="ltr" className="flex items-center justify-between px-5 pt-5 md:px-8">
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={close}
          className="flex size-11 items-center justify-center text-lime"
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <DealLogo onClick={close} />
      </div>

      <nav className="flex flex-col items-end gap-4 px-8 pt-16 text-right">
        {nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={close}
            className="menu-link font-display text-2xl font-semibold text-snow hover:text-lime"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <a
        href="#services"
        onClick={close}
        className="absolute bottom-[34%] left-6 flex items-center gap-2 font-display text-sm text-lime"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        خدماتنا
      </a>

      <div className="absolute inset-x-0 bottom-0 h-[30%] overflow-hidden">
        <img
          src="/images/menu-bg.jpg"
          alt=""
          className="h-full w-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-ink/25" />
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
      <a href="https://youtube.com" aria-label="YouTube" className="hover:text-lime">
        <Youtube className="size-5" strokeWidth={1.4} />
      </a>
      <a href="https://instagram.com" aria-label="Instagram" className="hover:text-lime">
        <Instagram className="size-5" strokeWidth={1.4} />
      </a>
      <a href="https://x.com/deal_adv_sa" aria-label="X" className="hover:text-lime">
        <XMark className="size-4" />
      </a>
    </div>
  );
}
