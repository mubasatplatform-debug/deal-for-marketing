import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DealSignIn } from "@/components/deal-sign-in";
import { SiteChrome } from "@/components/site-chrome";
import { SignInGate } from "@/lib/auth/gates";
import { serviceBySlug } from "@/lib/content";
import { LINE_DRAFT_KEY } from "@/lib/line";
import { createRequest } from "@/lib/requests";

export const Route = createFileRoute("/start/$slug")({ component: StartService });

function StartService() {
  const { slug } = Route.useParams();
  const service = serviceBySlug(slug);
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fromLine, setFromLine] = useState(false);

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
    setBusy(true);
    try {
      await createRequest({ data: { slug: service.slug, company, brief } });
      try {
        sessionStorage.removeItem(LINE_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      await navigate({ to: "/client" });
    } catch (error) {
      setErr(error instanceof Error && error.message === "Unauthorized" ? "يلزم الدخول أولاً" : "تعذر إرسال الطلب، حاول مرة أخرى.");
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

        <SignInGate
          fallback={
            <div className="mt-12 max-w-md">
              <p className="mb-6 text-snow">ادخل أولاً لإرسال طلبك.</p>
              <DealSignIn callbackURL={`/start/${service.slug}`} />
            </div>
          }
        >
          <form onSubmit={onSubmit} className="mt-12 max-w-lg space-y-6">
            <label className="block">
              <span className="text-sm text-dim">اسم الجهة / الشركة</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-2 h-12 w-full border border-hair bg-card px-4 text-snow outline-none focus:border-lime"
                placeholder="مثال: مؤسسة النور"
              />
            </label>
            <label className="block">
              <span className="text-sm text-dim">ماذا تحتاج؟</span>
              <textarea
                required
                minLength={8}
                rows={6}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="mt-2 w-full border border-hair bg-card px-4 py-3 text-snow outline-none focus:border-lime"
                placeholder="صف المشروع، الجمهور، والموعد إن وُجد."
              />
            </label>
            {err ? <p className="text-sm text-lime">{err}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="h-12 min-w-44 border border-lime bg-lime px-8 font-display text-ink disabled:opacity-60"
            >
              {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
            </button>
          </form>
        </SignInGate>
      </main>
    </SiteChrome>
  );
}
