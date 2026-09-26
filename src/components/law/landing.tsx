import { useState } from "react";
import { Plus } from "lucide-react";
import { ArrowLink } from "@/components/arrow-link";
import { PlayMarks } from "@/components/brand-marks";
import { IdentityBreak } from "@/components/identity-break";
import { LimeWave } from "@/components/lime-wave";
import { Reveal } from "@/components/reveal";
import { MODULES } from "@/components/law/modules";
import { PlanFeatures } from "@/components/law/plan-features";
import { riyals } from "@/components/law/format";
import { mobile } from "@/lib/content";
import { GRACE_DAYS, PLANS, TRIAL_DAYS, yearlySavingPct, type BillingCycle } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

/**
 * /law — the «مكتب المحامي» product page in the DEAL identity: black
 * cinematic surfaces, lime display type in the DEAL face, square buttons,
 * hairline rows, the play-triangle geometry and the lime brand band. No stock
 * people photography — the product itself (the real law-desk still) and the
 * brand marks carry the page. Honest about scope: only what ships is listed;
 * no testimonials, customer logos or usage numbers.
 */

const SIGNUP = "/law/signup";
const CTA = `ابدأ تجربتك المجانية ${TRIAL_DAYS} يومًا`;

const limeButton =
  "inline-flex h-12 min-w-52 items-center justify-center bg-lime px-8 font-display text-base text-ink transition-opacity hover:opacity-90";

/** The real law-desk still (/public/images/desk-home-*), full bleed like the home page shots. */
function DeskShot({ priority }: { priority?: boolean }) {
  const set = (ext: string) => [800, 1600, 2400].map((w) => `/images/desk-home-${w}.${ext} ${w}w`).join(", ");
  const sizes = "100vw";
  return (
    <picture>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      <img
        src="/images/desk-home.jpg"
        alt="لوحة تحكم مكتب المحامي: مواعيد اليوم والقضايا والعقود"
        width={2400}
        height={1380}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="block h-[22rem] w-full object-cover object-top md:h-[34rem]"
      />
    </picture>
  );
}

export function LawHero() {
  return (
    <section className="relative isolate flex min-h-[92dvh] flex-col overflow-hidden bg-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-0 hidden w-[48%] opacity-90 md:block">
        <PlayMarks />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,transparent_0%,color-mix(in_oklab,var(--color-ink)_80%,transparent)_75%)]"
      />

      <div className="hero-in relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-28 pb-10 text-center">
        <p className="mb-7 flex items-baseline justify-center gap-3 text-lime">
          <span className="font-display text-base">مكتب المحامي</span>
          <span dir="ltr" className="font-ui text-micro font-semibold tracking-[0.28em]">
            BY DEAL
          </span>
        </p>
        <h1 className="text-balance font-display text-hero font-semibold text-lime md:text-6xl md:leading-[1.25]">
          مكتبك القانوني،
          <span className="block">في مكان واحد.</span>
        </h1>
        <p className="mt-6 max-w-xl text-pretty font-display text-lg leading-relaxed text-snow md:text-xl">
          العملاء والقضايا والجلسات والمستندات، واستشارات بالفيديو مع صفحة حجز لمكتبك.
        </p>
        <p className="mt-3 max-w-md text-pretty font-display text-sm leading-relaxed text-mist">
          نظام سعودي، عربي أولًا، لطريقة عمل المكاتب في المملكة.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <a href={SIGNUP} className={limeButton}>
            {CTA}
          </a>
          <div className="flex flex-wrap items-center justify-center gap-x-6">
            <ArrowLink href="/desk/law/home">شاهد العرض التوضيحي</ArrowLink>
            <ArrowLink href="#pricing">الأسعار</ArrowLink>
          </div>
          <p className="font-display text-xs text-dim">بدون بطاقة ائتمان · جاهز في أقل من دقيقة · بلا التزام</p>
        </div>
      </div>

      <div
        dir="ltr"
        className="relative z-20 mb-20 flex shrink-0 items-center justify-between px-6 font-ui text-micro tracking-[0.22em] text-snow/70 md:mb-28 md:px-10"
      >
        <span>DEAL FOR MARKETING</span>
        <span>LAW OFFICE</span>
      </div>
      <LimeWave className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 md:h-24" />
    </section>
  );
}

const TRUST = [
  { title: "عربي أولًا", body: "واجهة من اليمين لليسار، بلغة المكاتب." },
  { title: "بيانات معزولة", body: "لا يرى بيانات مكتبك إلا أعضاؤه." },
  { title: "للشركات والجهات", body: "تحويل بنكي وتفعيل من فريق ديل." },
  { title: "دعم قريب", body: "فريق سعودي يرد عليك بالواتساب." },
];

