import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  Gavel,
  Hourglass,
  ListChecks,
  Phone,
  Scale,
  Sparkles,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { Card, CardHeader, EmptyState, Kpi, Pill, Skeleton } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { dayAr, daysAr, timeAr } from "@/components/law/format";
import { StatusPill, useLoad } from "@/components/law/kit";
import { TaskItem } from "@/components/law/tasks-ui";
import { getLawHome } from "@/lib/law/practice";
import type { AgendaItem } from "@/lib/law/practice-core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  component: Home,
});

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Riyadh" }));
  return h < 12 ? "صباح الخير" : "مساء الخير";
}

function Home() {
  const { ctx, active } = useLawApp();
  const { workspace, lifecycle, seats, role } = active;
  const first = (ctx.user.name || "").trim().split(/\s+/)[0];
  const manager = role === "owner" || role === "admin";
  const home = useLoad(() => getLawHome({ data: { workspaceId: workspace.id } }), [workspace.id]);
  const h = home.data;

  const steps = [
    {
      done: Boolean(workspace.cr_number),
      title: "أكمل بيانات المكتب",
      to: "/app/settings" as const,
    },
    { done: seats.used > 1, title: "ادعُ فريقك", to: "/app/team" as const },
    { done: (h?.counts.clients ?? 0) > 0, title: "أضف أول عميل", to: "/app/clients" as const },
    { done: lifecycle.status === "active", title: "اختر خطتك", to: "/app/billing" as const },
  ];
  const pending = steps.filter((s) => !s.done && (manager || s.to !== "/app/settings") && (manager || s.to !== "/app/billing"));

  return (
    <>
      <PageHead
        title={`${greeting()}${first ? `، ${first}` : ""}`}
        subtitle={h ? `${dayAr(h.today, true)} · ${workspace.name}` : workspace.name}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Kpi label="قضايا مفتوحة" value={h?.counts.openCases ?? 0} loading={!h} icon={Scale} hint="كل المراحل عدا المغلقة" />
        <Kpi label="جلسات هذا الأسبوع" value={h?.counts.weekHearings ?? 0} loading={!h} icon={Gavel} hint="خلال سبعة أيام" />
        <Kpi
          label="بانتظار التأكيد"
          value={h?.counts.pendingConsults ?? 0}
          loading={!h}
          icon={Hourglass}
          tone="lime"
          hint={<Link to="/app/consultations" className="text-pine hover:underline">طلبات الاستشارة</Link>}
        />
        <Kpi label="العملاء" value={h?.counts.clients ?? 0} loading={!h} icon={UserRound} hint="ملفات العملاء في المكتب" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="اليوم"
            description="الجلسات والمواعيد والاستشارات (بتوقيت الرياض)"
            actions={
              <Link to="/app/appointments" className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-pine hover:underline">
                التقويم
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {!h ? (
            <div className="space-y-3 p-5 md:p-6">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : h.agenda.length === 0 ? (
            <EmptyState icon={CalendarDays} title="لا شيء في جدول اليوم" body="جلسات القضايا والمواعيد والاستشارات تظهر هنا في يومها." />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {h.agenda.map((a) => (
                <AgendaRow key={`${a.type}-${a.id}`} a={a} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          <CardHeader
            title="مهامي"
            actions={
              <Link to="/app/tasks" className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-pine hover:underline">
                كل المهام
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {!h ? (
            <div className="space-y-3 p-5 md:p-6">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : h.myTasks.length === 0 ? (
            <p className="px-5 pt-4 pb-6 text-sm text-slate md:px-6">لا مهام مسندة إليك.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {h.myTasks.map((t) => (
                <TaskItem key={t.id} task={t} compact onChanged={() => void home.reload()} />
              ))}
            </ul>
          )}
          {h && h.overdue.length > 0 ? (
            <div className="mt-auto border-t border-red-100 bg-red-50/60">
              <p className="flex items-center gap-2 px-5 pt-4 text-[13px] font-bold text-red-800 md:px-6">
                <AlertTriangle className="size-4" aria-hidden="true" />
                متأخرة في المكتب ({h.overdue.length})
              </p>
              <ul className="divide-y divide-red-100">
                {h.overdue.map((t) => (
                  <TaskItem key={t.id} task={t} compact onChanged={() => void home.reload()} />
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {pending.length ? (
          <Card className="lg:col-span-3">
            <CardHeader title="جهّز مكتبك" description={`${steps.length - pending.length} من ${steps.length} خطوات مكتملة`} />
            <ul className="mt-2 grid gap-2 px-5 pb-5 sm:grid-cols-2 md:px-6">
              {steps.map((s) => (
                <li key={s.title}>
                  <Link
                    to={s.to}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-line transition-colors hover:bg-paper",
                      s.done && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full",
                        s.done ? "bg-lime text-pine-deep" : "bg-paper text-slate ring-1 ring-line",
                      )}
                    >
                      {s.done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <ListChecks className="size-3.5" aria-hidden="true" />}
                    </span>
                    <span className={cn("text-sm font-semibold", s.done && "line-through decoration-slate/40")}>{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card className={cn("p-5 md:p-6", pending.length ? "lg:col-span-2" : "lg:col-span-5")}>
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <Sparkles className="size-[18px] text-lime-600" aria-hidden="true" />
            الاستشارات عن بُعد
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate">
            فعّل صفحة الحجز ليحجز عملاؤك استشاراتهم بالفيديو أو الهاتف أو حضوريًا من الأوقات المتاحة فعلًا، ويدخلون
            المكالمة من المتصفح دون تطبيق.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/app/consultations" className="inline-flex h-9 items-center gap-2 rounded-xl bg-pine px-3.5 text-[13px] font-semibold text-snow hover:bg-pine-deep">
              <Video className="size-4" aria-hidden="true" />
              الاستشارات
            </Link>
            {manager ? (
              <Link
                to="/app/settings"
                hash="booking"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3.5 text-[13px] font-semibold hover:bg-paper"
              >
                إعدادات الحجز
              </Link>
            ) : null}
          </div>
          {lifecycle.status === "trialing" ? (
            <p className="mt-4 text-xs text-slate">تجربتك المجانية: باقي {daysAr(lifecycle.daysLeft)}.</p>
          ) : null}
        </Card>
      </div>
    </>
  );
}

function AgendaRow({ a }: { a: AgendaItem }) {
  const Icon = a.type === "hearing" ? Gavel : a.mode === "video" ? Video : a.mode === "phone" ? Phone : Users;
  const title =
    a.type === "hearing"
      ? `جلسة: ${a.title}`
      : a.type === "consultation"
        ? `استشارة${a.client_name ? ` — ${a.client_name}` : ""}`
        : a.title || a.client_name || "موعد";
  const sub = [a.type === "consultation" ? a.title : a.client_name, a.lawyer_name].filter(Boolean).join(" · ");
  const body = (
    <>
      <div className="w-16 shrink-0">
        <p className="font-ui text-[13px] font-bold tabular-nums">{timeAr(a.starts_at)}</p>
      </div>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          a.type === "hearing" ? "bg-pine-deep text-lime" : a.type === "consultation" ? "bg-lime text-pine-deep" : "bg-paper text-pine ring-1 ring-line",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        {sub ? <p className="truncate text-xs text-slate">{sub}</p> : null}
      </div>
      {a.type !== "hearing" && a.status !== "confirmed" ? (
        <StatusPill status={a.status as "pending"} />
      ) : a.type === "hearing" ? (
        <Pill tone="pine" dot={false}>
          جلسة
        </Pill>
      ) : null}
    </>
  );
  const cls = "flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper md:px-6";
  return (
    <li>
      {a.type === "hearing" && a.case_id ? (
        <Link to="/app/cases/$id" params={{ id: a.case_id }} className={cls}>
          {body}
        </Link>
      ) : (
        <Link to="/app/consultations/$id" params={{ id: a.id }} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}
