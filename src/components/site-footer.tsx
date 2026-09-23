import { mobile, phone } from "@/lib/content";

/** Compact footer for inner pages. Same contact presentation as the home footer: landline for calls, mobile for WhatsApp. */
export function SiteFooter() {
  return (
    <footer className="border-t border-hair bg-ink px-6 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))] md:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 text-start text-sm">
          <dt className="text-dim">هاتف</dt>
          <dd>
            <a href={`tel:${phone.tel}`} className="inline-flex min-h-11 items-center font-ui text-lg text-snow hover:text-lime">
              <span dir="ltr">{phone.display}</span>
            </a>
          </dd>
          <dt className="text-dim">جوال وواتساب</dt>
          <dd>
            <a
              href={`https://wa.me/${mobile.wa}`}
              aria-label={`واتساب ${mobile.display}`}
              className="inline-flex min-h-11 items-center gap-2 font-ui text-lg text-snow hover:text-lime"
            >
              <span dir="ltr">{mobile.display}</span>
              <span className="font-display text-sm text-lime">واتساب</span>
            </a>
          </dd>
          <dt className="text-dim">البريد</dt>
          <dd>
            <a href="mailto:info@dealadv.sa" className="inline-flex min-h-11 items-center font-ui text-lime hover:opacity-80">
              <span dir="ltr">info@dealadv.sa</span>
            </a>
          </dd>
          <dt className="text-dim">العنوان</dt>
          <dd className="py-2 text-mist">القصيم، بريدة</dd>
        </dl>

        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-mist">
          <li>
            <a href="/start" className="inline-flex min-h-11 items-center hover:text-lime">
              اطلب خدمتك
            </a>
          </li>
          <li>
            <a href="/line" className="inline-flex min-h-11 items-center hover:text-lime">
              خط ديل
            </a>
          </li>
          <li>
            <a href="/client" className="inline-flex min-h-11 items-center hover:text-lime">
              حسابي
            </a>
          </li>
          <li>
            <a href="/privacy" className="inline-flex min-h-11 items-center hover:text-lime">
              سياسة الخصوصية
            </a>
          </li>
        </ul>
      </div>

      <p className="mx-auto mt-8 max-w-6xl text-xs text-dim">© 2026 ديل للتسويق</p>
    </footer>
  );
}
