import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  FlaskConical,
  Gavel,
  Hourglass,
  ListChecks,
  Loader2,
  Phone,
  Scale,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Kpi, Pill, Skeleton } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { dayAr, daysAr, timeAr } from "@/components/law/format";
import { ConfirmDialog, StatusPill, useLoad } from "@/components/law/kit";
import { TaskItem } from "@/components/law/tasks-ui";
import { clearDemoData, getOnboarding, seedDemoData } from "@/lib/law/demo";
import type { OnboardingState } from "@/lib/law/demo-core";
import { getLawHome } from "@/lib/law/practice";
import type { AgendaItem } from "@/lib/law/practice-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
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
  const { workspace, lifecycle, role } = active;
  const first = (ctx.user.name || "").trim().split(/\s+/)[0];
  const manager = role === "owner" || role === "admin";
  const home = useLoad(() => getLawHome({ data: { workspaceId: workspace.id } }), [workspace.id]);
  const onboarding = useLoad(() => getOnboarding({ data: { workspaceId: workspace.id } }), [workspace.id]);
  const h = home.data;
  const ob = onboarding.data;
  const dismissKey = `law:onboarding-dismissed:${ctx.user.id}:${workspace.id}`;
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(readFlag(dismissKey));
  }, [dismissKey]);
  const reloadAll = async () => {
    await Promise.all([home.reload(), onboarding.reload()]);
  };
  const showStart = manager && ob !== null && !dismissed && !allDone(ob);

  return (
    <>
      <PageHead
        title={`${greeting()}${first ? `، ${first}` : ""}`}
        subtitle={h ? `${dayAr(h.today, true)} · ${workspace.name}` : workspace.name}
      />

      {ob?.hasDemo ? <DemoBanner workspaceId={workspace.id} manager={manager} onCleared={reloadAll} /> : null}
      {manager && ob && !ob.hasDemo && !ob.hasRealData && !lifecycle.readOnly ? (
        <TryDemo workspaceId={workspace.id} onSeeded={reloadAll} />
      ) : null}

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
        {showStart && ob ? (
          <StartHere
            state={ob}
            onDismiss={() => {
              writeFlag(dismissKey);
              setDismissed(true);
            }}
          />
        ) : null}
        <Card className={cn("p-5 md:p-6", showStart ? "lg:col-span-2" : "lg:col-span-5")}>
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

/* ------------------------------------------------------------------------ */
/* Onboarding and sample data                                                */
/* ------------------------------------------------------------------------ */

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode / blocked storage: the card simply comes back next visit.
  }
}

type StepKey = keyof OnboardingState["steps"];

const START_STEPS: {
  key: StepKey;
  title: string;
  body: string;
  to: "/app/settings" | "/app/clients" | "/app/cases" | "/app/team";
  hash?: string;
}[] = [
  { key: "office", title: "أكمل بيانات المكتب", body: "المدينة ورقم السجل التجاري", to: "/app/settings" },
  { key: "booking", title: "فعّل صفحة الحجز", body: "ليحجز عملاؤك استشاراتهم بأنفسهم", to: "/app/settings", hash: "booking" },
  { key: "client", title: "أضف أول عميل", body: "فرد أو منشأة", to: "/app/clients" },
  { key: "case", title: "افتح أول قضية", body: "برقم ملف ومرحلة وأتعاب", to: "/app/cases" },
  { key: "team", title: "ادعُ فريقك", body: "محامين ومساعدين بصلاحيات مناسبة", to: "/app/team" },
  { key: "twoStep", title: "فعّل الدخول بخطوتين", body: "رمز عبر واتساب عند كل دخول", to: "/app/settings" },
];

function allDone(s: OnboardingState): boolean {
  return START_STEPS.every((x) => s.steps[x.key]);
}

function StartHere({ state, onDismiss }: { state: OnboardingState; onDismiss: () => void }) {
  const done = START_STEPS.filter((x) => state.steps[x.key]).length;
  return (
    <Card className="lg:col-span-3">
      <CardHeader
        title="ابدأ هنا"
        description={`${done} من ${START_STEPS.length} خطوات مكتملة`}
        actions={
          <button
            type="button"
            onClick={onDismiss}
            aria-label="إخفاء قائمة البدء"
            title="إخفاء"
            className="grid size-9 place-items-center rounded-xl text-slate transition-colors hover:bg-paper hover:text-pine-deep"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        }
      />
      <div className="px-5 md:px-6">
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={START_STEPS.length}
          aria-valuenow={done}
          aria-label="التقدّم"
        >
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(done / START_STEPS.length) * 100}%` }} />
        </div>
      </div>
      <ul className="mt-3 grid gap-2 px-5 pb-5 sm:grid-cols-2 md:px-6">
        {START_STEPS.map((x) => {
          const ok = state.steps[x.key];
          return (
            <li key={x.key}>
              <Link
                to={x.to}
                hash={x.hash}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-line transition-colors hover:bg-paper",
                  ok && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full",
                    ok ? "bg-lime text-pine-deep" : "bg-paper text-slate ring-1 ring-line",
                  )}
                >
                  {ok ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <ListChecks className="size-3.5" aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold", ok && "line-through decoration-slate/40")}>{x.title}</span>
                  <span className="block truncate text-xs text-slate">{x.body}</span>
                </span>
                <span className="sr-only">{ok ? "(مكتملة)" : ""}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TryDemo({ workspaceId, onSeeded }: { workspaceId: string; onSeeded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mb-4 border-dashed border-pine/30 bg-pine-50/40 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lime text-pine-deep">
          <FlaskConical className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-pine-deep">جرّب ببيانات تجريبية</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate">
            نضيف إلى مكتبك أربعة عملاء وأربع قضايا بجلساتها ومهامها ومواعيدها لتتعرّف على النظام قبل إدخال بياناتك. تُعلَّم
            كلها «تجريبي» وتحذفها بضغطة متى ما أردت.
          </p>
        </div>
        <Button
          variant="dark"
          icon={busy ? Loader2 : Sparkles}
          disabled={busy}
          className="shrink-0"
          onClick={async () => {
            setBusy(true);
            try {
              await seedDemoData({ data: { workspaceId } });
              toast.success("أُضيفت البيانات التجريبية");
              await onSeeded();
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          أضف البيانات التجريبية
        </Button>
      </div>
    </Card>
  );
}

function DemoBanner({ workspaceId, manager, onCleared }: { workspaceId: string; manager: boolean; onCleared: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-lime/25 px-4 py-2.5 ring-1 ring-lime/60 ring-inset">
      <FlaskConical className="size-4 shrink-0 text-pine" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-pine-deep">هذه بيانات تجريبية — احذفها متى ما أردت</p>
      {manager ? (
        <Button size="sm" icon={Trash2} onClick={() => setConfirming(true)}>
          حذف البيانات التجريبية
        </Button>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="حذف البيانات التجريبية؟"
          body="ستُحذف العملاء والقضايا والجلسات والمهام والمواعيد والملاحظات المعلَّمة «تجريبي» فقط. لا يُمسّ شيء أدخلته بنفسك."
          confirmLabel="حذف البيانات التجريبية"
          danger
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            try {
              await clearDemoData({ data: { workspaceId } });
              toast.success("حُذفت البيانات التجريبية");
              setConfirming(false);
              await onCleared();
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
            }
          }}
        />
      ) : null}
    </div>
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
