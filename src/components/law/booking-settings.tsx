import { useEffect, useId, useState, type FormEvent } from "react";
import { ExternalLink, Globe, Loader2, Phone, Save, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Pill } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { TextArea, useLoad } from "@/components/law/kit";
import { ShareLink } from "@/components/law/share-link";
import { MODE_LABELS, SLOT_LENGTHS, WEEKDAY_LABELS, type ConsultMode } from "@/lib/law/options";
import { getBookingSettings, saveBookingSettings, setOfficeSlug } from "@/lib/law/schedule";
import type { BookingSettings } from "@/lib/law/schedule-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

const MODE_ICON = { video: Video, in_office: Users, phone: Phone } as const;
const NOTICE = [
  [0, "بلا مهلة"],
  [60, "ساعة"],
  [120, "ساعتان"],
  [240, "4 ساعات"],
  [1440, "يوم"],
  [2880, "يومان"],
] as const;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;

/**
 * /app/settings → "الحجز الإلكتروني والتوفر": the office's public booking
 * page (on/off, modes, link), working days and hours, slot length, buffer,
 * notice and horizon. Owner/admin edit; everyone else reads.
 */
export function BookingSettingsCard() {
  const { active } = useLawApp();
  const res = useLoad(() => getBookingSettings({ data: { workspaceId: active.workspace.id } }), [active.workspace.id]);
  const v = res.data;
  return (
    <section id="booking" className="scroll-mt-20">
      <h2 className="mt-10 mb-4 text-[15px] font-bold">الحجز الإلكتروني والتوفر</h2>
      {!v ? (
        <Card className="h-48 animate-pulse bg-pine-50/40">
          <span className="sr-only">جارٍ التحميل…</span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <SettingsForm view={v} onSaved={() => void res.reload()} />
          <SlugCard slug={v.slug} url={v.bookingUrl} enabled={v.settings.bookingEnabled} canEdit={v.canEdit} onSaved={() => void res.reload()} />
        </div>
      )}
    </section>
  );
}

