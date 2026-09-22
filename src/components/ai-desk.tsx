import type { ReactNode } from "react";

const threads = [
  { name: "أبو فهد", preview: "الطلب وصل ولا باقي؟", state: "يرد الآن", on: true },
  { name: "نورة السبيعي", preview: "أبغى موعد بعد العشاء", state: "حُوِّل لك", on: false },
  { name: "مؤسسة النور", preview: "الفاتورة رقم ٤١٢", state: "أُغلق", on: false },
];

const messages = [
  { me: false, text: "السلام عليكم، الطلب وصل ولا باقي؟" },
  { me: true, text: "وعليكم السلام أبو فهد، وصلك اليوم قبل العصر إن شاء الله." },
  { me: false, text: "تمام، وإذا تأخر؟" },
  { me: true, text: "أي تأخير أكلمك أنا قبل ما يوصلك. ارتاح." },
];

const posts = [
  { ch: "تيك توك", title: "قصة اليوم — المستودع", state: "مجدول ٦:٣٠" },
  { ch: "سناب", title: "عرض الجمعة", state: "نُشر" },
  { ch: "منصة X", title: "تنويه الدوام", state: "قيدك أنت" },
];

const cols = [
  { name: "وارد", items: ["استفسار سعر", "موعد جديد"] },
  { name: "يرد النظام", items: ["تتبع شحنة", "تأكيد حجز"] },
  { name: "يحتاجك", items: ["شكوى فاتورة"] },
  { name: "أُغلق", items: ["طلب مكتمل"] },
];

function Screen({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <figure className="flex min-h-80 flex-col overflow-hidden border border-ink/10 bg-snow text-ink">
      <figcaption className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <span className="font-display text-base text-ink">{title}</span>
        <span className="font-ui text-micro tracking-widest text-lime">{kicker}</span>
      </figcaption>
      <div className="flex-1 p-4">{children}</div>
    </figure>
  );
}

export function AiDesk() {
  return (
    <div className="bg-snow text-ink">
      <div className="px-8 py-14 text-center md:px-16">
        <p className="text-kicker text-lime">الواجهة //</p>
        <h3 className="mt-4 font-display text-poster text-ink">
          هذا شكل الشغل.
          <br />
          مو عرض.
        </h3>
        <p className="mx-auto mt-4 max-w-lg text-pretty leading-loose text-ink/60">
          شاشة بيضاء عشان تتقرا. النظام يرد، يوجّه، وينشر — وأنت تشوفه وهو يشتغل.
        </p>
      </div>

      <div className="grid gap-px bg-ink/10 md:grid-cols-3">
        <Screen kicker="01" title="الوارد والرد">
          <ul className="space-y-2">
            {threads.map((t) => (
              <li
                key={t.name}
                className={`flex items-center justify-between px-3 py-2 ${t.on ? "bg-lime/20" : "bg-ink/5"}`}
              >
                <div className="text-right">
                  <p className="font-display text-sm text-ink">{t.name}</p>
                  <p className="text-xs text-ink/50">{t.preview}</p>
                </div>
                <span className={`font-ui text-micro ${t.on ? "text-ink" : "text-ink/40"}`}>{t.state}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2">
            {messages.map((m) => (
              <p
                key={m.text}
                className={`max-w-[90%] px-3 py-2 text-sm leading-relaxed ${m.me ? "mr-auto bg-lime text-ink" : "bg-ink/5 text-ink"}`}
              >
                {m.text}
              </p>
            ))}
          </div>
        </Screen>

        <Screen kicker="02" title="توجيه المحادثات">
          <div className="grid grid-cols-2 gap-2">
            {cols.map((c) => (
              <div key={c.name} className="bg-ink/5 p-2">
                <p className="mb-2 font-ui text-micro tracking-widest text-lime">{c.name}</p>
                {c.items.map((it) => (
                  <p key={it} className="mb-1 bg-snow px-2 py-2 text-xs text-ink">
                    {it}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Screen>

        <Screen kicker="03" title="المنصات والنشر">
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.title} className="flex items-center justify-between bg-ink/5 px-3 py-3">
                <div className="text-right">
                  <p className="font-ui text-micro text-ink/40">{p.ch}</p>
                  <p className="font-display text-sm text-ink">{p.title}</p>
                </div>
                <span className="font-ui text-micro text-lime">{p.state}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 bg-lime px-4 py-3 text-center font-display text-ink">انشر</p>
        </Screen>
      </div>
    </div>
  );
}
