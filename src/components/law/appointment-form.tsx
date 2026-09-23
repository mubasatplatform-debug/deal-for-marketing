import { useId, useState, type FormEvent } from "react";
import { Loader2, Phone, Save, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { hmOf, ymdFromNow, ymdOf } from "@/components/law/format";
import { ClientPicker, lawyersOf, useMembers, type PickedClient } from "@/components/law/kit";
import { toLatinDigits } from "@/components/law/office-options";
import { MODE_LABELS, type AppointmentKind, type ConsultMode } from "@/lib/law/options";
import { createAppointment, updateAppointment, type AppointmentView } from "@/lib/law/schedule";
import { normalizePhone } from "@/lib/phone";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { planHas } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const MODE_ICON = { video: Video, in_office: Users, phone: Phone } as const;

/**
 * New / edit appointment or consultation. A consultation needs a client (or
 * a lead's name and phone), a topic and — for video — a plan that includes
 * video consultations.
 */
export function AppointmentFormDialog({
  kind: initialKind = "consultation",
  appointment,
  presetClient,
  presetCaseId,
  presetDate,
  presetTime,
  onClose,
  onSaved,
}: {
  kind?: AppointmentKind;
  appointment?: AppointmentView | null;
  presetClient?: PickedClient | null;
  presetCaseId?: string | null;
  presetDate?: string;
  presetTime?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { active, ctx } = useLawApp();
  const uid = useId();
  const lawyers = lawyersOf(useMembers());
  const videoOk = planHas(active.workspace.plan, "videoSessions");
  const a = appointment;
  const [kind, setKind] = useState<AppointmentKind>(a?.kind ?? initialKind);
  const [mode, setMode] = useState<ConsultMode>(a?.mode ?? (videoOk ? "video" : "in_office"));
  const [client, setClient] = useState<PickedClient | null>(
    a?.client_id ? { id: a.client_id, name: a.client_name ?? "" } : (presetClient ?? null),
  );
  const [asLead, setAsLead] = useState(Boolean(a && !a.client_id && a.lead_name));
  const [leadName, setLeadName] = useState(a?.lead_name ?? "");
  const [leadPhone, setLeadPhone] = useState(a?.lead_phone?.replace(/^\+966/, "0") ?? "");
  const [leadEmail, setLeadEmail] = useState(a?.lead_email ?? "");
  const [title, setTitle] = useState(a?.title ?? "");
  const [lawyerId, setLawyerId] = useState<string>(
    a ? (a.lawyer_id ?? "") : active.role !== "staff" ? ctx.user.id : "",
  );
  const [date, setDate] = useState(a ? ymdOf(a.starts_at) : (presetDate ?? ymdFromNow(1)));
  const [time, setTime] = useState(a ? hmOf(a.starts_at) : (presetTime ?? "10:00"));
  const [duration, setDuration] = useState(
    a ? Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60_000) : 30,
  );
  const [location, setLocation] = useState(a?.location ?? "");
  const [status, setStatus] = useState<"confirmed" | "pending">("confirmed");
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<"client" | "lead" | "phone" | "title" | "when", string>>>({});
  const [busy, setBusy] = useState(false);
  const consult = kind === "consultation";

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (consult && !asLead && !client) next.client = "اختر العميل، أو أدخل بيانات عميل جديد.";
    if (consult && asLead && leadName.trim().length < 2) next.lead = "اكتب اسم العميل.";
    if (asLead && leadPhone.trim() && !normalizePhone(leadPhone)) next.phone = "رقم الجوال غير صحيح.";
    if (consult && title.trim().length < 2) next.title = "اكتب موضوع الاستشارة.";
    if (!date || !time) next.when = "اختر التاريخ والوقت.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const fields = {
      workspaceId: active.workspace.id,
      kind,
      mode: consult ? mode : "in_office",
      title: title.trim(),
      clientId: asLead ? null : (client?.id ?? null),
      caseId: a ? a.case_id : (presetCaseId ?? null),
      leadName: asLead ? leadName.trim() : null,
      leadPhone: asLead ? leadPhone.trim() || null : null,
      leadEmail: asLead ? leadEmail.trim() || null : null,
      lawyerId: lawyerId || null,
      date,
      time,
      durationMinutes: duration,
      location: location.trim(),
      status,
    };
    try {
      if (a) {
        const r = await updateAppointment({ data: { ...fields, id: a.id } });
        toast.success("حُفظ الموعد");
        if (r.conflicts) toast.warning("تنبيه: لدى المحامي موعد أو جلسة أخرى في الوقت نفسه.");
        onSaved(a.id);
      } else {
        const r = await createAppointment({ data: { ...fields, notify } });
        toast.success(consult ? "أُضيفت الاستشارة" : "أُضيف الموعد");
        if (r.conflicts) toast.warning("تنبيه: لدى المحامي موعد أو جلسة أخرى في الوقت نفسه.");
        onSaved(r.id);
      }
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={a ? (consult ? "تعديل الاستشارة" : "تعديل الموعد") : consult ? "استشارة جديدة" : "موعد جديد"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Save} disabled={busy}>
            {busy ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        {!a ? (
          <div role="radiogroup" aria-label="النوع" className="grid grid-cols-2 gap-2 sm:col-span-2">
            {(
              [
                ["consultation", "استشارة"],
                ["appointment", "موعد آخر"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={kind === v}
                onClick={() => setKind(v)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold transition-colors",
                  kind === v ? "border-pine bg-pine-50 text-pine-deep ring-2 ring-pine/15" : "border-line-strong text-slate hover:bg-paper",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {consult ? (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-semibold text-pine-deep">طريقة الاستشارة</p>
            <div role="radiogroup" aria-label="طريقة الاستشارة" className="grid grid-cols-3 gap-2">
              {(["video", "in_office", "phone"] as const).map((m) => {
                const Icon = MODE_ICON[m];
                const disabled = m === "video" && !videoOk;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    disabled={disabled}
                    title={disabled ? "الاستشارات المرئية ضمن الخطة الاحترافية فأعلى" : undefined}
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      mode === m ? "border-pine bg-pine-50 text-pine-deep ring-2 ring-pine/15" : "border-line-strong text-slate hover:bg-paper",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {MODE_LABELS[m]}
                  </button>
                );
              })}
            </div>
            {!videoOk ? (
              <p className="mt-1.5 text-[12.5px] text-slate">الاستشارات المرئية متاحة في الخطة الاحترافية فأعلى.</p>
            ) : null}
          </div>
        ) : null}

        <div className="sm:col-span-2">
          {!asLead ? (
            <Field id={`${uid}-client`} label="العميل" optional={!consult} error={errors.client}>
              <ClientPicker id={`${uid}-client`} value={client} onChange={setClient} invalid={Boolean(errors.client)} />
            </Field>
          ) : (
            <div className="grid gap-4 rounded-xl bg-paper p-4 ring-1 ring-line sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id={`${uid}-lead`} label="اسم العميل" error={errors.lead}>
                  <TextInput id={`${uid}-lead`} value={leadName} maxLength={120} onChange={(e) => setLeadName(e.target.value)} invalid={Boolean(errors.lead)} />
                </Field>
              </div>
              <Field id={`${uid}-lphone`} label="الجوال" optional error={errors.phone}>
                <TextInput
                  id={`${uid}-lphone`}
                  type="tel"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(toLatinDigits(e.target.value))}
                  invalid={Boolean(errors.phone)}
                  className="text-left font-ui"
                />
              </Field>
              <Field id={`${uid}-lmail`} label="البريد" optional hint="يصله رابط الاستشارة">
                <TextInput
                  id={`${uid}-lmail`}
                  type="email"
                  dir="ltr"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="text-left font-ui"
                />
              </Field>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAsLead((v) => !v)}
            className="mt-1.5 inline-flex min-h-9 items-center text-[13px] font-semibold text-pine hover:underline"
          >
            {asLead ? "اختيار عميل مسجّل" : "عميل غير مسجّل؟ أدخل بياناته"}
          </button>
        </div>

        <div className="sm:col-span-2">
          <Field id={`${uid}-title`} label={consult ? "موضوع الاستشارة" : "العنوان"} optional={!consult} error={errors.title}>
            <TextInput
              id={`${uid}-title`}
              value={title}
              maxLength={200}
              placeholder={consult ? "مثال: مراجعة عقد إيجار تجاري" : "مثال: اجتماع مع الموكل"}
              onChange={(e) => setTitle(e.target.value)}
              invalid={Boolean(errors.title)}
            />
          </Field>
        </div>

        <Field id={`${uid}-date`} label="التاريخ" error={errors.when}>
          <TextInput id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-ui" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${uid}-time`} label="الوقت">
            <TextInput id={`${uid}-time`} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="font-ui" />
          </Field>
          <Field id={`${uid}-dur`} label="المدة">
            <SelectInput id={`${uid}-dur`} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} د
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field id={`${uid}-lawyer`} label={consult ? "المحامي" : "عضو الفريق"} optional>
          <SelectInput id={`${uid}-lawyer`} value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
            <option value="">— بدون —</option>
            {lawyers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        {!consult || mode === "in_office" ? (
          <Field id={`${uid}-loc`} label="المكان" optional>
            <TextInput id={`${uid}-loc`} value={location} maxLength={200} placeholder="مقر المكتب" onChange={(e) => setLocation(e.target.value)} />
          </Field>
        ) : (
          <div />
        )}

        {!a && consult ? (
          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={status === "pending"}
                onChange={(e) => setStatus(e.target.checked ? "pending" : "confirmed")}
                className="size-4 accent-[var(--color-pine)]"
              />
              بانتظار التأكيد (لم يتفق على الموعد نهائيًا)
            </label>
            {status === "confirmed" ? (
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-[var(--color-pine)]" />
                أرسل للعميل رسالة التأكيد ورابط الاستشارة (إن كان له بريد)
              </label>
            ) : null}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
