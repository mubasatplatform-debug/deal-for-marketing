import { useEffect, useRef, useState } from "react";
import { ArrowLink } from "@/components/arrow-link";
import { LimeWave } from "@/components/lime-wave";
import { Reveal } from "@/components/reveal";
import { SocialRow } from "@/components/site-chrome";
import { clients, heroSlides, lawShots, phone, quotes, services, works } from "@/lib/content";
import { cn } from "@/lib/utils";

function LiveVideo({
  src,
  poster,
  className,
  eager = false,
}: {
  src: string;
  poster: string;
  className?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(eager);

  useEffect(() => {
    if (eager) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setOn(true);
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
    const play = () => {
      v.play().catch(() => undefined);
    };
    play();
    v.addEventListener("canplay", play);
    return () => v.removeEventListener("canplay", play);
  }, [src, on]);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      poster={poster}
      className={className}
    >
      {on ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}

function Marquee() {
  const item = (
    <span className="mx-8 whitespace-nowrap font-display text-5xl text-lime/80 md:text-7xl">
      ديل <span dir="ltr" className="font-ui font-extrabold tracking-tight">DEAL</span>
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

export function Hero() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % heroSlides.length), 12000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section id="top" className="relative isolate min-h-dvh overflow-hidden bg-ink">
      <img
        src={heroSlides[i].poster}
        alt=""
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      <LiveVideo
        key={heroSlides[i].src}
        src={heroSlides[i].src}
        poster={heroSlides[i].poster}
        eager
        className="live-vid absolute inset-0 h-full w-full object-cover grayscale"
      />
      <div className="absolute inset-0 bg-ink/70" />

      <div className="hero-in relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 pt-20 pb-28 text-center">
        <p className="mb-5 flex items-baseline gap-3 font-ui text-micro tracking-[0.35em] text-lime">
          <span className="font-display text-base tracking-normal">ديل</span>
          <span dir="ltr">DEAL</span>
        </p>
        <h1 className="font-display text-hero text-lime md:text-5xl">حيـــــث يبقـــــي التـــــاثير</h1>
        <p className="mt-4 max-w-md font-display text-lg text-snow md:text-2xl">
          التـــأثير لا ياتــي صدفــــة … نحــــن نصنعــــة
        </p>
        <p dir="ltr" className="mt-3 font-slab text-sm text-mist md:text-base">
          Impact doesn’t come by chance … we make it.
        </p>

        <div className="pointer-events-none relative mt-10 w-full max-w-lg overflow-hidden">
          <p className="lime-pulse font-display text-5xl leading-none text-lime/80 md:text-7xl">حيث يبقي التأثير</p>
          <p
            dir="ltr"
            className="float-script absolute inset-x-0 top-8 font-script text-4xl text-snow/90 md:top-12 md:text-6xl"
          >
            Where Impact Stays
          </p>
        </div>

        <div className="relative z-10 mt-16 flex flex-col items-center gap-4">
          <ArrowLink href="/start">اطلب خدمتك</ArrowLink>
          <ArrowLink href="#contact">تواصل معنا</ArrowLink>
        </div>
      </div>

      <div
        dir="ltr"
        className="absolute inset-x-0 bottom-28 z-10 flex items-end justify-between px-6 font-ui text-micro tracking-[0.28em] text-snow/80 md:px-10"
      >
        <span className="flex gap-3">
          <button type="button" onClick={() => setI((n) => (n + 1) % heroSlides.length)} className="hover:text-lime">
            NEXT
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={() => setI((n) => (n - 1 + heroSlides.length) % heroSlides.length)}
            className="hover:text-lime"
          >
            PREV
          </button>
        </span>
        <span>DIGITAL AGENCY</span>
      </div>

      <LimeWave className="absolute inset-x-0 bottom-0 z-10 h-28 md:h-36" />
    </section>
  );
}

export function Story() {
  return (
    <section className="bg-ink px-6 pt-10 pb-4 md:px-16">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-kicker text-lime">من هنـا تبـدا القصـة</p>
        <p className="mt-8 font-display text-poster leading-relaxed text-snow">
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
        <ArrowLink href="#instant" className="mt-10">
          الحل اللحظي
        </ArrowLink>
      </Reveal>
    </section>
  );
}

export function Instant() {
  return (
    <section id="instant" className="bg-ink">
      <div className="grid md:grid-cols-2">
        <div className="relative min-h-[22rem] overflow-hidden md:min-h-[34rem]">
          <LiveVideo
            src="/video/instant.mp4"
            poster="/images/instant.jpg"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <Reveal kind="clip-in" className="relative min-h-[22rem] overflow-hidden md:min-h-[34rem]">
          <img src="/images/instant-phone.jpg" alt="نظام ديل للواتساب والـ CRM" className="absolute inset-0 h-full w-full object-cover" />
        </Reveal>
      </div>

      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الحل اللحظي // 01</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          نعطيك السلوشن
          <br />
          لحظــي.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          نظام CRM متكامل مع واتساب وكول سنتر. رقم جوال واحد، رد فوري، وكل المحادثات في شاشة واحدة. النظام سريع — والحل يُسلَّم لحظيًا.
        </p>
        <a href={`tel:${phone.tel}`} className="mt-8 inline-block font-ui text-3xl font-semibold text-lime md:text-4xl" dir="ltr">
          {phone.display}
        </a>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={phone.wa}
            className="inline-flex h-12 min-w-40 items-center justify-center border border-lime bg-lime px-6 font-display text-ink"
          >
            واتساب الآن
          </a>
          <a
            href={`tel:${phone.tel}`}
            className="inline-flex h-12 min-w-40 items-center justify-center border border-lime px-6 font-display text-lime"
          >
            اتصال مباشر
          </a>
        </div>
        <ArrowLink href="/start/crm" className="mt-8">
          اطلب هذا الحل
        </ArrowLink>
      </Reveal>
    </section>
  );
}

function ShotCycle({
  items,
}: {
  items: readonly { image: string; n: string; title: string }[];
}) {
  const [i, setI] = useState(0);
  const s = items[i];
  return (
    <div>
      <Reveal kind="clip-in" className="relative">
        <img src={s.image} alt={s.title} className="h-72 w-full object-cover md:h-[28rem]" />
        <button
          type="button"
          aria-label="التالي"
          onClick={() => setI((n) => (n + 1) % items.length)}
          className="absolute right-0 bottom-0 flex size-16 items-center justify-center bg-lime text-ink md:size-20"
        >
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 14l5-5 4 4 7-8" />
            <path d="M14 5h6v6" />
          </svg>
        </button>
      </Reveal>
      <Reveal className="px-8 pt-10 text-center md:px-16">
        <div className="flex items-baseline justify-center gap-4">
          <h3 className="font-display text-2xl text-snow md:text-4xl">{s.title}</h3>
          <span className="font-display text-sm text-lime">{s.n}</span>
        </div>
        <div className="mt-8 flex justify-center gap-2">
          {items.map((item, idx) => (
            <button
              key={item.n}
              type="button"
              aria-label={item.title}
              onClick={() => setI(idx)}
              className={cn("h-1 w-6", idx === i ? "bg-lime" : "bg-hair")}
            />
          ))}
        </div>
      </Reveal>
    </div>
  );
}

export function Lawyers() {
  return (
    <section id="law" className="bg-ink">
      <div className="grid md:grid-cols-2">
        <div className="relative min-h-[22rem] overflow-hidden md:min-h-[34rem]">
          <LiveVideo
            src="/video/law.mp4"
            poster="/images/law.jpg"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <Reveal kind="clip-in" className="relative min-h-[22rem] overflow-hidden md:min-h-[34rem]">
          <img src="/images/law-phone.jpg" alt="واجهة مكتب المحامي" className="absolute inset-0 h-full w-full object-cover" />
        </Reveal>
      </div>

      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الأنشطة المهنية // 01</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          للمحاميـــن.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          موقع وصفحة ثبوت، حجوزات، عملاء، موظفين، عقود، قضايا، وجلسات فيديو من داخل موقعك. نظام واحد للمكتب.
        </p>
        <ArrowLink href="/start/law" className="mt-8">
          اطلب هذا الحل
        </ArrowLink>
      </Reveal>

      <ShotCycle items={lawShots} />
    </section>
  );
}

export function AiUse() {
  return (
    <section id="ai" className="bg-ink">
      <div className="grid md:grid-cols-2">
        <div className="relative min-h-[22rem] overflow-hidden md:min-h-[34rem]">
          <LiveVideo
            src="/video/ai.mp4"
            poster="/images/ai.jpg"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <Reveal kind="clip-in" className="relative min-h-[22rem] overflow-hidden md:min-h-[34rem]">
          <img src="/images/ai-phone.jpg" alt="واجهة الذكاء الاصطناعي" className="absolute inset-0 h-full w-full object-cover" />
        </Reveal>
      </div>

      <Reveal className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الأنشطة المهنية // 02</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          مو روبوت.
          <br />
          نظام سعودي.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty leading-loose text-mist">
          يتحمل اللهجات، يرد بأسلوبك، يفاوت بين العملاء، يوجّه المحادثات، ويدير التيك توك والمنصات. ينوب عن الموظف في آخر الخط.
        </p>
        <ArrowLink href="/start/ai" className="mt-8">
          اطلب هذا الحل
        </ArrowLink>
      </Reveal>
    </section>
  );
}


export function Services() {
  const [i, setI] = useState(0);
  const s = services[i];

  return (
    <section id="services" className="bg-ink pb-8">
      <Reveal kind="clip-in" className="relative">
        <img
          src={i === 0 ? "/images/instant.jpg" : "/images/service.jpg"}
          alt=""
          className={cn("h-72 w-full object-cover md:h-[28rem]", i !== 0 && "grayscale")}
        />
        <button
          type="button"
          aria-label="الخدمة التالية"
          onClick={() => setI((n) => (n + 1) % services.length)}
          className="absolute right-0 bottom-0 flex size-16 items-center justify-center bg-lime text-ink md:size-20"
        >
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 14l5-5 4 4 7-8" />
            <path d="M14 5h6v6" />
          </svg>
        </button>
      </Reveal>

      <Reveal className="px-8 pt-10 text-center md:px-16">
        <div className="flex items-baseline justify-center gap-4">
          <h2 className="font-display text-2xl text-snow md:text-4xl">{s.title}</h2>
          <span className="font-ui text-sm tracking-widest text-lime">{s.n}</span>
        </div>
        <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-loose text-mist">{s.body}</p>
        <div className="mt-8 flex justify-center gap-2">
          {services.map((item, idx) => (
            <button
              key={item.n}
              type="button"
              aria-label={item.title}
              onClick={() => setI(idx)}
              className={cn("h-1 w-6 transition-colors", idx === i ? "bg-lime" : "bg-hair")}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function About() {
  return (
    <section id="about" className="relative isolate mt-10 min-h-[34rem] overflow-hidden md:min-h-[42rem]">
      <LiveVideo
        src="/video/about.mp4"
        poster="/images/about.jpg"
        className="live-vid absolute inset-0 h-full w-full object-cover grayscale"
      />
      <div className="absolute inset-0 bg-ink/55" />
      <Reveal className="relative z-10 flex min-h-[34rem] flex-col justify-center px-8 py-20 md:min-h-[42rem] md:px-16">
        <p className="text-kicker text-lime">من نحــن //</p>
        <h2 className="mt-6 max-w-xl font-display text-poster text-snow md:text-5xl">
          نحوّل الأفكار إلى
          <br />
          تجارب إبــداعية
          <br />
          تصنع تـــأثيرًا لا
          <br />
          يُنســـى.
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
        <p className="text-kicker text-lime">أعمالنـــا //</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          أعمــال إبداعيـــة وحلـــول
          <br />
          متكاملــة
        </h2>
        <p className="mt-4 font-display text-2xl text-snow">تصنـــع نتائـــج ملموســـة.</p>
        <p dir="ltr" className="mt-2 font-slab text-sm text-mist">
          Creative work. Measurable impact.
        </p>
      </Reveal>

      <div className="mt-12">
        {works.map((w, idx) => (
          <article key={w.title} className="work-card">
            <Reveal kind="clip-in">
              <img src={w.image} alt={w.ar} className="h-72 w-full object-cover grayscale md:h-[30rem]" />
            </Reveal>
            <div className="relative bg-card px-8 py-10 text-center">
              <span className="absolute top-6 left-6 font-ui text-xs tracking-widest text-lime">
                0{idx + 1}
              </span>
              <h3 className="font-display text-2xl text-snow md:text-3xl">{w.ar}</h3>
              <p dir="ltr" className="mt-3 font-slab text-lg text-snow/90">
                {w.title}
              </p>
              <p dir="ltr" className="mt-2 font-ui text-sm text-mist">
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
          <p className="text-kicker text-lime">عملاؤنـــا //</p>
          <p className="mt-4 font-display text-xl text-mist">علامات نبني معها حضورًا يبقى.</p>
          <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-px bg-hair sm:grid-cols-3">
            {clients.map((c) => (
              <li key={c} dir="ltr" className="bg-ink py-8 font-ui text-sm tracking-[0.28em] text-mist">
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
        <p className="text-kicker text-lime">القيــادة //</p>
        <h2 className="mt-5 font-display text-poster text-snow">
          رؤية تقــود ديــــل…
          <br />
          وتصنــع تأثيـــرًا يبقـــى.
        </h2>
        <ArrowLink href="#about" className="mt-8">
          تعرف علينا
        </ArrowLink>
      </Reveal>

      <Reveal className="mx-auto mt-14 max-w-sm">
        <div className="relative mx-auto size-64 md:size-80">
          <span className="lime-pulse absolute inset-0 rounded-full bg-lime" />
          <img
            src="/images/chairman-now.jpg"
            alt="خالد العنزي أبو فيصل، رئيس مجلس إدارة ديل"
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
      <img src="/images/quote.jpg" alt="" className="absolute inset-0 h-full w-full object-cover grayscale" />
      <div className="absolute inset-0 bg-ink/70" />
      <Reveal className="relative z-10 px-8 text-center md:px-16">
        <p className="text-kicker text-lime">كلمة رئيس مجلس الإدارة //</p>
        <blockquote className="mx-auto mt-8 max-w-2xl font-display text-2xl leading-relaxed text-snow md:text-3xl">
          «{q.text}»
        </blockquote>
        <p className="mt-8 font-display text-lime">— {q.by}</p>
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

        <div className="mt-14 space-y-8 text-right">
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

        <ul className="mt-14 space-y-3 text-right text-mist">
          <li>
            <a href="#top" className="hover:text-lime">
              • الرئيسية
            </a>
          </li>
          <li>
            <a href="#instant" className="hover:text-lime">
              • الحل اللحظي
            </a>
          </li>
          <li>
            <a href="#works" className="hover:text-lime">
              • اعمالنا
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
