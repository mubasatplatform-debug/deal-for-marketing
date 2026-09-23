import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ArrowLink } from "@/components/arrow-link";
import { LimeWave } from "@/components/lime-wave";
import { Reveal } from "@/components/reveal";
import { SocialRow } from "@/components/site-chrome";
import { agency, clients, phone, quotes, systems, works } from "@/lib/content";
import { cn } from "@/lib/utils";

/** Responsive variants generated under /public/images as `<name>-<w>.avif|webp`, JPEG fallback `<name>.jpg`. */
type Media = { widths: readonly number[]; width: number; height: number };

const SHOT = { widths: [800, 1600, 2400], width: 2400, height: 1380 } as const;
const WIDE = { widths: [800, 1600], width: 1600, height: 900 } as const;
const FOUR_THREE = { widths: [800, 1600], width: 1600, height: 1200 } as const;

const media: Record<string, Media> = {
  hero: { widths: [720, 1008], width: 1008, height: 1792 },
  "chairman-now": { widths: [400, 800], width: 800, height: 800 },
  "ops-inbox": SHOT,
  "desk-home": SHOT,
  "ops-ai": SHOT,
  "pay-home": SHOT,
  service: FOUR_THREE,
  quote: WIDE,
  about: WIDE,
  "work-app": { widths: [800, 1200], width: 1200, height: 1600 },
  "work-beat": FOUR_THREE,
  "work-desert": WIDE,
  "work-event": WIDE,
  "work-luxe": WIDE,
  "work-shop": FOUR_THREE,
};

/** `object-cover` boxes render wider than the viewport on short screens, so sizes follow the cover width. */
const SIZES = {
  full: "100vw",
  clip: "110vw",
  shot: "(min-width: 891px) 100vw, (min-width: 768px) 891px, (min-width: 612px) 100vw, 612px",
  quote: "(min-width: 1300px) 100vw, 1300px",
  about: "(min-width: 1200px) 100vw, (min-width: 768px) 1200px, 970px",
  chairman: "(min-width: 768px) 296px, 232px",
} as const;

