import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  CalendarDays,
  CircleCheck,
  Download,
  Inbox,
  LayoutGrid,
  RotateCw,
  Search,
  SearchX,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { DashShell, type NavItem } from "@/components/dash/shell";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Num,
  Segmented,
  Skeleton,
} from "@/components/dash/ui";
import type { AdminRequestRow } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { LeadsChart, ServiceBars } from "./charts";
import { CustomersList } from "./customers";
import {
  STATUS_ORDER,
  aggregateCustomers,
  byService,
  computeStats,
  countOf,
  dailySeries,
  downloadCsv,
  formatLongDay,
  matchesQuery,
  requestsWord,
  statusLabel,
} from "./format";
import { AdminKpi } from "./kpi";
import { RequestDrawer } from "./request-drawer";
import { RequestsTable, TableSkeleton, type SortDir } from "./requests-table";

export type AdminPanelState = "loading" | "error" | "ready";

type Filter = "all" | (typeof STATUS_ORDER)[number];

const PAGE = 15;
const SECTIONS = ["overview", "requests", "customers"] as const;

export type AdminPanelProps = {
  user: { name: string; email?: string | null };
  state: AdminPanelState;
  rows: AdminRequestRow[];
  /** When the rows were loaded; relative dates and weekly windows count from here. */
  now: number;
  onRetry: () => void;
  /** Persist a status change. Reject to roll the optimistic update back. */
  onStatusChange: (id: number, status: string) => Promise<void>;
  onSignOut?: () => void;
};

