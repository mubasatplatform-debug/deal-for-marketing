import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarX2,
  Check,
  Clock,
  Copy,
  Loader2,
  Phone,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useCopy } from "@/components/keys/use-copy";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { dayAr, durationAr, timeAr } from "@/components/law/format";
import { TextArea } from "@/components/law/kit";
import { toLatinDigits } from "@/components/law/office-options";
import { PublicShell } from "@/components/law/public-shell";
import { MODE_LABELS, WEEKDAY_LABELS, type ConsultMode } from "@/lib/law/options";
import {
  createBooking,
  getBookingOffice,
  getBookingSlots,
  type BookingOffice,
  type BookingResult,
} from "@/lib/law/public";
import { normalizePhone } from "@/lib/phone";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/o/$slug/book")({
  loader: async ({ params }) => ({ office: await getBookingOffice({ data: { slug: params.slug } }) }),
  head: ({ loaderData }) =>
    pageHead({
      title: loaderData?.office ? `احجز استشارة — ${loaderData.office.name}` : "حجز استشارة",
      description: loaderData?.office
        ? `احجز استشارتك القانونية مع ${loaderData.office.name} بالفيديو أو الهاتف أو حضوريًا، من الأوقات المتاحة.`
        : undefined,
      noindex: true,
    }),
  component: BookPage,
});

