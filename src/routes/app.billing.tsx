import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, CreditCard, Landmark, Loader2, Lock, ReceiptText, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Num, Pill, Segmented, Skeleton, type Tone } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { dateAr, daysAr, riyals, sar } from "@/components/law/format";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { STATUS_LABELS, type WorkspaceStatus } from "@/lib/saas/lifecycle";
import {
  CYCLE_LABELS,
  PLANS,
  getPlan,
  quote,
  yearlySavingPct,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "@/lib/saas/plans";
import {
  confirmCheckout,
  getBilling,
  startCheckout,
  type BillingView,
  type CheckoutResponse,
} from "@/lib/saas/workspace";
import { PlanFeatures } from "@/components/law/plan-features";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/billing")({
  validateSearch: (s: Record<string, unknown>): { checkout?: string } =>
    typeof s.checkout === "string" && UUID.test(s.checkout) ? { checkout: s.checkout } : {},
  component: Billing,
});

const STATUS_TONE: Record<WorkspaceStatus, Tone> = {
  trialing: "lime",
  active: "pine",
  past_due: "danger",
  suspended: "danger",
  cancelled: "neutral",
};

const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "بانتظار الدفع", tone: "lime" },
  paid: { label: "مدفوع", tone: "pine" },
  cancelled: { label: "ملغى", tone: "neutral" },
  failed: { label: "فشل", tone: "danger" },
};

