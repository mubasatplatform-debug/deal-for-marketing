import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { DealWordmark } from "@/components/logo";
import { Avatar } from "@/components/dash/ui";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: number;
  /** Runs before the link's own navigation (e.g. to set a filter). */
  onClick?: () => void;
};

type ShellProps = {
  /** Product area shown under the wordmark, e.g. "لوحة الفريق". */
  area: string;
  nav: NavItem[];
  user: { name: string; email?: string | null };
  onSignOut?: () => void;
  /** A sign-out is in flight: the button is disabled until it fails or leaves. */
  signingOut?: boolean;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Application frame for every DEAL dashboard: pine sidebar at the inline
 * start (right in RTL), a light paper canvas, and a sticky top bar. On small
 * screens the sidebar becomes a modal drawer: the rest of the page is
 * `inert` while it is open (so Tab stays inside), and focus returns to the
 * menu button when it closes.
 */
export function DashShell({
  area,
  nav,
  user,
  onSignOut,
  signingOut,
  title,
  subtitle,
  actions,
  children,
}: ShellProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const btn = trigger.current;
    panel.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      btn?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-dvh bg-paper font-dash text-pine-deep">
      {/* Overscroll and short pages show paper, not the marketing site's ink. */}
      <style>{"html,body{background:var(--color-paper)}"}</style>
      {/* Desktop sidebar */}
      <aside
        inert={open}
        className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-pine-deep lg:flex"
      >
        <Sidebar
          area={area}
          nav={nav}
          user={user}
          onSignOut={onSignOut}
          signingOut={signingOut}
        />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            tabIndex={-1}
            className="absolute inset-0 bg-pine-deep/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="القائمة"
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-pine-deep shadow-2xl"
          >
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
              className="absolute end-3 top-4 grid size-9 place-items-center rounded-lg text-snow/70 hover:bg-white/5 hover:text-snow"
            >
              <X className="size-5" />
            </button>
            <Sidebar
              area={area}
              nav={nav}
              user={user}
              onSignOut={onSignOut}
              signingOut={signingOut}
            />
          </div>
        </div>
      ) : null}

      {/* Everything behind the open drawer is inert: no focus, no clicks, hidden from AT. */}
      <div inert={open} className="lg:ps-64">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 md:px-8">
            <button
              ref={trigger}
              type="button"
              aria-label="القائمة"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-pine lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <a href="/" aria-label="ديل — الموقع" className="text-pine lg:hidden">
              <DealWordmark className="h-5 w-auto" />
            </a>
            <div className="ms-auto flex items-center gap-2">{actions}</div>
          </div>
        </header>

        <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-16 md:px-8 md:pt-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-pine-deep md:text-[28px]">
              {title}
            </h1>
            {subtitle ? <p className="mt-1 text-sm text-slate">{subtitle}</p> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  area,
  nav,
  user,
  onSignOut,
  signingOut,
}: Pick<ShellProps, "area" | "nav" | "user" | "onSignOut" | "signingOut">) {
  return (
    <>
      <div className="px-6 pt-6 pb-8">
        <a href="/" aria-label="ديل — الموقع" className="inline-flex text-lime">
          <DealWordmark className="h-7 w-auto" />
        </a>
        <p className="mt-2 text-xs font-semibold text-snow/50">{area}</p>
      </div>
      <nav aria-label={area} className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <a
            key={item.href + item.label}
            href={item.href}
            onClick={item.onClick}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
              item.active
                ? "bg-white/[0.07] text-snow"
                : "text-snow/60 hover:bg-white/[0.04] hover:text-snow",
            )}
          >
            {item.active ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-lime"
              />
            ) : null}
            <item.icon className={cn("size-[18px]", item.active ? "text-lime" : "")} />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-lime px-2 font-ui text-[11px] leading-5 font-bold text-pine-deep tabular-nums">
                {item.badge}
              </span>
            ) : null}
          </a>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3">
        <Avatar name={user.name} className="bg-lime text-pine-deep" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-snow">{user.name}</p>
          {user.email ? (
            <p className="truncate font-ui text-[11px] text-snow/50">{user.email}</p>
          ) : null}
        </div>
        {onSignOut ? (
          <button
            type="button"
            aria-label={signingOut ? "جارٍ تسجيل الخروج" : "تسجيل الخروج"}
            aria-busy={signingOut || undefined}
            disabled={signingOut}
            onClick={onSignOut}
            className="grid size-8 place-items-center rounded-lg text-snow/60 hover:bg-white/10 hover:text-snow disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut className="size-4" />
          </button>
        ) : null}
      </div>
    </>
  );
}
