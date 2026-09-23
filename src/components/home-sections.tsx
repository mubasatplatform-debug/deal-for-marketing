import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  Phone,
  Quote as QuoteIcon,
  ShieldCheck,
} from "lucide-react";
import { ServiceTile } from "@/components/client/service-icon";
import { Reveal } from "@/components/reveal";
import { SocialRow } from "@/components/site-chrome";
import { siteButton, wrap } from "@/components/site-classes";
import { Eyebrow, Frame, Photo } from "@/components/site-ui";
import {
  agency,
  clients,
  lineStarters,
  mobile,
  phone,
  quotes,
  systems,
  works,
} from "@/lib/content";
import { servicePhotos, type PhotoName } from "@/lib/photos";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------ */
/* Product screenshots and portfolio stills under /public/images             */
/* ------------------------------------------------------------------------ */

/** Responsive variants generated under /public/images as `<name>-<w>.avif|webp`, JPEG fallback `<name>.jpg`. */
type Media = { widths: readonly number[]; width: number; height: number };

const SHOT = { widths: [800, 1600, 2400], width: 2400, height: 1380 } as const;
const WIDE = { widths: [800, 1600], width: 1600, height: 900 } as const;
const FOUR_THREE = { widths: [800, 1600], width: 1600, height: 1200 } as const;

const media: Record<string, Media> = {
  "chairman-now": { widths: [400, 800], width: 800, height: 800 },
  "ops-inbox": SHOT,
  "desk-home": SHOT,
  "ops-ai": SHOT,
  "pay-home": SHOT,
  "work-app": { widths: [800, 1200], width: 1200, height: 1600 },
  "work-beat": FOUR_THREE,
  "work-desert": WIDE,
  "work-event": WIDE,
  "work-luxe": WIDE,
  "work-shop": FOUR_THREE,
};