function Pic({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const name = src.replace(/^\/images\//, "").replace(/\.jpg$/, "");
  const m = media[name];
  const img = (
    <img
      src={src}
      alt={alt}
      width={m?.width}
      height={m?.height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? undefined : "async"}
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
  if (!m) return img;
  const set = (ext: string) => m.widths.map((w) => `/images/${name}-${w}.${ext} ${w}w`).join(", ");
  return (
    <picture>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      {img}
    </picture>
  );
}

/** Decorative autoplay loops are skipped for reduced motion and Save-Data; the image underneath stays. */
function motionAllowed() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conn?.saveData;
}

function afterLoadIdle(cb: () => void) {
  let idle = 0;
  let timer = 0;
  const run = () => {
    const hasIdle = typeof (window.requestIdleCallback as unknown) === "function";
    if (hasIdle) idle = window.requestIdleCallback(cb, { timeout: 3000 });
    else timer = window.setTimeout(cb, 1500);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    window.removeEventListener("load", run);
    if (idle) window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
  };
}

function LiveVideo({
  src,
  className,
  eager = false,
}: {
  src: string;
  className?: string;
  /** Attach after window load + idle instead of when scrolled near. */
  eager?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!motionAllowed()) return;
    if (eager) return afterLoadIdle(() => setOn(true));
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: "280px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!on) return;
    const v = ref.current;
    if (!v) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const play = () => {
      if (mq.matches) v.pause();
      else v.play().catch(() => undefined);
    };
    play();
    v.addEventListener("canplay", play);
    mq.addEventListener("change", play);
    return () => {
      v.removeEventListener("canplay", play);
      mq.removeEventListener("change", play);
    };
  }, [src, on]);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
      className={className}
    >
      {on ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}

function Marquee() {
  const item = (
    <span className="mx-8 whitespace-nowrap font-display text-5xl text-lime/80 md:text-7xl">
      ديل{" "}
      <span dir="ltr" className="font-ui font-extrabold tracking-tight">
        DEAL
      </span>
      <span className="mx-8 text-snow/20">/</span>
    </span>
  );
  return (
    <div className="overflow-hidden border-y border-hair bg-ink py-6" dir="ltr">
      <div className="marquee-track">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <Pic
      src={src}
      alt={alt}
      sizes={SIZES.shot}
      className="h-[22rem] w-full object-cover object-top md:h-[32rem]"
    />
  );
}

export function Hero() {
  return (
    <section id="top" className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink">
      <Pic
        src="/images/hero.jpg"
        alt=""
        sizes={SIZES.full}
        priority
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      <LiveVideo
        src="/video/hero.mp4"
        eager
        className="live-vid absolute inset-0 h-full w-full object-cover grayscale"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-ink)_38%,transparent)_0%,color-mix(in_oklab,var(--color-ink)_88%,transparent)_70%)]" />

      <div className="hero-in relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-8 text-center">
        <p className="mb-7 flex items-baseline justify-center gap-3 text-lime">
          <span className="font-display text-base">ديل</span>
          <span dir="ltr" className="font-ui text-micro font-semibold tracking-[0.28em]">
            DEAL
          </span>
        </p>
        <h1 className="text-balance font-display text-hero font-semibold text-lime md:text-6xl">
          حيث يبقى <span className="block md:inline">التأثير</span>
        </h1>
        <p className="mt-6 max-w-md text-pretty font-display text-lg leading-relaxed text-snow md:text-xl">
          التأثير لا يأتي صدفة… نحن نصنعه
        </p>
        <p dir="ltr" lang="en" className="mt-3 font-ui text-sm text-mist">
          Impact doesn’t come by chance — we make it.
        </p>

        <div className="mt-12 flex flex-col items-center gap-5">
          <ArrowLink href="/line" className="text-base">
            جرّب خط ديل
          </ArrowLink>
          <ArrowLink href="/start">اطلب خدمتك</ArrowLink>
          <ArrowLink href="#contact">تواصل معنا</ArrowLink>
        </div>
      </div>

      <div
        dir="ltr"
        className="relative z-20 mb-20 flex shrink-0 items-center justify-between px-6 font-ui text-micro tracking-[0.22em] text-snow/70 md:mb-28 md:px-10"
      >
        <span>DEAL FOR MARKETING</span>
        <span>DIGITAL AGENCY</span>
      </div>
      <LimeWave className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 md:h-24" />
    </section>
  );
}

export function Story() {
  return (
    <section className="bg-ink px-6 pt-10 pb-4 md:px-16">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-kicker text-lime">من هنا تبدأ القصة</p>
        <p className="mt-8 font-display text-poster leading-snug text-snow">
          في عالم تتسارع فيه الرسائل وتشتد فيه المنافسة تأتي
        </p>
        <p className="mt-4 font-display text-poster text-snow">
          شركة{" "}
          <span className="underline decoration-lime decoration-2 underline-offset-8">ديل</span>
          <span dir="ltr" className="mx-2 font-ui text-2xl font-extrabold text-lime md:text-3xl">
            DEAL
          </span>{" "}
          لتكون شريكك
        </p>
        <p className="mt-4 font-display text-poster text-snow">
          المثالي في بناء صورة مؤثرة وإدارة حضورك الإعلامي.
        </p>
        <ArrowLink href="#systems" className="mt-10">
          الأنظمة
        </ArrowLink>
      </Reveal>
    </section>
  );
}

