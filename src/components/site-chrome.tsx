import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Instagram, Youtube } from "lucide-react";
import { DealLogo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { mobile, phone } from "@/lib/content";

/** The one label for the signed-in customer area (/client) across the site (also used in start.$slug.tsx). */
const ACCOUNT_LABEL = "حسابي";

/** `/login` that brings the visitor back to where they were. */
function loginHref(path: string) {
  return path && path !== "/" && !path.startsWith("/login") ? `/login?redirect=${encodeURIComponent(path)}` : "/login";
}

type Chrome = {
  menu: boolean;
  open: () => void;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
};

const MENU_ID = "site-menu";

const ChromeCtx = createContext<Chrome | null>(null);

export function useChrome() {
  const v = useContext(ChromeCtx);
  if (!v) throw new Error("chrome");
  return v;
}

/**
 * `footer` defaults to showing the compact SiteFooter on every page except the
 * home page ("/"), which renders its own full footer.
 */
export function SiteChrome({ children, footer }: { children: ReactNode; footer?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showFooter = footer ?? pathname !== "/";
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
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
  const value: Chrome = { menu, open, close, trigger };

  return (
    <ChromeCtx.Provider value={value}>
      <header
        dir="ltr"
        className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-hair/60 bg-ink px-5 md:h-18 md:px-8"
      >
        <button
          ref={trigger}
          type="button"
          aria-label="القائمة"
          aria-expanded={menu}
          aria-controls={MENU_ID}
          onClick={value.open}
          className="flex size-11 items-center justify-center text-snow touch-manipulation"
        >
          <span className="flex w-6 flex-col gap-1.5">
            <span className="h-px w-full bg-snow" />
            <span className="h-px w-full bg-snow" />
            <span className="h-px w-full bg-snow" />
          </span>
        </button>
        <div className="flex items-center gap-2 md:gap-4">
          <a
            href="/start"
            className="hidden h-10 items-center bg-lime px-5 font-display text-sm text-ink transition-opacity hover:opacity-90 md:inline-flex"
          >
            اطلب خدمتك
          </a>
          <AuthSlot />
          <DealLogo className="ms-1 md:ms-2" />
        </div>
      </header>

      <span
        aria-hidden="true"
        className="edge-tick pointer-events-none fixed top-24 end-3 z-40 h-16 w-px bg-lime/80 md:end-5"
      />

      <button
        type="button"
        aria-label="العودة للأعلى"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "fixed bottom-24 end-3 z-40 flex size-12 items-center justify-center bg-ink text-lime outline outline-hair transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-lime md:end-5",
          showTop ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>

      <MenuOverlay />
      {children}
      {showFooter ? <SiteFooter /> : null}
    </ChromeCtx.Provider>
  );
}

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  // Same footprint in every state, so the header never shifts while the session resolves.
  const base =
    "inline-flex h-10 min-w-[4.5rem] items-center justify-center gap-2 border px-3 font-display text-sm transition-colors";
  if (isPending) return <span aria-hidden="true" className={cn(base, "border-hair")} />;
  if (!user) {
    return (
      <a href={loginHref(pathname)} className={cn(base, "border-hair text-snow hover:border-lime hover:text-lime")}>
        دخول
      </a>
    );
  }
  const initial = (user.displayName ?? user.primaryEmail ?? "؟").trim().charAt(0).toUpperCase();
  return (
    <a
      href="/client"
      aria-current={pathname === "/client" ? "page" : undefined}
      className={cn(base, "border-lime/60 text-lime hover:border-lime")}
    >
      <span aria-hidden="true" className="grid size-6 place-items-center bg-lime font-ui text-xs font-bold text-ink">
        {initial}
      </span>
      {ACCOUNT_LABEL}
    </a>
  );
}

function MenuOverlay() {
  const { menu, close, trigger } = useChrome();
  const nav0 = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(false);
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const [signingOut, setSigningOut] = useState(false);
  const links = nav.filter((item) => item.href !== "/client");

  useEffect(() => {
    if (menu) {
      nav0.current?.focus();
    } else if (wasOpen.current) {
      trigger.current?.focus();
    }
    wasOpen.current = menu;
  }, [menu, trigger]);

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
      <div
        id={MENU_ID}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة"
        className="menu-panel absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-ink">
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

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pt-6 pb-4 text-start">
          {links.map((item, idx) => (
            <a
              key={item.href}
              ref={idx === 0 ? nav0 : undefined}
              href={item.href}
              onClick={close}
              className="menu-link flex min-h-12 w-full items-center justify-end px-3 font-display text-xl font-semibold text-snow active:bg-lime active:text-ink"
            >
              {item.label}
            </a>
          ))}
          <a
            href="/#services"
            onClick={close}
            className="menu-link flex min-h-12 w-full items-center justify-end px-3 font-display text-xl font-semibold text-snow active:bg-lime active:text-ink"
          >
            خدماتنا
          </a>
        </nav>

        <div className="shrink-0 space-y-3 border-t border-hair px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-start">
          {isPending ? (
            <span aria-hidden="true" className="block h-12 bg-hair/60" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <a
                href="/client"
                onClick={close}
                className="flex h-12 flex-1 items-center justify-center bg-lime font-display text-ink"
              >
                {ACCOUNT_LABEL}
              </a>
              {authEnabled ? (
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    void signOut("/").catch(() => setSigningOut(false));
                  }}
                  className="h-12 border border-hair px-4 font-display text-sm text-mist hover:text-snow disabled:opacity-60"
                >
                  {signingOut ? "جارٍ الخروج…" : "تسجيل الخروج"}
                </button>
              ) : null}
            </div>
          ) : (
            <a
              href={loginHref(pathname)}
              onClick={close}
              className="flex h-12 items-center justify-center border border-lime font-display text-lime"
            >
              دخول / حساب جديد
            </a>
          )}
          <div className="flex items-center justify-between gap-3 text-sm">
            <a href={`tel:${phone.tel}`} className="inline-flex min-h-11 items-center gap-2 text-mist hover:text-lime">
              اتصال
              <span dir="ltr" className="font-ui text-snow">
                {phone.display}
              </span>
            </a>
            <a href={`https://wa.me/${mobile.wa}`} className="inline-flex min-h-11 items-center text-lime hover:opacity-80">
              واتساب
            </a>
          </div>
        </div>
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