function Pic({
  src,
  alt,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const name = src.replace(/^\/images\//, "").replace(/\.jpg$/, "");
  const m = media[name];
  const img = (
    <img
      src={src}
      alt={alt}
      width={m?.width}
      height={m?.height}
      loading="lazy"
      decoding="async"
      className={cn("block h-full w-full object-cover", className)}
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

/* ------------------------------------------------------------------------ */
/* Shared bits                                                               */
/* ------------------------------------------------------------------------ */

function SectionHead({
  eyebrow,
  title,
  body,
  aside,
  dark,
  id,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  aside?: React.ReactNode;
  dark?: boolean;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        <h2
          id={id}
          className={cn(
            "mt-4 font-display text-[1.9rem] leading-[1.3] md:text-[2.75rem] md:leading-[1.25]",
            dark ? "text-snow" : "text-pine-deep",
          )}
        >
          {title}
        </h2>
        {body ? (
          <p
            className={cn("mt-4 text-[17px] leading-relaxed", dark ? "text-snow/75" : "text-slate")}
          >
            {body}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

/** The Line's own tile (lime play mark on pine), reused in the chat previews. */
function LineTile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-pine text-lime",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5">
        <polygon points="4,2 22,12 4,22" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <polygon points="7.5,7.5 15.5,12 7.5,16.5" fill="currentColor" />
      </svg>
    </span>
  );
}

function Online({ dark }: { dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-bold",
        dark ? "text-lime" : "text-pine",
      )}
    >
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inset-0 rounded-full bg-lime opacity-70 motion-safe:animate-ping" />
        <span className="relative size-2 rounded-full bg-lime ring-1 ring-pine/30" />
      </span>
      متصل
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Hero                                                                      */
/* ------------------------------------------------------------------------ */

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-paper pt-24 pb-16 md:pt-32 md:pb-24">
      <div className={cn(wrap, "grid gap-10 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-0")}>
        <div className="hero-in lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:self-end">
          <Eyebrow>وكالة ديل للتسويق · بريدة، القصيم</Eyebrow>
          <h1 className="mt-6 font-display text-[2.75rem] leading-[1.2] text-pine-deep sm:text-6xl lg:text-[4.4rem] lg:leading-[1.15]">
            حيث يبقى{" "}
            <span className="relative inline-block">
              <span className="relative z-10">التأثير</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-[-0.08em] bottom-[0.12em] h-[0.3em] rounded-[3px] bg-lime"
              />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pine-deep/80 md:text-xl">
            التأثير لا يأتي صدفة… نحن نصنعه. هوية وإنتاج وفعاليات، وأنظمة عملاء ودفع تشتغل لك كل
            يوم.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="/start" className={siteButton("primary", "lg")}>
              اطلب خدمتك
              <ArrowLeft className="size-4" aria-hidden="true" />
            </a>
            <a href="/line" className={siteButton("secondary", "lg")}>
              <LineTile className="size-7 rounded-lg" />
              جرّب خط ديل
            </a>
          </div>
        </div>

        <div className="relative lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:self-center">
          <div className="grid grid-cols-12 gap-3 sm:gap-4">
            <Frame className="col-span-7 aspect-[4/5]">
              <Photo
                name="hero-man"
                alt="شاب سعودي بثوب وشماغ يقف في ممر مضيء"
                sizes="(min-width: 1240px) 400px, (min-width: 1024px) 33vw, 58vw"
                position="50% 18%"
                priority
              />
            </Frame>
            <div className="col-span-5 flex flex-col gap-3 pt-8 sm:gap-4 sm:pt-14">
              <Frame className="aspect-[4/5]">
                <Photo
                  name="hero-woman"
                  alt="موظفة بحجاب تحمل حاسوبها المحمول في مساحة عمل"
                  sizes="(min-width: 1240px) 280px, (min-width: 1024px) 24vw, 42vw"
                  position="50% 22%"
                />
              </Frame>
              <Frame className="aspect-[4/3]">
                <Photo
                  name="ops-desk"
                  alt="رجل بشماغ يراجع جواله فوق ملف عمل وحاسوب"
                  sizes="(min-width: 1240px) 280px, (min-width: 1024px) 24vw, 42vw"
                />
              </Frame>
            </div>
          </div>

          <div className="relative mx-4 -mt-16 rounded-2xl bg-surface p-4 shadow-[var(--shadow-float)] ring-1 ring-line sm:absolute sm:start-6 sm:-bottom-8 sm:mx-0 sm:mt-0 sm:w-[19rem]">
            <div className="flex items-center gap-3">
              <LineTile />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-pine-deep">خط ديل</p>
                <Online />
              </div>
            </div>
            <p className="mt-3 rounded-2xl rounded-ss-md bg-lime-50 px-3.5 py-2.5 text-[14px] leading-relaxed text-pine-deep">
              {lineStarters[0].text}
            </p>
            <p className="mt-2 text-xs text-slate">يرد بلهجتكم، ويحوّل لك إذا احتجت.</p>
          </div>
        </div>

        <ul className="grid gap-3 border-t border-line pt-6 sm:grid-cols-3 sm:gap-4 lg:col-span-6 lg:col-start-1 lg:row-start-2 lg:mt-10 lg:self-start">
          <li className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-50 text-pine">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-pine-deep">ضمان ثلاثين يومًا</span>
              <span className="mt-0.5 block text-[13px] text-slate">إن لم تستفد… لا تدفع</span>
            </span>
          </li>
          <li>
            <a href={`tel:${phone.tel}`} className="group flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine">
                <Phone className="size-5" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] text-slate">اتصال</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block font-ui text-[15px] font-bold text-pine-deep group-hover:underline"
                >
                  {phone.display}
                </span>
              </span>
            </a>
          </li>
          <li>
            <a
              href={`https://wa.me/${mobile.wa}`}
              aria-label={`واتساب ${mobile.display}`}
              className="group flex items-center gap-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine">
                <MessageCircle className="size-5" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] text-slate">واتساب</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block font-ui text-[15px] font-bold text-pine-deep group-hover:underline"
                >
                  {mobile.display}
                </span>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Clients strip                                                             */
/* ------------------------------------------------------------------------ */

export function Clients() {
  return (
    <section id="clients" aria-labelledby="clients-h" className="border-y border-line bg-surface">
      <div className={cn(wrap, "flex flex-col gap-5 py-8 md:flex-row md:items-center md:gap-10")}>
        <h2 id="clients-h" className="shrink-0 text-sm font-bold text-slate">
          علامات نبني معها حضورًا يبقى
        </h2>
        <ul className="grid flex-1 grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-6">
          {clients.map((c) => (
            <li
              key={c}
              dir="ltr"
              lang="en"
              className="text-center font-ui text-[13px] font-extrabold tracking-[0.24em] text-pine-deep/45"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Systems                                                                   */
/* ------------------------------------------------------------------------ */

type SystemRow = {
  id: string;
  slug: string;
  n: string;
  title: string;
  headline: string;
  body: string;
  points: string[];
  screen: string;
  screenAlt: string;
  person: PhotoName;
  personAlt: string;
  personPosition?: string;
  line?: boolean;
};

const systemRows: SystemRow[] = [
  {
    id: "instant",
    slug: "crm",
    n: "01",
    title: "الحل اللحظي",
    headline: "خط العملاء. يرد عنك.",
    body: "كول سنتر وواتساب في غرفة واحدة. الذكاء يسمع الزبون، يراجع ملفه — سدّد أو ما سدّد، الطلب واصل أو باقي — ويرد بلهجتكم. أنت لا تدخل إلا إذا احتاجك.",
    points: [
      "كل زبون: واتسابه، مكالمته، طلبه، فاتورته — في ملف واحد.",
      "ذاكرة البيع: لا دفتر، ولا شات ضائع.",
      "يرد بأسلوب المحل، ويقفل ما اكتمل.",
    ],
    screen: "/images/ops-inbox.jpg",
    screenAlt: "وارد الحل اللحظي — واتساب وملف العميل",
    person: "shopkeeper",
    personAlt: "صاحب محل بزيّ خليجي يقف أمام متجره",
    personPosition: "50% 28%",
    line: true,
  },
  {
    id: "law",
    slug: "law",
    n: "02",
    title: "مكتب المحامي",
    headline: "للمحامين.",
    body: "أبو فيصل من أهل المهنة، لا من هواة التقنية. بنى منصة كهذه قبل أن يطلبها السوق. ديل لا تجرّب على مكتبك — تسلّم نظامًا اكتمل اختباره.",
    points: [
      "ثبوت، حجوزات، CRM، موظفون، وعقود.",
      "من الملف إلى ناجز.",
      "جلسات فيديو من داخل الموقع.",
    ],
    screen: "/images/desk-home.jpg",
    screenAlt: "لوحة تحكم مكتب المحامي",
    person: "handshake",
    personAlt: "مصافحة على طاولة اجتماع فوقها ملف عقد",
  },
  {
    id: "ai",
    slug: "ai",
    n: "03",
    title: "ذكاء سعودي",
    headline: "مو روبوت. نظام سعودي.",
    body: "يتحمل اللهجات، يرد بأسلوب المحل، يفاوت بين الزبائن، ويدير الخط حتى يقفل. ينوب عن موظف آخر السلسلة.",
    points: ["لهجتك وأسلوبك.", "يراجع ملف الزبون قبل ما يرد.", "يحوّل لك إذا احتجت."],
    screen: "/images/ops-ai.jpg",
    screenAlt: "الذكاء يدير خط ديل",
    person: "portrait",
    personAlt: "شاب سعودي بشماغ أحمر ينظر إلى الكاميرا",
    personPosition: "45% 40%",
    line: true,
  },
  {
    id: "pay",
    slug: "pay",
    n: "04",
    title: "الدفع المبسط",
    headline: "الدفع المبسط.",
    body: "من منصة مبسط، على بوابة ادفع باي: رابط، فاتورة إلكترونية، والجوال نقطة بيع. مرخّصة، والتسوية سريعة.",
    points: [
      "رابط دفع وفاتورة إلكترونية.",
      "الجوال نقطة بيع — سوفت POS.",
      "مرخّصة، والتسوية سريعة.",
    ],
    screen: "/images/pay-home.jpg",
    screenAlt: "تحصيل الدفع المبسط",
    person: "pay-qr",
    personAlt: "جوالان متقابلان لإتمام دفع برمز QR",
  },
];

export function Systems() {
  return (
    <section
      id="systems"
      aria-labelledby="systems-h"
      className="scroll-mt-16 bg-surface py-20 md:py-28"
    >
      <div className={wrap}>
        <SectionHead
          id="systems-h"
          eyebrow="الأنظمة"
          title="أنظمة تشتغل عنك، من أول رسالة إلى آخر ريال."
          body="ديل لا تجرّب على عملك: تسلّم نظامًا اكتمل اختباره، بلهجتك وأسلوبك."
        />

        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {systems.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="group flex h-full flex-col rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-pine md:p-5"
              >
                <span className="font-ui text-xs font-bold text-slate">{s.n}</span>
                <span className="mt-2 font-display text-lg text-pine-deep md:text-xl">
                  {s.title}
                </span>
                <span className="mt-1.5 text-[13px] leading-relaxed text-slate md:text-sm">
                  {s.line}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-20 space-y-24 md:mt-28 md:space-y-32">
          {systemRows.map((row, i) => (
            <SystemFeature key={row.id} row={row} flip={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemFeature({ row, flip }: { row: SystemRow; flip: boolean }) {
  return (
    <article
      id={row.id}
      aria-labelledby={`${row.id}-h`}
      className="scroll-mt-24 grid items-center gap-12 lg:grid-cols-12 lg:gap-14"
    >
      <Reveal className={cn("relative pb-10 lg:col-span-7", flip && "lg:order-last")}>
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--shadow-card)]">
          <div className="aspect-[16/10]">
            <Pic
              src={row.screen}
              alt={row.screenAlt}
              sizes="(min-width: 1240px) 680px, (min-width: 1024px) 56vw, 92vw"
              className="object-top"
            />
          </div>
        </div>
        <Frame
          className={cn(
            "absolute bottom-0 aspect-[4/5] w-[30%] max-w-52 shadow-[var(--shadow-float)] ring-4 ring-surface",
            flip ? "start-4" : "end-4",
          )}
        >
          <Photo
            name={row.person}
            alt={row.personAlt}
            sizes="(min-width: 1024px) 208px, 30vw"
            position={row.personPosition}
          />
        </Frame>
      </Reveal>

      <div className="lg:col-span-5">
        <p className="flex items-center gap-3 text-sm font-bold text-pine">
          <span className="font-ui text-slate">{row.n}</span>
          <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-lime" />
          {row.title}
        </p>
        <h3
          id={`${row.id}-h`}
          className="mt-4 font-display text-[1.9rem] leading-[1.3] text-pine-deep md:text-[2.4rem]"
        >
          {row.headline}
        </h3>
        <p className="mt-4 text-[17px] leading-relaxed text-slate">{row.body}</p>
        <ul className="mt-6 space-y-3">
          {row.points.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 text-[15px] leading-relaxed text-pine-deep"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-pine-deep">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href={`/start/${row.slug}`} className={siteButton("dark")}>
            اطلب هذا الحل
            <ArrowLeft className="size-4" aria-hidden="true" />
          </a>
          {row.line ? (
            <a
              href="/line"
              className="inline-flex min-h-11 items-center gap-2 px-2 text-[15px] font-bold text-pine hover:underline"
            >
              جرّب الخط
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------------ */
/* Deal Line + pledge — the page's one dark band                             */
/* ------------------------------------------------------------------------ */

export function DealLineBand() {
  return (
    <section
      id="line"
      aria-labelledby="line-h"
      className="on-dark scroll-mt-16 bg-pine-deep py-20 text-snow md:py-28"
    >
      <div className={cn(wrap, "grid items-center gap-12 lg:grid-cols-12 lg:gap-16")}>
        <div className="lg:col-span-6">
          <Eyebrow dark>خط ديل</Eyebrow>
          <h2
            id="line-h"
            className="mt-4 font-display text-[2.1rem] leading-[1.25] md:text-[3.2rem]"
          >
            خدمة عملاء. بلهجتك.
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-snow/75">
            الخط يأخذ رقم الزبون ويرد عنه: يسمع اللهجة، ياخذ ويعطي، يراجع هل سدّد، هل الطلب واصل، هل
            الموعد ثابت. مو روبوت فصحى — موظف خدمة سعودي، عفوي، ويحوّل لك إذا احتجت.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="/line" className={siteButton("primary", "lg")}>
              اسمع الخط
              <ArrowLeft className="size-4" aria-hidden="true" />
            </a>
            <a
              href={`tel:${phone.tel}`}
              className="inline-flex min-h-12 items-center gap-3 px-1 text-snow hover:text-lime"
            >
              <Phone className="size-5 text-lime" aria-hidden="true" />
              <span dir="ltr" className="font-ui text-2xl font-bold tracking-wide">
                {phone.display}
              </span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-3xl bg-surface p-4 text-pine-deep shadow-[var(--shadow-float)] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <LineTile />
                <div>
                  <p className="text-[15px] font-bold">خط ديل</p>
                  <Online />
                </div>
              </div>
              <span className="rounded-lg bg-pine-50 px-2 py-1 font-ui text-[11px] font-bold tracking-wider text-pine">
                AI
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate">جرّب بداية</p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {lineStarters.map((s) => (
                <li key={s.label}>
                  <a
                    href="/line"
                    className="flex h-full flex-col rounded-2xl border border-line bg-paper p-3.5 transition-colors hover:border-pine"
                  >
                    <span className="text-xs font-bold text-pine">{s.label}</span>
                    <span className="mt-1 text-[14px] leading-relaxed text-pine-deep">
                      {s.text}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={cn(wrap, "mt-16 md:mt-20")}>
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 p-6 sm:flex-row sm:items-center md:p-8">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lime text-pine-deep">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-lime">الضمان الذهبي</p>
            <p className="mt-1 font-display text-2xl leading-snug md:text-3xl">
              ثلاثون يومًا. إن لم تستفد… لا تدفع.
            </p>
          </div>
          <p className="text-[15px] text-snow/60">شرط الشغل. لا شعار.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Agency services                                                           */
/* ------------------------------------------------------------------------ */

export function Services() {
  return (
    <section
      id="services"
      aria-labelledby="services-h"
      className="scroll-mt-16 bg-paper py-20 md:py-28"
    >
      <div className={wrap}>
        <SectionHead
          id="services-h"
          eyebrow="خدمات ديل"
          title="نحوّل الأفكار إلى تجارب إبداعية تصنع تأثيرًا لا يُنسى."
          aside={
            <a href="/start" className={cn(siteButton("secondary"), "self-start md:self-auto")}>
              كل الخدمات
              <ArrowLeft className="size-4" aria-hidden="true" />
            </a>
          }
        />

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          {agency.map((s, i) => {
            const p = servicePhotos[s.slug];
            const big = i === 0;
            return (
              <li key={s.slug} className={cn(big && "lg:row-span-2")}>
                <a
                  href={`/start/${s.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl bg-surface ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-card)]"
                >
                  <div
                    className={cn(
                      "relative overflow-hidden",
                      big ? "aspect-[4/3] lg:aspect-auto lg:min-h-80 lg:flex-1" : "aspect-[16/10]",
                    )}
                  >
                    <Photo
                      name={p.name}
                      alt={p.alt}
                      position={p.position}
                      fill
                      sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
                      className="transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <div className="flex items-center justify-between">
                      <ServiceTile slug={s.slug} />
                      <span className="font-ui text-xs font-bold text-slate">{s.n}</span>
                    </div>
                    <h3 className="mt-4 font-display text-xl text-pine-deep md:text-2xl">
                      {s.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 text-[15px] leading-relaxed text-slate",
                        !big && "line-clamp-3",
                      )}
                    >
                      {s.body}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[15px] font-bold text-pine">
                      اطلب هذه الخدمة
                      <ArrowLeft
                        className="size-4 transition-transform group-hover:-translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* About + how we work                                                       */
/* ------------------------------------------------------------------------ */

const steps = [
  {
    title: "اختر الخدمة",
    body: "من أنظمة العملاء والمحامين والدفع، إلى الهوية والإنتاج والفعاليات.",
  },
  { title: "اكتب احتياجك في دقيقة", body: "يصل طلبك فورًا لفريق ديل برقم مرجعي." },
  {
    title: "يتواصل معك الفريق",
    body: "نتواصل معك على جوالك لفهم التفاصيل، ثم نرسل لك العرض وخطة التنفيذ.",
  },
];

export function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-h"
      className="scroll-mt-16 bg-surface py-20 md:py-28"
    >
      <div className={cn(wrap, "grid items-center gap-14 lg:grid-cols-12 lg:gap-16")}>
        <Reveal className="relative pb-16 lg:col-span-6 lg:pb-20">
          <Frame className="aspect-[4/3]">
            <Photo
              name="najd"
              alt="عمارة نجدية تقليدية من الطين تنعكس في بركة ماء"
              sizes="(min-width: 1240px) 580px, (min-width: 1024px) 48vw, 92vw"
            />
            <span className="absolute top-4 start-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[13px] font-bold text-pine-deep shadow-sm">
              <MapPin className="size-4 text-pine" aria-hidden="true" />
              القصيم — بريدة
            </span>
          </Frame>
          <Frame className="absolute end-0 bottom-0 aspect-[3/2] w-[56%] shadow-[var(--shadow-float)] ring-[6px] ring-surface">
            <Photo
              name="team-talk"
              alt="زميلتان تتحدثان حول جهاز لوحي في جلسة عمل"
              sizes="(min-width: 1024px) 330px, 52vw"
              position="62% 50%"
            />
          </Frame>
        </Reveal>

        <div className="lg:col-span-6">
          <Eyebrow>من نحن</Eyebrow>
          <h2
            id="about-h"
            className="mt-4 font-display text-[1.9rem] leading-[1.3] text-pine-deep md:text-[2.6rem]"
          >
            شريكك في بناء صورة مؤثرة وإدارة حضورك الإعلامي.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-slate">
            في عالم تتسارع فيه الرسائل وتشتد فيه المنافسة تأتي شركة ديل لتكون شريكك المثالي. نحوّل
            الأفكار إلى تجارب إبداعية تصنع تأثيرًا لا يُنسى.
          </p>

          <h3 className="mt-10 text-sm font-bold text-pine">كيف نعمل</h3>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="flex gap-4 rounded-2xl border border-line bg-paper p-4 md:p-5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine-deep font-ui text-sm font-bold text-lime">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[16px] font-bold text-pine-deep">{s.title}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-slate">
                    {s.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <a href="/start" className={cn(siteButton("primary"), "mt-8")}>
            ابدأ طلبك الآن
            <ArrowLeft className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Works                                                                     */
/* ------------------------------------------------------------------------ */

export function Works() {
  const track = useRef<HTMLUListElement>(null);
  // RTL: scrolling "forward" moves the track toward negative scrollLeft.
  const nudge = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: -dir * step, behavior: "smooth" });
  };

  return (
    <section
      id="works"
      aria-labelledby="works-h"
      className="scroll-mt-16 overflow-hidden bg-paper py-20 md:py-28"
    >
      <div className={wrap}>
        <SectionHead
          id="works-h"
          eyebrow="أعمالنا"
          title="أعمال إبداعية وحلول متكاملة تصنع نتائج ملموسة."
          aside={
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                aria-label="الأعمال السابقة"
                onClick={() => nudge(-1)}
                className="grid size-12 place-items-center rounded-xl border border-line-strong bg-surface text-pine-deep hover:border-pine"
              >
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="الأعمال التالية"
                onClick={() => nudge(1)}
                className="grid size-12 place-items-center rounded-xl border border-line-strong bg-surface text-pine-deep hover:border-pine"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
            </div>
          }
        />
      </div>

      <div className={cn(wrap, "mt-10")}>
        <ul
          ref={track}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {works.map((w, idx) => (
            <li
              key={w.image}
              className="work-card w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-[31.5%]"
            >
              <figure>
                <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-pine-100">
                  <Pic
                    src={w.image}
                    alt={w.ar}
                    sizes="(min-width: 1024px) 390px, (min-width: 640px) 46vw, 80vw"
                  />
                </div>
                <figcaption className="mt-4 flex items-start justify-between gap-4">
                  <span>
                    <span className="block font-display text-lg text-pine-deep">{w.ar}</span>
                    <span
                      dir="ltr"
                      lang="en"
                      className="mt-1 block text-end font-ui text-[13px] text-slate"
                    >
                      {w.cats}
                    </span>
                  </span>
                  <span className="font-ui text-xs font-bold text-slate">0{idx + 1}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Leadership + chairman's words                                             */
/* ------------------------------------------------------------------------ */

export function Leadership() {
  const [i, setI] = useState(0);
  const q = quotes[i];

  return (
    <section aria-labelledby="lead-h" className="bg-surface py-20 md:py-28">
      <div className={cn(wrap, "grid items-center gap-14 lg:grid-cols-12 lg:gap-16")}>
        <Reveal className="relative lg:col-span-5">
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-lime sm:translate-x-4 sm:translate-y-4"
          />
          <Frame className="aspect-square">
            <Pic
              src="/images/chairman-now.jpg"
              alt="خالد العنزي أبو فيصل، رئيس مجلس إدارة ديل"
              sizes="(min-width: 1024px) 460px, 92vw"
              className="object-[center_28%]"
            />
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-surface/95 px-4 py-3 shadow-sm">
              <p className="text-[17px] font-bold text-pine-deep">خالد العنزي · أبو فيصل</p>
              <p className="text-[13px] text-slate">رئيس مجلس الإدارة · القصيم — بريدة</p>
            </div>
          </Frame>
        </Reveal>

        <div className="lg:col-span-7">
          <Eyebrow>القيادة</Eyebrow>
          <h2
            id="lead-h"
            className="mt-4 font-display text-[1.9rem] leading-[1.3] text-pine-deep md:text-[2.6rem]"
          >
            رؤية تقود ديل… وتصنع تأثيرًا يبقى.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-slate">
            لا يتسامح مع الخطأ. ولا يهاب الصعب. تاجر · دكتور · محامي — ومعيار يرفع من يعمل معه.
          </p>

          <figure className="mt-8 rounded-3xl border border-line bg-paper p-6 md:p-8">
            <QuoteIcon className="size-8 text-lime-600" aria-hidden="true" />
            <div aria-live="polite">
              <blockquote className="mt-3 text-xl leading-[1.8] font-semibold text-pine-deep md:text-[1.4rem]">
                {q.text}
              </blockquote>
              <figcaption className="mt-4 text-sm font-bold text-pine">— {q.by}</figcaption>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="flex gap-1.5" aria-hidden="true">
                {quotes.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === i ? "w-6 bg-pine" : "w-1.5 bg-line-strong",
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="الكلمة السابقة"
                  onClick={() => setI((n) => (n - 1 + quotes.length) % quotes.length)}
                  className="grid size-11 place-items-center rounded-xl border border-line-strong bg-surface text-pine-deep hover:border-pine"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="الكلمة التالية"
                  onClick={() => setI((n) => (n + 1) % quotes.length)}
                  className="grid size-11 place-items-center rounded-xl border border-line-strong bg-surface text-pine-deep hover:border-pine"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </figure>
          <SocialRow className="mt-6" />
        </div>
      </div>
    </section>
  );
}