export function Systems() {
  return (
    <section id="systems" className="border-y border-hair bg-ink">
      {systems.map((s) => (
        <a
          key={s.href}
          href={s.href}
          className="flex min-h-16 flex-col justify-center gap-2 border-b border-hair px-8 py-6 last:border-b-0 md:flex-row md:items-baseline md:justify-between md:gap-8 md:px-16"
        >
          <span className="font-display text-sm text-lime">{s.n}</span>
          <span className="flex-1 font-display text-2xl text-snow md:text-3xl">{s.title}</span>
          <span className="max-w-md font-display text-sm leading-relaxed text-mist">{s.line}</span>
        </a>
      ))}
    </section>
  );
}

export function Instant() {
  return (
    <section id="instant" className="bg-ink">
      <Shot src="/images/ops-inbox.jpg" alt="وارد الحل اللحظي — واتساب وملف العميل" />

      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الحل اللحظي // 01</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          خط العملاء.
          <br />
          يرد عنك.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          كول سنتر وواتساب في غرفة واحدة. الذكاء يسمع الزبون، يراجع ملفه — سدّد أو ما سدّد، الطلب واصل أو باقي — ويرد بلهجتكم. أنت لا تدخل إلا إذا احتاجك.
        </p>
        <a href={`tel:${phone.tel}`} className="mt-8 inline-block font-ui text-3xl font-semibold text-lime md:text-4xl" dir="ltr">
          {phone.display}
        </a>
        <div className="mt-8">
          <ArrowLink href="/line">جرّب الخط</ArrowLink>
        </div>
      </Reveal>

      <Reveal className="border-y border-hair px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">ملف العميل //</p>
        <h3 className="mt-5 font-display text-poster text-snow">
          ذاكرة البيع.
          <br />
          لا دفتر، ولا شات ضائع.
        </h3>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          كل زبون: واتسابه، مكالمته، طلبه، فاتورته — في ملف واحد. الذكاء يرد بأسلوب المحل، ويقفل ما اكتمل.
        </p>
      </Reveal>

      <Reveal className="px-8 py-16 text-center md:px-16">
        <ArrowLink href="/start/crm">اطلب هذا الحل</ArrowLink>
      </Reveal>
    </section>
  );
}

export function DealLineTeaser() {
  return (
    <section id="line" className="border-y border-hair bg-ink">
      <Reveal className="px-8 py-20 text-center md:px-16">
        <p className="text-kicker text-lime">خط ديل //</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          خدمة عملاء.
          <br />
          بلهجتك.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          الخط يأخذ رقم الزبون ويرد عنه: يسمع اللهجة، ياخذ ويعطي، يراجع هل سدّد، هل الطلب واصل، هل الموعد ثابت. مو روبوت فصحى — موظف خدمة سعودي، عفوي، ويحوّل لك إذا احتجت.
        </p>
        <ArrowLink href="/line" className="mt-10">
          اسمع الخط
        </ArrowLink>
      </Reveal>
    </section>
  );
}

export function Lawyers() {
  return (
    <section id="law" className="bg-ink">
      <Shot src="/images/desk-home.jpg" alt="لوحة تحكم مكتب المحامي" />

      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الأنشطة المهنية // 01</p>
        <h2 className="mt-5 font-display text-poster text-snow">للمحامين.</h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          أبو فيصل من أهل المهنة، لا من هواة التقنية. بنى منصة كهذه قبل أن يطلبها السوق. ديل لا تجرّب على مكتبك — تسلّم نظامًا اكتمل اختباره.
        </p>
      </Reveal>
      <Reveal className="px-8 py-16 text-center md:px-16">
        <ArrowLink href="/start/law">اطلب هذا الحل</ArrowLink>
      </Reveal>
    </section>
  );
}

export function AiUse() {
  return (
    <section id="ai" className="bg-ink">
      <Shot src="/images/ops-ai.jpg" alt="الذكاء يدير خط ديل" />

      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الأنشطة المهنية // 03</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          مو روبوت.
          <br />
          نظام سعودي.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          يتحمل اللهجات، يرد بأسلوب المحل، يفاوت بين الزبائن، ويدير الخط حتى يقفل. ينوب عن موظف آخر السلسلة.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <ArrowLink href="/line">جرّب خط ديل</ArrowLink>
          <ArrowLink href="/start/ai">اطلب هذا الحل</ArrowLink>
        </div>
      </Reveal>
    </section>
  );
}

