import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Globe,
  Languages,
  LockKeyhole,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { siteButton, wrap } from "@/components/site-classes";
import { Eyebrow, Frame, Photo } from "@/components/site-ui";
import { MODULES } from "@/components/law/modules";
import { PlanFeatures } from "@/components/law/plan-features";
import { riyals } from "@/components/law/format";
import { mobile } from "@/lib/content";
import { GRACE_DAYS, PLANS, TRIAL_DAYS, yearlySavingPct, type BillingCycle } from "@/lib/saas/plans";
import { cn } from "@/lib/utils";

/**
 * /law — the «مكتب المحامي» product page. Same light, photographic language as
 * the DEAL home (paper canvas, pine type, lime accents, rounded photo frames).
 * Honest about scope: only what ships is described (video consultations are
 * gated by plan and say so). No testimonials, customer logos or usage numbers.
 */

const SIGNUP = "/law/signup";
const CTA = `ابدأ تجربتك المجانية ${TRIAL_DAYS} يومًا`;

/** The law-desk demo still (/public/images/desk-home-*), framed like a browser window. */
function DeskShot({ className, priority }: { className?: string; priority?: boolean }) {
  const set = (ext: string) => [800, 1600, 2400].map((w) => `/images/desk-home-${w}.${ext} ${w}w`).join(", ");
  const sizes = "(min-width: 1240px) 700px, (min-width: 1024px) 56vw, 94vw";
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-float)]", className)}>
      <div className="flex h-8 items-center gap-1.5 border-b border-line bg-paper px-3" dir="ltr" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="mx-auto h-4 w-40 rounded bg-surface ring-1 ring-line" />
      </div>
      <div className="aspect-[16/10]">
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
            className="block h-full w-full object-cover object-top"
          />
        </picture>
      </div>
    </div>
  );
}

