import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SignedIn } from "@/lib/auth/gates";
import { phone as dealPhone, serviceBySlug } from "@/lib/content";
import { LINE_DRAFT_KEY } from "@/lib/line";
import { normalizePhone } from "@/lib/phone";
import { createRequest, LEAD_ERRORS } from "@/lib/requests";

const inputClass =
  "mt-2 h-12 w-full border border-hair bg-card px-4 text-snow outline-none focus-visible:border-lime focus-visible:outline-2 focus-visible:outline-lime";
const knownErrors: string[] = Object.values(LEAD_ERRORS);

export const Route = createFileRoute("/start/$slug")({ component: StartService });

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
  const startedAt = useRef(0);

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
        <main className="grid min-h-dvh place-items-center bg-ink px-6 text-center">
          <div>
            <p className="text-mist">هذه الخدمة غير موجودة.</p>
            <Link to="/start" className="mt-4 inline-block text-lime">
              العودة للخدمات
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
    if (!normalizePhone(phone)) {
      setErr(LEAD_ERRORS.phone);
      return;
    }
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
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="font-ui text-xs tracking-widest text-lime">{service.n}</p>
        <h1 className="mt-3 font-display text-poster text-snow">{service.title}</h1>
        <p className="mt-4 max-w-lg text-mist">{service.body}</p>
        {fromLine ? <p className="mt-4 text-kicker text-lime">من خط ديل //</p> : null}

        {sentId !== null ? (
          <div role="status" className="mt-12 max-w-lg border border-lime px-6 py-10">
            <p className="text-kicker text-lime">وصل طلبك //</p>
            <p className="mt-4 font-display text-2xl text-snow">
              شكرًا {name.trim()}، فريق ديل يتواصل معك قريبًا.
            </p>
            {sentId > 0 ? (
              <p className="mt-3 font-ui text-sm text-mist">رقم الطلب: #{sentId}</p>
            ) : null}
            <p className="mt-3 text-sm text-mist">
              للاستعجال:{" "}
              <a href={`tel:${dealPhone.tel}`} className="text-lime" dir="ltr">
                {dealPhone.display}
              </a>
            </p>
            <SignedIn>
              <Link to="/client" className="mt-6 inline-flex font-display text-sm text-lime">
                تابع طلباتك في «مشاريعي»
              </Link>
            </SignedIn>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-12 max-w-lg space-y-6">
            <label className="block">
              <span className="text-sm text-dim">الاسم</span>
              <input
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm text-dim">رقم الجوال</span>
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                maxLength={24}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${inputClass} text-end`}
                placeholder="05X XXX XXXX"
              />
            </label>
            <label className="block">
              <span className="text-sm text-dim">اسم الجهة / الشركة (اختياري)</span>
              <input
                maxLength={120}
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputClass}
                placeholder="مثال: مؤسسة النور"
              />
            </label>
            <label className="block">
              <span className="text-sm text-dim">ماذا تحتاج؟</span>
              <textarea
                required
                minLength={8}
                maxLength={2000}
                rows={6}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="mt-2 w-full border border-hair bg-card px-4 py-3 text-snow outline-none focus-visible:border-lime focus-visible:outline-2 focus-visible:outline-lime"
                placeholder="صف المشروع، الجمهور، والموعد إن وُجد."
              />
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
            <label className="flex items-start gap-3 text-sm leading-relaxed text-mist">
              <input
                required
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-4 accent-lime"
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
              <p role="alert" className="text-sm text-red-400">
                {err}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="h-12 min-w-44 border border-lime bg-lime px-8 font-display text-ink disabled:opacity-60"
            >
              {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
            </button>
          </form>
        )}
      </main>
    </SiteChrome>
  );
}
