import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Wallet } from "lucide-react";
import { Card, EmptyState, Num, type Tone } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { ErrorCard, ListSkeleton, useCan, useLoad } from "@/components/law/kit";
import { sar } from "@/components/law/format";
import { getLawReports } from "@/lib/law/practice";
import { CASE_STAGE_LABELS, HEARING_STATUS_LABELS, MODE_SHORT, type ConsultMode } from "@/lib/law/options";
import type { ReportsView } from "@/lib/law/practice-core";

export const Route = createFileRoute("/app/reports")({
  component: Reports,
});

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = (ym: string) => MONTH_AR[Number(ym.slice(5, 7)) - 1] ?? ym;

function Reports() {
  const { active } = useLawApp();
  const allowed = useCan();
  const canSee = allowed("case.fees.view", { write: false });

  const rep = useLoad(() => getLawReports({ data: { workspaceId: active.workspace.id } }), [active.workspace.id]);

  return (
    <>
      <PageHead title="التقارير" subtitle="نظرة مالية وتشغيلية على المكتب" />
      {!canSee ? (
        <EmptyState icon={BarChart3} title="التقارير غير متاحة لدورك" body="تظهر التقارير المالية لأعضاء الفريق ذوي صلاحية الأتعاب." />
      ) : rep.error && !rep.data ? (
        <ErrorCard title="تعذّر تحميل التقارير" message={rep.error} onRetry={() => void rep.reload()} />
      ) : !rep.data ? (
        <ListSkeleton />
      ) : (
        <ReportsBody v={rep.data} />
      )}
    </>
  );
}

function ReportsBody({ v }: { v: ReportsView }) {
  const { finance: f, totals, stages, openedByMonth, topClients, hearings, appointments } = v;
  const maxStage = Math.max(1, ...stages.map((s) => s.count));
  const maxMonth = Math.max(1, ...openedByMonth.map((m) => m.count));

  return (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="إجمالي الأتعاب" value={`${sar(f.billed)} ر.س`} tone="pine" icon={Wallet} />
        <Kpi label="المحصّل" value={`${sar(f.collected)} ر.س`} tone="lime" icon={TrendingUp} />
        <Kpi label="المتبقّي" value={`${sar(f.outstanding)} ر.س`} tone={f.outstanding > 0 ? "danger" : "neutral"} />
        <Kpi label="نسبة التحصيل" value={`${f.collectionRate}٪`} tone="info" sub={<CollectBar pct={f.collectionRate} />} />
      </div>

      {/* Counts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="قضايا مفتوحة" value={totals.openCases} of={`من ${totals.cases} إجمالًا`} />
        <MiniStat label="العملاء" value={totals.clients} />
        <MiniStat label="جلسات قادمة" value={hearings.upcoming} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cases by stage */}
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-pine-deep">القضايا حسب المرحلة</h3>
          {totals.cases === 0 ? (
            <p className="text-sm text-slate">لا قضايا بعد.</p>
          ) : (
            <ul className="space-y-2.5">
              {stages.map((s) => (
                <li key={s.stage} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
                  <span className="text-slate">{CASE_STAGE_LABELS[s.stage]}</span>
                  <span className="h-2.5 rounded-full bg-paper">
                    <span className="block h-full rounded-full bg-pine" style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </span>
                  <Num className="text-end font-bold">{s.count}</Num>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Cases opened per month */}
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-pine-deep">قضايا جديدة — آخر ٦ أشهر</h3>
          <div className="flex h-40 items-end justify-between gap-2">
            {openedByMonth.map((m) => (
              <div key={m.ym} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-pine-deep">{m.count}</span>
                <div
                  className="w-full rounded-t bg-lime"
                  style={{ height: `${Math.max(4, (m.count / maxMonth) * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="text-[11px] text-slate">{monthLabel(m.ym)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top clients by outstanding */}
      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg text-pine-deep">أعلى العملاء بالمستحقات</h3>
        {topClients.length === 0 ? (
          <p className="text-sm text-slate">لا مطالبات مسجّلة بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-end text-[13px] text-slate">
                  <th className="px-2 py-2 text-start font-semibold">العميل</th>
                  <th className="px-2 py-2 font-semibold">الأتعاب</th>
                  <th className="px-2 py-2 font-semibold">المحصّل</th>
                  <th className="px-2 py-2 font-semibold">المتبقّي</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-2 py-2.5 font-semibold text-pine-deep">{c.name}</td>
                    <td className="px-2 py-2.5 text-end"><Num>{sar(c.billed)}</Num></td>
                    <td className="px-2 py-2.5 text-end text-pine"><Num>{sar(c.collected)}</Num></td>
                    <td className="px-2 py-2.5 text-end font-bold text-red-700"><Num>{sar(c.outstanding)}</Num></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-pine-deep">الجلسات</h3>
          <Distribution rows={hearings.byStatus.map((r) => ({ label: HEARING_STATUS_LABELS[r.status as keyof typeof HEARING_STATUS_LABELS] ?? r.status, count: r.count }))} empty="لا جلسات بعد." />
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg text-pine-deep">المواعيد حسب النوع</h3>
          <Distribution rows={appointments.byMode.map((r) => ({ label: MODE_SHORT[r.mode as ConsultMode] ?? r.mode, count: r.count }))} empty="لا مواعيد بعد." />
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon: Icon, sub }: { label: string; value: string; tone: Tone; icon?: typeof Wallet; sub?: React.ReactNode }) {
  const bar: Record<Tone, string> = { pine: "bg-pine", lime: "bg-lime", neutral: "bg-slate", info: "bg-sky-500", danger: "bg-red-500" };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-slate">
        {Icon ? <Icon className="size-4" aria-hidden="true" /> : <span className={`inline-block size-2.5 rounded-full ${bar[tone]}`} aria-hidden="true" />}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl text-pine-deep"><Num>{value}</Num></p>
      {sub ? <div className="mt-2">{sub}</div> : null}
    </Card>
  );
}

function CollectBar({ pct }: { pct: number }) {
  return (
    <span className="block h-2 rounded-full bg-paper" aria-hidden="true">
      <span className="block h-full rounded-full bg-lime" style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
  );
}

function MiniStat({ label, value, of }: { label: string; value: number; of?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] font-semibold text-slate">{label}</p>
      <p className="mt-1 font-display text-3xl text-pine-deep"><Num>{value}</Num></p>
      {of ? <p className="mt-0.5 text-xs text-slate">{of}</p> : null}
    </Card>
  );
}

function Distribution({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return <p className="text-sm text-slate">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-2 text-sm">
          <span className="text-slate">{r.label}</span>
          <span className="h-2.5 rounded-full bg-paper">
            <span className="block h-full rounded-full bg-pine" style={{ width: `${(r.count / total) * 100}%` }} />
          </span>
          <Num className="text-end font-bold">{r.count}</Num>
        </li>
      ))}
    </ul>
  );
}
