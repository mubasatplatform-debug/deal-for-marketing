import { SiteChrome } from "@/components/site-chrome";

/** Inside SiteChrome so the header/menu show and first-touch attribution is captured even when a visit starts on a 404. */
export function NotFound() {
  return (
    <SiteChrome>
      <main className="flex min-h-[85dvh] flex-col items-center justify-center gap-6 bg-ink px-6 pt-24 pb-16 text-center">
        <p className="font-ui text-kicker tracking-widest text-lime" dir="ltr" lang="en">
          404
        </p>
        <h1 className="font-display text-poster text-snow">الصفحة غير موجودة</h1>
        <p className="max-w-md text-mist">الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="/"
            className="inline-flex h-12 items-center border border-lime bg-lime px-8 font-display text-ink"
          >
            الرئيسية
          </a>
          <a
            href="/start"
            className="inline-flex h-12 items-center border border-lime px-8 font-display text-lime"
          >
            اطلب خدمتك
          </a>
        </div>
      </main>
    </SiteChrome>
  );
}
