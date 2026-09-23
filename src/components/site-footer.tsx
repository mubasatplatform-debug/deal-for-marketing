import { mobile, phone } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-hair bg-ink px-6 pt-10 pb-12 md:px-16">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 text-start">
          <a
            href={`tel:${phone.tel}`}
            dir="ltr"
            className="block font-ui text-lg text-snow hover:text-lime"
          >
            {phone.display}
          </a>
          <a
            href={phone.wa}
            dir="ltr"
            aria-label={`واتساب ${mobile.display}`}
            className="block font-ui text-lg text-snow hover:text-lime"
          >
            {mobile.display} <span className="font-dash text-sm text-lime">واتساب</span>
          </a>
          <a
            href="mailto:info@dealadv.sa"
            dir="ltr"
            className="block font-ui text-sm text-lime hover:opacity-80"
          >
            info@dealadv.sa
          </a>
          <p className="text-sm text-mist">القصيم، بريدة</p>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
          <li>
            <a href="/start" className="inline-flex min-h-11 items-center hover:text-lime">
              اطلب خدمتك
            </a>
          </li>
          <li>
            <a href="/privacy" className="inline-flex min-h-11 items-center hover:text-lime">
              سياسة الخصوصية
            </a>
          </li>
        </ul>
      </div>

      <p className="mt-8 text-xs text-dim">© 2026 ديل للتسويق</p>
    </footer>
  );
}