function SettingsForm({
  view,
  onSaved,
}: {
  view: { settings: BookingSettings; planVideo: boolean; canEdit: boolean; provider: "livekit" | "jitsi" };
  onSaved: () => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const [s, setS] = useState<BookingSettings>(view.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setS(view.settings), [view.settings]);
  const dis = !view.canEdit;
  const dirty = JSON.stringify(s) !== JSON.stringify(view.settings);
  const set = <K extends keyof BookingSettings>(k: K, val: BookingSettings[K]) => setS((cur) => ({ ...cur, [k]: val }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || dis) return;
    if (s.dayEnd <= s.dayStart) {
      setError("وقت نهاية الدوام يجب أن يكون بعد بدايته.");
      return;
    }
    if (s.workDays.length === 0 || s.bookingModes.length === 0) {
      setError("اختر يوم عمل واحدًا ونوع استشارة واحدًا على الأقل.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveBookingSettings({ data: { workspaceId: active.workspace.id, ...s } });
      toast.success("حُفظت إعدادات الحجز");
      onSaved();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="المواعيد المتاحة للحجز"
        description="تُحسب الأوقات المعروضة للعملاء من هذه الإعدادات مطروحًا منها مواعيد المحامين وجلساتهم."
        actions={view.settings.bookingEnabled ? <Pill tone="lime">الحجز مفعّل</Pill> : <Pill tone="neutral">الحجز متوقف</Pill>}
      />
      <form onSubmit={save} noValidate className="space-y-6 px-5 pt-5 pb-6 md:px-6">
        <label className="flex items-start gap-3 rounded-xl bg-paper p-4 ring-1 ring-line">
          <input
            type="checkbox"
            disabled={dis}
            checked={s.bookingEnabled}
            onChange={(e) => set("bookingEnabled", e.target.checked)}
            className="mt-1 size-4 accent-[var(--color-pine)]"
          />
          <span>
            <span className="block text-sm font-bold">تفعيل صفحة الحجز الإلكتروني</span>
            <span className="mt-0.5 block text-[13px] text-slate">
              يحجز العملاء بأنفسهم، وتصلك الطلبات «بانتظار التأكيد» في الاستشارات.
            </span>
          </span>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">أنواع الاستشارة المتاحة للحجز</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["video", "in_office", "phone"] as ConsultMode[]).map((m) => {
              const Icon = MODE_ICON[m];
              const on = s.bookingModes.includes(m);
              const locked = m === "video" && !view.planVideo;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  disabled={dis || locked}
                  onClick={() => set("bookingModes", on ? s.bookingModes.filter((x) => x !== m) : [...s.bookingModes, m])}
                  className={cn(
                    "flex h-12 items-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "border-pine bg-pine-50 text-pine-deep" : "border-line-strong text-slate hover:bg-paper",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12.5px] text-slate">
            {!view.planVideo
              ? "الاستشارات المرئية متاحة في الخطة الاحترافية فأعلى."
              : view.provider === "livekit"
                ? "مكالمات الفيديو داخل المتصفح بغرفة انتظار."
                : "مكالمات الفيديو عبر Jitsi Meet في نافذة جديدة، ويمكنك وضع رابط Zoom أو Meet لأي استشارة."}
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">أيام العمل</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((d, i) => {
              const on = s.workDays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  disabled={dis}
                  onClick={() => set("workDays", on ? s.workDays.filter((x) => x !== i) : [...s.workDays, i].sort())}
                  className={cn(
                    "h-10 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed",
                    on ? "border-pine bg-pine text-snow" : "border-line-strong text-slate hover:bg-paper",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id={`${uid}-start`} label="بداية الدوام">
            <TextInput id={`${uid}-start`} type="time" step={900} disabled={dis} value={s.dayStart} onChange={(e) => set("dayStart", e.target.value)} className="font-ui" />
          </Field>
          <Field id={`${uid}-end`} label="نهاية الدوام">
            <TextInput id={`${uid}-end`} type="time" step={900} disabled={dis} value={s.dayEnd} onChange={(e) => set("dayEnd", e.target.value)} className="font-ui" />
          </Field>
          <Field id={`${uid}-slot`} label="مدة الاستشارة">
            <SelectInput id={`${uid}-slot`} disabled={dis} value={s.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))}>
              {SLOT_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} دقيقة
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id={`${uid}-buffer`} label="فاصل بين المواعيد">
            <SelectInput id={`${uid}-buffer`} disabled={dis} value={s.bufferMinutes} onChange={(e) => set("bufferMinutes", Number(e.target.value))}>
              {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "بلا فاصل" : `${m} دقيقة`}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id={`${uid}-notice`} label="أقل مهلة للحجز">
            <SelectInput id={`${uid}-notice`} disabled={dis} value={s.minNoticeMinutes} onChange={(e) => set("minNoticeMinutes", Number(e.target.value))}>
              {NOTICE.map(([m, l]) => (
                <option key={m} value={m}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id={`${uid}-horizon`} label="الحجز حتى">
            <SelectInput id={`${uid}-horizon`} disabled={dis} value={s.horizonDays} onChange={(e) => set("horizonDays", Number(e.target.value))}>
              {[7, 14, 21, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} يومًا قادمًا
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field id={`${uid}-note`} label="ملاحظة تظهر في صفحة الحجز" optional>
          <TextArea
            id={`${uid}-note`}
            rows={2}
            maxLength={500}
            disabled={dis}
            value={s.bookingNote}
            placeholder="مثال: الاستشارة الأولى 30 دقيقة، وتُحدد الأتعاب بعد دراسة الملف."
            onChange={(e) => set("bookingNote", e.target.value)}
          />
        </Field>

        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
        {view.canEdit ? (
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" icon={busy ? Loader2 : Save} disabled={busy || !dirty}>
              {busy ? "جارٍ الحفظ…" : "حفظ إعدادات الحجز"}
            </Button>
            {dirty ? <span className="text-[13px] text-slate">لديك تغييرات غير محفوظة</span> : null}
          </div>
        ) : (
          <p className="text-[13px] text-slate">يعدّل هذه الإعدادات مالك المكتب أو المدير.</p>
        )}
      </form>
    </Card>
  );
}

function SlugCard({
  slug,
  url,
  enabled,
  canEdit,
  onSaved,
}: {
  slug: string;
  url: string;
  enabled: boolean;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { active, reload } = useLawApp();
  const uid = useId();
  const [value, setValue] = useState(slug);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(slug), [slug]);
  const clean = value.trim().toLowerCase();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || clean === slug) return;
    if (!SLUG_RE.test(clean) || clean.endsWith("-") || clean.includes("--")) {
      setError("٣ إلى ٦٣ حرفًا: أحرف إنجليزية صغيرة وأرقام وشرطات.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setOfficeSlug({ data: { workspaceId: active.workspace.id, slug: clean } });
      toast.success("تغيّر رابط صفحة الحجز");
      onSaved();
      await reload();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <Globe className="size-[18px] text-pine" aria-hidden="true" />
        رابط صفحة الحجز
      </p>
      <p className="mt-1 text-[13px] text-slate">شاركه في موقعك وحساباتك وتوقيع بريدك.</p>
      <ShareLink className="mt-4" url={url} label="رابط صفحة الحجز" message={`احجز استشارتك مع ${active.workspace.name}:`} />
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-pine hover:underline"
      >
        معاينة الصفحة
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
      {!enabled ? <p className="mt-1 text-[12.5px] text-slate">الصفحة تعرض «الحجز غير متاح» حتى تفعّله.</p> : null}
      {canEdit ? (
        <form onSubmit={save} noValidate className="mt-4 border-t border-line pt-4">
          <Field id={`${uid}-slug`} label="المعرّف في الرابط" error={error ?? undefined} hint="تغييره يوقف الرابط القديم.">
            <div className="flex gap-2">
              <TextInput
                id={`${uid}-slug`}
                dir="ltr"
                value={value}
                maxLength={63}
                onChange={(e) => setValue(e.target.value.replace(/[^A-Za-z0-9-]/g, "").toLowerCase())}
                invalid={Boolean(error)}
                className="text-left font-ui"
              />
              <Button type="submit" variant="dark" className="h-12 shrink-0" disabled={busy || clean === slug}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </Field>
        </form>
      ) : null}
    </Card>
  );
}
