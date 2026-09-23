import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronsUpDown, CircleHelp, Lock, Search, Settings } from "lucide-react";
import { DealWordmark } from "@/components/logo";
import { Face } from "@/components/desks/kit";
import { cn } from "@/lib/utils";

/**
 * Static showcase frame for DEAL's product desks (the homepage stills are shot
 * from it). Same visual language as the real dashboards — pine sidebar, paper
 * canvas, white cards — but every nav item is inert: these are stages, not apps.
 * With `?shot=1` the desk is wrapped in a quiet browser window for screenshots.
 *
 * Below `lg` the sidebar gives way to a scrollable tab row (real links, so a
 * phone visitor can move between views) and the panes reflow to one column;
 * from `lg` up — and always in shot mode — the desk keeps its desktop layout.
 */

/** The desk routes; each takes the view id as `$view`. */
export type DeskRoute = "/desk/crm/$view" | "/desk/law/$view" | "/desk/pay/$view";

export type DeskNavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

function useShot() {
  const [shot, setShot] = useState(false);
  useEffect(() => {
    setShot(new URLSearchParams(window.location.search).get("shot") === "1");
  }, []);
  return shot;
}

export function DeskFrame({
  product,
  workspace,
  workspaceMark,
  workspaceMeta,
  path,
  route,
  view,
  nav,
  more,
  user,
  searchHint,
  status,
  title,
  subtitle,
  actions,
  bare = false,
  children,
}: {
  /** Product name shown under the wordmark, e.g. "الحل اللحظي". */
  product: string;
  /** The (fictional) business using the product. */
  workspace: string;
  /** One letter (or a small icon) for the workspace tile. */
  workspaceMark: ReactNode;
  workspaceMeta: string;
  /** URL path shown in the screenshot browser bar. */
  path: string;
  /** Route the mobile tab row links to, with each nav id as `$view`. */
  route: DeskRoute;
  view: string;
  nav: readonly DeskNavItem[];
  more?: readonly DeskNavItem[];
  user: { name: string; role: string };
  searchHint: string;
  /** Small live-state chip in the top bar. */
  status?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Full-bleed views (inbox, calendar) draw their own panes without the page header. */
  bare?: boolean;
  children: ReactNode;
}) {
  const shot = useShot();

  const app = (
    <div
      dir="rtl"
      className={cn(
        "flex bg-paper font-dash leading-normal text-pine-deep",
        shot ? "h-full min-h-0" : "h-dvh",
      )}
    >
      <aside
        className={cn("w-[244px] shrink-0 flex-col bg-pine-deep", shot ? "flex" : "hidden lg:flex")}
      >
        <div className="px-5 pt-6 pb-5">
          <DealWordmark className="h-[18px] w-auto text-lime" />
          <p className="mt-3 text-[17px] leading-tight font-bold text-snow">{product}</p>
        </div>

        <div className="mx-3 flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/[0.06] ring-inset">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime text-[13px] font-bold text-pine-deep">
            {workspaceMark}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-snow">{workspace}</p>
            <p className="truncate text-[11px] text-snow/50">{workspaceMeta}</p>
          </div>
          <ChevronsUpDown className="size-4 text-snow/40" />
        </div>

        <nav aria-label={product} className="mt-6 space-y-0.5 px-3">
          {nav.map((item) => (
            <NavRow key={item.id} item={item} active={item.id === view} />
          ))}
        </nav>

        {more?.length ? (
          <div className="mt-6 px-3">
            <p className="px-3 pb-1.5 text-[11px] font-semibold text-snow/35">مساحة العمل</p>
            <div className="space-y-0.5">
              {more.map((item) => (
                <NavRow key={item.id} item={item} active={false} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto space-y-0.5 px-3 pb-2">
          <NavRow item={{ id: "settings", label: "الإعدادات", icon: Settings }} active={false} />
          <NavRow item={{ id: "help", label: "المساعدة", icon: CircleHelp }} active={false} />
        </div>
        <div className="mx-3 mb-3 flex items-center gap-3 border-t border-white/[0.07] px-2 pt-3">
          <Face name={user.name} tone="lime" className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-snow">{user.name}</p>
            <p className="truncate text-[11px] text-snow/50">{user.role}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6 max-sm:gap-2.5 max-sm:px-4">
          {shot ? null : (
            <div className="flex shrink-0 items-center gap-2.5 lg:hidden">
              <span className="grid h-9 place-items-center rounded-xl bg-pine-deep px-2.5">
                <DealWordmark className="h-3.5 w-auto text-lime" />
              </span>
              <span className="hidden text-[14px] font-bold whitespace-nowrap sm:inline">
                {product}
              </span>
            </div>
          )}
          <span
            role="img"
            aria-label={searchHint}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-paper text-slate sm:hidden"
          >
            <Search className="size-4" />
          </span>
          <div className="flex h-9 w-full max-w-[380px] items-center gap-2.5 rounded-xl border border-line bg-paper px-3 text-slate max-sm:hidden">
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate text-[13px] text-slate/80">{searchHint}</span>
            <kbd
              className="hidden rounded-md border border-line bg-surface px-1.5 font-ui text-[10px] leading-5 font-semibold text-slate sm:inline"
              dir="ltr"
            >
              Ctrl K
            </kbd>
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-2 max-sm:gap-1.5">
            {status}
            <span className="relative grid size-9 place-items-center rounded-xl text-slate">
              <Bell className="size-[18px]" />
              <span className="absolute end-2 top-2 size-2 rounded-full bg-lime ring-2 ring-surface" />
            </span>
            <span className="mx-1 h-6 w-px bg-line max-sm:hidden" />
            <Face name={user.name} tone="pine" className="size-8" />
          </div>
        </header>

        {shot ? null : <MobileNav nav={nav} view={view} route={route} label={product} />}

        <main className={cn("min-h-0 flex-1", shot ? "overflow-hidden" : "overflow-auto")}>
          <div className={cn("h-full", !shot && "lg:min-w-[1080px]")}>
            {bare ? (
              children
            ) : (
              <div className="px-8 pt-6 pb-10 max-lg:px-6 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
                {title ? (
                  <div className="mb-6 flex items-end justify-between gap-6 max-sm:mb-5 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
                    <div className="min-w-0">
                      <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-pine-deep max-sm:text-[20px]">
                        {title}
                      </h1>
                      {subtitle ? <p className="mt-1 text-[13px] text-slate">{subtitle}</p> : null}
                    </div>
                    {actions ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
                    ) : null}
                  </div>
                ) : null}
                {children}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );

  if (!shot) return app;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink bg-[radial-gradient(90%_70%_at_50%_0%,#12292b_0%,#050505_70%)] px-8 pt-8">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[14px] bg-[#1b1f1f] ring-1 ring-white/10">
        <div className="relative flex h-10 shrink-0 items-center px-4" dir="ltr">
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-white/15" />
            <span className="size-3 rounded-full bg-white/15" />
            <span className="size-3 rounded-full bg-white/15" />
          </div>
          <div className="absolute inset-x-0 mx-auto flex h-6 w-[420px] items-center justify-center gap-2 rounded-md bg-white/[0.06] font-ui text-[12px] text-snow/55">
            <Lock className="size-3" />
            app.dealadv.sa<span className="text-snow/35">/{path}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1">{app}</div>
      </div>
    </div>
  );
}

function NavRow({ item, active }: { item: DeskNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <span
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold",
        active ? "bg-white/[0.08] text-snow" : "text-snow/60",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-lime"
        />
      ) : null}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-lime" : "text-snow/45")} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-lime px-2 font-ui text-[11px] leading-5 font-bold text-pine-deep tabular-nums">
          {item.badge}
        </span>
      ) : null}
    </span>
  );
}

/** Below `lg`: the sidebar's views as a horizontally scrollable row of tabs. */
function MobileNav({
  nav,
  view,
  route,
  label,
}: {
  nav: readonly DeskNavItem[];
  view: string;
  route: DeskRoute;
  label: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Keep the current view's tab in sight when it sits past the row's edge.
  useEffect(() => {
    const row = rowRef.current;
    const tab = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !tab) return;
    const r = row.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (t.left < r.left + 16) row.scrollBy({ left: t.left - r.left - 16 });
    else if (t.right > r.right - 16) row.scrollBy({ left: t.right - r.right + 16 });
  }, [view]);
  return (
    <nav aria-label={label} className="shrink-0 border-b border-line bg-surface lg:hidden">
      <div
        ref={rowRef}
        className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.id === view;
          return (
            <Link
              key={item.id}
              to={route}
              params={{ view: item.id }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-pine-deep text-snow"
                  : "text-slate hover:bg-pine-50 hover:text-pine-deep",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-lime" : "text-slate/80")} />
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 font-ui text-[11px] leading-[18px] font-bold tabular-nums",
                    active ? "bg-lime text-pine-deep" : "bg-lime-50 text-lime-600",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Live-state chip for the top bar: a soft pine pill with a lime pulse. `detail`
 * follows after a dot and drops on phones so the chip stays on one line.
 */
export function LiveChip({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <span className="me-1 inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-pine-50 px-3 text-xs font-semibold whitespace-nowrap text-pine ring-1 ring-pine-100 ring-inset max-sm:me-0 max-sm:px-2.5">
      <span className="size-2 shrink-0 rounded-full bg-lime-600 ring-[3px] ring-lime/30" />
      {detail ? (
        <span>
          {children}
          <span className="max-sm:hidden"> · {detail}</span>
        </span>
      ) : (
        children
      )}
    </span>
  );
}
