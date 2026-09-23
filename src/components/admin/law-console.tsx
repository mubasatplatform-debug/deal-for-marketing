import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarPlus,
  CircleCheck,
  Hourglass,
  Inbox,
  KeyRound,
  LayoutGrid,
  PauseCircle,
  PlayCircle,
  ReceiptText,
  RotateCw,
  Scale,
  Search,
  Users,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { DashShell, type NavItem } from "@/components/dash/shell";
import { Button, Card, CardHeader, EmptyState, Kpi, Num, Pill, Segmented, Select, Skeleton, type Tone } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { dateAr, sar, ymdFromNow } from "@/components/law/format";
import { STATUS_LABELS, type WorkspaceStatus } from "@/lib/saas/lifecycle";
import { CYCLE_LABELS, PLANS, getPlan, type BillingCycle, type PlanId } from "@/lib/saas/plans";
import {
  ADMIN_FORBIDDEN,
  consoleActivate,
  consoleExtendTrial,
  consoleMarkPaid,
  consoleOverview,
  consoleSuspend,
  type ConsoleOverview,
} from "@/lib/saas/console";
import type { ConsoleInvoice, ConsoleWorkspace } from "@/lib/saas/tenancy-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";

/** /admin/law — the DEAL team's view of every «مكتب المحامي» subscriber. */

export const LAW_CONSOLE_NAV_LABEL = "مشتركو مكتب المحامي";

const STATUS_TONE: Record<WorkspaceStatus, Tone> = {
  trialing: "lime",
  active: "pine",
  past_due: "danger",
  suspended: "danger",
  cancelled: "neutral",
};

type Filter = "all" | WorkspaceStatus;

type Action =
  | { kind: "activate"; ws: ConsoleWorkspace }
  | { kind: "extend"; ws: ConsoleWorkspace }
  | { kind: "suspend"; ws: ConsoleWorkspace }
  | { kind: "paid"; inv: ConsoleInvoice };

