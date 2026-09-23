import { Initials, Kpi, Pill, DeskFrame } from "@/components/desk-frame";
import { cn } from "@/lib/utils";

const items = [
  { id: "home", label: "غرفة العمليات" },
  { id: "inbox", label: "الوارد" },
  { id: "calls", label: "الكول سنتر" },
  { id: "ai", label: "الذكاء يدير" },
] as const;

export type CrmView = (typeof items)[number]["id"];

export function CrmDesk({ view }: { view: CrmView }) {
  const screens = {
    home: <Home />,
    inbox: <Inbox />,
    calls: <Calls />,
    ai: <AiRun />,
  };
  return (
    <DeskFrame brand="الحل اللحظي" office="CRM · واتساب · كول سنتر" crumb="الذكاء يرد — أنت تعتمد" view={view} items={items}>
      {screens[view]}
    </DeskFrame>
  );
}

const threads = [
  { name: "أبو فهد", ch: "واتساب", preview: "الطلب وصل ولا باقي؟", time: "١٤:٠٢", state: "يرد الذكاء", unread: 2, on: true },
  { name: "نورة السبيعي", ch: "مكالمة", preview: "أبغى موعد بعد العشاء", time: "١٣:٥١", state: "حُوِّل لك", unread: 1, on: false },
  { name: "مؤسسة النور", ch: "واتساب", preview: "الفاتورة رقم ٤١٢", time: "١٣:٤٠", state: "أُغلق", unread: 0, on: false },
  { name: "خالد القصّاب", ch: "واتساب", preview: "باقة الجملة لثلاث محلات", time: "١٣:١٨", state: "مسودة", unread: 0, on: false },
  { name: "أم فهد", ch: "واتساب", preview: "وصلت؟ أنا عند الباب", time: "١٢:٥٥", state: "ردّ الذكاء", unread: 0, on: false },
  { name: "روابي للتجارة", ch: "مكالمة", preview: "عقد التوريد — بند الغرامة", time: "١٢:٢١", state: "يحتاجك", unread: 3, on: false },
  { name: "فهد العتيبي", ch: "واتساب", preview: "الألوان غير اللي بالكتالوج", time: "١١:٤٤", state: "قيد الرد", unread: 0, on: false },
  { name: "مكتب السالم", ch: "واتساب", preview: "نحتاج عرض سعر هذا الأسبوع", time: "١١:٠٢", state: "أُغلق", unread: 0, on: false },
];

