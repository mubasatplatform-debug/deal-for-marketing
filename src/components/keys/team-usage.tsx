import { useMemo, useState } from "react";
import { Activity, AlertTriangle, KeyRound, PlugZap } from "lucide-react";
import { Card, CardHeader, EmptyState, Kpi, Num, Pill, Segmented, Skeleton, type Tone } from "@/components/dash/ui";
import { formatAbsolute, formatRelative } from "@/components/admin/format";
import type { TeamUsage } from "@/lib/api/keys";
import { ScopeCode } from "./create-dialog";
import { lastUsedText } from "./key-list";

function statusTone(status: number): Tone {
  if (status >= 500) return "danger";
  if (status >= 400) return status === 429 ? "lime" : "danger";
  return "pine";
}

export function TeamKpis({ usage, loading }: { usage: TeamUsage | null; loading: boolean }) {
  const t = usage?.totals;
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Kpi label="استدعاءات آخر 24 ساعة" value={t?.calls_24h ?? 0} icon={Activity} loading={loading} />
      <Kpi
        label="أخطاء آخر 24 ساعة"
        value={t?.errors_24h ?? 0}
        icon={AlertTriangle}
        tone="lime"
        loading={loading}
        hint={t && t.calls_24h ? `${Math.round((t.errors_24h / t.calls_24h) * 100)}% من الاستدعاءات` : undefined}
      />
      <Kpi label="مفاتيح فعّالة" value={t?.active_keys ?? 0} icon={KeyRound} loading={loading} />
      <Kpi label="مفاتيح استُخدمت اليوم" value={t?.keys_used_24h ?? 0} icon={PlugZap} loading={loading} />
    </div>
  );
}

/** Every active key across accounts, most recently used first. */
export function AllKeysTable({ usage, loading, now }: { usage: TeamUsage | null; loading: boolean; now: number }) {
  const keys = usage?.keys ?? [];
  return (
    <Card>
      <CardHeader title="كل المفاتيح الفعّالة" description="مفاتيح العملاء والفريق، الأحدث استخدامًا أولًا." />
      {loading ? (
        <div className="space-y-2 p-5 md:p-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState icon={KeyRound} title="لا مفاتيح فعّالة" body="حين ينشئ عميل مفتاحًا يظهر هنا مع استخدامه." />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-[13px]">
            <thead>
              <tr className="border-y border-line bg-paper/60 text-xs text-slate">
                <th className="px-5 py-2.5 text-start font-semibold md:px-6">المفتاح</th>
                <th className="px-3 py-2.5 text-start font-semibold">المالك</th>
                <th className="px-3 py-2.5 text-start font-semibold">الصلاحيات</th>
                <th className="px-3 py-2.5 text-start font-semibold">آخر استخدام</th>
                <th className="px-5 py-2.5 text-end font-semibold md:px-6">7 أيام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k.id} className="align-top">
                  <td className="px-5 py-3 md:px-6">
                    <p className="font-bold text-pine-deep">{k.name}</p>
                    <code dir="ltr" className="mt-0.5 inline-block font-mono text-xs text-slate">
                      {k.prefix}…
                    </code>
                  </td>
                  <td className="max-w-[220px] px-3 py-3">
                    <p className="truncate font-semibold text-pine-deep">{k.owner_name || "—"}</p>
                    <p dir="ltr" className="truncate text-end font-ui text-xs text-slate">
                      {k.owner_email}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <ScopeCode key={s} scope={s} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate" title={k.last_used_at ? formatAbsolute(new Date(k.last_used_at)) : undefined}>
                    {lastUsedText(k.last_used_at, now)}
                  </td>
                  <td className="px-5 py-3 text-end md:px-6">
                    <Num className="font-bold text-pine-deep">{k.calls_7d}</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

type Filter = "all" | "errors" | "mcp";

/** Rows shown before "show more", so one noisy key can not bury the page. */
const PAGE = 15;

/** The last 100 authenticated calls (REST and MCP tool calls). */
export function ActivityLog({ usage, loading, now }: { usage: TeamUsage | null; loading: boolean; now: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const events = useMemo(() => usage?.events ?? [], [usage]);
  const shown = useMemo(
    () =>
      events.filter((e) =>
        filter === "errors" ? e.status >= 400 : filter === "mcp" ? e.method === "MCP" : true,
      ),
    [events, filter],
  );
  return (
    <Card>
      <CardHeader
        title="آخر الاستدعاءات"
        description="آخر 100 استدعاء عبر الـ API وخادم MCP، مع المفتاح وصاحبه ونتيجة الطلب."
        actions={
          <Segmented<Filter>
            label="تصفية السجل"
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setLimit(PAGE);
            }}
            options={[
              { value: "all", label: "الكل", count: events.length },
              { value: "errors", label: "أخطاء", count: events.filter((e) => e.status >= 400).length },
              { value: "mcp", label: "MCP", count: events.filter((e) => e.method === "MCP").length },
            ]}
          />
        }
      />
      {loading ? (
        <div className="space-y-2 p-5 md:p-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={events.length ? "لا نتائج لهذه التصفية" : "لا استدعاءات بعد"}
          body={events.length ? undefined : "حين يستخدم أحد مفتاحه يظهر كل استدعاء هنا."}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-y border-line bg-paper/60 text-xs text-slate">
                <th className="px-5 py-2.5 text-start font-semibold md:px-6">الوقت</th>
                <th className="px-3 py-2.5 text-start font-semibold">الطلب</th>
                <th className="px-3 py-2.5 text-start font-semibold">النتيجة</th>
                <th className="px-5 py-2.5 text-start font-semibold md:px-6">المفتاح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.slice(0, limit).map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate md:px-6" title={formatAbsolute(new Date(e.at))}>
                    {formatRelative(new Date(e.at), now)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span dir="ltr" className="inline-flex items-center gap-2 font-mono text-xs">
                      <span className="rounded bg-pine-50 px-1.5 py-px font-bold text-pine">{e.method}</span>
                      <span className="text-pine-deep">{e.target}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={statusTone(e.status)}>
                      <Num>{e.status}</Num>
                    </Pill>
                  </td>
                  <td className="px-5 py-2 md:px-6">
                    <span className="block font-semibold text-pine-deep">{e.key_name}</span>
                    <span dir="ltr" className="block text-end font-ui text-xs text-slate">
                      {e.owner_email}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > limit ? (
            <div className="border-t border-line px-5 py-3 text-center md:px-6">
              <button
                type="button"
                onClick={() => setLimit((l) => l + 25)}
                className="inline-flex min-h-10 items-center rounded-xl px-4 text-[13px] font-semibold text-pine hover:bg-paper focus-visible:outline-2 focus-visible:outline-pine"
              >
                عرض المزيد · بقي <Num className="ms-1">{shown.length - limit}</Num>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