export function LawConsole({
  user,
  onSignOut,
  signingOut,
  onForbidden,
}: {
  user: { name: string; email?: string | null };
  onSignOut?: () => void;
  signingOut?: boolean;
  onForbidden: () => void;
}) {
  const [data, setData] = useState<ConsoleOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await consoleOverview());
    } catch (err) {
      if (err instanceof Error && err.message === ADMIN_FORBIDDEN) onForbidden();
      else setFailed(true);
    }
  }, [onForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, trialing: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0 };
    for (const w of data?.workspaces ?? []) {
      c.all += 1;
      c[w.lifecycle.status] += 1;
    }
    return c;
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.workspaces ?? []).filter(
      (w) =>
        (filter === "all" || w.lifecycle.status === filter) &&
        (!needle ||
          w.name.toLowerCase().includes(needle) ||
          (w.owner_email ?? "").toLowerCase().includes(needle) ||
          (w.owner_name ?? "").toLowerCase().includes(needle) ||
          w.city.includes(needle) ||
          (w.cr_number ?? "").includes(needle)),
    );
  }, [data, filter, q]);

  const nav: NavItem[] = [
    { href: "/admin#overview", label: "نظرة عامة", icon: LayoutGrid },
    { href: "/admin#requests", label: "الطلبات", icon: Inbox },
    { href: "/admin#customers", label: "العملاء", icon: Users },
    { href: "/admin/law", label: LAW_CONSOLE_NAV_LABEL, icon: Scale, active: true, badge: data?.invoices.length || undefined },
    { href: "/admin/keys", label: "مفاتيح API", icon: KeyRound },
    { href: "/developers", label: "دليل المطوّرين", icon: BookOpen },
  ];

  return (
    <DashShell
      area="لوحة الفريق"
      nav={nav}
      user={user}
      onSignOut={onSignOut}
      signingOut={signingOut}
      title={LAW_CONSOLE_NAV_LABEL}
      subtitle="المكاتب المسجلة، اشتراكاتها، وطلبات الدفع اليدوي"
      actions={
        <Button size="sm" icon={RotateCw} onClick={() => void load()}>
          تحديث
        </Button>
      }
    >
      <Toaster position="top-center" dir="rtl" richColors closeButton />
      {failed ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="تعذّر تحميل المشتركين"
            action={
              <Button icon={RotateCw} onClick={() => void load()}>
                إعادة المحاولة
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <Kpi label="المكاتب" value={counts.all} icon={Building2} loading={!data} />
            <Kpi label="في التجربة" value={counts.trialing} icon={Hourglass} tone="lime" loading={!data} />
            <Kpi label="مشتركون نشطون" value={counts.active} icon={CircleCheck} loading={!data} />
            <Kpi
              label="طلبات دفع معلّقة"
              value={data?.invoices.length ?? 0}
              hint={counts.past_due + counts.suspended ? `${counts.past_due + counts.suspended} مكتب متأخر أو موقوف` : undefined}
              icon={ReceiptText}
              tone="lime"
              loading={!data}
            />
          </div>

          <Card className="mt-6">
            <CardHeader title="طلبات الدفع المعلّقة" description="تأكيد الدفع يفعّل الخطة ويمدّد الاشتراك فترة كاملة" />
            {!data ? (
              <div className="p-6">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : data.invoices.length === 0 ? (
              <p className="px-5 pt-3 pb-6 text-sm text-slate md:px-6">لا طلبات معلّقة.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 md:px-6">
                    <Num className="w-14 text-sm font-bold">#{inv.number}</Num>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-bold">{inv.workspace_name}</p>
                      <p className="truncate text-xs text-slate">
                        {getPlan(inv.plan).name} · {CYCLE_LABELS[inv.cycle]} ·{" "}
                        {inv.provider === "manual" ? "تحويل بنكي" : "Moyasar"} · {dateAr(inv.created_at)}
                        {inv.requested_by_email ? (
                          <>
                            {" · "}
                            <span dir="ltr" className="font-ui">
                              {inv.requested_by_email}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <p className="text-sm">
                      <Num className="font-bold">{sar(inv.total)}</Num> <span className="text-xs text-slate">ر.س</span>
                    </p>
                    <Button size="sm" variant="primary" icon={CircleCheck} onClick={() => setAction({ kind: "paid", inv })}>
                      تأكيد الدفع
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-6">
            <CardHeader
              title="المكاتب"
              description={data ? `${rows.length} من ${counts.all}` : undefined}
              actions={
                <label className="relative block w-full sm:w-64">
                  <span className="sr-only">بحث</span>
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate" aria-hidden="true" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="اسم المكتب، البريد، السجل…"
                    className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-[13px] outline-none focus:border-pine/40 focus:ring-4 focus:ring-pine/10"
                  />
                </label>
              }
            />
            <div className="px-5 pt-4 md:px-6">
              <Segmented
                label="تصفية حسب الحالة"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "الكل", count: counts.all },
                  { value: "trialing", label: STATUS_LABELS.trialing, count: counts.trialing },
                  { value: "active", label: STATUS_LABELS.active, count: counts.active },
                  { value: "past_due", label: STATUS_LABELS.past_due, count: counts.past_due },
                  { value: "suspended", label: STATUS_LABELS.suspended, count: counts.suspended },
                ]}
              />
            </div>
            {!data ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={Building2} title={counts.all ? "لا نتائج مطابقة" : "لا مكاتب مسجلة بعد"} />
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {rows.map((w) => (
                  <li key={w.id} className="grid gap-3 px-5 py-4 md:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{w.name}</p>
                      <p className="truncate text-xs text-slate">
                        {[w.city, w.cr_number ? `س.ت ${w.cr_number}` : null, `منذ ${dateAr(w.created_at)}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-semibold text-pine-deep">{w.owner_name || "—"}</p>
                      <p dir="ltr" className="truncate text-end font-ui text-slate lg:text-start" style={{ textAlign: "right" }}>
                        {w.owner_email ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={STATUS_TONE[w.lifecycle.status]}>{STATUS_LABELS[w.lifecycle.status]}</Pill>
                      <span className="text-xs font-semibold text-slate">{getPlan(w.plan).name}</span>
                    </div>
                    <div className="text-xs text-slate">
                      <p>
                        {w.lifecycle.status === "trialing" ? "التجربة حتى " : w.lifecycle.endsAt ? "حتى " : ""}
                        <span className="font-semibold text-pine-deep">{w.lifecycle.endsAt ? dateAr(w.lifecycle.endsAt) : "—"}</span>
                      </p>
                      <p>
                        المقاعد{" "}
                        <Num className="font-semibold text-pine-deep">
                          {w.members + w.pending_invites}/{w.seat_limit}
                        </Num>
                        {w.pending_invoices ? <span className="ms-1 text-lime-600">· طلب دفع</span> : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="dark" icon={PlayCircle} onClick={() => setAction({ kind: "activate", ws: w })}>
                        تفعيل
                      </Button>
                      <Button size="sm" icon={CalendarPlus} onClick={() => setAction({ kind: "extend", ws: w })}>
                        تمديد
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={PauseCircle}
                        disabled={w.status === "suspended"}
                        onClick={() => setAction({ kind: "suspend", ws: w })}
                      >
                        إيقاف
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {action ? (
        <ActionDialog
          action={action}
          onClose={() => setAction(null)}
          onDone={(msg) => {
            toast.success(msg);
            setAction(null);
            void load();
          }}
        />
      ) : null}
    </DashShell>
  );
}

function ActionDialog({
  action,
  onClose,
  onDone,
}: {
  action: Action;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanId>(action.kind === "activate" ? (getPlan(action.ws.plan).id) : "pro");
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [until, setUntil] = useState(ymdFromNow(365));
  const [days, setDays] = useState(14);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onDone(msg);
    } catch (e) {
      setErr(workspaceErrorMessage(e));
      setBusy(false);
    }
  }

  const errorBox = err ? (
    <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {err}
    </p>
  ) : null;

  if (action.kind === "paid") {
    const inv = action.inv;
    return (
      <Dialog
        size="sm"
        title={`تأكيد دفع الطلب #${inv.number}`}
        description={`«${inv.workspace_name}» — ${getPlan(inv.plan).name} (${CYCLE_LABELS[inv.cycle]}) بمبلغ ${sar(inv.total)} ر.س. أكّد فقط بعد وصول المبلغ فعليًا.`}
        onClose={onClose}
        busy={busy}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              تراجع
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void run(() => consoleMarkPaid({ data: { invoiceId: inv.id } }), "أُكّد الدفع وفُعّل الاشتراك")}
            >
              {busy ? "جارٍ التأكيد…" : "وصل المبلغ — فعّل"}
            </Button>
          </>
        }
      >
        {errorBox ?? <span className="sr-only">تأكيد</span>}
      </Dialog>
    );
  }

  const ws = action.ws;
  if (action.kind === "suspend") {
    return (
      <Dialog
        size="sm"
        title={`إيقاف «${ws.name}»؟`}
        description="يتحول المكتب للقراءة فقط مع رسالة لأعضائه. لا يُحذف أي شيء، ويعود بالتفعيل أو الدفع."
        onClose={onClose}
        busy={busy}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              تراجع
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={() => void run(() => consoleSuspend({ data: { workspaceId: ws.id } }), "أُوقف المكتب")}
            >
              {busy ? "جارٍ الإيقاف…" : "إيقاف المكتب"}
            </Button>
          </>
        }
      >
        {errorBox ?? <span className="sr-only">تأكيد</span>}
      </Dialog>
    );
  }

  if (action.kind === "extend") {
    return (
      <Dialog
        size="sm"
        title={`تمديد تجربة «${ws.name}»`}
        description="تُضاف الأيام إلى نهاية التجربة الحالية (أو من اليوم إن انتهت)، ويعود المكتب لحالة التجربة."
        onClose={onClose}
        busy={busy}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void run(() => consoleExtendTrial({ data: { workspaceId: ws.id, days } }), "مُدّدت التجربة")}
            >
              {busy ? "جارٍ التمديد…" : `تمديد ${days} يومًا`}
            </Button>
          </>
        }
      >
        <Segmented
          label="أيام التمديد"
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[
            { value: "7", label: "٧ أيام" },
            { value: "14", label: "١٤ يومًا" },
            { value: "30", label: "٣٠ يومًا" },
          ]}
        />
        {errorBox}
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`تفعيل «${ws.name}»`}
      description="للاتفاقات اليدوية: تُضبط الخطة وتاريخ نهاية الاشتراك مباشرة. لتأكيد تحويل مرتبط بطلب دفع استخدم «تأكيد الدفع»."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={busy || !until}
            onClick={() =>
              void run(
                () => consoleActivate({ data: { workspaceId: ws.id, plan, cycle, until } }),
                "فُعّل المكتب",
              )
            }
          >
            {busy ? "جارٍ التفعيل…" : "تفعيل"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          الخطة
          <Select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className="mt-1.5 w-full">
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.seats} مقاعد
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-semibold">
          الدورة
          <Select
            value={cycle}
            onChange={(e) => {
              const c = e.target.value as BillingCycle;
              setCycle(c);
              setUntil(ymdFromNow(c === "yearly" ? 365 : 30));
            }}
            className="mt-1.5 w-full"
          >
            <option value="monthly">شهري</option>
            <option value="yearly">سنوي</option>
          </Select>
        </label>
        <label className="block text-sm font-semibold sm:col-span-2">
          ينتهي الاشتراك في
          <input
            type="date"
            value={until}
            min={ymdFromNow(1)}
            onChange={(e) => setUntil(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 font-ui text-[13px] outline-none focus:border-pine/40 focus:ring-4 focus:ring-pine/10"
          />
        </label>
      </div>
      {errorBox}
    </Dialog>
  );
}
