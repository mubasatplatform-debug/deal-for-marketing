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
      <main className="bg-ink px-6 pt-24 pb-20 md:px-16">
        <p className="text-kicker text-lime">اطلب خدمتك //</p>
        <h1 className="mt-4 max-w-xl font-display text-poster text-snow">
          العميل يدخل…
          <br />
          ويأخذ الخدمة بنفسه.
        </h1>
        <p className="mt-4 max-w-lg text-mist">
          اختر الخدمة، اكتب احتياجك، ونبدأ التنفيذ. بدون انتظار نموذج عام — طلبك يصل مباشرة لفريق ديل.
        </p>

        <p className="mt-14 text-kicker text-lime">الأنشطة المهنية //</p>
        <ul className="mt-6 grid gap-px bg-hair sm:grid-cols-2">
          {professional.map((s) => (
            <ServiceItem key={s.slug} s={s} />
          ))}
        </ul>

        <p className="mt-14 text-kicker text-lime">خدمات ديل //</p>
        <ul className="mt-6 grid gap-px bg-hair sm:grid-cols-2">
          {agency.map((s) => (
            <ServiceItem key={s.slug} s={s} />
          ))}
        </ul>
      </main>
    </SiteChrome>
  );
}

function ServiceItem({ s }: { s: (typeof services)[number] }) {
  return (
    <li className="bg-ink p-8">
      <p className="font-ui text-xs tracking-widest text-lime">{s.n}</p>
      <h2 className="mt-3 font-display text-2xl text-snow">{s.title}</h2>
      <p className="mt-3 text-sm leading-loose text-mist">{s.body}</p>
      <Link
        to="/start/$slug"
        params={{ slug: s.slug }}
        className="mt-6 inline-flex items-center gap-2 font-display text-sm text-lime hover:opacity-80"
      >
        اطلب هذه الخدمة
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
    </li>
  );
}
