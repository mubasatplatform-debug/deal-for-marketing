import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RequestRow } from "@/lib/requests";
import { ContactPanel, EmptyState, GuestNote, MarkRule, PlayMark } from "./parts";
import { STEPS, statusLabel, stepIndex } from "./status";
import { RequestCard } from "./request-card";

export type DashboardUser = {
  displayName: string | null;
  primaryEmail: string | null;
};

export type DashboardState = "loading" | "error" | "ready";

type Filter = "all" | (typeof STEPS)[number];

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
}: {
  user: DashboardUser | null;
  rows: RequestRow[];
  state: DashboardState;
  onRetry?: () => void;
  /** Omit to hide sign-out (dev user, gate sessions). May reject to re-enable. */
  onSignOut?: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, new: 0, review: 0, production: 0, delivered: 0 };
    for (const r of rows) c[STEPS[stepIndex(r.status)]] += 1;
    return c;
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => STEPS[stepIndex(r.status)] === filter);
  const ready = state === "ready";
  const latestId = ready ? rows[0]?.id : undefined;

  return (
    <main className="min-h-dvh overflow-x-clip bg-ink px-4 pt-24 pb-20 sm:px-6 md:px-10 md:pt-28 xl:px-16">
      <div className="mx-auto max-w-7xl">
        <Header user={user} onSignOut={onSignOut} />
        <MarkRule className="mt-8 md:mt-10" />

        <Stats counts={counts} state={state} />

        <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section aria-labelledby="client-requests" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-kicker text-lime">الطلبات //</p>
                <h2 id="client-requests" className="mt-2 font-display text-2xl text-snow">
                  متابعة طلباتك
                </h2>
              </div>
            </div>

            {state === "loading" ? <ListSkeleton /> : null}
            {state === "error" ? <ErrorState onRetry={onRetry} /> : null}
            {ready && rows.length === 0 ? (
              <div className="mt-6">
                <EmptyState />
              </div>
            ) : null}
            {ready && rows.length > 0 ? (
              <>
                <Filters value={filter} onChange={setFilter} counts={counts} />
                {visible.length > 0 ? (
                  <ul className="mt-5 space-y-4" aria-live="polite">
                    {visible.map((r) => (
                      <li key={r.id}>
                        <RequestCard row={r} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-5 border border-dashed border-hair px-6 py-12 text-center" aria-live="polite">
                    <p className="font-display text-snow">لا توجد طلبات بحالة «{statusLabel(filter)}».</p>
                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className="mt-3 inline-flex min-h-10 items-center font-display text-sm text-lime hover:text-snow focus-visible:outline-2 focus-visible:outline-lime"
                    >
                      عرض كل الطلبات
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </section>

          <aside aria-label="التواصل والملاحظات" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <ContactPanel latestId={latestId} />
            <GuestNote />
          </aside>
        </div>
      </div>
    </main>
  );
}

function Header({ user, onSignOut }: { user: DashboardUser | null; onSignOut?: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false);
  const name = user?.displayName?.trim();
  return (
    <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-kicker text-lime">مشاريعي //</p>
        {user ? (
          <>
            <h1 className="mt-4 font-display text-poster text-snow md:text-5xl md:leading-tight">
              {name ? `أهلًا، ${name}` : "أهلًا بك"}
            </h1>
            {user.primaryEmail ? (
              <p dir="ltr" className="mt-2 truncate text-end font-ui text-sm text-dim">
                {user.primaryEmail}
              </p>
            ) : null}
          </>
        ) : (
          <div aria-hidden="true" className="mt-4 space-y-3">
            <div className="h-10 w-64 max-w-full bg-card motion-safe:animate-pulse" />
            <div className="h-4 w-44 bg-card motion-safe:animate-pulse" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/start"
          className="inline-flex h-12 flex-1 items-center justify-center gap-3 bg-lime px-6 font-display text-sm text-ink transition-colors hover:bg-lime/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime sm:flex-none"
        >
          طلب خدمة جديدة
          <PlayMark className="h-2.5 w-auto -scale-x-100" />
        </Link>
        {onSignOut ? (
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              onSignOut().catch(() => setSigningOut(false));
            }}
            className="inline-flex h-12 items-center justify-center border border-hair px-5 font-display text-sm text-mist transition-colors hover:border-pine-soft hover:text-snow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:cursor-wait disabled:opacity-60"
          >
            {signingOut ? "جارٍ الخروج…" : "تسجيل الخروج"}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Stats({ counts, state }: { counts: Record<Filter, number>; state: DashboardState }) {
  const tiles: { key: Filter; label: string }[] = [
    { key: "all", label: "كل الطلبات" },
    { key: "review", label: "قيد المراجعة" },
    { key: "production", label: "قيد التنفيذ" },
    { key: "delivered", label: "تم التسليم" },
  ];
  return (
    <dl className="mt-8 grid grid-cols-2 gap-px border border-hair bg-hair md:mt-10 md:grid-cols-4">
      {tiles.map((t, i) => (
        <div
          key={t.key}
          className={`relative flex min-h-28 flex-col justify-between gap-4 p-4 md:min-h-36 md:p-6 ${
            i === 0 ? "bg-pine-deep" : "bg-card"
          }`}
        >
          <dt className={`font-display text-sm ${i === 0 ? "text-mist" : "text-dim"}`}>{t.label}</dt>
          <dd className="flex items-end justify-between gap-2">
            {state === "loading" ? (
              <span aria-hidden="true" className="h-10 w-12 bg-hair motion-safe:animate-pulse" />
            ) : state === "error" ? (
              <span className="font-ui text-4xl leading-none font-bold text-dim md:text-5xl">
                <span aria-hidden="true">—</span>
                <span className="sr-only">غير متاح</span>
              </span>
            ) : (
              <span className={`font-ui text-4xl leading-none font-bold tabular-nums md:text-5xl ${i === 0 ? "text-lime" : "text-snow"}`}>
                {String(counts[t.key]).padStart(2, "0")}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`mb-1 h-1 w-6 ${i === 0 ? "bg-lime" : i === 3 ? "bg-lime" : i === 2 ? "bg-pine-soft" : "bg-pine"}`}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Filters({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  counts: Record<Filter, number>;
}) {
  const options: Filter[] = ["all", ...STEPS];
  return (
    <div
      role="group"
      aria-label="تصفية حسب الحالة"
      className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {options.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f)}
            className={`inline-flex h-10 shrink-0 items-center gap-2 border px-4 font-display text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${
              active ? "border-lime bg-lime text-ink" : "border-hair text-mist hover:border-pine-soft hover:text-snow"
            }`}
          >
            {f === "all" ? "الكل" : statusLabel(f)}
            <span
              className={`min-w-5 px-1 font-ui text-xs font-bold tabular-nums ${
                active ? "bg-pine-deep text-lime" : "bg-pine text-snow"
              }`}
            >
              {counts[f]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تحميل الطلبات" className="mt-6 space-y-4">
      <div className="flex gap-2">
        {[64, 96, 104, 96].map((w, i) => (
          <span key={i} style={{ width: w }} className="h-10 bg-card motion-safe:animate-pulse" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-hair bg-card p-5 md:p-7" aria-hidden="true">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-3 w-28 bg-hair motion-safe:animate-pulse" />
              <div className="h-6 w-2/3 bg-hair motion-safe:animate-pulse" />
            </div>
            <div className="h-7 w-24 bg-pine motion-safe:animate-pulse" />
          </div>
          <div className="mt-7 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((j) => (
              <span key={j} className="h-1 bg-pine motion-safe:animate-pulse" />
            ))}
          </div>
          <div className="mt-6 h-3 w-5/6 bg-hair motion-safe:animate-pulse" />
        </div>
      ))}
      <span className="sr-only">جارٍ التحميل…</span>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-6 border border-hair bg-card p-6 md:p-10">
      <p className="text-kicker text-red-400">خطأ //</p>
      <h3 className="mt-3 font-display text-xl text-snow">تعذّر تحميل طلباتك</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-mist">
        قد يكون الاتصال ضعيفًا أو الخدمة مشغولة. طلباتك محفوظة لدينا، حاول مرة أخرى بعد لحظات.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-12 items-center gap-3 border border-lime px-6 font-display text-sm text-lime transition-colors hover:bg-lime hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        >
          إعادة المحاولة
          <PlayMark className="h-2.5 w-auto -scale-x-100" />
        </button>
      ) : null}
    </div>
  );
}
