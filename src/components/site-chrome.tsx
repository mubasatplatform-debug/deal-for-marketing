import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ArrowUp, ChevronLeft, Instagram, Menu, Phone, X, Youtube } from "lucide-react";
import { DealLogo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { siteButton, wrap } from "@/components/site-classes";
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

/** Desktop navigation: the home sections plus the Line demo, in page order. */
const primaryNav = [
  { href: "/#systems", label: "الأنظمة" },
  { href: "/#services", label: "خدماتنا" },
  { href: "/line", label: "خط ديل" },
  { href: "/#works", label: "أعمالنا" },
  { href: "/#about", label: "من نحن" },
  { href: "/#contact", label: "تواصل معنا" },
] as const;

/** `footer` defaults to showing the SiteFooter; the full-height /line app turns it off. */
export function SiteChrome({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setShowTop(window.scrollY > 900);
    };
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
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b bg-paper/90 backdrop-blur-md transition-[border-color,box-shadow] duration-200",
          scrolled ? "border-line shadow-[0_1px_0_rgba(16,38,40,0.04),0_8px_24px_-18px_rgba(16,38,40,0.3)]" : "border-transparent",
        )}
      >
        <div className={cn(wrap, "flex h-16 items-center gap-3 md:h-[72px]")}>
          <DealLogo />
          <nav aria-label="أقسام الموقع" className="ms-6 hidden items-center gap-0.5 lg:flex">
            {primaryNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex h-11 items-center rounded-lg px-3 text-[15px] font-semibold text-pine-deep/75 transition-colors hover:bg-pine-50 hover:text-pine-deep"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <a
              href={`tel:${phone.tel}`}
              className="hidden h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-pine-deep hover:bg-pine-50 xl:inline-flex"
            >
              <Phone className="size-4 text-pine" aria-hidden="true" />
              <span dir="ltr" className="font-ui">
                {phone.display}
              </span>
            </a>
            <span className="hidden sm:inline-flex">
              <AuthSlot />
            </span>
            <a href="/start" className={cn(siteButton("primary"), "h-11 px-4 text-sm sm:px-5")}>
              اطلب خدمتك
            </a>
            <button
              ref={trigger}
              type="button"
              aria-label="القائمة"
              aria-expanded={menu}
              aria-controls={MENU_ID}
              onClick={value.open}
              className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-pine-deep touch-manipulation lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <button
        type="button"
        aria-label="العودة للأعلى"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "fixed bottom-24 end-4 z-30 grid size-11 place-items-center rounded-full border border-line bg-surface text-pine-deep shadow-[var(--shadow-card)] transition-opacity duration-300 hover:border-pine md:end-6",
          showTop ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ArrowUp className="size-5" aria-hidden="true" />
      </button>

      <MenuOverlay />
      {children}
      {footer ? <SiteFooter /> : null}
    </ChromeCtx.Provider>
  );
}

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  // Same footprint in every state, so the header never shifts while the session resolves.
  const base =
    "inline-flex h-11 min-w-[4.5rem] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors";
  if (isPending) return <span aria-hidden="true" className={cn(base, "border-line bg-surface")} />;
  if (!user) {
    return (
      <a href={loginHref(pathname)} className={cn(base, "border-line bg-surface text-pine-deep hover:border-pine")}>
        دخول
      </a>
    );
  }
  const initial = (user.displayName ?? user.primaryEmail ?? "؟").trim().charAt(0).toUpperCase();
  return (
    <a
      href="/client"
      aria-current={pathname === "/client" ? "page" : undefined}
      className={cn(base, "border-line bg-surface text-pine-deep hover:border-pine")}
    >
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-pine font-ui text-xs font-bold text-lime">
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
        className="menu-scrim absolute inset-0 bg-pine-deep/45"
      />
      <div
        id={MENU_ID}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة"
        className="menu-panel absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-paper"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <DealLogo onClick={close} />
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={close}
            className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-pine-deep touch-manipulation"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="القائمة الرئيسية" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3">
          {links.map((item, idx) => (
            <a
              key={item.href}
              ref={idx === 0 ? nav0 : undefined}
              href={item.href}
              onClick={close}
              className="menu-link flex min-h-13 w-full items-center justify-between gap-3 rounded-xl px-3 text-[17px] font-bold text-pine-deep hover:bg-pine-50 active:bg-pine-100"
            >
              {item.label}
              <ChevronLeft className="size-4 text-slate" aria-hidden="true" />
            </a>
          ))}
          <a
            href="/#services"
            onClick={close}
            className="menu-link flex min-h-13 w-full items-center justify-between gap-3 rounded-xl px-3 text-[17px] font-bold text-pine-deep hover:bg-pine-50 active:bg-pine-100"
          >
            خدماتنا
            <ChevronLeft className="size-4 text-slate" aria-hidden="true" />
          </a>
        </nav>

        <div className="shrink-0 space-y-3 border-t border-line bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isPending ? (
            <span aria-hidden="true" className="block h-12 rounded-xl bg-pine-50" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <a href="/client" onClick={close} className={cn(siteButton("dark"), "flex-1")}>
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
                  className={cn(siteButton("secondary"), "text-sm disabled:opacity-60")}
                >
                  {signingOut ? "جارٍ الخروج…" : "تسجيل الخروج"}
                </button>
              ) : null}
            </div>
          ) : (
            <a href={loginHref(pathname)} onClick={close} className={cn(siteButton("secondary"), "w-full")}>
              دخول / حساب جديد
            </a>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <a
              href={`tel:${phone.tel}`}
              className="flex min-h-12 flex-col justify-center rounded-xl border border-line px-3 py-1.5 hover:border-pine"
            >
              <span className="text-xs font-semibold text-slate">اتصال</span>
              <span dir="ltr" className="text-end font-ui font-bold text-pine-deep">
                {phone.display}
              </span>
            </a>
            <a
              href={`https://wa.me/${mobile.wa}`}
              className="flex min-h-12 flex-col justify-center rounded-xl border border-line px-3 py-1.5 hover:border-pine"
            >
              <span className="text-xs font-semibold text-slate">واتساب</span>
              <span dir="ltr" className="text-end font-ui font-bold text-pine-deep">
                {mobile.display}
              </span>
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

export function SocialRow({ className, dark }: { className?: string; dark?: boolean }) {
  const item = cn(
    "grid size-11 place-items-center rounded-xl border transition-colors",
    dark ? "border-white/15 text-snow/80 hover:border-lime hover:text-lime" : "border-line text-pine hover:border-pine",
  );
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a href="https://youtube.com" aria-label="YouTube" className={item}>
        <Youtube className="size-5" strokeWidth={1.6} />
      </a>
      <a href="https://instagram.com" aria-label="Instagram" className={item}>
        <Instagram className="size-5" strokeWidth={1.6} />
      </a>
      <a href="https://x.com/deal_adv_sa" aria-label="X" className={item}>
        <XMark className="size-4" />
      </a>
    </div>
  );
}