function Billing() {
  const { active, reload } = useLawApp();
  const { checkout } = Route.useSearch();
  const manager = active.role === "owner" || active.role === "admin";
  const [view, setView] = useState<BillingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [picked, setPicked] = useState<PlanId | null>(null);
  const confirmed = useRef(false);
  const wsId = active.workspace.id;

  const load = useCallback(async () => {
    setError(null);
    try {
      setView(await getBilling({ data: { workspaceId: wsId } }));
    } catch (err) {
      setError(workspaceErrorMessage(err));
    }
  }, [wsId]);

  useEffect(() => {
    if (manager) void load();
  }, [manager, load]);

  // Back from a hosted payment page: ask the server (which asks the provider).
  useEffect(() => {
    if (!checkout || !manager || confirmed.current) return;
    confirmed.current = true;
    void confirmCheckout({ data: { workspaceId: wsId, invoiceId: checkout } })
      .then(async (r) => {
        if (r.status === "paid") {
          toast.success("تم الدفع وتفعيل الاشتراك. شكرًا لك!");
          await reload();
        } else if (r.status === "failed") toast.error("لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.");
        else if (r.status === "pending") toast.message("نتحقق من الدفع… سيُفعّل الاشتراك فور تأكيده.");
        await load();
      })
      .catch(() => undefined)
      .finally(() => window.history.replaceState(null, "", "/app/billing"));
  }, [checkout, manager, wsId, load, reload]);

  if (!manager) {
    const plan = getPlan(active.workspace.plan);
    return (
      <>
        <PageHead title="الاشتراك" />
        <Card>
          <EmptyState
            icon={Lock}
            title={`مكتبك على خطة ${plan.name} · ${STATUS_LABELS[active.lifecycle.status]}`}
            body="يدير الاشتراك والدفع مالك المكتب أو المدير."
          />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHead title="الاشتراك" />
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="تعذّر تحميل الاشتراك"
            body={error}
            action={
              <Button icon={RotateCw} onClick={() => void load()}>
                إعادة المحاولة
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  if (!view) {
    return (
      <>
        <PageHead title="الاشتراك" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-4 h-9 w-32" />
              <Skeleton className="mt-6 h-24 w-full" />
            </Card>
          ))}
        </div>
      </>
    );
  }

  const current = getPlan(view.plan);
  const lc = view.lifecycle;
  const pending = view.invoices.find((i) => i.status === "pending");

  return (
    <>
      <PageHead title="الاشتراك" subtitle="خطتك، مقاعدك، وطلبات الدفع" />

      <Card className="overflow-hidden">
        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="الخطة الحالية">
            <span className="text-xl font-extrabold">{current.name}</span>
            <Pill tone={STATUS_TONE[lc.status]} className="ms-2 align-middle">
              {STATUS_LABELS[lc.status]}
            </Pill>
          </Summary>
          <Summary label={lc.status === "trialing" ? "باقي من التجربة" : lc.status === "active" ? "يتجدد في" : "انتهى في"}>
            <span className="text-xl font-extrabold">
              {lc.status === "trialing" ? daysAr(lc.daysLeft) : dateAr(lc.endsAt)}
            </span>
            {lc.status === "trialing" && lc.endsAt ? (
              <span className="mt-0.5 block text-xs text-slate">حتى {dateAr(lc.endsAt)}</span>
            ) : null}
          </Summary>
          <Summary label="المقاعد">
            <Num className="text-xl font-extrabold">
              {view.seats.used} / {view.seats.limit}
            </Num>
            <span className="mt-0.5 block text-xs text-slate">
              {view.seats.members} أعضاء · {view.seats.pending} دعوات معلّقة
            </span>
          </Summary>
          <Summary label="دورة الفوترة">
            <span className="text-xl font-extrabold">
              {lc.status === "trialing" ? "—" : CYCLE_LABELS[view.cycle]}
            </span>
          </Summary>
        </div>
      </Card>

      {pending ? (
        <Card className="mt-4 border-lime/50 bg-lime-50/60">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center md:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/30 text-pine">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            <p className="flex-1 text-sm leading-relaxed">
              <strong>طلب دفع #{pending.number} بانتظار التأكيد</strong> — خطة {getPlan(pending.plan).name} (
              {CYCLE_LABELS[pending.cycle]}) بمبلغ <Num className="font-bold">{sar(pending.total)}</Num> ر.س.
              {pending.provider === "manual" ? " يُفعّل فور تأكيد فريق ديل لوصول التحويل." : ""}
            </p>
          </div>
        </Card>
      ) : null}

      <div className="mt-10 mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold">اختر خطتك</h2>
          <p className="mt-1 text-sm text-slate">الأسعار بالريال السعودي ولا تشمل ضريبة القيمة المضافة (١٥٪).</p>
        </div>
        <Segmented
          label="دورة الفوترة"
          value={cycle}
          onChange={setCycle}
          options={[
            { value: "monthly", label: "شهري" },
            { value: "yearly", label: `سنوي · وفّر ${yearlySavingPct(PLANS[1])}٪` },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            cycle={cycle}
            current={p.id === view.plan && lc.status === "active"}
            tooSmall={p.seats < view.seats.members}
            onPick={() => setPicked(p.id)}
          />
        ))}
      </div>

      <Card className="mt-10">
        <CardHeader title="طلبات الدفع" description="كل طلب اشتراك أنشأته، ومرجعه للتحويل البنكي" />
        {view.invoices.length === 0 ? (
          <p className="px-5 pt-3 pb-6 text-sm text-slate md:px-6">لا طلبات دفع بعد.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-line bg-paper text-start text-xs text-slate">
                  <th className="px-5 py-2.5 text-start font-semibold md:px-6">المرجع</th>
                  <th className="px-3 py-2.5 text-start font-semibold">الخطة</th>
                  <th className="px-3 py-2.5 text-start font-semibold">المبلغ</th>
                  <th className="px-3 py-2.5 text-start font-semibold">الطريقة</th>
                  <th className="px-3 py-2.5 text-start font-semibold">الحالة</th>
                  <th className="px-5 py-2.5 text-start font-semibold md:px-6">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-3 font-ui font-bold md:px-6">#{i.number}</td>
                    <td className="px-3 py-3">
                      {getPlan(i.plan).name} · {CYCLE_LABELS[i.cycle]}
                    </td>
                    <td className="px-3 py-3">
                      <Num className="font-semibold">{sar(i.total)}</Num> <span className="text-xs text-slate">ر.س</span>
                    </td>
                    <td className="px-3 py-3 text-slate">{i.provider === "manual" ? "تحويل بنكي" : "بطاقة / مدى"}</td>
                    <td className="px-3 py-3">
                      <Pill tone={INVOICE_STATUS[i.status]?.tone ?? "neutral"}>{INVOICE_STATUS[i.status]?.label ?? i.status}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate md:px-6">{dateAr(i.paid_at ?? i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {picked ? (
        <CheckoutDialog
          workspaceId={wsId}
          planId={picked}
          cycle={cycle}
          providers={view.providers}
          onClose={() => setPicked(null)}
          onDone={() => void load()}
        />
      ) : null}
    </>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-5 md:px-6">
      <p className="text-[13px] font-semibold text-slate">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  current,
  tooSmall,
  onPick,
}: {
  plan: Plan;
  cycle: BillingCycle;
  current: boolean;
  tooSmall: boolean;
  onPick: () => void;
}) {
  const dark = Boolean(plan.highlight);
  return (
    <Card className={cn("relative flex flex-col p-6", dark && "border-pine-deep bg-pine-deep text-snow")}>
      {plan.highlight ? (
        <span className="absolute -top-3 start-6 rounded-full bg-lime px-3 py-0.5 text-xs font-bold text-pine-deep">
          الأنسب لمعظم المكاتب
        </span>
      ) : null}
      <p className={cn("text-lg font-extrabold", dark && "text-snow")}>{plan.name}</p>
      <p className={cn("mt-1 text-[13px]", dark ? "text-snow/65" : "text-slate")}>{plan.tagline}</p>
      <p className="mt-5 flex items-baseline gap-1.5">
        <Num className="text-[34px] leading-none font-bold">{riyals(plan.price[cycle])}</Num>
        <span className={cn("text-sm font-semibold", dark ? "text-snow/65" : "text-slate")}>
          ر.س / {cycle === "yearly" ? "سنة" : "شهر"}
        </span>
      </p>
      <p className={cn("mt-1 text-xs", dark ? "text-snow/50" : "text-slate")}>
        {cycle === "yearly"
          ? `يعادل ${riyals(Math.round(plan.price.yearly / 12))} ر.س شهريًا`
          : "تُدفع شهريًا، وتلغي متى شئت"}
      </p>
      <div className="mt-6 flex-1">
        <PlanFeatures plan={plan} dark={dark} />
      </div>
      <Button
        variant={dark ? "primary" : "dark"}
        className="mt-7 h-11 w-full"
        disabled={current || tooSmall}
        onClick={onPick}
      >
        {current ? "خطتك الحالية" : tooSmall ? "فريقك أكبر من هذه الخطة" : `اشترك في ${plan.name}`}
      </Button>
    </Card>
  );
}

