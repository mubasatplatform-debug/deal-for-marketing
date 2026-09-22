import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { requestStatus } from "@/lib/content";
import { listMyRequests, type RequestRow } from "@/lib/requests";

export const Route = createFileRoute("/client")({ component: ClientHome });

function ClientHome() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<RequestRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listMyRequests()
      .then(setRows)
      .catch(() => setRows([]));
  }, [user]);

  if (isPending) {
    return (
      <SiteChrome>
        <main className="grid min-h-dvh place-items-center bg-ink">
          <p className="text-mist">جارٍ التحميل…</p>
        </main>
      </SiteChrome>
    );
  }
  if (!user) return <RedirectToSignIn to="/login" />;

  return (
    <SiteChrome>
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="text-kicker text-lime">مشاريعي //</p>
        <h1 className="mt-4 font-display text-poster text-snow">طلباتك لدى ديل</h1>
        <p className="mt-2 text-mist">{user.displayName ?? user.primaryEmail}</p>
        <Link to="/start" className="mt-6 inline-flex font-display text-sm text-lime">
          طلب خدمة جديدة
        </Link>

        <div className="mt-12">
          {rows === null ? (
            <p className="text-mist">جارٍ التحميل…</p>
          ) : rows.length === 0 ? (
            <p className="border border-hair px-6 py-12 text-center text-mist">لا توجد طلبات بعد. ابدأ من الخدمات.</p>
          ) : (
            <ul className="space-y-px bg-hair">
              {rows.map((r) => (
                <li key={r.id} className="bg-ink px-6 py-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="font-display text-xl text-snow">{r.service_title}</h2>
                    <span className="font-ui text-xs tracking-widest text-lime">
                      {requestStatus[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.company ? <p className="mt-2 text-sm text-mist">{r.company}</p> : null}
                  <p className="mt-3 max-w-2xl text-sm leading-loose text-dim">{r.brief}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </SiteChrome>
  );
}
