import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { requestStatus } from "@/lib/content";
import {
  ADMIN_FORBIDDEN,
  listAllRequests,
  updateRequestStatus,
  type AdminRequestRow,
} from "@/lib/admin";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  head: () => pageHead({ title: "صندوق الطلبات", noindex: true }),
  component: Admin,
});

type State =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error" }
  | { kind: "ready"; rows: AdminRequestRow[] };

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
  dateStyle: "medium",
  timeStyle: "short",
});

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    listAllRequests()
      .then((rows) => setState({ kind: "ready", rows }))
      .catch((err: unknown) =>
        setState({
          kind: err instanceof Error && err.message === ADMIN_FORBIDDEN ? "forbidden" : "error",
        }),
      );
  }, []);

  useEffect(() => {
    if (user) load();
    // Full navigation so /login reads `redirect` from the real URL.
    else if (!isPending) window.location.replace("/login?redirect=/admin");
  }, [user, isPending, load]);

  async function setStatus(id: number, status: string) {
    await updateRequestStatus({ data: { id, status } });
    load();
  }

  if (isPending || !user) return null;

  return (
    <SiteChrome>
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="text-kicker text-lime">الفريق //</p>
        <h1 className="mt-4 font-display text-poster text-snow">صندوق الطلبات</h1>
        <div className="mt-12">
          {state.kind === "loading" ? <p className="text-mist">جارٍ التحميل…</p> : null}
          {state.kind === "forbidden" ? (
            <p className="text-mist">هذه الصفحة لفريق ديل فقط.</p>
          ) : null}
          {state.kind === "error" ? (
            <p role="alert" className="text-red-400">
              تعذر تحميل الطلبات.
            </p>
          ) : null}
          {state.kind === "ready" && state.rows.length === 0 ? (
            <p className="border border-hair px-6 py-12 text-center text-mist">
              لا توجد طلبات بعد.
            </p>
          ) : null}
          {state.kind === "ready" && state.rows.length > 0 ? (
            <ul className="space-y-px bg-hair">
              {state.rows.map((r) => (
                <li key={r.id} className="bg-ink px-6 py-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="font-display text-xl text-snow">
                      #{r.id} · {r.service_title}
                    </h2>
                    <select
                      aria-label={`حالة الطلب ${r.id}`}
                      value={r.status}
                      onChange={(e) => void setStatus(r.id, e.target.value)}
                      className="h-10 border border-hair bg-card px-3 font-ui text-xs text-lime"
                    >
                      {Object.entries(requestStatus).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-sm text-mist">
                    {r.contact_name || "—"} ·{" "}
                    <a href={`tel:${r.phone}`} dir="ltr" className="text-lime">
                      {r.phone || r.account_email || "—"}
                    </a>
                    {r.company ? ` · ${r.company}` : ""}
                  </p>
                  <p className="mt-3 max-w-3xl text-sm leading-loose whitespace-pre-line text-dim">
                    {r.brief}
                  </p>
                  <p className="mt-3 font-ui text-xs text-dim">
                    {dateFmt.format(new Date(r.created_at))} ·{" "}
                    {r.notified_at ? "أُشعر الفريق" : "لم يُرسل إشعار"}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>
    </SiteChrome>
  );
}