function CheckoutDialog({
  workspaceId,
  planId,
  cycle,
  providers,
  onClose,
  onDone,
}: {
  workspaceId: string;
  planId: PlanId;
  cycle: BillingCycle;
  providers: ("manual" | "moyasar")[];
  onClose: () => void;
  onDone: () => void;
}) {
  const q = quote(planId, cycle);
  const [method, setMethod] = useState<"manual" | "moyasar">(providers.includes("moyasar") ? "moyasar" : "manual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<CheckoutResponse, { kind: "instructions" }> | null>(null);

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      const r = await startCheckout({ data: { workspaceId, plan: planId, cycle, provider: method } });
      if (r.kind === "redirect") {
        window.location.assign(r.url);
        return;
      }
      setDone(r);
      onDone();
    } catch (error) {
      setErr(workspaceErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const b = done.bank;
    return (
      <Dialog
        title="طلبك وصلنا"
        description="أكمل التحويل البنكي، وسيُفعّل فريق ديل اشتراكك فور تأكيد وصوله."
        onClose={onClose}
        footer={
          <Button variant="dark" onClick={onClose}>
            تم
          </Button>
        }
      >
        <dl className="divide-y divide-line rounded-xl border border-line text-sm">
          <Line k="مرجع الطلب" v={<Num className="font-bold">#{done.invoice.number}</Num>} />
          <Line k="المبلغ شامل الضريبة" v={<><Num className="font-bold">{sar(done.invoice.total)}</Num> ر.س</>} />
          {b ? (
            <>
              {b.bankName ? <Line k="البنك" v={b.bankName} /> : null}
              {b.beneficiary ? <Line k="اسم المستفيد" v={b.beneficiary} /> : null}
              <Line k="الآيبان" v={<code dir="ltr" className="font-ui text-[13px] font-bold">{b.iban}</code>} />
            </>
          ) : null}
        </dl>
        <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-slate">
          {b
            ? `اكتب المرجع #${done.invoice.number} في وصف التحويل. `
            : "سيتواصل معك فريق ديل خلال يوم عمل بتفاصيل الحساب البنكي. "}
          للجهات الحكومية والشركات: تواصل معنا لترتيب إجراءات الشراء لديكم.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`الاشتراك في خطة ${q.plan.name}`}
      description={`فوترة ${CYCLE_LABELS[cycle]} · حتى ${q.plan.seats} أعضاء`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={() => void pay()} disabled={busy} icon={busy ? Loader2 : undefined}>
            {busy ? "جارٍ التجهيز…" : method === "moyasar" ? "المتابعة للدفع" : "إرسال طلب التفعيل"}
          </Button>
        </>
      }
    >
      <dl className="divide-y divide-line rounded-xl border border-line text-sm">
        <Line k={`خطة ${q.plan.name} (${CYCLE_LABELS[cycle]})`} v={<><Num>{sar(q.subtotal)}</Num> ر.س</>} />
        <Line k="ضريبة القيمة المضافة ١٥٪" v={<><Num>{sar(q.vat)}</Num> ر.س</>} />
        <Line k={<strong>الإجمالي</strong>} v={<><Num className="text-base font-bold">{sar(q.total)}</Num> ر.س</>} />
      </dl>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold">طريقة الدفع</legend>
        <div className="grid gap-2">
          {providers.includes("moyasar") ? (
            <Method
              checked={method === "moyasar"}
              onPick={() => setMethod("moyasar")}
              icon={CreditCard}
              title="مدى، فيزا، ماستركارد، Apple Pay"
              body="دفع فوري وتفعيل مباشر عبر بوابة دفع سعودية."
            />
          ) : null}
          <Method
            checked={method === "manual"}
            onPick={() => setMethod("manual")}
            icon={Building2}
            title="تحويل بنكي"
            body="للشركات والجهات الحكومية. يُفعّل بعد تأكيد وصول التحويل."
          />
        </div>
        {!providers.includes("moyasar") ? (
          <p className="mt-3 text-xs text-slate">الدفع بالبطاقة ومدى وApple Pay قريبًا.</p>
        ) : null}
      </fieldset>
      {err ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}
    </Dialog>
  );
}

function Line({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-slate">{k}</dt>
      <dd className="text-pine-deep">{v}</dd>
    </div>
  );
}

function Method({
  checked,
  onPick,
  icon: Icon,
  title,
  body,
}: {
  checked: boolean;
  onPick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
        checked ? "border-pine bg-pine-50/60" : "border-line hover:border-line-strong",
      )}
    >
      <input type="radio" name="pay-method" checked={checked} onChange={onPick} className="mt-1 size-4 accent-[var(--color-pine)]" />
      <Icon className="mt-0.5 size-5 shrink-0 text-pine" />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-[13px] text-slate">{body}</span>
      </span>
    </label>
  );
}
