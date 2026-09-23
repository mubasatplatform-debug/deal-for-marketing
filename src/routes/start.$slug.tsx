import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, MessageCircle, Phone } from "lucide-react";
import { ServiceTile } from "@/components/client/service-icon";
import { SiteChrome } from "@/components/site-chrome";
import { siteButton, wrap } from "@/components/site-classes";
import { Eyebrow, Frame, Photo } from "@/components/site-ui";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { mobile, phone as dealPhone, serviceBySlug } from "@/lib/content";
import { LINE_DRAFT_KEY } from "@/lib/line";
import { normalizePhone } from "@/lib/phone";
import { createRequest, LEAD_ERRORS } from "@/lib/requests";
import { servicePhotos } from "@/lib/photos";
import { pageHead } from "@/lib/seo";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-[15px] text-pine-deep outline-none transition-[border-color,box-shadow] placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10";
/** Same label as the header/menu entry (site-chrome.tsx). */
const ACCOUNT_LABEL = "حسابي";
const knownErrors: string[] = Object.values(LEAD_ERRORS);

export const Route = createFileRoute("/start/$slug")({
  head: ({ params }) => {
    const service = serviceBySlug(params.slug);
    return service
      ? pageHead({
          title: service.title,
          description: service.body,
          path: `/start/${service.slug}`,
        })
      : pageHead({ noindex: true });
  },
  component: StartService,
});

