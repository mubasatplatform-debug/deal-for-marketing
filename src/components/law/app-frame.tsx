import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  BarChart3,
  LogOut,
  Menu,
  MessageCircle,
  PhoneCall,
  Plus,
  ReceiptText,
  Scale,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { DealWordmark } from "@/components/logo";
import { Avatar } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { MODULES } from "@/components/law/modules";
import { InboxNavIcon } from "@/components/law/inbox/nav-badge";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { daysAr, dateAr, officeInitial } from "@/components/law/format";
import { can, type Action } from "@/lib/law/permissions";
import { ROLE_LABELS, type Lifecycle } from "@/lib/saas/lifecycle";
import { getPlan } from "@/lib/saas/plans";
import type { AppContext, ActiveWorkspace, MembershipSummary } from "@/lib/saas/workspace";
import { mobile } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * The «مكتب المحامي» application frame — the law-desk demo's visual language
 * (pine sidebar with the office tile, paper canvas, white top bar) with real
 * navigation, an office switcher, and the subscription banners. Below `lg`
 * the sidebar becomes a modal drawer (rest of the page inert, Esc closes,
 * focus returns to the menu button).
 */

type NavEntry = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  soon?: boolean;
  /** Shown only to roles allowed this action. */
  need?: Action;
};