export function Pay() {
  return (
    <section id="pay" className="bg-ink">
      <Shot src="/images/pay-home.jpg" alt="تحصيل الدفع المبسط" />
      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">التحصيل // 04</p>
        <h2 className="mt-5 font-display text-poster text-snow">الدفع المبسط.</h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          من منصة مبسط، على بوابة ادفع باي: رابط، فاتورة إلكترونية، والجوال نقطة بيع. مرخّصة، والتسوية سريعة.
        </p>
      </Reveal>
      <Reveal className="px-8 py-16 text-center md:px-16">
        <ArrowLink href="/start/pay">اطلب هذا الحل</ArrowLink>
      </Reveal>
    </section>
  );
}

export function Pledge() {
  return (
    <section className="border-y border-hair bg-ink px-8 py-20 text-center md:px-16">
      <p className="text-kicker text-lime">الضمان الذهبي //</p>
      <h2 className="mt-5 font-display text-poster text-snow">
        ثلاثون يومًا.
        <br />
        إن لم تستفد… لا تدفع.
      </h2>
      <p className="mx-auto mt-6 max-w-lg text-pretty leading-loose text-mist">
        شرط الشغل. لا شعار.
      </p>
    </section>
  );
}

export function Services() {
  const [i, setI] = useState(0);
  const s = agency[i];

  return (
    <section id="services" className="bg-ink pb-8">
      <Reveal kind="clip-in" className="relative">
        <Pic
          src="/images/service.jpg"
          alt=""
          sizes={SIZES.clip}
          className="h-72 w-full object-cover grayscale md:h-[28rem]"
        />
        <button
          type="button"
          aria-label="الخدمة التالية"
          onClick={() => setI((n) => (n + 1) % agency.length)}
          className="absolute start-0 bottom-0 flex size-16 items-center justify-center bg-lime text-ink md:size-20"
        >
          <ArrowLeft className="size-8" strokeWidth={1.7} aria-hidden="true" />
        </button>
      </Reveal>

      <Reveal className="px-8 pt-10 text-center md:px-16">
        <div aria-live="polite">
          <div className="flex items-baseline justify-center gap-4">
            <h2 className="font-display text-2xl text-snow md:text-4xl">{s.title}</h2>
            <span className="font-display text-sm text-lime">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-loose text-mist">{s.body}</p>
        </div>
        <div className="mt-8 flex justify-center gap-2">
          {agency.map((item, idx) => (
            <button
              key={item.slug}
              type="button"
              aria-label={item.title}
              aria-current={idx === i ? "true" : undefined}
              onClick={() => setI(idx)}
              className="flex h-11 w-8 items-center justify-center"
            >
              <span className={cn("h-1 w-6", idx === i ? "bg-lime" : "bg-hair")} />
            </button>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function About() {
  return (
    <section id="about" className="relative isolate mt-10 min-h-[34rem] overflow-hidden md:min-h-[42rem]">
      <Pic
        src="/images/about.jpg"
        alt=""
        sizes={SIZES.about}
        className="live-vid absolute inset-0 h-full w-full object-cover grayscale"
      />
      <LiveVideo
        src="/video/about.mp4"
        className="live-vid absolute inset-0 h-full w-full object-cover grayscale"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,color-mix(in_oklab,var(--color-ink)_48%,transparent)_0%,color-mix(in_oklab,var(--color-ink)_86%,transparent)_68%)]" />
      <Reveal className="relative z-10 flex min-h-[34rem] flex-col justify-center px-8 py-20 pb-28 md:min-h-[42rem] md:px-16">
        <p className="text-kicker text-lime">من نحن //</p>
        <h2 className="mt-6 max-w-xl font-display text-poster leading-snug text-snow md:text-5xl">
          نحوّل الأفكار إلى
          <br />
          تجارب إبداعية
          <br />
          تصنع تأثيرًا لا
          <br />
          يُنسى.
        </h2>
        <ArrowLink href="#services" className="mt-10">
          اكتشف خدماتنا
        </ArrowLink>
      </Reveal>
      <LimeWave className="absolute inset-x-0 bottom-0 z-10 h-24" />
    </section>
  );
}

export function Works() {
  return (
    <section id="works" className="bg-ink pt-16 pb-4">
      <Reveal className="px-8 text-center md:px-16">
        <p className="text-kicker text-lime">أعمالنا //</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          أعمال إبداعية وحلول
          <br />
          متكاملة
        </h2>
        <p className="mt-4 font-display text-2xl text-snow">تصنع نتائج ملموسة.</p>
        <p dir="ltr" lang="en" className="mt-2 font-ui text-sm text-mist">
          Creative work. Measurable impact.
        </p>
      </Reveal>

      <div className="mt-12">
        {works.map((w, idx) => (
          <article key={w.title} className="work-card">
            <Reveal kind="clip-in">
              <Pic
                src={w.image}
                alt={w.ar}
                sizes={SIZES.clip}
                className="h-72 w-full object-cover grayscale md:h-[30rem]"
              />
            </Reveal>
            <div className="relative bg-card px-8 py-10 text-center">
              <span className="absolute top-6 end-6 font-ui text-xs tracking-widest text-lime">0{idx + 1}</span>
              <h3 className="font-display text-2xl text-snow md:text-3xl">{w.ar}</h3>
              <p dir="ltr" lang="en" className="mt-3 font-ui text-lg text-snow/90">
                {w.title}
              </p>
              <p dir="ltr" lang="en" className="mt-2 font-ui text-sm text-mist">
                {w.cats}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Clients() {
  return (
    <>
      <Marquee />
      <section id="clients" className="bg-ink px-8 py-16 md:px-16">
        <Reveal className="text-center">
          <p className="text-kicker text-lime">عملاؤنا //</p>
          <p className="mt-4 font-display text-xl text-mist">علامات نبني معها حضورًا يبقى.</p>
          <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-px bg-hair sm:grid-cols-3">
            {clients.map((c) => (
              <li key={c} dir="ltr" lang="en" className="bg-ink py-8 font-ui text-sm tracking-[0.28em] text-mist">
                {c}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    </>
  );
}

export function Leadership() {
  return (
    <section className="bg-ink px-8 pt-8 pb-16 text-center md:px-16">
      <Reveal>
        <p className="text-kicker text-lime">القيادة //</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          رؤية تقود ديل…
          <br />
          وتصنع تأثيرًا يبقى.
        </h2>
        <ArrowLink href="#about" className="mt-8">
          تعرف علينا
        </ArrowLink>
      </Reveal>

      <Reveal className="mx-auto mt-14 max-w-sm">
        <div className="relative mx-auto size-64 md:size-80">
          <span className="absolute inset-0 rounded-full bg-lime" />
          <Pic
            src="/images/chairman-now.jpg"
            alt="خالد العنزي أبو فيصل، رئيس مجلس إدارة ديل"
            sizes={SIZES.chairman}
            className="absolute inset-3 rounded-full object-cover object-[center_28%]"
          />
        </div>
        <h3 className="mt-8 font-display text-2xl text-snow">خالد العنزي</h3>
        <p className="mt-1 font-display text-lg text-lime">أبو فيصل</p>
        <p className="mt-2 font-display text-sm text-mist">رئيس مجلس الإدارة</p>
        <p className="mt-1 text-sm text-dim">القصيم — بريدة</p>
        <p className="mx-auto mt-6 max-w-xs font-display text-base leading-loose text-snow/80">
          لا يتسامح مع الخطأ. ولا يهاب الصعب.
          <br />
          تاجر · دكتور · محامي
          <br />
          ومعيار يرفع من يعمل معه.
        </p>
        <SocialRow className="mt-6 justify-center" />
      </Reveal>
    </section>
  );
}

export function Quote() {
  const [i, setI] = useState(0);
  const q = quotes[i];

  return (
    <section className="relative isolate overflow-hidden py-24">
      <Pic src="/images/quote.jpg" alt="" sizes={SIZES.quote} className="absolute inset-0 h-full w-full object-cover grayscale" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-ink)_62%,transparent)_0%,color-mix(in_oklab,var(--color-ink)_90%,transparent)_75%)]" />
      <Reveal className="relative z-10 px-8 pb-28 text-center md:px-16">
        <p className="text-kicker text-lime">كلمة رئيس مجلس الإدارة //</p>
        <div aria-live="polite">
          <blockquote className="mx-auto mt-8 max-w-2xl font-display text-2xl leading-relaxed text-snow md:text-3xl">
            «{q.text}»
          </blockquote>
          <p className="mt-8 font-display text-lime">— {q.by}</p>
        </div>
        <div className="mt-10 flex items-center justify-center gap-6 text-mist">
          <button
            type="button"
            aria-label="السابق"
            onClick={() => setI((n) => (n - 1 + quotes.length) % quotes.length)}
            className="size-10 text-snow hover:text-lime"
          >
            →
          </button>
          <button
            type="button"
            aria-label="التالي"
            onClick={() => setI((n) => (n + 1) % quotes.length)}
            className="size-10 text-snow hover:text-lime"
          >
            ←
          </button>
        </div>
      </Reveal>
      <LimeWave className="absolute inset-x-0 bottom-0 z-10 h-24" />
    </section>
  );
}

export function Footer() {
  return (
    <footer id="contact" className="bg-ink px-8 pt-20 pb-12 md:px-16">
      <Reveal>
        <a
          href="mailto:info@dealadv.sa"
          className="block text-center font-ui text-3xl font-semibold text-lime md:text-5xl"
          dir="ltr"
        >
          info@dealadv.sa
        </a>

        <div className="mt-14 space-y-8 text-start">
          <div>
            <p className="text-sm text-dim">هاتف</p>
            <a href={`tel:${phone.tel}`} className="mt-2 inline-flex items-center gap-2 text-lg text-snow" dir="ltr">
              {phone.display}
              <span className="text-lime">•</span>
            </a>
            <a href={phone.wa} className="mt-2 block text-sm text-lime">
              واتساب مباشر
            </a>
          </div>
          <div>
            <p className="text-sm text-dim">العنوان</p>
            <p className="mt-2 leading-relaxed text-lime">
              القصيم، بريدة
              <br />
              المملكة العربية السعودية
            </p>
          </div>
        </div>

        <ul className="mt-14 space-y-3 text-start text-mist">
          <li>
            <a href="#top" className="hover:text-lime">
              • الرئيسية
            </a>
          </li>
          <li>
            <a href="/line" className="hover:text-lime">
              • خط ديل
            </a>
          </li>
          <li>
            <a href="#instant" className="hover:text-lime">
              • الحل اللحظي
            </a>
          </li>
          <li>
            <a href="#works" className="hover:text-lime">
              • أعمالنا
            </a>
          </li>
          <li>
            <a href="#clients" className="hover:text-lime">
              • عملاؤنا
            </a>
          </li>
          <li>
            <a href="#about" className="hover:text-lime">
              • من نحن
            </a>
          </li>
          <li>
            <a href="#contact" className="hover:text-lime">
              • تواصل معنا
            </a>
          </li>
          <li>
            <a href="/privacy" className="hover:text-lime">
              • سياسة الخصوصية
            </a>
          </li>
        </ul>

        <div className="mt-12 flex items-end justify-between">
          <SocialRow />
          <p dir="ltr" className="font-ui text-xs text-dim">
            Copyright © 2026
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
