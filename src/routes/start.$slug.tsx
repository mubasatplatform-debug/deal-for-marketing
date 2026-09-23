import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { mobile, phone as dealPhone, serviceBySlug } from "@/lib/content";
import { LINE_DRAFT_KEY } from "@/lib/line";
import { normalizePhone } from "@/lib/phone";
import { createRequest, LEAD_ERRORS } from "@/lib/requests";
import { pageHead } from "@/lib/seo";

const inputClass =
  "mt-2 h-12 w-full border border-hair bg-card px-4 text-snow outline-none focus-visible:border-lime focus-visible:outline-2 focus-visible:outline-lime";
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
  const startedAt = useRef(0);
  const doneRef = useRef<HTMLDivElement>(null);

  // Move focus to the confirmation so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (sentId === null) return;
    doneRef.current?.focus();
    doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [sentId]);

  useEffect(() => {
    startedAt.current = Date.now();
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
        <main className="grid min-h-[70dvh] place-items-center bg-ink px-6 pt-24 pb-16 text-center">
          <div className="max-w-md">
            <p className="text-kicker text-lime">اطلب خدمتك //</p>
            <h1 className="mt-4 font-display text-3xl text-snow">هذه الخدمة غير موجودة</h1>
            <p className="mt-3 text-mist">ربما تغيّر الرابط. اختر خدمتك من القائمة وسنكمل من هناك.</p>
            <Link
              to="/start"
              className="mt-8 inline-flex h-12 items-center border border-lime bg-lime px-8 font-display text-ink"
            >
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
          startedAt: startedAt.current,
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

  return (
    <SiteChrome>
      <main className="mx-auto max-w-6xl bg-ink px-6 pt-24 pb-20 md:px-16 md:pt-32">
        <Link
          to="/start"
          className="inline-flex min-h-11 items-center gap-2 font-display text-sm text-mist hover:text-lime"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
          كل الخدمات
        </Link>
        <p className="mt-4 font-ui text-xs tracking-widest text-lime">{service.n}</p>
        <h1 className="mt-3 font-display text-poster text-snow md:text-5xl">{service.title}</h1>
        <p className="mt-4 max-w-2xl text-mist">{service.body}</p>
        {fromLine ? (
          <p className="mt-5 inline-flex items-center gap-2 border border-lime/40 px-3 py-2 text-sm text-lime">
            عبّأنا الطلب من محادثتك في خط ديل — راجعه وأكمل بياناتك.
          </p>
        ) : null}

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          {sentId !== null ? (
            <div role="status" tabIndex={-1} ref={doneRef} className="border border-lime px-6 py-10 outline-none md:px-10">
              <span className="grid size-12 place-items-center bg-lime text-ink" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <p className="mt-6 text-kicker text-lime">وصل طلبك //</p>
              <p className="mt-3 font-display text-2xl leading-snug text-snow md:text-3xl">
                شكرًا {name.trim()}، فريق ديل يتواصل معك قريبًا.
              </p>
              {sentId > 0 ? (
                <p className="mt-3 text-mist">
                  رقم الطلب: <span className="font-ui text-snow">#{sentId}</span>
                </p>
              ) : null}
              <p className="mt-6 text-sm text-mist">تحتاجنا الآن؟</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`tel:${dealPhone.tel}`}
                  className="inline-flex h-12 items-center justify-center gap-2 border border-hair px-5 text-snow hover:border-lime"
                >
                  اتصال
                  <span dir="ltr" className="font-ui">
                    {dealPhone.display}
                  </span>
                </a>
                <a
                  href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent(`طلب رقم ${sentId} — ${service.title}`)}`}
                  className="inline-flex h-12 items-center justify-center gap-2 border border-hair px-5 text-snow hover:border-lime"
                >
                  واتساب
                  <span dir="ltr" className="font-ui">
                    {mobile.display}
                  </span>
                </a>
              </div>
              <div className="mt-8 border-t border-hair pt-6">
                <SignedIn>
                  <Link
                    to="/client"
                    className="inline-flex h-12 items-center border border-lime bg-lime px-8 font-display text-ink"
                  >
                    تابع طلبك في «{ACCOUNT_LABEL}»
                  </Link>
                </SignedIn>
                <SignedOut>
                  <p className="text-sm leading-relaxed text-mist">
                    أنشئ حسابًا لتتابع طلباتك القادمة وحالتها من «{ACCOUNT_LABEL}».
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href="/login?mode=up&redirect=/client"
                      className="inline-flex h-12 items-center border border-lime px-6 font-display text-lime"
                    >
                      إنشاء حساب
                    </a>
                    <Link to="/" className="inline-flex h-12 items-center px-4 font-display text-mist hover:text-snow">
                      العودة للرئيسية
                    </Link>
                  </div>
                </SignedOut>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-6">
              <SignedOut>
                <p className="border border-hair px-4 py-3 text-sm leading-relaxed text-mist">
                  لديك حساب؟{" "}
                  <a href={`/login?redirect=/start/${service.slug}`} className="text-lime underline underline-offset-4">
                    سجّل الدخول
                  </a>{" "}
                  ليظهر الطلب في «{ACCOUNT_LABEL}». أو أكمل مباشرة بدون حساب.
                </p>
              </SignedOut>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-mist">الاسم</span>
                  <input
                    required
                    name="name"
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={fieldErr === "name"}
                    className={cn(inputClass, fieldErr === "name" && "border-red-400")}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-mist">رقم الجوال</span>
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
                    className={cn(inputClass, "text-end font-ui", fieldErr === "phone" && "border-red-400")}
                    placeholder="05X XXX XXXX"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm text-mist">
                  اسم الجهة / الشركة <span className="text-dim">(اختياري)</span>
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
                <span className="text-sm text-mist">ماذا تحتاج؟</span>
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
                    "mt-2 w-full resize-y border border-hair bg-card px-4 py-3 text-snow outline-none focus-visible:border-lime focus-visible:outline-2 focus-visible:outline-lime",
                    fieldErr === "brief" && "border-red-400",
                  )}
                  placeholder="صف المشروع، الجمهور، والموعد إن وُجد."
                />
                <span className="mt-1 block text-end font-ui text-xs text-dim" dir="ltr">
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
                  "flex cursor-pointer items-start gap-3 py-1 text-sm leading-relaxed text-mist",
                  fieldErr === "consent" && "text-red-300",
                )}
              >
                <input
                  required
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-invalid={fieldErr === "consent"}
                  className="mt-0.5 size-5 shrink-0 accent-lime"
                />
                <span>
                  أوافق على معالجة بياناتي للتواصل بخصوص طلبي وفق{" "}
                  <Link to="/privacy" className="text-lime underline underline-offset-4">
                    سياسة الخصوصية
                  </Link>
                  .
                </span>
              </label>
              {err ? (
                <p role="alert" className="border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {err}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className="h-12 w-full border border-lime bg-lime px-8 font-display text-ink transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-52"
              >
                {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
              </button>
            </form>
          )}

          <aside className="space-y-8 lg:border-s lg:border-hair lg:ps-10">
            <div>
              <p className="text-kicker text-lime">بعد الإرسال //</p>
              <ol className="mt-4 space-y-4 text-sm leading-relaxed text-mist">
                <li className="flex gap-3">
                  <span className="font-ui text-xs text-lime">01</span>
                  يصل طلبك فورًا لفريق ديل برقم مرجعي.
                </li>
                <li className="flex gap-3">
                  <span className="font-ui text-xs text-lime">02</span>
                  نتواصل معك على جوالك لفهم التفاصيل.
                </li>
                <li className="flex gap-3">
                  <span className="font-ui text-xs text-lime">03</span>
                  نرسل لك العرض وخطة التنفيذ.
                </li>
              </ol>
            </div>
            <div className="border-t border-hair pt-6 text-sm">
              <p className="text-mist">تفضّل الحديث مباشرة؟</p>
              <a href={`tel:${dealPhone.tel}`} className="mt-3 flex min-h-11 items-center justify-between gap-3 text-snow hover:text-lime">
                <span className="text-dim">هاتف</span>
                <span dir="ltr" className="font-ui">
                  {dealPhone.display}
                </span>
              </a>
              <a
                href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent(`أرغب في خدمة: ${service.title}`)}`}
                className="flex min-h-11 items-center justify-between gap-3 text-snow hover:text-lime"
              >
                <span className="text-dim">واتساب</span>
                <span dir="ltr" className="font-ui">
                  {mobile.display}
                </span>
              </a>
            </div>
          </aside>
        </div>
      </main>
    </SiteChrome>
  );
}
