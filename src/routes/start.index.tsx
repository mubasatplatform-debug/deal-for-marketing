import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { pageHead } from "@/lib/seo";
import { services } from "@/lib/content";

export const Route = createFileRoute("/start/")({
  head: () =>
    pageHead({
      title: "اطلب خدمتك",
      description: "اختر خدمتك من ديل — أنظمة العملاء والمحامين والدفع، والهوية والإنتاج والفعاليات — وأرسل طلبك مباشرة للفريق.",
      path: "/start",
    }),
  component: Start,
});

const professions = new Set(["law", "ai"]);

function Start() {
  const professional = services.filter((s) => professions.has(s.slug));
  const agency = services.filter((s) => !professions.has(s.slug));

  return (
    <SiteChrome>
      <main className="mx-auto max-w-6xl bg-ink px-6 pt-24 pb-20 md:px-16 md:pt-32">
        <p className="text-kicker text-lime">اطلب خدمتك //</p>
        <h1 className="mt-4 max-w-xl font-display text-poster text-snow">
          العميل يدخل…
          <br />
          ويأخذ الخدمة بنفسه.
        </h1>
        <p className="mt-4 max-w-lg text-mist">
          اختر الخدمة، اكتب احتياجك، ونبدأ التنفيذ. بدون انتظار نموذج عام — طلبك يصل مباشرة لفريق ديل.
        </p>
        <ol className="mt-8 grid max-w-2xl gap-3 text-sm text-mist sm:grid-cols-3">
          {["اختر الخدمة", "اكتب احتياجك في دقيقة", "يتواصل معك الفريق"].map((step, i) => (
            <li key={step} className="flex items-center gap-3 border border-hair px-4 py-3">
              <span className="font-ui text-xs text-lime">0{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <p className="mt-14 text-kicker text-lime">الأنشطة المهنية //</p>
        <ul className={grid}>
          {professional.map((s) => (
            <ServiceItem key={s.slug} s={s} />
          ))}
        </ul>

        <p className="mt-14 text-kicker text-lime">خدمات ديل //</p>
        <ul className={grid}>
          {agency.map((s) => (
            <ServiceItem key={s.slug} s={s} />
          ))}
        </ul>
      </main>
    </SiteChrome>
  );
}

/** Hairline grid; an odd last card spans the row instead of leaving a grey hole. */
const grid = "mt-6 grid gap-px border border-hair bg-hair sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2";

function ServiceItem({ s }: { s: (typeof services)[number] }) {
  return (
    <li className="bg-ink">
      {/* The whole card is the tap target; the lime line is its visible label. */}
      <Link
        to="/start/$slug"
        params={{ slug: s.slug }}
        className="group flex h-full flex-col p-6 transition-colors hover:bg-card focus-visible:bg-card focus-visible:-outline-offset-2 md:p-8"
      >
        <span className="font-ui text-xs tracking-widest text-lime">{s.n}</span>
        <h2 className="mt-3 font-display text-2xl text-snow">{s.title}</h2>
        <p className="mt-3 flex-1 text-sm leading-loose text-mist">{s.body}</p>
        <span className="mt-6 inline-flex min-h-11 items-center gap-2 font-display text-sm text-lime">
          اطلب هذه الخدمة
          <svg
            viewBox="0 0 24 24"
            className="size-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </span>
      </Link>
    </li>
  );
}