export function LawHero() {
  return (
    <section className="relative overflow-hidden bg-paper pt-24 pb-16 md:pt-32 md:pb-24">
      <div className={cn(wrap, "grid items-center gap-12 lg:grid-cols-12 lg:gap-14")}>
        <div className="hero-in lg:col-span-5">
          <Eyebrow>مكتب المحامي · من ديل</Eyebrow>
          <h1 className="mt-6 font-display text-[2.5rem] leading-[1.22] text-pine-deep sm:text-[3.4rem] lg:text-[3.6rem] lg:leading-[1.18]">
            مكتبك القانوني،{" "}
            <span className="relative inline-block">
              <span className="relative z-10">مرتّب</span>
              <span aria-hidden="true" className="absolute inset-x-[-0.06em] bottom-[0.1em] h-[0.28em] rounded-[3px] bg-lime" />
            </span>{" "}
            في مكان واحد.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pine-deep/80">
            نظام سعودي لإدارة مكتب المحاماة: العملاء والقضايا والجلسات والمهام والمستندات، واستشارات عن بُعد
            بالفيديو مع صفحة حجز إلكتروني لمكتبك. عربي أولًا، ومصمم لطريقة عمل المكاتب في المملكة.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={SIGNUP} className={siteButton("primary", "lg")}>
              {CTA}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </a>
            <a href="/desk/law/home" className={siteButton("secondary", "lg")}>
              شاهد العرض التوضيحي
            </a>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-lime-600" aria-hidden="true" />
              بدون بطاقة ائتمان
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-lime-600" aria-hidden="true" />
              جاهز في أقل من دقيقة
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-lime-600" aria-hidden="true" />
              بلا التزام
            </span>
          </p>
        </div>

        <div className="relative pb-10 lg:col-span-7">
          <DeskShot priority />
          <Frame className="absolute -bottom-2 end-4 aspect-[4/5] w-[30%] max-w-52 shadow-[var(--shadow-float)] ring-4 ring-surface">
            <Photo
              name="handshake"
              alt="مصافحة على طاولة اجتماع فوقها ملف عقد"
              sizes="(min-width: 1024px) 208px, 30vw"
              position="50% 50%"
            />
          </Frame>
          <div className="absolute start-4 -bottom-4 hidden rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-float)] ring-1 ring-line sm:block">
            <p className="text-xs font-semibold text-slate">تجربة مجانية</p>
            <p className="mt-0.5 font-display text-xl text-pine-deep">
              <span className="font-ui font-bold">{TRIAL_DAYS}</span> يومًا بكامل المزايا
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const TRUST = [
  { icon: Languages, title: "عربي أولًا", body: "واجهة من اليمين لليسار، بلغة المكاتب." },
  { icon: LockKeyhole, title: "بيانات معزولة", body: "لا يرى بيانات مكتبك إلا أعضاؤه." },
  { icon: Building2, title: "للشركات والجهات", body: "تحويل بنكي وتفعيل من فريق ديل." },
  { icon: MessageCircle, title: "دعم قريب", body: "فريق سعودي يرد عليك بالواتساب." },
];

export function LawTrust() {
  return (
    <section aria-label="لماذا مكتب المحامي" className="border-y border-line bg-surface">
      <ul className={cn(wrap, "grid grid-cols-2 gap-x-4 gap-y-6 py-8 lg:grid-cols-4")}>
        {TRUST.map((t) => (
          <li key={t.title} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine">
              <t.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-pine-deep">{t.title}</span>
              <span className="mt-1 block text-[13px] leading-snug text-slate">{t.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const NOW = [
  {
    icon: Video,
    title: "استشارات بالفيديو دون تطبيق",
    body: "يدخل العميل من رابط خاص به ويفحص الكاميرا والصوت، ثم ينتظر حتى يسمح له المحامي بالدخول. أو استخدم رابط Zoom أو Meet إن فضّلت.",
  },
  {
    icon: Globe,
    title: "صفحة حجز لمكتبك",
    body: "رابط تشاركه مع عملائك: يختارون نوع الاستشارة والوقت من الأوقات المتاحة فعلًا، وتؤكد أنت الطلب.",
  },
  {
    icon: Users,
    title: "الفريق والصلاحيات",
    body: "ادعُ المحامين والموظفين بالبريد، ولكل عضو صلاحيته: مالك، مدير، محامٍ، أو موظف.",
  },
];

function SectionHead({ eyebrow, title, body, id }: { eyebrow: string; title: string; body?: string; id?: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-4 font-display text-[1.9rem] leading-[1.3] text-pine-deep md:text-[2.6rem] md:leading-[1.25]">
        {title}
      </h2>
      {body ? <p className="mt-4 text-[17px] leading-relaxed text-slate">{body}</p> : null}
    </div>
  );
}

export function LawFeatures() {
  return (
    <section id="features" aria-labelledby="features-h" className="scroll-mt-20 bg-paper py-20 md:py-28">
      <div className={wrap}>
        <SectionHead
          id="features-h"
          eyebrow="المزايا"
          title="كل ما يحتاجه مكتبك في يومه، في مكان واحد."
          body="من حجز الاستشارة إلى إغلاق القضية: العميل، المواعيد، الجلسات، المهام والمستندات، ومكالمة الفيديو نفسها."
        />

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {NOW.map((f) => (
            <li key={f.title} className="rounded-3xl bg-surface p-6 ring-1 ring-line md:p-7">
              <span className="grid size-11 place-items-center rounded-2xl bg-lime text-pine-deep">
                <f.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-pine-deep">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">{f.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-12 flex items-center gap-2 text-sm font-bold text-pine">
          <span className="size-2 rounded-full bg-lime-600 ring-[3px] ring-lime/30" aria-hidden="true" />
          وحدات المكتب
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.id} className="flex flex-col rounded-3xl bg-surface p-6 ring-1 ring-line">
              <span className="grid size-11 place-items-center rounded-2xl bg-pine-50 text-pine">
                <m.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-pine-deep">{m.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">{m.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-pine-deep">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-lime-600" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
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
    <section aria-labelledby="data-h" className="bg-surface py-20 md:py-28">
      <div className={cn(wrap, "grid items-center gap-12 lg:grid-cols-12 lg:gap-16")}>
        <Reveal className="lg:col-span-5">
          <Frame className="aspect-[4/5] max-h-[560px] w-full">
            <Photo name="ops-desk" alt="رجل بشماغ يراجع جواله فوق ملف عمل وحاسوب" sizes="(min-width: 1024px) 460px, 92vw" />
          </Frame>
        </Reveal>
        <div className="lg:col-span-7">
          <SectionHead
            id="data-h"
            eyebrow="بياناتك"
            title="بيانات موكليك لمكتبك وحده."
            body="بنينا عزل المكاتب في أساس النظام، لا كإضافة لاحقة: كل طلب يمر بفحص العضوية والصلاحية قبل أن يصل لأي بيانات."
          />
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[16px] leading-relaxed text-pine-deep">
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-pine text-lime">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate">
            التفاصيل في{" "}
            <a href="/law/terms" className="font-semibold text-pine underline underline-offset-4">
              شروط الاستخدام
            </a>{" "}
            و
            <a href="/privacy#law" className="font-semibold text-pine underline underline-offset-4">
              سياسة الخصوصية
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

export function LawSteps() {
  const steps = [
    { icon: UserPlus, title: "أنشئ حسابك", body: "بريدك وكلمة مرور. لا بطاقة ائتمان." },
    { icon: Building2, title: "عرّفنا بمكتبك", body: "الاسم والمدينة، والسجل التجاري إن رغبت." },
    { icon: Users, title: "ادعُ فريقك", body: `وابدأ تجربة ${TRIAL_DAYS} يومًا بكامل مزايا الخطة الاحترافية.` },
  ];
  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20 bg-paper py-20 md:py-28">
      <div className={wrap}>
        <SectionHead id="how-h" eyebrow="كيف تبدأ" title="ثلاث خطوات، وأقل من دقيقة." />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl bg-surface p-6 ring-1 ring-line md:p-8">
              <span className="font-ui text-5xl leading-none font-extrabold text-pine-100">{`0${i + 1}`}</span>
              <span className="absolute end-6 top-6 grid size-11 place-items-center rounded-2xl bg-pine text-lime md:end-8 md:top-8">
                <s.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-xl font-bold text-pine-deep">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <a href={SIGNUP} className={siteButton("primary", "lg")}>
            {CTA}
            <ArrowLeft className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function LawPricing() {
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-20 bg-surface py-20 md:py-28">
      <div className={wrap}>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHead
            id="pricing-h"
            eyebrow="الأسعار"
            title="خطة لكل حجم مكتب."
            body={`كل مكتب يبدأ بتجربة ${TRIAL_DAYS} يومًا على الخطة الاحترافية، ثم تختار ما يناسبك.`}
          />
          <div role="group" aria-label="دورة الفوترة" className="flex shrink-0 gap-1 self-start rounded-xl bg-paper p-1 ring-1 ring-line md:self-end">
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
                  "h-10 rounded-lg px-4 text-sm font-bold transition-colors",
                  cycle === v ? "bg-surface text-pine-deep shadow-sm ring-1 ring-line" : "text-slate hover:text-pine-deep",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-12 grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => {
            const dark = Boolean(p.highlight);
            return (
              <li
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-3xl p-7 md:p-8",
                  dark ? "on-dark bg-pine-deep text-snow" : "bg-paper ring-1 ring-line",
                )}
              >
                {dark ? (
                  <span className="absolute -top-3 start-7 rounded-full bg-lime px-3 py-0.5 text-xs font-bold text-pine-deep">
                    الأنسب لمعظم المكاتب
                  </span>
                ) : null}
                <h3 className={cn("font-display text-2xl", dark ? "text-snow" : "text-pine-deep")}>{p.name}</h3>
                <p className={cn("mt-1 text-sm", dark ? "text-snow/65" : "text-slate")}>{p.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-ui text-[2.6rem] leading-none font-extrabold tabular-nums">{riyals(p.price[cycle])}</span>
                  <span className={cn("text-sm font-semibold", dark ? "text-snow/65" : "text-slate")}>
                    ر.س / {cycle === "yearly" ? "سنة" : "شهر"}
                  </span>
                </p>
                <p className={cn("mt-1.5 text-xs", dark ? "text-snow/50" : "text-slate")}>
                  {cycle === "yearly" ? `يعادل ${riyals(Math.round(p.price.yearly / 12))} ر.س شهريًا` : "تُدفع شهريًا"} · لا
                  تشمل الضريبة
                </p>
                <div className="mt-7 flex-1">
                  <PlanFeatures plan={p} dark={dark} />
                </div>
                <a href={SIGNUP} className={cn(siteButton(dark ? "primary" : "dark"), "mt-8 w-full")}>
                  ابدأ التجربة المجانية
                </a>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm leading-relaxed text-slate">
          الأسعار بالريال السعودي ولا تشمل ضريبة القيمة المضافة (١٥٪). للجهات الحكومية والشركات: تحويل بنكي وتفعيل من فريق
          ديل —{" "}
          <a
            href={`https://wa.me/${mobile.wa}?text=${encodeURIComponent("أرغب في اشتراك مكتب المحامي لجهتنا")}`}
            className="font-semibold text-pine underline underline-offset-4"
          >
            تواصل معنا
          </a>
          .
        </p>
      </div>
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
    a: "بالتحويل البنكي حاليًا، ويفعّل فريق ديل اشتراكك فور تأكيد وصول المبلغ. والدفع بمدى والبطاقات وApple Pay عبر بوابة دفع سعودية قادم قريبًا.",
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
    a: "تحدد أوقات عملك، وتشارك صفحة الحجز مع عملائك. يحجز العميل وقتًا متاحًا، وبعد تأكيدك يدخل من رابط خاص به من المتصفح دون تطبيق، ويفحص الكاميرا والصوت، ثم ينتظر حتى تسمح له بالدخول. الاستشارات المرئية ضمن الخطة الاحترافية فأعلى، ويمكنك استخدام رابط Zoom أو Google Meet بدلًا منها.",
  },
  {
    q: "أين تُحفظ مستندات المكتب؟",
    a: "في مساحة مكتبك وحده، ولا تُنزّل إلا لأعضائه. يُفحص نوع كل ملف ومحتواه قبل الحفظ، ومساحة التخزين حسب خطتك.",
  },
];

export function LawFaq() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 bg-paper py-20 md:py-28">
      <div className={cn(wrap, "grid gap-10 lg:grid-cols-12")}>
        <div className="lg:col-span-4">
          <SectionHead id="faq-h" eyebrow="أسئلة شائعة" title="قبل أن تبدأ." />
          <p className="mt-4 text-[15px] leading-relaxed text-slate">
            سؤالك غير موجود؟{" "}
            <a href={`https://wa.me/${mobile.wa}`} className="font-semibold text-pine underline underline-offset-4">
              راسلنا واتساب
            </a>
            .
          </p>
        </div>
        <div className="space-y-3 lg:col-span-8">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-surface ring-1 ring-line open:ring-pine/30">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-pine-deep [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pine-50 text-pine transition-transform group-open:rotate-45">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
              </summary>
              <p className="px-5 pb-5 text-[15px] leading-loose text-slate">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LawFinalCta() {
  return (
    <section className="bg-paper pb-20 md:pb-28">
      <div className={wrap}>
        <div className="on-dark relative isolate overflow-hidden rounded-3xl bg-pine-deep px-6 py-12 text-snow md:px-14 md:py-16">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_10%_110%,rgba(194,207,48,0.22),transparent_60%)]" />
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-[1.9rem] leading-snug md:text-[2.6rem]">جهّز مكتبك اليوم.</h2>
              <p className="mt-3 text-[17px] leading-relaxed text-snow/75">
                {TRIAL_DAYS} يومًا مجانًا، بدون بطاقة، وفريق ديل معك إن احتجت.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={SIGNUP} className={siteButton("primary", "lg")}>
                {CTA}
                <ArrowLeft className="size-4" aria-hidden="true" />
              </a>
              <a href={`https://wa.me/${mobile.wa}`} className={siteButton("ghost-dark", "lg")}>
                <MessageCircle className="size-4" aria-hidden="true" />
                تحدث معنا
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
