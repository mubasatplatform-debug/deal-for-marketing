import { useId, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { AiAuditCard, AiIntegrationsCard } from "@/components/law/ai-integrations";
import { TwoFactorCard } from "@/components/law/two-factor";
import { BookingSettingsCard } from "@/components/law/booking-settings";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { CITIES, TEAM_SIZE_OPTIONS, toLatinDigits } from "@/components/law/office-options";
import { dateAr } from "@/components/law/format";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { ROLE_LABELS } from "@/lib/saas/lifecycle";
import { updateWorkspace, type TeamSize } from "@/lib/saas/workspace";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  const { active, reload } = useLawApp();
  const ws = active.workspace;
  const uid = useId();
  const canEdit = (active.role === "owner" || active.role === "admin") && !active.lifecycle.readOnly;
  const [name, setName] = useState(ws.name);
  const [city, setCity] = useState(ws.city);
  const [cr, setCr] = useState(ws.cr_number ?? "");
  const [size, setSize] = useState<string>(ws.team_size ?? "");
  const [errors, setErrors] = useState<Partial<Record<"name" | "city" | "cr", string>>>({});
  const [busy, setBusy] = useState(false);

  const dirty = name !== ws.name || city !== ws.city || cr !== (ws.cr_number ?? "") || size !== (ws.team_size ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !canEdit) return;
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "اكتب اسم المكتب (حرفان على الأقل).";
    if (city.trim().length < 2) next.city = "اختر المدينة.";
    if (cr && !/^[0-9]{10}$/.test(cr)) next.cr = "رقم السجل التجاري ١٠ أرقام.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await updateWorkspace({
        data: {
          workspaceId: ws.id,
          name: name.trim(),
          city: city.trim(),
          crNumber: cr || null,
          teamSize: (size || null) as TeamSize | null,
        },
      });
      toast.success("حُفظت بيانات المكتب");
      await reload();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="الإعدادات"
        subtitle={canEdit ? "بيانات المكتب كما تظهر لفريقك وفي طلبات الدفع" : "يعدّلها مالك المكتب أو المدير"}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="بيانات المكتب" />
          <form onSubmit={save} noValidate className="grid gap-5 px-5 pt-5 pb-6 md:grid-cols-2 md:px-6">
            <div className="md:col-span-2">
              <Field id={`${uid}-name`} label="اسم المكتب" error={errors.name}>
                <TextInput
                  id={`${uid}-name`}
                  value={name}
                  maxLength={120}
                  disabled={!canEdit}
                  onChange={(e) => setName(e.target.value)}
                  invalid={Boolean(errors.name)}
                />
              </Field>
            </div>
            <Field id={`${uid}-city`} label="المدينة" error={errors.city}>
              <SelectInput id={`${uid}-city`} value={city} disabled={!canEdit} onChange={(e) => setCity(e.target.value)}>
                {!CITIES.includes(city as (typeof CITIES)[number]) && city ? <option value={city}>{city}</option> : null}
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id={`${uid}-size`} label="حجم الفريق" optional>
              <SelectInput id={`${uid}-size`} value={size} disabled={!canEdit} onChange={(e) => setSize(e.target.value)}>
                <option value="">—</option>
                {TEAM_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="md:col-span-2">
              <Field
                id={`${uid}-cr`}
                label="رقم السجل التجاري"
                optional
                error={errors.cr}
                hint="١٠ أرقام. يظهر في طلبات الدفع."
              >
                <TextInput
                  id={`${uid}-cr`}
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={10}
                  value={cr}
                  disabled={!canEdit}
                  onChange={(e) => setCr(toLatinDigits(e.target.value).replace(/\D/g, ""))}
                  placeholder="1010xxxxxx"
                  invalid={Boolean(errors.cr)}
                  className="text-left font-ui md:max-w-xs"
                />
              </Field>
            </div>
            {canEdit ? (
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" variant="primary" disabled={busy || !dirty} icon={busy ? Loader2 : Save}>
                  {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
                </Button>
                {dirty ? <span className="text-[13px] text-slate">لديك تغييرات غير محفوظة</span> : null}
              </div>
            ) : null}
          </form>
        </Card>

        <div className="space-y-4">
          <TwoFactorCard />
          <Card className="p-5 md:p-6">
            <p className="text-[15px] font-bold">عن هذا المكتب</p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row k="صلاحيتك" v={ROLE_LABELS[active.role]} />
              <Row k="أُنشئ في" v={dateAr(ws.created_at)} />
              <Row k="المعرّف" v={<code className="font-ui text-xs">{ws.slug}</code>} />
            </dl>
          </Card>
          <Card className="p-5 md:p-6">
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <ShieldCheck className="size-[18px] text-pine" aria-hidden="true" />
              بياناتك وبيانات عملائك
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate">
              مكتبك هو المسؤول عن بيانات عملائه، وديل تعالجها نيابة عنه لتشغيل الخدمة فقط. بيانات كل مكتب معزولة
              عن غيره، ولا تُحذف تلقائيًا عند انتهاء الاشتراك.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 text-[13px] font-semibold">
              <a href="/law/terms" className="inline-flex min-h-10 items-center text-pine hover:underline">
                شروط الاستخدام
              </a>
              <a href="/privacy#law" className="inline-flex min-h-10 items-center text-pine hover:underline">
                الخصوصية ومعالجة البيانات
              </a>
            </p>
          </Card>
        </div>
      </div>
      <BookingSettingsCard />
      <div className="mt-6 grid gap-6">
        <AiIntegrationsCard />
        <AiAuditCard />
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