function Home() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-4 border-b border-ink/10">
        <Kpi n="١٤٢" l="محادثة اليوم" hint="١١٨ واتساب · ٢٤ مكالمة" />
        <Kpi n="٣٨" l="مكالمة" hint="متوسط الانتظار ٤١ ث" />
        <Kpi n="٩١٪" l="ردّها الذكاء" hint="٧ محادثات تحتاجك" />
        <Kpi n="٧" l="تحتاجك الآن" hint="SLA أقل من ٣ دقائق" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.85fr]">
        <div className="min-h-0 overflow-auto border-l border-ink/10">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2.5">
            <p className="font-display text-xs text-ink/45">آخر الحركة</p>
            <p className="font-display text-xs text-ink/35">اليوم · القصيم</p>
          </div>
          <table className="w-full text-right">
            <thead className="font-display text-xs text-ink/40">
              <tr className="border-b border-ink/10">
                <th className="px-4 py-2 font-normal">العميل</th>
                <th className="px-4 py-2 font-normal">القناة</th>
                <th className="px-4 py-2 font-normal">الموضوع</th>
                <th className="px-4 py-2 font-normal">الحالة</th>
                <th className="px-4 py-2 font-normal">الوقت</th>
              </tr>
            </thead>
            <tbody className="font-display text-sm">
              {threads.map((t) => (
                <tr key={t.name} className="border-b border-ink/5">
                  <td className="px-4 py-2.5">{t.name}</td>
                  <td className="px-4 py-2.5 text-ink/55">{t.ch}</td>
                  <td className="px-4 py-2.5 text-ink/70">{t.preview}</td>
                  <td className="px-4 py-2.5">
                    <Pill tone={t.state.includes("ذكاء") || t.state === "أُغلق" ? "lime" : t.state === "يحتاجك" ? "ink" : "mute"}>
                      {t.state}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5 font-ui text-xs text-ink/45" dir="ltr">
                    {t.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-h-0 overflow-auto">
          <div className="border-b border-ink/10 px-4 py-2.5">
            <p className="font-display text-xs text-ink/45">الوكلاء الآن</p>
          </div>
          {[
            ["هند", "وارد واتساب", "متاح", true],
            ["سلطان", "كول سنتر", "في مكالمة", false],
            ["ماجد", "متابعة الطلبات", "متاح", true],
            ["الذكاء", "الخط بالكامل", "يرد", true],
          ].map(([n, r, s, on]) => (
            <div key={String(n)} className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
              <div>
                <p className="font-display text-sm">{n}</p>
                <p className="text-xs text-ink/45">{r}</p>
              </div>
              <Pill tone={on ? "lime" : "mute"}>{s}</Pill>
            </div>
          ))}
          <div className="px-4 py-4">
            <p className="font-display text-xs text-ink/45">قواعد التوجيه</p>
            <ul className="mt-3 space-y-2 font-display text-sm leading-relaxed text-ink/70">
              <li>شكوى أو مبلغ أعلى من ٥٠٠ → حوّل للوكيل.</li>
              <li>تتبع شحنة أو تأكيد طلب → الذكاء يقفل.</li>
              <li>لهجة قصيمية أو نجدية → الرد بأسلوب المحل.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inbox() {
  const active = threads[0];
  const msgs = [
    { me: false, text: "السلام عليكم، الطلب وصل ولا باقي؟", t: "١٣:٥٨" },
    { me: true, ai: true, text: "وعليكم السلام أبو فهد، وصلك اليوم قبل العصر إن شاء الله.", t: "١٣:٥٨" },
    { me: false, text: "تمام، وإذا تأخر؟", t: "١٤:٠٠" },
    { me: true, ai: true, text: "أي تأخير أكلمك قبل ما يوصلك. ارتاح.", t: "١٤:٠١" },
    { me: false, text: "والفاتورة تجي مع المندوب ولا على الواتساب؟", t: "١٤:٠٢" },
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[17.5rem_minmax(0,1fr)_16.5rem]">
      <ul className="min-h-0 overflow-auto border-l border-ink/10">
        {threads.map((t) => (
          <li key={t.name} className={cn("flex gap-3 border-b border-ink/5 px-3 py-3", t.on && "bg-lime/30")}>
            <Initials name={t.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-display text-sm">{t.name}</p>
                <span className="font-ui text-micro text-ink/40" dir="ltr">
                  {t.time}
                </span>
              </div>
              <p className="truncate text-xs text-ink/50">{t.preview}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-display text-micro text-ink/40">{t.ch}</span>
                {t.unread ? <span className="bg-ink px-1.5 font-ui text-micro text-lime">{t.unread}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2.5">
          <div>
            <p className="font-display text-sm">{active.name}</p>
            <p className="text-xs text-ink/45">واتساب · يرد الذكاء · طلب #٣٨١٢</p>
          </div>
          <Pill tone="lime">على الخط</Pill>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
          {msgs.map((m) => (
            <div key={m.t + m.text} className={cn("max-w-[85%]", m.me && "mr-auto")}>
              <p className={cn("px-3 py-2 text-sm leading-relaxed", m.me ? "bg-lime text-ink" : "bg-ink/6")}>{m.text}</p>
              <p className="mt-1 flex gap-2 font-display text-micro text-ink/40">
                <span dir="ltr">{m.t}</span>
                {m.ai ? <span>الذكاء</span> : null}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-ink/10 px-4 py-3">
          <p className="flex-1 border border-ink/10 px-3 py-2 font-display text-sm text-ink/35">اكتب ردًا، أو اترك الذكاء يكمل…</p>
          <span className="bg-lime px-4 py-2 font-display text-sm text-ink">أرسل</span>
        </div>
      </div>
      <aside className="min-h-0 overflow-auto border-r border-ink/10">
        <div className="border-b border-ink/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <Initials name={active.name} />
            <div>
              <p className="font-display text-sm">{active.name}</p>
              <p className="font-ui text-xs text-ink/45" dir="ltr">
                055 412 8891
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill>عميل دائم</Pill>
            <Pill>بريدة</Pill>
            <Pill tone="lime">واتساب</Pill>
          </div>
        </div>
        <dl className="space-y-3 px-4 py-4 font-display text-sm">
          {[
            ["آخر طلب", "#٣٨١٢ — شحن اليوم"],
            ["القيمة", "١٬٢٥٠ ر.س"],
            ["اللهجة", "قصيمية"],
            ["الملف", "منذ مارس ٢٠٢٤"],
            ["الوكيل", "الذكاء → هند عند الحاجة"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-ink/40">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-ink/10 px-4 py-4">
          <p className="font-display text-xs text-ink/40">سجل الملف</p>
          <ul className="mt-3 space-y-2 font-display text-xs leading-relaxed text-ink/65">
            <li>١٤:٠١ — الذكاء أكّد موعد التسليم.</li>
            <li>أمس — فاتورة ٤١٢ أُغلقت.</li>
            <li>الأحد — طلب جملة لثلاث قطع.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Calls() {
  const queue = [
    { name: "نورة السبيعي", wait: "٠٠:٤١", reason: "موعد بعد العشاء", on: true },
    { name: "روابي للتجارة", wait: "٠١:١٢", reason: "بند الغرامة", on: false },
    { name: "أم فهد", wait: "٠٠:١٨", reason: "تتبع مندوب", on: false },
    { name: "خالد القصّاب", wait: "٠٠:٠٩", reason: "عرض جملة", on: false },
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[16.5rem_minmax(0,1fr)_16.5rem]">
      <div className="min-h-0 overflow-auto border-l border-ink/10">
        <p className="border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">الوارد · ٤ في الانتظار</p>
        {queue.map((q) => (
          <div key={q.name} className={cn("border-b border-ink/5 px-4 py-3", q.on && "bg-lime/30")}>
            <div className="flex items-baseline justify-between">
              <p className="font-display text-sm">{q.name}</p>
              <span className="font-ui text-xs text-ink/45" dir="ltr">
                {q.wait}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink/50">{q.reason}</p>
          </div>
        ))}
        <p className="px-4 py-3 font-display text-xs text-ink/40">الوكلاء</p>
        {[
          ["سلطان", "في مكالمة · ١٢:٠٨"],
          ["هند", "متاح"],
          ["ماجد", "استراحة"],
        ].map(([n, s]) => (
          <div key={n} className="flex items-center justify-between px-4 py-2">
            <span className="font-display text-sm">{n}</span>
            <span className="text-xs text-ink/45">{s}</span>
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-col items-center justify-center px-8">
        <p className="font-display text-xs text-ink/40">مكالمة واردة · يسمع الذكاء</p>
        <p className="mt-4 font-display text-3xl">نورة السبيعي</p>
        <p className="mt-1 font-ui text-sm text-ink/45" dir="ltr">
          053 220 4418
        </p>
        <p className="mt-6 font-ui text-4xl tabular-nums text-ink" dir="ltr">
          12:08
        </p>
        <div className="mt-6 flex h-10 items-end gap-1">
          {[4, 10, 7, 14, 8, 16, 6, 12, 9, 15, 5, 11, 8, 13, 7].map((h, i) => (
            <span key={i} className="w-1 bg-lime" style={{ height: h * 2 }} />
          ))}
        </div>
        <div className="mt-10 grid grid-cols-4 gap-2 font-display text-xs">
          {["كتم", "انتظار", "تحويل", "إنهاء"].map((a) => (
            <span
              key={a}
              className={cn(
                "px-5 py-3 text-center",
                a === "إنهاء" ? "bg-ink text-snow" : "border border-ink/15 text-ink",
              )}
            >
              {a}
            </span>
          ))}
        </div>
        <p className="mt-8 max-w-sm text-center font-display text-sm leading-relaxed text-ink/55">
          طلبت موعد بعد العشاء. الجدول فيه فراغ الثلاثاء ٥:٠٠ — لا يتعارض مع جلسة الغد.
        </p>
      </div>
      <aside className="min-h-0 overflow-auto border-r border-ink/10 px-4 py-4">
        <p className="font-display text-xs text-ink/40">ملف المتصلة</p>
        <p className="mt-2 font-display text-lg">نورة السبيعي</p>
        <p className="mt-1 text-sm text-ink/50">عميلة منذ ٢٠٢٥ · حجز مواعيد</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill tone="lime">يحتاجك</Pill>
          <Pill>موعد</Pill>
          <Pill>قصيمية</Pill>
        </div>
        <p className="mt-6 font-display text-xs text-ink/40">اقتراح النظام</p>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">ثلاثاء ٥:٠٠ — ٣٠ دقيقة. اعتمد أو غيّر الوقت.</p>
        <p className="mt-4 bg-lime px-3 py-2 text-center font-display text-sm">اعتماد الموعد</p>
        <p className="mt-8 font-display text-xs text-ink/40">مسار المكالمة</p>
        <ul className="mt-3 space-y-2 font-display text-xs leading-relaxed text-ink/65">
          <li>١٢:٠٠ — الذكاء ردّ التحية.</li>
          <li>١٢:٠٣ — طلبت بعد الدوام.</li>
          <li>١٢:٠٦ — حُوّلت لسلطان.</li>
        </ul>
      </aside>
    </div>
  );
}

function AiRun() {
  const log = [
    ["١٤:٠٢", "أبو فهد", "تأكيد تسليم", "أُغلق", "٤ ث"],
    ["١٤:٠٠", "نورة السبيعي", "موعد بعد العشاء", "حُوِّل", "١١ ث"],
    ["١٣:٥١", "أم فهد", "تتبع مندوب", "أُغلق", "٦ ث"],
    ["١٣:٤٠", "مؤسسة النور", "فاتورة ٤١٢", "أُغلق", "٣ ث"],
    ["١٣:٢٢", "فهد العتيبي", "لون مختلف", "يحتاجك", "٩ ث"],
    ["١٣:١٨", "خالد القصّاب", "عرض جملة", "مسودة", "٧ ث"],
    ["١٢:٥٥", "مكتب السالم", "عرض سعر", "أُغلق", "٥ ث"],
    ["١٢:٢١", "روابي", "بند الغرامة", "حُوِّل", "٨ ث"],
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-4 border-b border-ink/10">
        <Kpi n="٨٤" l="ردود أُنجزت" hint="بدون وكيل" />
        <Kpi n="٣١" l="مكالمات أُغلقت" hint="الذكاء قفل الخط" />
        <Kpi n="٧" l="حُوِّل لك" hint="شكوى أو مبلغ عالٍ" />
        <Kpi n="٤ ث" l="متوسط الرد" hint="من أول رسالة" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem]">
        <div className="min-h-0 overflow-auto border-l border-ink/10">
          <p className="border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">سجل الذكاء — اللحظة</p>
          <table className="w-full text-right">
            <thead className="font-display text-xs text-ink/40">
              <tr className="border-b border-ink/10">
                <th className="px-4 py-2 font-normal">الوقت</th>
                <th className="px-4 py-2 font-normal">العميل</th>
                <th className="px-4 py-2 font-normal">النية</th>
                <th className="px-4 py-2 font-normal">القرار</th>
                <th className="px-4 py-2 font-normal">السرعة</th>
              </tr>
            </thead>
            <tbody className="font-display text-sm">
              {log.map((r) => (
                <tr key={r.join()} className="border-b border-ink/5">
                  <td className="px-4 py-2.5 font-ui text-xs text-ink/45" dir="ltr">
                    {r[0]}
                  </td>
                  <td className="px-4 py-2.5">{r[1]}</td>
                  <td className="px-4 py-2.5 text-ink/70">{r[2]}</td>
                  <td className="px-4 py-2.5">
                    <Pill tone={r[3] === "أُغلق" ? "lime" : r[3] === "حُوِّل" || r[3] === "يحتاجك" ? "ink" : "mute"}>{r[3]}</Pill>
                  </td>
                  <td className="px-4 py-2.5 text-ink/50">{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="overflow-auto px-4 py-4">
          <p className="font-display text-xs text-ink/40">ما يُقفله وحده</p>
          <ul className="mt-3 space-y-2 font-display text-sm leading-relaxed text-ink/70">
            <li>تتبع شحنة وتأكيد طلب.</li>
            <li>مواعيد ضمن الجدول.</li>
            <li>فاتورة مدفوعة أو رابط جاهز.</li>
          </ul>
          <p className="mt-6 font-display text-xs text-ink/40">ما يحوّله لك</p>
          <ul className="mt-3 space-y-2 font-display text-sm leading-relaxed text-ink/70">
            <li>شكوى أو لون/مقاس غلط.</li>
            <li>عقد أو بند غرامة.</li>
            <li>مبلغ أعلى من حدّك.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
