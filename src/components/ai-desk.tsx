import { AppBar } from "@/components/product-tour";

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

export function AiInbox() {
  return (
    <div className="bg-snow text-ink">
      <AppBar title="الوارد" crumb="لهجة · أسلوبك · عميل بعميل" />
      <div className="grid md:grid-cols-[14rem_1fr]">
        <ul className="border-b border-ink/10 md:border-l md:border-b-0">
          {threads.map((t) => (
            <li key={t.name} className={`flex items-center justify-between px-4 py-3 ${t.on ? "bg-lime/25" : ""}`}>
              <div>
                <p className="font-display text-sm">{t.name}</p>
                <p className="text-xs text-ink/45">{t.preview}</p>
              </div>
              <span className="font-display text-xs text-ink/40">{t.state}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 p-5">
          {messages.map((m) => (
            <p
              key={m.text}
              className={`max-w-[92%] px-3 py-2 text-sm leading-relaxed ${m.me ? "mr-auto bg-lime" : "bg-ink/5"}`}
            >
              {m.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AiRoute() {
  const cols = [
    { name: "وارد", items: ["استفسار سعر", "موعد جديد"] },
    { name: "يرد النظام", items: ["تتبع شحنة", "تأكيد حجز"] },
    { name: "يحتاجك", items: ["شكوى فاتورة"] },
    { name: "أُغلق", items: ["طلب مكتمل"] },
  ];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="توجيه المحادثات" crumb="يرد · يحوّل · يقفل" />
      <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
        {cols.map((c) => (
          <div key={c.name} className="bg-ink/5 p-3">
            <p className="font-display text-xs text-lime">{c.name}</p>
            {c.items.map((it) => (
              <p key={it} className="mt-2 bg-snow px-2 py-3 font-display text-sm">
                {it}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiPublish() {
  const posts = [
    { ch: "تيك توك", title: "قصة اليوم — المستودع", state: "مجدول ٦:٣٠" },
    { ch: "سناب", title: "عرض الجمعة", state: "نُشر" },
    { ch: "منصة X", title: "تنويه الدوام", state: "قيدك أنت" },
  ];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="المنصات والنشر" crumb="تيك توك وباقي القنوات" />
      <ul className="p-4">
        {posts.map((p) => (
          <li key={p.title} className="flex items-center justify-between border-b border-ink/10 py-3">
            <div>
              <p className="font-display text-xs text-ink/40">{p.ch}</p>
              <p className="font-display">{p.title}</p>
            </div>
            <span className="font-display text-sm text-lime">{p.state}</span>
          </li>
        ))}
      </ul>
      <div className="px-4 pb-5">
        <p className="bg-lime px-4 py-3 text-center font-display">انشر</p>
      </div>
    </div>
  );
}

export function AiClose() {
  const rows = [
    ["ردود أُنجزت اليوم", "٨٤"],
    ["حُوِّل للمحامي", "٦"],
    ["منشورات نزلت", "٣"],
    ["ما يحتاجك الآن", "١"],
  ];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="آخر السلسلة" crumb="ينوب عن الموظف — شغل منتهي" />
      <div className="grid grid-cols-2 gap-px bg-ink/10">
        {rows.map(([k, v]) => (
          <div key={k} className="bg-snow p-6">
            <p className="font-display text-3xl text-ink">{v}</p>
            <p className="mt-2 font-display text-sm text-ink/50">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
