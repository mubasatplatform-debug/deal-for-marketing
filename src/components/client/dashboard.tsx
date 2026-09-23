import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, MessagesSquare, Plus, RotateCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DashShell } from "@/components/dash/shell";
import { CLIENT_NAV } from "./nav";
import { Button, Card, Kpi, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { firstName } from "@/lib/names";
import type { RequestRow } from "@/lib/requests";
import { cn } from "@/lib/utils";
import { messagesWord } from "@/components/thread/format";
import { ActiveRequest, ActiveRequestSkeleton } from "./active-request";
import { FirstRequest } from "./empty";
import { RequestList, RequestListSkeleton } from "./request-list";
import { GuestNote, SupportCard } from "./support";
import { activeSummary, isDelivered } from "./status";

export type DashboardUser = {
  displayName: string | null;
  primaryEmail: string | null;
};

export type DashboardState = "loading" | "error" | "ready";


/**
 * Presentational client dashboard ("مشاريعي"). Holds no data fetching so it can
 * be rendered with any rows/state; the /client route wires it to the server.
 */
export function ClientDashboard({
  user,
  rows,
  state,
  onRetry,
  onSignOut,
  now: nowProp,
}: {
  user: DashboardUser | null;
  rows: RequestRow[];
  state: DashboardState;
  onRetry?: () => void;
  /** Omit to hide sign-out (dev user, gate sessions). */
  onSignOut?: () => void;
  /** Reference time for relative dates (fixed in previews). */
  now?: Date;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);

  const ready = state === "ready";
  const active = useMemo(() => rows.filter((r) => !isDelivered(r.status)), [rows]);
  const delivered = rows.length - active.length;
  const hero = active[0];

  const fullName = user?.displayName?.trim() || "";
  const greetName = firstName(fullName);
  const shellName = fullName || user?.primaryEmail?.split("@")[0] || "حسابك";

  return (
    <DashShell
      area="حساب العميل"
      nav={CLIENT_NAV.map((n) => (n.href === "#requests" && ready ? { ...n, badge: active.length || undefined } : n))}
      user={{ name: shellName, email: user?.primaryEmail }}
      onSignOut={onSignOut}
      title={greetName ? `أهلًا، ${greetName}` : "أهلًا بك"}
      subtitle={
        ready ? (
          activeSummary(active.length, rows.length)
        ) : state === "loading" ? (
          <Skeleton className="mt-1.5 h-4 w-48" />
        ) : undefined
      }
      actions={
        <Link to="/start" className={buttonClass("primary")}>
          <Plus className="size-4" strokeWidth={2.5} />
          <span className="sm:hidden">طلب جديد</span>
          <span className="hidden sm:inline">طلب خدمة جديدة</span>
        </Link>
      }
    >
      <div className="grid items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5 md:space-y-6">
          {state === "loading" ? (
            <>
              <ActiveRequestSkeleton />
              <KpiRow loading />
              <RequestListSkeleton />
            </>
          ) : null}

          {state === "error" ? <LoadError onRetry={onRetry} /> : null}

          {ready && rows.length === 0 ? <FirstRequest /> : null}

          {ready && rows.length > 0 ? (
            <>
              <UnreadBanner rows={rows} />
              {hero ? (
                <ActiveRequest row={hero} others={active.length - 1} now={now} onOpen={setOpenId} />
              ) : null}
              {rows.length > 1 ? (
                <KpiRow total={rows.length} active={active.length} delivered={delivered} />
              ) : null}
              <RequestList
                rows={rows}
                now={now}
                openId={openId}
                onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
              />
            </>
          ) : null}
        </div>

        <aside aria-label="الدعم" className="space-y-4 lg:sticky lg:top-24">
          <SupportCard latestId={hero?.id ?? rows[0]?.id} latestService={hero?.service_title ?? rows[0]?.service_title} />
          <GuestNote />
        </aside>
      </div>
    </DashShell>
  );
}

/** New team replies across requests, linking to the first one waiting. */
function UnreadBanner({ rows }: { rows: RequestRow[] }) {
  const waiting = rows.filter((r) => r.unread > 0);
  if (waiting.length === 0) return null;
  const total = waiting.reduce((s, r) => s + r.unread, 0);
  const first = waiting[0];
  return (
    <Link
      to="/client/requests/$id"
      params={{ id: String(first.id) }}
      className="group flex items-center gap-3.5 rounded-2xl bg-pine-deep px-4 py-3.5 text-snow shadow-[0_8px_24px_-12px_rgba(16,38,40,0.5)] transition-colors hover:bg-pine md:px-5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-pine-deep">
        <MessagesSquare className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">
          {messagesWord(total)} من فريق ديل
        </span>
        <span className="block truncate text-[12px] text-snow/70">
          {waiting.length === 1
            ? `على طلب «${first.service_title}»`
            : `على ${waiting.length} من طلباتك · الأحدث: «${first.service_title}»`}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-[13px] font-semibold text-lime sm:inline-flex">
        افتح المحادثة
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      </span>
      <ArrowLeft className="size-4 shrink-0 text-lime sm:hidden" />
    </Link>
  );
}

function KpiRow({
  total = 0,
  active = 0,
  delivered = 0,
  loading,
}: {
  total?: number;
  active?: number;
  delivered?: number;
  loading?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-3 md:gap-4")}>
      <Kpi label="كل الطلبات" value={total} loading={loading} />
      <Kpi label="قيد التنفيذ" value={active} tone="lime" loading={loading} />
      <Kpi label="تم التسليم" value={delivered} loading={loading} />
    </div>
  );
}

function LoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert">
      <Card className="px-5 py-10 text-center md:px-8 md:py-14">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <AlertCircle className="size-6" />
        </span>
        <h2 className="mt-4 text-[17px] font-bold text-pine-deep">تعذّر تحميل طلباتك</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate">
          قد يكون الاتصال ضعيفًا أو الخدمة مشغولة للحظات. طلباتك محفوظة لدينا ولم يضع شيء.
        </p>
        {onRetry ? (
          <Button icon={RotateCw} onClick={onRetry} className="mt-6">
            إعادة المحاولة
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
