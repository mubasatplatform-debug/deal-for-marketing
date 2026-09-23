import { ArrowLeft } from "lucide-react";
import { SiteChrome } from "@/components/site-chrome";
import { siteButton } from "@/components/site-classes";
import { Frame, Photo } from "@/components/site-ui";
import { cn } from "@/lib/utils";

export function NotFound() {
  return (
    <SiteChrome>
      <main className="flex min-h-[85dvh] flex-col bg-paper pt-16 md:pt-[72px]">
        <div className="mx-auto grid w-full max-w-[1240px] flex-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8">
          <div className="lg:col-span-6">
            <p className="font-ui text-sm font-bold tracking-[0.3em] text-slate">404</p>
            <h1 className="mt-3 font-display text-[2.3rem] leading-[1.25] text-pine-deep md:text-5xl">
              الصفحة غير موجودة
            </h1>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-slate">
              الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/" className={siteButton("primary")}>
                الرئيسية
              </a>
              <a href="/start" className={cn(siteButton("secondary"))}>
                اطلب خدمتك
                <ArrowLeft className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <Frame className="aspect-[16/10] lg:col-span-6 lg:aspect-[5/4]">
            <Photo
              name="riyadh-road"
              alt="طريق في الرياض يمتد نحو برج المملكة"
              sizes="(min-width: 1024px) 45vw, 92vw"
              position="50% 60%"
              fill
            />
          </Frame>
        </div>
      </main>
    </SiteChrome>
  );
}
