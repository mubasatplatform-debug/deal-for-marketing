import { ArrowLeft, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { DealLogo } from "@/components/logo";
import { SocialRow } from "@/components/site-chrome";
import { siteButton, wrap } from "@/components/site-classes";
import { mobile, phone, services } from "@/lib/content";
import { cn } from "@/lib/utils";

const siteLinks = [
  { href: "/#systems", label: "الأنظمة" },
  { href: "/#services", label: "خدماتنا" },
  { href: "/line", label: "خط ديل" },
  { href: "/#works", label: "أعمالنا" },
  { href: "/#about", label: "من نحن" },
  { href: "/client", label: "حسابي" },
  { href: "/developers", label: "المطوّرون" },
] as const;

/**
 * The site's one dark band besides the Line section: a closing call to action
 * and every way to reach DEAL (landline for calls, mobile for WhatsApp).
 */
export function SiteFooter() {
  return (
    <footer id="contact" className="on-dark scroll-mt-20 bg-pine-deep text-snow">
      <div className={cn(wrap, "pt-14 md:pt-20")}>
        <div className="flex flex-col gap-8 rounded-3xl bg-pine px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10 md:py-10">
          <div className="max-w-xl">
            <h2 className="font-display text-[1.75rem] leading-snug text-snow md:text-4xl">
              جاهز نبدأ؟
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-snow/75">
              اختر الخدمة واكتب احتياجك في دقيقة، أو كلّمنا مباشرة — طلبك يصل لفريق ديل.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="/start" className={siteButton("primary", "lg")}>
              اطلب خدمتك
              <ArrowLeft className="size-4" aria-hidden="true" />
            </a>
            <a
              href={`https://wa.me/${mobile.wa}`}
              aria-label={`واتساب ${mobile.display}`}
              className={siteButton("ghost-dark", "lg")}
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              واتساب
            </a>
          </div>
        </div>

        <div className="grid gap-10 py-14 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <DealLogo tone="dark" />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-snow/70">
              حيث يبقى التأثير — التأثير لا يأتي صدفة… نحن نصنعه.
            </p>
            <SocialRow dark className="mt-6" />
          </div>

          <nav aria-label="روابط الموقع" className="md:col-span-2">
            <h3 className="text-sm font-bold text-snow/50">الموقع</h3>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 md:grid-cols-1">
              {siteLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-11 items-center text-[15px] text-snow/85 hover:text-lime"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="الخدمات" className="md:col-span-3">
            <h3 className="text-sm font-bold text-snow/50">الخدمات</h3>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 md:grid-cols-1">
              {services.map((s) => (
                <li key={s.slug}>
                  <a
                    href={`/start/${s.slug}`}
                    className="inline-flex min-h-11 items-center text-[15px] text-snow/85 hover:text-lime"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <h3 className="text-sm font-bold text-snow/50">تواصل</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <a href={`tel:${phone.tel}`} className="group flex min-h-11 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-lime">
                    <Phone className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-snow/55">هاتف</span>
                    <span
                      dir="ltr"
                      className="block font-ui text-[17px] font-bold text-snow group-hover:text-lime"
                    >
                      {phone.display}
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${mobile.wa}`}
                  aria-label={`جوال وواتساب ${mobile.display}`}
                  className="group flex min-h-11 items-center gap-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-lime">
                    <MessageCircle className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-snow/55">جوال وواتساب</span>
                    <span
                      dir="ltr"
                      className="block font-ui text-[17px] font-bold text-snow group-hover:text-lime"
                    >
                      {mobile.display}
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a href="mailto:info@mubasat.net" className="group flex min-h-11 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-lime">
                    <Mail className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-snow/55">البريد</span>
                    <span
                      dir="ltr"
                      className="block font-ui text-[15px] font-semibold text-snow group-hover:text-lime"
                    >
                      info@mubasat.net
                    </span>
                  </span>
                </a>
              </li>
              <li className="flex min-h-11 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-lime">
                  <MapPin className="size-[18px]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs text-snow/55">العنوان</span>
                  <span className="block text-[15px] text-snow">
                    القصيم، بريدة — المملكة العربية السعودية
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-snow/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ديل للتسويق · DEAL FOR MARKETING</p>
          <a href="/privacy" className="inline-flex min-h-11 items-center hover:text-lime">
            سياسة الخصوصية
          </a>
        </div>
      </div>
    </footer>
  );
}