const MAIN: NavEntry[] = [
  { to: "/app", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/app/assistant", label: "مساعد المكتب", icon: Sparkles },
  { to: "/app/inbox", label: "التواصل", icon: InboxNavIcon },
  { to: "/app/calls", label: "المكالمات", icon: PhoneCall },
  ...MODULES.map((m) => ({ to: `/app/${m.id}`, label: m.label, icon: m.icon })),
];

const OFFICE: NavEntry[] = [
  { to: "/app/invoices", label: "الفواتير", icon: ReceiptText, need: "invoice.view" },
  { to: "/app/reports", label: "التقارير", icon: BarChart3 },
  { to: "/app/team", label: "الفريق", icon: Users },
  { to: "/app/settings", label: "الإعدادات", icon: Settings },
  { to: "/app/billing", label: "الاشتراك", icon: CreditCard },
];

export function LawAppFrame({
  ctx,
  active,
  onSwitch,
  onSignOut,
  signingOut,
  children,
}: {
  ctx: AppContext;
  active: ActiveWorkspace;
  onSwitch: (workspaceId: string) => void;
  onSignOut?: () => void;
  signingOut?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Navigating closes the drawer.
  useEffect(() => setOpen(false), [pathname]);

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

  const sidebar = (
    <Sidebar
      ctx={ctx}
      active={active}
      pathname={pathname}
      onSwitch={onSwitch}
      onSignOut={onSignOut}
      signingOut={signingOut}
    />
  );

  return (
    <div className="min-h-dvh bg-paper font-dash text-pine-deep">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <aside inert={open} className="fixed inset-y-0 start-0 z-30 hidden w-[256px] flex-col bg-pine-deep lg:flex">
        {sidebar}
      </aside>

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
            className="absolute inset-y-0 start-0 flex w-[288px] max-w-[86vw] flex-col bg-pine-deep shadow-2xl"
          >
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
              className="absolute end-3 top-5 z-10 grid size-9 place-items-center rounded-lg text-snow/70 hover:bg-white/5 hover:text-snow"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div inert={open} className="lg:ps-[256px]">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 md:px-8">
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
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime text-pine-deep">
                <Scale className="size-4" aria-hidden="true" />
              </span>
              <span className="truncate text-[14px] font-bold">{active.workspace.name}</span>
            </div>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <StatusChip lifecycle={active.lifecycle} plan={active.workspace.plan} />
            </div>
          </div>
        </header>

        <LifecycleBanner lifecycle={active.lifecycle} canPay={active.role === "owner" || active.role === "admin"} />

        <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-8 md:pt-8">
          <div className="space-y-5 md:space-y-6">
            <VerifyEmailBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  ctx,
  active,
  pathname,
  onSwitch,
  onSignOut,
  signingOut,
}: {
  ctx: AppContext;
  active: ActiveWorkspace;
  pathname: string;
  onSwitch: (id: string) => void;
  onSignOut?: () => void;
  signingOut?: boolean;
}) {
  const isActive = (to: string) => (to === "/app" ? pathname === "/app" || pathname === "/app/" : pathname.startsWith(to));
  return (
    <>
      <div className="px-5 pt-6 pb-5">
        <a href="/law" aria-label="مكتب المحامي — ديل" className="inline-flex text-lime">
          <DealWordmark className="h-[18px] w-auto" />
        </a>
        <p className="mt-3 text-[17px] leading-tight font-bold text-snow">مكتب المحامي</p>
      </div>

      <Switcher ctx={ctx} active={active} onSwitch={onSwitch} />

      <nav aria-label="أقسام المكتب" className="mt-6 flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {MAIN.map((item) => (
            <NavRow key={item.to} item={item} current={isActive(item.to)} />
          ))}
        </ul>
        <p className="mt-6 px-3 pb-1.5 text-[11px] font-semibold text-snow/40">المكتب</p>
        <ul className="space-y-0.5">
          {OFFICE.filter((item) => !item.need || can(active.role, item.need)).map((item) => (
            <NavRow key={item.to} item={item} current={isActive(item.to)} />
          ))}
        </ul>
      </nav>

      <div className="px-3 pb-2">
        <a
          href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent("أحتاج مساعدة في مكتب المحامي")}`}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold text-snow/60 hover:bg-white/[0.04] hover:text-snow"
        >
          <MessageCircle className="size-[18px] text-snow/45" aria-hidden="true" />
          الدعم عبر واتساب
        </a>
      </div>
      <div className="mx-3 mb-3 flex items-center gap-3 border-t border-white/[0.07] px-2 pt-3">
        <Avatar name={ctx.user.name || ctx.user.email} className="size-8 bg-lime text-[13px] text-pine-deep" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-snow">{ctx.user.name || ctx.user.email}</p>
          <p className="truncate text-[11px] text-snow/50">{ROLE_LABELS[active.role]}</p>
        </div>
        {onSignOut ? (
          <button
            type="button"
            aria-label={signingOut ? "جارٍ تسجيل الخروج" : "تسجيل الخروج"}
            disabled={signingOut}
            onClick={onSignOut}
            className="grid size-8 place-items-center rounded-lg text-snow/60 hover:bg-white/10 hover:text-snow disabled:opacity-50"
          >
            <LogOut className="size-4" />
          </button>
        ) : null}
      </div>
    </>
  );
}

function NavRow({ item, current }: { item: NavEntry; current: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        aria-current={current ? "page" : undefined}
        className={cn(
          "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold transition-colors",
          current ? "bg-white/[0.08] text-snow" : "text-snow/60 hover:bg-white/[0.04] hover:text-snow",
        )}
      >
        {current ? (
          <span aria-hidden="true" className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-lime" />
        ) : null}
        <Icon className={cn("size-[18px] shrink-0", current ? "text-lime" : "text-snow/45")} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.soon ? (
          <span className="rounded-full bg-white/[0.07] px-2 text-[10.5px] leading-5 font-semibold text-snow/50">
            قريبًا
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function Switcher({
  ctx,
  active,
  onSwitch,
}: {
  ctx: AppContext;
  active: ActiveWorkspace;
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const many = ctx.memberships.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const tile = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime text-[13px] font-bold text-pine-deep">
        {officeInitial(active.workspace.name) || <Scale className="size-4" />}
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-[13px] font-bold text-snow">{active.workspace.name}</span>
        <span className="block truncate text-[11px] text-snow/50">
          {[active.workspace.city, getPlan(active.workspace.plan).name].filter(Boolean).join(" · ")}
        </span>
      </span>
    </>
  );

  return (
    <div ref={box} className="relative mx-3">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`المكتب الحالي: ${active.workspace.name}. تبديل المكتب`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/[0.06] ring-inset transition-colors hover:bg-white/[0.09]"
      >
        {tile}
        <ChevronsUpDown className="size-4 shrink-0 text-snow/40" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl bg-surface p-1.5 text-pine-deep shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-line">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-slate">
            {many ? "مكاتبك" : "مكتبك"}
          </p>
          <ul role="listbox" aria-label="مكاتبك">
            {ctx.memberships.map((m) => (
              <SwitchRow
                key={m.id}
                m={m}
                current={m.id === active.workspace.id}
                onPick={() => {
                  setOpen(false);
                  if (m.id !== active.workspace.id) onSwitch(m.id);
                }}
              />
            ))}
          </ul>
          <a
            href="/law/signup?new=1"
            className="mt-1 flex h-10 items-center gap-2 rounded-lg border-t border-line px-2.5 text-[13px] font-semibold text-pine hover:bg-paper"
          >
            <Plus className="size-4" aria-hidden="true" />
            إنشاء مكتب آخر
          </a>
        </div>
      ) : null}
    </div>
  );
}

function SwitchRow({ m, current, onPick }: { m: MembershipSummary; current: boolean; onPick: () => void }) {
  return (
    <li role="option" aria-selected={current}>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start hover:bg-paper",
          current && "bg-pine-50",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-pine text-[12px] font-bold text-lime">
          {officeInitial(m.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{m.name}</span>
          <span className="block truncate text-[11px] text-slate">{ROLE_LABELS[m.role]}</span>
        </span>
        {current ? <Check className="size-4 text-pine" aria-hidden="true" /> : null}
      </button>
    </li>
  );
}

function StatusChip({ lifecycle, plan }: { lifecycle: Lifecycle; plan: string }) {
  const planName = getPlan(plan).name;
  if (lifecycle.status === "trialing") {
    return (
      <Link
        to="/app/billing"
        className="inline-flex h-8 items-center gap-2 rounded-full bg-lime-50 px-3 text-xs font-semibold whitespace-nowrap text-pine-deep ring-1 ring-lime/40 ring-inset hover:bg-lime/25"
      >
        <Sparkles className="size-3.5 text-lime-600" aria-hidden="true" />
        تجربة مجانية · باقي {daysAr(lifecycle.daysLeft)}
      </Link>
    );
  }
  if (lifecycle.status === "active") {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-full bg-pine-50 px-3 text-xs font-semibold whitespace-nowrap text-pine ring-1 ring-pine-100 ring-inset">
        <span className="size-2 rounded-full bg-lime-600 ring-[3px] ring-lime/30" aria-hidden="true" />
        خطة {planName}
      </span>
    );
  }
  return null;
}

function LifecycleBanner({ lifecycle, canPay }: { lifecycle: Lifecycle; canPay: boolean }) {
  if (lifecycle.status !== "past_due" && !lifecycle.readOnly) return null;
  const readOnly = lifecycle.readOnly;
  return (
    <div
      role="status"
      className={cn(
        "border-b",
        readOnly ? "border-red-200 bg-red-50 text-red-900" : "border-lime/40 bg-lime-50 text-pine-deep",
      )}
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-8">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            readOnly ? "bg-red-100 text-red-700" : "bg-lime/30 text-pine",
          )}
        >
          {readOnly ? <LockKeyhole className="size-[18px]" /> : <AlertTriangle className="size-[18px]" />}
        </span>
        <p className="flex-1 text-sm leading-relaxed">
          {readOnly ? (
            <>
              <strong className="font-bold">المكتب موقوف — للقراءة فقط.</strong> بياناتك محفوظة كما هي ولم يُحذف
              شيء. {canPay ? "جدّد الاشتراك لإعادة التعديل والإضافة." : "تواصل مع مالك المكتب لتجديد الاشتراك."}
            </>
          ) : (
            <>
              <strong className="font-bold">انتهت الفترة المدفوعة أو التجربة.</strong> يبقى كل شيء متاحًا حتى{" "}
              {dateAr(lifecycle.suspendsAt)}، ثم يتحول المكتب للقراءة فقط.
            </>
          )}
        </p>
        {canPay ? (
          <Link to="/app/billing" className={cn(buttonClass(readOnly ? "dark" : "primary"), "shrink-0")}>
            {readOnly ? "تجديد الاشتراك" : "اختر خطتك"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Page title row used by every /app page. */
export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-pine-deep md:text-[26px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-slate">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
