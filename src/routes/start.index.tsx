import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { ServiceCard } from "@/components/service-card";
import { SiteChrome } from "@/components/site-chrome";
import { wrap } from "@/components/site-classes";
import { Eyebrow, Frame, Photo } from "@/components/site-ui";
import { pageHead } from "@/lib/seo";
import { phone, services } from "@/lib/content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/start/")({
  head: () =>
    pageHead({
      title: "اطلب خدمتك",
      description:
        "اختر خدمتك من ديل — أنظمة العملاء والمحامين والدفع، والهوية والإنتاج والفعاليات — وأرسل طلبك مباشرة للفريق.",
      path: "/start",
    }),
  component: Start,
});

const professions = new Set(["law", "ai"]);

const steps = ["اختر الخدمة", "اكتب احتياجك في دقيقة", "يتواصل معك الفريق"];

function Start() {
  const professional = services.filter((s) => professions.has(s.slug));
  const agency = services.filter((s) => !professions.has(s.slug));

  return (
    <SiteChrome>
      <main className="bg-paper">
        <section className="pt-24 pb-14 md:pt-32 md:pb-20">
          <div className={cn(wrap, "grid items-center gap-10 lg:grid-cols-12 lg:gap-14")}>
            <div className="lg:col-span-6">
              <Eyebrow>اطلب خدمتك</Eyebrow>
              <h1 className="mt-5 font-display text-[2.4rem] leading-[1.25] text-pine-deep md:text-[3.4rem]">
                العميل يدخل…
                <br />
                ويأخذ الخدمة بنفسه.
              </h1>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-slate">
                اختر الخدمة، اكتب احتياجك، ونبدأ التنفيذ. بدون انتظار نموذج عام — طلبك يصل مباشرة
                لفريق ديل.
              </p>
              <ol className="mt-8 grid gap-3 sm:grid-cols-3">
                {steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pine-deep font-ui text-xs font-bold text-lime">
                      {i + 1}
                    </span>
                    <span className="text-[15px] font-semibold text-pine-deep">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative lg:col-span-6">
              <Frame className="aspect-[4/3]">
                <Photo
                  name="portrait"
                  alt="شاب سعودي بشماغ أحمر ينظر إلى الكاميرا"
                  sizes="(min-width: 1240px) 580px, (min-width: 1024px) 48vw, 92vw"
                  position="45% 35%"
                  priority
                />
              </Frame>
              <a
                href={`tel:${phone.tel}`}
                className="relative mx-4 -mt-10 flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-float)] ring-1 ring-line sm:absolute sm:start-6 sm:-bottom-8 sm:mx-0 sm:mt-0"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-pine-deep">
                  <Phone className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[13px] text-slate">تفضّل الحديث مباشرة؟</span>
                  <span
                    dir="ltr"
                    className="block text-end font-ui text-lg font-bold text-pine-deep"
                  >
                    {phone.display}
                  </span>
                </span>
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="pro-h" className="border-t border-line bg-surface py-16 md:py-20">
          <div className={wrap}>
            <Eyebrow>الأنشطة المهنية</Eyebrow>
            <h2 id="pro-h" className="mt-4 font-display text-[1.8rem] text-pine-deep md:text-4xl">
              أنظمة للمهن
            </h2>
            <ul className="mt-8 grid gap-4 lg:grid-cols-2">
              {professional.map((s) => (
                <ServiceCard key={s.slug} s={s} />
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="agency-h" className="py-16 md:py-20">
          <div className={wrap}>
            <Eyebrow>خدمات ديل</Eyebrow>
            <h2
              id="agency-h"
              className="mt-4 font-display text-[1.8rem] text-pine-deep md:text-4xl"
            >
              حلول وخدمات إبداعية
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agency.map((s, i) => {
                const wide = i === 0 || i === agency.length - 1;
                return (
                  <ServiceCard
                    key={s.slug}
                    s={s}
                    wide={wide}
                    className={cn(wide && "lg:col-span-2")}
                  />
                );
              })}
            </ul>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