const MODE_ICON = { video: Video, in_office: Users, phone: Phone } as const;
const MODE_HINT: Record<ConsultMode, string> = {
  video: "من جوالك أو حاسبك، دون تطبيق",
  in_office: "في مقر المكتب",
  phone: "يتصل بك المحامي",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Day = { date: string; weekday: number; slots: { start: string; time: string }[] };

function BookPage() {
  const { office } = Route.useLoaderData();
  if (!office) {
    return (
      <PublicShell office={null} eyebrow="حجز استشارة">
        <Notice icon={CalendarX2} title="الصفحة غير موجودة" body="تحقق من الرابط الذي وصلك من المكتب." />
      </PublicShell>
    );
  }
  if (!office.open) {
    return (
      <PublicShell office={office.name} city={office.city} eyebrow="حجز استشارة">
        <Notice
          icon={CalendarX2}
          title="الحجز الإلكتروني غير متاح حاليًا"
          body="تواصل مع المكتب مباشرة لتحديد موعد استشارتك."
        />
      </PublicShell>
    );
  }
  return (
    <PublicShell office={office.name} city={office.city} eyebrow="احجز استشارة">
      <Booking office={office} />
      <Toaster position="top-center" dir="rtl" richColors />
    </PublicShell>
  );
}

function Notice({ icon: Icon, title, body }: { icon: typeof Video; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-surface px-6 py-12 text-center ring-1 ring-line">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate">{body}</p>
    </div>
  );
}

function Booking({ office }: { office: BookingOffice }) {
  const uid = useId();
  const [mode, setMode] = useState<ConsultMode>(office.modes[0]);
  const [lawyerId, setLawyerId] = useState("");
  const [days, setDays] = useState<Day[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ start: string; time: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "email" | "topic", string>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BookingResult | null>(null);
  const opened = useRef(Date.now());
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setDays(null);
    setSlotsError(false);
    setSlot(null);
    getBookingSlots({ data: { slug: office.slug, mode, lawyerId: lawyerId || null, days: Math.min(31, office.horizonDays) } })
      .then((r) => {
        if (!alive) return;
        setDays(r.days);
        const first = r.days.find((d) => d.slots.length);
        setDate((cur) => (cur && r.days.some((d) => d.date === cur && d.slots.length) ? cur : (first?.date ?? null)));
      })
      .catch(() => alive && setSlotsError(true));
    return () => {
      alive = false;
    };
  }, [office.slug, office.horizonDays, mode, lawyerId]);

  const day = useMemo(() => days?.find((d) => d.date === date) ?? null, [days, date]);
  const anySlots = days?.some((d) => d.slots.length) ?? false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !slot) return;
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "اكتب اسمك.";
    if (!normalizePhone(phone)) next.phone = "رقم الجوال غير صحيح. مثال: 0501234567";
    if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = "البريد الإلكتروني غير صحيح.";
    if (topic.trim().length < 5) next.topic = "صف موضوع استشارتك باختصار.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const r = await createBooking({
        data: {
          slug: office.slug,
          mode,
          lawyerId: lawyerId || null,
          start: slot.start,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          topic: topic.trim(),
          website,
          fillMs: Date.now() - opened.current,
        },
      });
      setDone(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(/[؀-ۿ]/.test(msg) ? msg : "تعذّر إرسال الحجز. حاول مرة أخرى.");
      if (msg.includes("لم يعد هذا الموعد متاحًا")) {
        setSlot(null);
        setLawyerId((v) => v);
        setDays(null);
        getBookingSlots({ data: { slug: office.slug, mode, lawyerId: lawyerId || null, days: Math.min(31, office.horizonDays) } })
          .then((r) => setDays(r.days))
          .catch(() => setSlotsError(true));
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Done result={done} />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <section aria-labelledby={`${uid}-s1`} className="rounded-2xl bg-surface p-5 ring-1 ring-line md:p-6">
          <StepTitle n={1} id={`${uid}-s1`}>
            نوع الاستشارة
          </StepTitle>
          <div role="radiogroup" aria-labelledby={`${uid}-s1`} className="mt-4 grid gap-2 sm:grid-cols-3">
            {office.modes.map((m) => {
              const Icon = MODE_ICON[m];
              const on = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3.5 text-start transition-colors sm:flex-col sm:items-start",
                    on ? "border-pine bg-pine-50 ring-2 ring-pine/15" : "border-line-strong hover:bg-paper",
                  )}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-pine text-lime" : "bg-paper text-pine")}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{MODE_LABELS[m]}</span>
                    <span className="block text-xs text-slate">{MODE_HINT[m]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {office.lawyers.length > 1 ? (
            <div className="mt-4 max-w-xs">
              <Field id={`${uid}-lawyer`} label="المحامي">
                <SelectInput id={`${uid}-lawyer`} value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
                  <option value="">أي محامٍ متاح</option>
                  {office.lawyers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          ) : null}
        </section>

        <section aria-labelledby={`${uid}-s2`} className="rounded-2xl bg-surface p-5 ring-1 ring-line md:p-6">
          <StepTitle n={2} id={`${uid}-s2`}>
            اختر اليوم والوقت
          </StepTitle>
          <p className="mt-1 text-[13px] text-slate">
            الأوقات بتوقيت الرياض · مدة الاستشارة {durationAr(office.slotMinutes)}
          </p>
          {slotsError ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">تعذّر تحميل الأوقات. أعد تحميل الصفحة.</p>
          ) : !days ? (
            <div className="mt-4 flex gap-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="h-16 w-16 animate-pulse rounded-xl bg-pine-50" />
              ))}
            </div>
          ) : !anySlots ? (
            <p className="mt-4 rounded-xl bg-paper px-4 py-4 text-sm text-slate ring-1 ring-line">
              لا أوقات متاحة حاليًا{lawyerId ? " لهذا المحامي. جرّب «أي محامٍ متاح»" : ""}. تواصل مع المكتب مباشرة.
            </p>
          ) : (
            <>
              <div role="tablist" aria-label="الأيام" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
                {days.map((d) => {
                  const on = d.date === date;
                  const empty = d.slots.length === 0;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      disabled={empty}
                      onClick={() => {
                        setDate(d.date);
                        setSlot(null);
                      }}
                      className={cn(
                        "flex w-[64px] shrink-0 flex-col items-center rounded-xl border py-2 transition-colors disabled:opacity-40",
                        on ? "border-pine bg-pine text-snow" : "border-line-strong bg-surface enabled:hover:bg-paper",
                      )}
                    >
                      <span className={cn("text-[11px]", on ? "text-snow/70" : "text-slate")}>{WEEKDAY_LABELS[d.weekday].replace("ال", "")}</span>
                      <span className="font-ui text-lg leading-tight font-bold tabular-nums">{Number(d.date.slice(8))}</span>
                      <span className={cn("text-[10.5px]", on ? "text-snow/70" : "text-slate")}>
                        {new Date(`${d.date}T12:00:00+03:00`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short" })}
                      </span>
                    </button>
                  );
                })}
              </div>
              {day ? (
                <div className="mt-3">
                  <p className="mb-2 text-[13px] font-semibold">{dayAr(day.date)}</p>
                  <div role="radiogroup" aria-label="الأوقات المتاحة" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {day.slots.map((s) => {
                      const on = slot?.start === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => {
                            setSlot(s);
                            setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                          }}
                          className={cn(
                            "h-11 rounded-xl border font-ui text-sm font-semibold tabular-nums transition-colors",
                            on ? "border-lime-600 bg-lime text-pine-deep" : "border-line-strong hover:border-pine hover:bg-pine-50",
                          )}
                        >
                          {timeAr(s.start)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section
          ref={detailsRef}
          aria-labelledby={`${uid}-s3`}
          className={cn("scroll-mt-4 rounded-2xl bg-surface p-5 ring-1 ring-line transition-opacity md:p-6", !slot && "opacity-60")}
        >
          <StepTitle n={3} id={`${uid}-s3`}>
            بياناتك
          </StepTitle>
          <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id={`${uid}-name`} label="الاسم" error={errors.name}>
                <TextInput id={`${uid}-name`} autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} invalid={Boolean(errors.name)} />
              </Field>
            </div>
            <Field id={`${uid}-phone`} label="الجوال" error={errors.phone}>
              <TextInput
                id={`${uid}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(toLatinDigits(e.target.value))}
                invalid={Boolean(errors.phone)}
                className="text-left font-ui"
              />
            </Field>
            <Field
              id={`${uid}-email`}
              label="البريد الإلكتروني"
              optional
              error={errors.email}
              hint={mode === "video" ? "يصلك عليه رابط المكالمة بعد التأكيد" : "لتصلك رسالة التأكيد"}
            >
              <TextInput
                id={`${uid}-email`}
                type="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={Boolean(errors.email)}
                className="text-left font-ui"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id={`${uid}-topic`} label="موضوع الاستشارة" error={errors.topic} hint="لا تكتب تفاصيل حساسة هنا؛ ستناقشها مع المحامي.">
                <TextArea
                  id={`${uid}-topic`}
                  rows={3}
                  maxLength={500}
                  value={topic}
                  placeholder="مثال: خلاف مع صاحب العمل على مستحقات نهاية الخدمة"
                  onChange={(e) => setTopic(e.target.value)}
                  invalid={Boolean(errors.topic)}
                />
              </Field>
            </div>
            {/* Honeypot: hidden from people and screen readers; bots fill it. */}
            <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
              <label htmlFor={`${uid}-website`}>Website</label>
              <input id={`${uid}-website`} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy || !slot}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-pine-deep transition-colors hover:bg-[#b3bf28] disabled:cursor-not-allowed disabled:bg-pine-50 disabled:text-slate"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CalendarCheck2 className="size-4" aria-hidden="true" />}
                {busy ? "جارٍ الإرسال…" : slot ? `احجز ${dayAr(slot.start)} الساعة ${timeAr(slot.start)}` : "اختر وقتًا أولًا"}
              </button>
              <p className="mt-2 text-center text-xs text-slate">
                بإرسال الطلب توافق على مشاركة بياناتك مع {office.name} لتنظيم الاستشارة.
              </p>
            </div>
          </form>
        </section>
      </div>

      <aside className="lg:col-span-2">
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl bg-pine-deep p-5 text-snow md:p-6">
            <p className="text-[12px] font-semibold text-snow/60">ملخص الحجز</p>
            <dl className="mt-3 space-y-3 text-sm">
              <SummaryRow k="المكتب" v={office.name} />
              <SummaryRow k="النوع" v={MODE_LABELS[mode]} />
              <SummaryRow k="المحامي" v={office.lawyers.find((l) => l.id === lawyerId)?.name ?? "أي محامٍ متاح"} />
              <SummaryRow k="الموعد" v={slot ? `${dayAr(slot.start)} · ${timeAr(slot.start)}` : "—"} />
              <SummaryRow k="المدة" v={durationAr(office.slotMinutes)} />
            </dl>
          </div>
          {office.note ? <p className="rounded-2xl bg-surface p-5 text-[13px] leading-relaxed text-slate ring-1 ring-line">{office.note}</p> : null}
          <ul className="space-y-2.5 rounded-2xl bg-surface p-5 text-[13px] text-slate ring-1 ring-line">
            <li className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0 text-pine" aria-hidden="true" />
              يراجع المكتب طلبك ويؤكده، ثم يصلك الرابط.
            </li>
            <li className="flex gap-2">
              <Clock className="size-4 shrink-0 text-pine" aria-hidden="true" />
              {mode === "video" ? "مكالمة الفيديو من المتصفح مباشرة، دون تثبيت تطبيق." : "ستجد تفاصيل موعدك في صفحة خاصة بك."}
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function StepTitle({ n, id, children }: { n: number; id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-[16px] font-extrabold">
      <span className="grid size-7 place-items-center rounded-full bg-pine font-ui text-[13px] text-lime">{n}</span>
      {children}
    </h2>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-snow/60">{k}</dt>
      <dd className="text-end font-semibold">{v}</dd>
    </div>
  );
}

function Done({ result }: { result: BookingResult }) {
  const { copied, copy } = useCopy();
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-surface p-6 text-center ring-1 ring-line md:p-8">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-lime text-pine-deep">
        <Check className="size-7" strokeWidth={3} aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold">وصل طلبك</h1>
      <p className="mt-2 leading-relaxed text-slate">
        طلبت {MODE_LABELS[result.mode]} {dayAr(result.startsAt)} الساعة {timeAr(result.startsAt)}
        {result.lawyer ? ` مع ${result.lawyer}` : ""}. سيراجع المكتب الطلب ويؤكده
        {result.emailed ? "، وتصلك رسالة على بريدك." : "."}
      </p>
      {result.meetUrl ? (
        <div className="mt-6 rounded-xl bg-paper p-4 text-start ring-1 ring-line">
          <p className="text-sm font-bold">صفحة استشارتك</p>
          <p className="mt-1 text-[13px] text-slate">احفظ هذا الرابط: فيه حالة الطلب، ومنه تدخل المكالمة في موعدها.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a href={result.meetUrl} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-semibold text-snow hover:bg-pine-deep">
              فتح صفحة الاستشارة
              <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => void copy(result.meetUrl!)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-paper"
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "نُسخ" : "نسخ الرابط"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