function StartService() {
  const { slug } = Route.useParams();
  const service = serviceBySlug(slug);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [brief, setBrief] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sentId, setSentId] = useState<number | null>(null);
  const [fromLine, setFromLine] = useState(false);
  const [fieldErr, setFieldErr] = useState<"name" | "phone" | "brief" | "consent" | null>(null);
  /** `performance.now()` at mount: monotonic, so a skewed device clock cannot matter. */
  const mountedAt = useRef(0);
  const doneRef = useRef<HTMLDivElement>(null);

  // Move focus to the confirmation so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (sentId === null) return;
    doneRef.current?.focus();
    doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [sentId]);

  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LINE_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { slug?: string; company?: string; brief?: string };
      if (d.slug !== slug) return;
      if (d.company) setCompany(d.company);
      if (d.brief) setBrief(d.brief);
      setFromLine(true);
    } catch {
      /* ignore */
    }
  }, [slug]);

  if (!service) {
    return (
      <SiteChrome>
        <main className="grid min-h-[70dvh] place-items-center bg-paper px-4 pt-24 pb-16 text-center">
          <div className="max-w-md">
            <Eyebrow className="justify-center">اطلب خدمتك</Eyebrow>
            <h1 className="mt-4 font-display text-3xl text-pine-deep">هذه الخدمة غير موجودة</h1>
            <p className="mt-3 text-slate">ربما تغيّر الرابط. اختر خدمتك من القائمة وسنكمل من هناك.</p>
            <Link to="/start" className={cn(siteButton("primary"), "mt-8")}>
              عرض كل الخدمات
            </Link>
          </div>
        </main>
      </SiteChrome>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!service) return;
    setErr("");
    const form = e.currentTarget as HTMLFormElement;
    const focus = (field: string) => form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
    const fail = (key: "name" | "phone" | "brief" | "consent", message: string, field: string) => {
      setFieldErr(key);
      setErr(message);
      if (key === "consent") form.querySelector<HTMLElement>('[type="checkbox"]')?.focus();
      else focus(field);
    };
    if (name.trim().length < 2) return fail("name", "اكتب اسمك (حرفان على الأقل).", "name");
    if (!normalizePhone(phone)) return fail("phone", `${LEAD_ERRORS.phone} — مثال: 05X XXX XXXX`, "tel");
    if (brief.trim().length < 8) return fail("brief", "صف احتياجك في جملة على الأقل (٨ أحرف فأكثر).", "brief");
    if (!consent) return fail("consent", "نحتاج موافقتك على سياسة الخصوصية لنتواصل معك.", "consent");
    setFieldErr(null);
    setBusy(true);
    try {
      const res = await createRequest({
        data: {
          slug: service.slug,
          name,
          phone,
          company,
          brief,
          consent,
          website,
          fillMs: Math.round(performance.now() - mountedAt.current),
          source: fromLine ? "line" : "form",
        },
      });
      try {
        sessionStorage.removeItem(LINE_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setSentId(res.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setErr(knownErrors.includes(message) ? message : "تعذر إرسال الطلب، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  const photo = servicePhotos[service.slug];

  return (
    <SiteChrome>
      <main className="bg-paper pt-20 pb-20 md:pt-24 md:pb-28">
        <div className={wrap}>
          <Link
            to="/start"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate hover:text-pine-deep"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            كل الخدمات
          </Link>

          <div className="mt-4 grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-3">
                <ServiceTile slug={service.slug} size="lg" />
                <span className="font-ui text-sm font-bold text-slate">{service.n}</span>
              </div>
              <h1 className="mt-5 font-display text-[2.3rem] leading-[1.25] text-pine-deep md:text-[3.2rem]">{service.title}</h1>
              <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate md:text-lg">{service.body}</p>
              {fromLine ? (
                <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-50 px-4 py-3 text-sm font-semibold text-pine-deep ring-1 ring-lime/60">
                  <Check className="size-4 shrink-0 text-lime-600" strokeWidth={3} aria-hidden="true" />
                  عبّأنا الطلب من محادثتك في خط ديل — راجعه وأكمل بياناتك.
                </p>
              ) : null}
            </div>
            {photo ? (
              <Frame className="aspect-[16/10] lg:col-span-5 lg:aspect-[4/3]">
                <Photo
                  name={photo.name}
                  alt={photo.alt}
                  position={photo.position}
                  sizes="(min-width: 1240px) 480px, (min-width: 1024px) 40vw, 92vw"
                  priority
                />
              </Frame>
            ) : null}
          </div>

          <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
            {sentId !== null ? (
              <div
                role="status"
                tabIndex={-1}
                ref={doneRef}
                className="rounded-3xl bg-surface px-5 py-8 ring-1 ring-line outline-none md:px-10 md:py-10"
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-lime text-pine-deep" aria-hidden="true">
                  <Check className="size-7" strokeWidth={2.6} />
                </span>
                <p className="mt-6 text-sm font-bold text-pine">وصل طلبك</p>
                <p className="mt-2 font-display text-2xl leading-snug text-pine-deep md:text-3xl">
                  شكرًا {name.trim()}، فريق ديل يتواصل معك قريبًا.
                </p>
                {sentId > 0 ? (
                  <p className="mt-3 text-slate">
                    رقم الطلب: <span className="font-ui font-bold text-pine-deep">#{sentId}</span>
                  </p>
                ) : null}
                <p className="mt-6 text-sm font-semibold text-slate">تحتاجنا الآن؟</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <a href={`tel:${dealPhone.tel}`} className={siteButton("secondary")}>
                    <Phone className="size-4" aria-hidden="true" />
                    اتصال
                    <span dir="ltr" className="font-ui">
                      {dealPhone.display}
                    </span>
                  </a>
                  <a
                    href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent(`طلب رقم ${sentId} — ${service.title}`)}`}
                    className={siteButton("secondary")}
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    واتساب
                    <span dir="ltr" className="font-ui">
                      {mobile.display}
                    </span>
                  </a>
                </div>
                <div className="mt-8 border-t border-line pt-6">
                  <SignedIn>
                    <Link to="/client" className={siteButton("primary")}>
                      تابع طلبك في «{ACCOUNT_LABEL}»
                    </Link>
                  </SignedIn>
                  <SignedOut>
                    <p className="text-sm leading-relaxed text-slate">
                      أنشئ حسابًا لتتابع طلباتك القادمة وحالتها من «{ACCOUNT_LABEL}».
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a href="/login?mode=up&redirect=/client" className={siteButton("dark")}>
                        إنشاء حساب
                      </a>
                      <Link to="/" className="inline-flex h-12 items-center px-4 font-bold text-slate hover:text-pine-deep">
                        العودة للرئيسية
                      </Link>
                    </div>
                  </SignedOut>
                </div>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                noValidate
                className="relative space-y-6 rounded-3xl bg-surface p-5 ring-1 ring-line md:p-8"
              >
                <div>
                  <h2 className="font-display text-2xl text-pine-deep">أرسل طلبك</h2>
                  <p className="mt-1 text-sm text-slate">دقيقة واحدة، ويصل طلبك مباشرة لفريق ديل.</p>
                </div>
                <SignedOut>
                  <p className="rounded-xl bg-pine-50 px-4 py-3 text-sm leading-relaxed text-pine-deep">
                    لديك حساب؟{" "}
                    <a
                      href={`/login?redirect=/start/${service.slug}`}
                      className="font-bold text-pine underline underline-offset-4"
                    >
                      سجّل الدخول
                    </a>{" "}
                    ليظهر الطلب في «{ACCOUNT_LABEL}». أو أكمل مباشرة بدون حساب.
                  </p>
                </SignedOut>
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-pine-deep">الاسم</span>
                    <input
                      required
                      name="name"
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={fieldErr === "name"}
                      className={cn(inputClass, fieldErr === "name" && "border-red-500")}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-pine-deep">رقم الجوال</span>
                    <input
                      required
                      name="tel"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      maxLength={24}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      aria-invalid={fieldErr === "phone"}
                      className={cn(inputClass, "text-end font-ui", fieldErr === "phone" && "border-red-500")}
                      placeholder="05X XXX XXXX"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-bold text-pine-deep">
                    اسم الجهة / الشركة <span className="font-normal text-slate">(اختياري)</span>
                  </span>
                  <input
                    name="organization"
                    maxLength={120}
                    autoComplete="organization"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={inputClass}
                    placeholder="مثال: مؤسسة النور"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-pine-deep">ماذا تحتاج؟</span>
                  <textarea
                    required
                    name="brief"
                    minLength={8}
                    maxLength={2000}
                    rows={6}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    aria-invalid={fieldErr === "brief"}
                    className={cn(
                      "mt-2 w-full resize-y rounded-xl border border-line-strong bg-surface px-4 py-3 text-[15px] leading-relaxed text-pine-deep outline-none transition-[border-color,box-shadow] placeholder:text-slate/60 focus:border-pine focus:ring-4 focus:ring-pine/10",
                      fieldErr === "brief" && "border-red-500",
                    )}
                    placeholder="صف المشروع، الجمهور، والموعد إن وُجد."
                  />
                  <span className="mt-1 block text-end font-ui text-xs text-slate" dir="ltr">
                    {brief.length}/2000
                  </span>
                </label>
                {/* Honeypot: invisible to people and screen readers, tempting to bots. */}
                <div aria-hidden="true" className="absolute -start-[9999px] size-px overflow-hidden">
                  <label>
                    الموقع
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 py-1 text-sm leading-relaxed text-slate",
                    fieldErr === "consent" && "text-red-700",
                  )}
                >
                  <input
                    required
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    aria-invalid={fieldErr === "consent"}
                    className="mt-0.5 size-5 shrink-0 accent-pine"
                  />
                  <span>
                    أوافق على معالجة بياناتي للتواصل بخصوص طلبي وفق{" "}
                    <Link to="/privacy" className="font-bold text-pine underline underline-offset-4">
                      سياسة الخصوصية
                    </Link>
                    .
                  </span>
                </label>
                {err ? (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {err}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className={cn(siteButton("primary", "lg"), "w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-52")}
                >
                  {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
                </button>
              </form>
            )}

            <aside className="space-y-4">
              <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
                <p className="text-sm font-bold text-pine">بعد الإرسال</p>
                <ol className="mt-4 space-y-4 text-[15px] leading-relaxed text-pine-deep">
                  {[
                    "يصل طلبك فورًا لفريق ديل برقم مرجعي.",
                    "نتواصل معك على جوالك لفهم التفاصيل.",
                    "نرسل لك العرض وخطة التنفيذ.",
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-pine-50 font-ui text-xs font-bold text-pine">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="on-dark rounded-3xl bg-pine-deep p-6 text-snow">
                <p className="text-sm font-bold text-lime">تفضّل الحديث مباشرة؟</p>
                <a
                  href={`tel:${dealPhone.tel}`}
                  className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white/5 px-4 hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-snow/70">
                    <Phone className="size-4 text-lime" aria-hidden="true" />
                    هاتف
                  </span>
                  <span dir="ltr" className="font-ui text-[17px] font-bold">
                    {dealPhone.display}
                  </span>
                </a>
                <a
                  href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent(`أرغب في خدمة: ${service.title}`)}`}
                  className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white/5 px-4 hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-snow/70">
                    <MessageCircle className="size-4 text-lime" aria-hidden="true" />
                    واتساب
                  </span>
                  <span dir="ltr" className="font-ui text-[17px] font-bold">
                    {mobile.display}
                  </span>
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </SiteChrome>
  );
}