export function LawTrust() {
  return (
    <section aria-label="لماذا مكتب المحامي" className="bg-ink">
      <DeskShot priority />
      <ul className="grid grid-cols-2 border-y border-hair lg:grid-cols-4">
        {TRUST.map((t, i) => (
          <li
            key={t.title}
            className="border-hair px-6 py-7 odd:border-e max-lg:[&:nth-child(-n+2)]:border-b lg:border-e lg:last:border-e-0 md:px-10"
          >
            <span className="font-display text-sm text-lime">{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-3 font-display text-lg text-snow">{t.title}</p>
            <p className="mt-1 font-display text-sm leading-relaxed text-mist">{t.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const NOW = [
  {
    title: "استشارات بالفيديو دون تطبيق",
    body: "يدخل العميل من رابط خاص به ويفحص الكاميرا والصوت، وينتظر حتى تسمح له بالدخول. أو استخدم رابط Zoom أو Meet إن فضّلت.",
  },
  {
    title: "صفحة حجز لمكتبك",
    body: "رابط تشاركه مع عملائك: يختارون نوع الاستشارة والوقت من الأوقات المتاحة فعلًا، وتؤكد أنت الطلب.",
  },
  {
    title: "الفريق والصلاحيات",
    body: "ادعُ المحامين والموظفين بالبريد، ولكل عضو صلاحيته: مالك، مدير، محامٍ، أو موظف.",
  },
];

function Head({ kicker, title, body, id }: { kicker: string; title: string; body?: string; id?: string }) {
  return (
    <Reveal className="mx-auto max-w-3xl px-8 text-center md:px-16">
      <p className="text-kicker text-lime">{kicker} //</p>
      <h2 id={id} className="mt-5 font-display text-poster text-snow">
        {title}
      </h2>
      {body ? <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">{body}</p> : null}
    </Reveal>
  );
}

export function LawFeatures() {
  return (
    <section id="features" aria-labelledby="features-h" className="scroll-mt-20 bg-ink pt-24 md:pt-32">
      <Head
        id="features-h"
        kicker="المزايا"
        title="كل ما يحتاجه مكتبك في يومه."
        body="من حجز الاستشارة إلى إغلاق القضية: العميل، المواعيد، الجلسات، المهام والمستندات، ومكالمة الفيديو نفسها."
      />
      <ul className="mt-14 border-t border-hair">
        {NOW.map((f, i) => (
          <li
            key={f.title}
            className="flex flex-col gap-2 border-b border-hair px-8 py-7 md:flex-row md:items-baseline md:justify-between md:gap-8 md:px-16"
          >
            <span className="font-display text-sm text-lime">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 font-display text-2xl text-snow md:text-3xl">{f.title}</span>
            <span className="max-w-md font-display text-sm leading-relaxed text-mist">{f.body}</span>
          </li>
        ))}
      </ul>

      <Reveal className="px-8 pt-20 text-center md:px-16">
        <p className="text-kicker text-lime">وحدات المكتب //</p>
      </Reveal>
      <ul className="mt-8 grid border-t border-hair sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <li key={m.id} className="border-b border-hair px-8 py-8 sm:odd:border-e lg:border-e lg:[&:nth-child(3n)]:border-e-0">
            <m.icon className="size-6 text-lime" />
            <h3 className="mt-5 font-display text-xl text-snow">{m.title}</h3>
            <p className="mt-2 font-display text-sm leading-relaxed text-mist">{m.blurb}</p>
            <ul className="mt-5 space-y-2 font-display text-sm text-snow/85">
              {m.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 bg-lime" />
                  {p}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LawData() {
  const points = [
    "كل مكتب مساحة عمل مستقلة، ولا يصل إليها إلا أعضاؤها المدعوون.",
    "صلاحيات واضحة: من يدير الفريق، ومن يدير الاشتراك، ومن يعمل على الملفات.",
    `لا نحذف بياناتك تلقائيًا: إن انتهى الاشتراك يبقى المكتب ${GRACE_DAYS} أيام كاملًا، ثم للقراءة فقط.`,
    "مكتبك هو المسؤول عن بيانات عملائه، وديل تعالجها نيابة عنه لتشغيل الخدمة فقط.",
  ];
  return (
    <section aria-labelledby="data-h" className="border-y border-hair bg-ink px-8 py-24 text-center md:px-16 md:py-32">
      <p className="text-kicker text-lime">بياناتك //</p>
      <h2 id="data-h" className="mt-5 font-display text-poster text-snow">
        بيانات موكليك
        <br />
        لمكتبك وحده.
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
        بنينا عزل المكاتب في أساس النظام، لا كإضافة لاحقة: كل طلب يمر بفحص العضوية والصلاحية قبل أن يصل لأي بيانات.
      </p>
      <ul className="mx-auto mt-12 max-w-2xl space-y-5 text-start">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-4 font-display text-[15px] leading-relaxed text-snow/90">
            <span aria-hidden="true" className="mt-2.5 h-px w-6 shrink-0 bg-lime" />
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-10 font-display text-sm text-dim">
        التفاصيل في{" "}
        <a href="/law/terms" className="text-lime hover:opacity-80">
          شروط الاستخدام
        </a>{" "}
        و
        <a href="/privacy#law" className="text-lime hover:opacity-80">
          سياسة الخصوصية
        </a>
        .
      </p>
    </section>
  );
}

export function LawSteps() {
  const steps = [
    { title: "أنشئ حسابك", body: "بريدك وكلمة مرور. لا بطاقة ائتمان." },
    { title: "عرّفنا بمكتبك", body: "الاسم والمدينة، والسجل التجاري إن رغبت." },
    { title: "ادعُ فريقك", body: `وابدأ تجربة ${TRIAL_DAYS} يومًا بكامل مزايا الخطة الاحترافية.` },
  ];
  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20 bg-ink pt-24 md:pt-32">
      <Head id="how-h" kicker="كيف تبدأ" title="ثلاث خطوات، وأقل من دقيقة." />
      <ol className="mt-14 grid border-y border-hair md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="border-b border-hair px-8 py-10 last:border-b-0 md:border-e md:border-b-0 md:last:border-e-0 md:px-12">
            <span className="font-display text-5xl leading-none text-lime">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-6 font-display text-2xl text-snow">{s.title}</h3>
            <p className="mt-2 font-display text-sm leading-relaxed text-mist">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="flex justify-center px-8 py-16">
        <a href={SIGNUP} className={limeButton}>
          {CTA}
        </a>
      </div>
    </section>
  );
}

export function LawPricing() {
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-20 bg-ink pt-8 pb-24 md:pb-32">
      <Head
        id="pricing-h"
        kicker="الأسعار"
        title="خطة لكل حجم مكتب."
        body={`كل مكتب يبدأ بتجربة ${TRIAL_DAYS} يومًا على الخطة الاحترافية، ثم تختار ما يناسبك.`}
      />
      <div role="group" aria-label="دورة الفوترة" className="mx-auto mt-10 flex w-fit border border-hair">
        {(
          [
            ["monthly", "شهري"],
            ["yearly", `سنوي · وفّر ${yearlySavingPct(PLANS[1])}٪`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={cycle === v}
            onClick={() => setCycle(v)}
            className={cn(
              "h-11 px-5 font-display text-sm transition-colors",
              cycle === v ? "bg-lime text-ink" : "text-mist hover:text-snow",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-12 md:px-8">
        <ul className="mx-auto grid max-w-6xl gap-px border-y border-hair bg-hair md:grid-cols-3 md:border">
          {PLANS.map((p) => {
            const lime = Boolean(p.highlight);
            return (
              <li key={p.id} className={cn("relative flex flex-col p-8 md:p-10", lime ? "bg-lime text-ink" : "bg-ink text-snow")}>
                {lime ? <p className="font-display text-xs text-pine">الأنسب لمعظم المكاتب</p> : <p className="font-display text-xs text-dim">&nbsp;</p>}
                <h3 className="mt-3 font-display text-3xl">{p.name}</h3>
                <p className={cn("mt-1 font-display text-sm", lime ? "text-pine" : "text-mist")}>{p.tagline}</p>
                <p className="mt-8 flex items-baseline gap-2">
                  <span className="font-ui text-[2.75rem] leading-none font-extrabold tabular-nums">{riyals(p.price[cycle])}</span>
                  <span className={cn("font-display text-sm", lime ? "text-pine" : "text-mist")}>
                    ر.س / {cycle === "yearly" ? "سنة" : "شهر"}
                  </span>
                </p>
                <p className={cn("mt-2 font-display text-xs", lime ? "text-pine/80" : "text-dim")}>
                  {cycle === "yearly" ? `يعادل ${riyals(Math.round(p.price.yearly / 12))} ر.س شهريًا` : "تُدفع شهريًا"} · لا تشمل
                  الضريبة
                </p>
                <div className="mt-8 flex-1">
                  <PlanFeatures plan={p} dark={!lime} onLime={lime} />
                </div>
                <a
                  href={SIGNUP}
                  className={cn(
                    "mt-10 inline-flex h-12 items-center justify-center px-6 font-display text-base transition-opacity hover:opacity-90",
                    lime ? "bg-ink text-lime" : "border border-lime text-lime",
                  )}
                >
                  ابدأ التجربة المجانية
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mx-auto mt-8 max-w-3xl px-8 text-center font-display text-sm leading-relaxed text-dim">
        الأسعار بالريال السعودي ولا تشمل ضريبة القيمة المضافة (١٥٪). للجهات الحكومية والشركات: تحويل بنكي وتفعيل من فريق ديل —{" "}
        <a
          href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent("أرغب في اشتراك مكتب المحامي لجهتنا")}`}
          className="text-lime hover:opacity-80"
        >
          تواصل معنا
        </a>
        .
      </p>
    </section>
  );
}

const FAQ = [
  {
    q: "هل أحتاج بطاقة ائتمان لبدء التجربة؟",
    a: `لا. أنشئ حسابك ومكتبك وجرّب ${TRIAL_DAYS} يومًا بكامل مزايا الخطة الاحترافية، ثم اختر خطتك إن ناسبك.`,
  },
  {
    q: "ماذا يحدث عند انتهاء التجربة أو الاشتراك؟",
    a: `يبقى مكتبك متاحًا كاملًا ${GRACE_DAYS} أيام بعد الانتهاء، ثم يتحول للقراءة فقط حتى تجدد. لا نحذف بياناتك تلقائيًا.`,
  },
  {
    q: "كيف أدفع؟",
    a: "بالتحويل البنكي حاليًا، ويفعّل فريق ديل اشتراكك فور تأكيد وصول المبلغ. والدفع بمدى والبطاقات وApple Pay عبر بوابة دفع سعودية قريبًا.",
  },
  {
    q: "من يملك بيانات عملائي؟",
    a: "مكتبك. أنت المسؤول عن بيانات عملائك بصفتك جهة التحكم، وديل تعالجها نيابة عنك لتشغيل الخدمة فقط، ولا تستخدمها لأي غرض آخر.",
  },
  {
    q: "هل أستطيع إدارة أكثر من مكتب أو فرع؟",
    a: "نعم. حساب واحد يمكن أن يكون عضوًا في عدة مكاتب مع التبديل بينها، وخطة «مؤسسي» مصممة لتعدد الفروع.",
  },
  {
    q: "كيف تعمل الاستشارات بالفيديو؟",
    a: "تحدد أوقات عملك، وتشارك صفحة الحجز مع عملائك. يحجز العميل وقتًا متاحًا، وبعد تأكيدك يدخل من رابط خاص به من المتصفح دون تطبيق، وينتظر حتى تسمح له بالدخول. الاستشارات المرئية متاحة في خطتي «احترافي» و«مؤسسي»، ويمكنك فيهما أيضًا استخدام رابط Zoom أو Google Meet أو Teams بدلًا منها.",
  },
  {
    q: "أين تُحفظ مستندات المكتب؟",
    a: "في مساحة مكتبك وحده، ولا تُنزّل إلا لأعضائه. يُفحص نوع كل ملف ومحتواه قبل الحفظ، ومساحة التخزين حسب خطتك.",
  },
];

export function LawFaq() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 bg-ink pb-24 md:pb-32">
      <Head id="faq-h" kicker="أسئلة شائعة" title="قبل أن تبدأ." />
      <div className="mx-auto mt-12 max-w-3xl border-t border-hair">
        {FAQ.map((f) => (
          <details key={f.q} className="group border-b border-hair">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-8 py-5 font-display text-lg text-snow [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus className="size-5 shrink-0 text-lime transition-transform group-open:rotate-45" strokeWidth={1.6} aria-hidden="true" />
            </summary>
            <p className="px-8 pb-6 font-display text-sm leading-loose text-mist">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-center font-display text-sm text-dim">
        سؤالك غير موجود؟{" "}
        <a href={`https://wa.me/${mobile.wa}`} className="text-lime hover:opacity-80">
          راسلنا واتساب
        </a>
      </p>
    </section>
  );
}

export function LawFinalCta() {
  return (
    <>
      <IdentityBreak />
      <section className="bg-ink px-8 py-24 text-center md:px-16 md:py-32">
        <p className="text-kicker text-lime">جاهز؟ //</p>
        <h2 className="mt-5 font-display text-poster text-snow">جهّز مكتبك اليوم.</h2>
        <p className="mx-auto mt-6 max-w-lg text-pretty leading-loose text-mist">
          {TRIAL_DAYS} يومًا مجانًا، بدون بطاقة، وفريق ديل معك إن احتجت.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <a href={SIGNUP} className={limeButton}>
            {CTA}
          </a>
          <ArrowLink href={`https://wa.me/${mobile.wa}`}>تحدث معنا واتساب</ArrowLink>
        </div>
      </section>
    </>
  );
}