export function AdminPanel({
  user,
  state,
  rows: sourceRows,
  now,
  onRetry,
  onStatusChange,
  onSignOut,
}: AdminPanelProps) {
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortDir>("desc");
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<number | null>(null);
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("overview");
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(
    () =>
      sourceRows.map((r) =>
        overrides[r.id] && overrides[r.id] !== r.status ? { ...r, status: overrides[r.id] } : r,
      ),
    [sourceRows, overrides],
  );

  const stats = useMemo(() => computeStats(rows, now), [rows, now]);
  const series = useMemo(() => dailySeries(rows, now), [rows, now]);
  const services = useMemo(() => byService(rows), [rows]);
  const customers = useMemo(() => aggregateCustomers(rows), [rows]);
  const last30 = series.reduce((s, d) => s + d.count, 0);

  const searched = useMemo(() => rows.filter((r) => matchesQuery(r, query)), [rows, query]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of searched) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [searched]);
  const filtered = useMemo(() => {
    const list = filter === "all" ? searched : searched.filter((r) => r.status === filter);
    const dir = sort === "desc" ? -1 : 1;
    return [...list].sort(
      (a, b) =>
        dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) ||
        dir * (a.id - b.id),
    );
  }, [searched, filter, sort]);

  const open = openId === null ? null : (rows.find((r) => r.id === openId) ?? null);

  const changeStatus = useCallback(
    async (id: number, next: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row || row.status === next) return;
      const prev = row.status;
      setOverrides((o) => ({ ...o, [id]: next }));
      setPending(id);
      try {
        await onStatusChange(id, next);
        toast.success(`نُقل الطلب #${id} إلى «${statusLabel(next)}»`);
      } catch {
        setOverrides((o) => ({ ...o, [id]: prev }));
        toast.error("تعذر تحديث الحالة", { description: "أعدنا الطلب إلى حالته السابقة." });
      } finally {
        setPending(null);
      }
    },
    [rows, onStatusChange],
  );

  // "/" focuses search, like the products it takes after.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key !== "/" ||
        e.metaKey ||
        e.ctrlKey ||
        t.closest("input,textarea,select,[contenteditable]")
      )
        return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Highlight the nav item of the section in view.
  useEffect(() => {
    if (state !== "ready") return;
    const els = SECTIONS.map((id) => document.getElementById(id)).filter(
      (e): e is HTMLElement => !!e,
    );
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setSection(hit.target.id as (typeof SECTIONS)[number]);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [state]);

  const nav: NavItem[] = [
    { href: "#overview", label: "نظرة عامة", icon: LayoutGrid, active: section === "overview" },
    {
      href: "#requests",
      label: "الطلبات",
      icon: Inbox,
      active: section === "requests",
      badge: state === "ready" ? stats.fresh : undefined,
    },
    { href: "#customers", label: "العملاء", icon: Users, active: section === "customers" },
  ];

  const loading = state === "loading";
  const delta = stats.thisWeek - stats.lastWeek;
  const resetPaging = () => setLimit(PAGE);

  return (
    <DashShell
      area="لوحة الفريق"
      nav={nav}
      user={user}
      onSignOut={onSignOut}
      title="لوحة الفريق"
      subtitle={
        state === "ready"
          ? `${formatLongDay(new Date(now))} · ${stats.total ? `${countOf(stats.total, requestsWord)} في المجموع` : "لا طلبات بعد"}`
          : "طلبات العملاء ومتابعتها في مكان واحد"
      }
      actions={
        <Button
          size="sm"
          icon={RotateCw}
          onClick={onRetry}
          disabled={loading}
          className={cn(loading && "[&_svg]:animate-spin")}
        >
          تحديث
        </Button>
      }
    >
      <Toaster
        dir="rtl"
        position="bottom-left"
        offset={24}
        toastOptions={{
          style: {
            fontFamily: "Cairo, Manrope, sans-serif",
            borderRadius: 14,
            border: "1px solid #e3e6dc",
            color: "#102628",
            boxShadow: "0 12px 32px -12px rgba(16,38,40,0.25)",
          },
        }}
      />

      {state === "error" ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="تعذر تحميل الطلبات"
            body="حدث خطأ أثناء جلب البيانات. تحقق من الاتصال ثم أعد المحاولة."
            action={
              <Button variant="dark" icon={RotateCw} onClick={onRetry}>
                إعادة المحاولة
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Overview */}
          <section id="overview" aria-label="نظرة عامة" className="scroll-mt-24 space-y-6">
            <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
              <AdminKpi
                label="طلبات جديدة تنتظر"
                icon={Inbox}
                accent
                loading={loading}
                value={stats.fresh}
                hint={
                  loading ? undefined : stats.fresh ? "بانتظار المراجعة الأولى" : "لا شيء ينتظر"
                }
              />
              <AdminKpi
                label="طلبات هذا الأسبوع"
                icon={CalendarDays}
                loading={loading}
                value={stats.thisWeek}
                hint={loading ? undefined : <WeekDelta delta={delta} />}
              />
              <AdminKpi
                label="معدل الإنجاز"
                icon={CircleCheck}
                loading={loading}
                value={stats.total ? `${stats.rate}%` : "—"}
                hint={
                  loading ? undefined : !stats.total ? (
                    "يظهر مع أول طلب"
                  ) : (
                    <>
                      <Num>{stats.delivered}</Num> من <Num>{stats.total}</Num> سُلّمت
                    </>
                  )
                }
              />
              <AdminKpi
                label="إشعارات لم تصل"
                icon={BellOff}
                loading={loading}
                value={stats.unnotified}
                hint={
                  loading ? undefined : stats.unnotified ? (
                    <span className="text-red-700">تحتاج متابعة يدوية</span>
                  ) : (
                    "كل الإشعارات وصلت"
                  )
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader
                  title="الطلبات خلال 30 يومًا"
                  description={
                    loading ? "جارٍ التحميل…" : `${countOf(last30, requestsWord)} · عدد يومي`
                  }
                />
                <div className="px-3 pt-4 pb-3 md:px-4">
                  {loading ? <Skeleton className="mx-2 h-[244px]" /> : <LeadsChart data={series} />}
                </div>
              </Card>
              <Card>
                <CardHeader title="الطلبات حسب الخدمة" description="من إجمالي الطلبات" />
                <div className="px-5 pt-5 pb-6 md:px-6">
                  {loading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-3.5 w-1/2" />
                          <Skeleton className="h-1.5 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : services.length ? (
                    <ServiceBars data={services.slice(0, 7)} total={stats.total} />
                  ) : (
                    <p className="py-16 text-center text-sm text-slate">لا توجد بيانات بعد.</p>
                  )}
                </div>
              </Card>
            </div>
          </section>

          {/* Requests */}
          <section id="requests" aria-label="الطلبات" className="scroll-mt-24">
            <Card className="overflow-hidden">
              <CardHeader
                title="الطلبات"
                description={
                  loading
                    ? "جارٍ التحميل…"
                    : filtered.length === rows.length
                      ? countOf(rows.length, requestsWord)
                      : `${countOf(filtered.length, requestsWord)} من ${rows.length.toLocaleString("en-US")}`
                }
                actions={
                  <Button
                    size="sm"
                    icon={Download}
                    disabled={loading || filtered.length === 0}
                    onClick={() => downloadCsv(filtered, new Date(now))}
                  >
                    تصدير CSV
                  </Button>
                }
              />
              <div className="flex flex-col gap-3 px-4 pt-4 pb-4 md:px-6 lg:flex-row lg:items-center">
                <label className="relative block lg:w-80">
                  <span className="sr-only">بحث في الطلبات</span>
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      resetPaging();
                    }}
                    placeholder="ابحث بالاسم أو الجوال أو رقم الطلب"
                    disabled={loading}
                    className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-9 text-sm text-pine-deep placeholder:text-slate/70 focus:border-pine/40 focus:ring-4 focus:ring-pine/10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query ? (
                    <button
                      type="button"
                      aria-label="مسح البحث"
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                      className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate hover:bg-paper hover:text-pine-deep"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden h-5 -translate-y-1/2 place-items-center rounded-md border border-line px-1.5 font-ui text-[11px] text-slate lg:grid">
                      /
                    </kbd>
                  )}
                </label>
                <div className="min-w-0 lg:ms-auto">
                  <Segmented<Filter>
                    label="تصفية حسب الحالة"
                    value={filter}
                    onChange={(v) => {
                      setFilter(v);
                      resetPaging();
                    }}
                    options={[
                      { value: "all", label: "الكل", count: loading ? undefined : searched.length },
                      ...STATUS_ORDER.map((s) => ({
                        value: s,
                        label: statusLabel(s),
                        count: loading ? undefined : (counts[s] ?? 0),
                      })),
                    ]}
                  />
                </div>
              </div>

              {loading ? (
                <TableSkeleton />
              ) : rows.length === 0 ? (
                <div className="border-t border-line">
                  <EmptyState
                    icon={Inbox}
                    title="لا توجد طلبات بعد"
                    body="ستظهر هنا طلبات العملاء فور إرسالها من نموذج الموقع."
                  />
                </div>
              ) : filtered.length === 0 ? (
                <div className="border-t border-line">
                  <EmptyState
                    icon={SearchX}
                    title="لا نتائج مطابقة"
                    body="جرّب كلمة بحث أخرى أو غيّر الحالة المختارة."
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        مسح التصفية
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <RequestsTable
                    rows={filtered.slice(0, limit)}
                    now={now}
                    sort={sort}
                    onSort={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}
                    onOpen={setOpenId}
                  />
                  {filtered.length > PAGE ? (
                    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-slate md:px-6">
                      <span>
                        عرض <Num>{Math.min(limit, filtered.length)}</Num> من{" "}
                        <Num>{filtered.length}</Num>
                      </span>
                      {limit < filtered.length ? (
                        <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
                          عرض المزيد
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </Card>
          </section>

          {/* Customers */}
          <section id="customers" aria-label="العملاء" className="scroll-mt-24">
            <Card className="overflow-hidden">
              <CardHeader
                title="العملاء"
                description={
                  loading
                    ? "جارٍ التحميل…"
                    : `${countOf(customers.length, { zero: "لا عملاء", one: "عميل واحد", two: "عميلان", few: "عملاء", many: "عميلًا", other: "عميل" })} · مجمّعون برقم الجوال`
                }
                className="pb-4"
              />
              {loading ? (
                <TableSkeleton />
              ) : customers.length ? (
                <CustomersList customers={customers} now={now} onOpen={setOpenId} />
              ) : (
                <p className="border-t border-line px-6 py-10 text-center text-sm text-slate">
                  سيظهر العملاء هنا مع أول طلب.
                </p>
              )}
            </Card>
          </section>
        </div>
      )}

      {open ? (
        <RequestDrawer
          key={open.id}
          row={open}
          now={now}
          pending={pending === open.id}
          onClose={() => setOpenId(null)}
          onStatus={(s) => void changeStatus(open.id, s)}
        />
      ) : null}
    </DashShell>
  );
}

function WeekDelta({ delta }: { delta: number }) {
  if (delta === 0) return <>مثل الأسبوع السابق</>;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1 font-semibold",
          up ? "text-lime-600" : "text-slate",
        )}
      >
        <Icon className="size-3.5" />
        <Num>
          <span dir="ltr">
            {up ? "+" : "−"}
            {Math.abs(delta)}
          </span>
        </Num>
      </span>
      عن الأسبوع السابق
    </span>
  );
}
