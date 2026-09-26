import { useRouterState } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";

/** Signed-in product areas that draw their own frame; a 404 there must not add the marketing header/footer. */
const APP_AREAS = /^\/(app|admin|client|desk|meet)(\/|$)/;

/**
 * On public paths the 404 sits inside SiteChrome so the header shows and
 * first-touch attribution is captured even when a visit starts on a 404.
 */
export function NotFound() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (APP_AREAS.test(pathname)) return <Body className="min-h-[60dvh] py-16" />;
  return (
    <SiteChrome>
      <main>
        <Body className="min-h-[85dvh] pt-24 pb-16" />
      </main>
    </SiteChrome>
  );
}

function Body({ className }: { className: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-6 bg-ink px-6 text-center ${className}`}>
      <p className="font-ui text-kicker tracking-widest text-lime" dir="ltr" lang="en">
        404
      </p>
      <h1 className="font-display text-poster text-snow">الصفحة غير موجودة</h1>
      <p className="max-w-md text-mist">الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a href="/" className="inline-flex h-12 items-center border border-lime bg-lime px-8 font-display text-ink">
          الرئيسية
        </a>
        <a href="/start" className="inline-flex h-12 items-center border border-lime px-8 font-display text-lime">
          اطلب خدمتك
        </a>
      </div>
    </div>
  );
}
