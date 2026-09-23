import { DealLogo } from "@/components/logo";

export function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink px-6 text-center">
      <DealLogo />
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
  );
}
