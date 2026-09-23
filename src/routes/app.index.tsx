import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, CalendarClock, Check, CreditCard, ExternalLink, Users } from "lucide-react";
import { Card, CardHeader, Kpi, Pill } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { daysAr, dateAr } from "@/components/law/format";
import { MODULES } from "@/components/law/modules";
import { STATUS_LABELS } from "@/lib/saas/lifecycle";
import { getPlan } from "@/lib/saas/plans";
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
  const plan = getPlan(workspace.plan);
  const first = (ctx.user.name || "").trim().split(/\s+/)[0];
  const manager = role === "owner" || role === "admin";

  const steps = [
    { done: true, title: "أنشئ مكتبك", body: "تم. مكتبك جاهز وتجربتك بدأت.", to: null },
    {
      done: Boolean(workspace.cr_number),
      title: "أكمل بيانات المكتب",
      body: "أضف رقم السجل التجاري ليظهر في طلبات الدفع.",
      to: "/app/settings" as const,
    },
    {
      done: seats.used > 1,
      title: "ادعُ فريقك",
      body: "أضف المحامين والموظفين، ولكل واحد صلاحياته.",
      to: "/app/team" as const,
    },
    {
      done: lifecycle.status === "active",
      title: "اختر خطتك",
      body: "اشترك قبل نهاية التجربة ليستمر مكتبك دون انقطاع.",
      to: "/app/billing" as const,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHead
        title={`${greeting()}${first ? `، ${first}` : ""}`}
        subtitle={[workspace.name, workspace.city].filter(Boolean).join(" · ")}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Kpi
          label="الخطة"
          value={<span className="font-dash text-[24px]">{plan.name}</span>}
          hint={STATUS_LABELS[lifecycle.status]}
          icon={CreditCard}
          tone="lime"
        />
        <Kpi
          label={lifecycle.status === "trialing" ? "باقي من التجربة" : "ينتهي الاشتراك"}
          value={
            lifecycle.status === "trialing" ? (
              <span className="font-dash text-[24px]">{daysAr(lifecycle.daysLeft)}</span>
            ) : (
              <span className="font-dash text-[20px]">{dateAr(lifecycle.endsAt)}</span>
            )
          }
          hint={lifecycle.endsAt ? `حتى ${dateAr(lifecycle.endsAt)}` : undefined}
          icon={CalendarClock}
        />
        <Kpi
          label="المقاعد المستخدمة"
          value={
            <>
              {seats.used}
              <span className="text-[18px] text-slate"> / {seats.limit}</span>
            </>
          }
          hint={seats.pending ? `منها ${seats.pending} دعوة معلّقة` : "أعضاء ودعوات معلّقة"}
          icon={Users}
        />
        <Kpi
          label="مكاتبك"
          value={ctx.memberships.length}
          hint={ctx.memberships.length > 1 ? "بدّل بينها من القائمة الجانبية" : "مكتب واحد"}
          icon={Building2}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="جهّز مكتبك"
            description={`${doneCount} من ${steps.length} خطوات مكتملة`}
            actions={<Pill tone={doneCount === steps.length ? "lime" : "pine"}>{Math.round((doneCount / steps.length) * 100)}%</Pill>}
          />
          <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-pine-50 md:mx-6">
            <div
              className="h-full rounded-full bg-lime transition-[width]"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <ol className="mt-2 divide-y divide-line px-5 pb-2 md:px-6">
            {steps.map((s, i) => {
              const body = (
                <>
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full font-ui text-[13px] font-bold",
                      s.done ? "bg-lime text-pine-deep" : "bg-paper text-slate ring-1 ring-line",
                    )}
                  >
                    {s.done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-bold", s.done && "text-slate line-through decoration-slate/40")}>
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-slate">{s.body}</span>
                  </span>
                  {!s.done && s.to ? <ArrowLeft className="size-4 shrink-0 text-slate" aria-hidden="true" /> : null}
                </>
              );
              return (
                <li key={s.title}>
                  {!s.done && s.to && (manager || s.to === "/app/team") ? (
                    <Link to={s.to} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 hover:bg-paper">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-3.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          <CardHeader title="ما الجديد في مكتبك" description="المرحلة الأولى متاحة الآن" />
          <ul className="flex-1 space-y-3 px-5 pt-4 pb-5 text-sm md:px-6">
            {[
              "مساحة عمل خاصة بمكتبك، معزولة عن غيره.",
              "دعوة الفريق بالبريد، وصلاحيات: مالك، مدير، محامٍ، موظف.",
              "الاشتراك والدفع: تحويل بنكي الآن، ومدى والبطاقات قريبًا.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-lime-50 text-lime-600">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="leading-relaxed text-pine-deep">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mx-5 mb-5 rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-slate md:mx-6">
            المواعيد والعملاء والقضايا والمستندات قادمة تباعًا، وتصلك داخل اشتراكك دون إعداد إضافي.
          </p>
        </Card>
      </div>

      <h2 className="mt-10 mb-4 text-[15px] font-bold">وحدات المكتب</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((m) => (
          <Card key={m.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-pine-50 text-pine">
                <m.icon className="size-5" />
              </span>
              <Pill tone="neutral" dot={false}>
                قريبًا
              </Pill>
            </div>
            <p className="mt-4 font-bold">{m.title}</p>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-slate">{m.blurb}</p>
            <a
              href={m.demo}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-pine hover:underline"
            >
              شاهد العرض التوضيحي
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Card>
        ))}
      </div>
    </>
  );
}
