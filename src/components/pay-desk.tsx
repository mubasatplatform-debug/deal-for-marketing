import { DeskFrame, Kpi, Pill } from "@/components/desk-frame";

const items = [
  { id: "home", label: "التحصيل" },
  { id: "pay", label: "رابط الدفع" },
  { id: "bills", label: "الفاتورة" },
  { id: "pos", label: "سوفت POS" },
] as const;

export type PayView = (typeof items)[number]["id"];

export function PayDesk({ view }: { view: PayView }) {
  const screens = { home: <Home />, pay: <Pay />, bills: <Bills />, pos: <Pos /> };
  return (
    <DeskFrame brand="الدفع المبسط" office="منصة مبسط · بوابة ادفع باي" crumb="رابط · فاتورة · جوال نقطة بيع" view={view} items={items}>
      {screens[view]}
    </DeskFrame>
  );
}

const tx = [
  ["٤١٢", "مؤسسة النور", "مدى", "١٬٢٥٠", "ناجحة", "١٤:٠٢"],
  ["٤١١", "أبو فهد", "آبل باي", "٣٢٠", "ناجحة", "١٣:٤٠"],
  ["٤١٠", "نورة السبيعي", "بطاقة", "٥٤٠", "معلقة", "١٣:١٨"],
  ["٤٠٩", "خالد القصّاب", "مدى", "٢٬١٠٠", "ناجحة", "١٢:٥٥"],
  ["٤٠٨", "أم فهد", "رابط", "٨٥", "ناجحة", "١٢:٢١"],
  ["٤٠٧", "روابي", "آبل باي", "٤٬٨٠٠", "ناجحة", "١١:٤٤"],
  ["٤٠٦", "مكتب السالم", "مدى", "١٬٧٥٠", "معلقة", "١١:٠٢"],
  ["٤٠٥", "فهد العتيبي", "بطاقة", "٢١٠", "ناجحة", "١٠:١٨"],
];

function Home() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-4 border-b border-ink/10">
        <Kpi n="١٨٬٤٢٠" l="حُصِّل اليوم" hint="ر.س · تسوية خلال يوم" />
        <Kpi n="١٢" l="رابط مفتوح" hint="٣ لم يُفتح بعد" />
        <Kpi n="٣" l="بانتظار الدفع" hint="آخر تذكير قبل ساعة" />
        <Kpi n="٩٧٪" l="نجاح العمليات" hint="مدى · آبل باي · بطاقة" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <p className="border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">آخر العمليات</p>
        <table className="w-full text-right">
          <thead className="font-display text-xs text-ink/40">
            <tr className="border-b border-ink/10">
              {["رقم", "العميل", "الوسيلة", "المبلغ", "الحالة", "الوقت"].map((h) => (
                <th key={h} className="px-4 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-display text-sm">
            {tx.map((r) => (
              <tr key={r[0]} className="border-b border-ink/5">
                <td className="px-4 py-2.5 font-ui text-xs" dir="ltr">
                  {r[0]}
                </td>
                <td className="px-4 py-2.5">{r[1]}</td>
                <td className="px-4 py-2.5 text-ink/55">{r[2]}</td>
                <td className="px-4 py-2.5">{r[3]} ر.س</td>
                <td className="px-4 py-2.5">
                  <Pill tone={r[4] === "ناجحة" ? "lime" : "mute"}>{r[4]}</Pill>
                </td>
                <td className="px-4 py-2.5 font-ui text-xs text-ink/45" dir="ltr">
                  {r[5]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pay() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_22rem]">
      <div className="overflow-auto border-l border-ink/10 p-6">
        <p className="font-display text-xs text-ink/40">إنشاء رابط · منصة مبسط · ادفع باي</p>
        <p className="mt-2 font-display text-2xl">فاتورة ٤١٢</p>
        <dl className="mt-6 space-y-4 font-display text-sm">
          {[
            ["العميل", "مؤسسة النور"],
            ["الجوال", "055 412 8891"],
            ["البيان", "توريد — دفعة أولى"],
            ["المبلغ", "١٬٢٥٠ ر.س"],
            ["الصلاحية", "٧٢ ساعة"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-ink/5 pb-3">
              <dt className="text-ink/40">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 bg-lime px-4 py-3 text-center font-display text-sm">أرسل الرابط على واتساب</p>
        <p className="mt-2 border border-ink/15 px-4 py-3 text-center font-display text-sm">انسخ الرابط</p>
      </div>
      <div className="flex items-center justify-center bg-ink/5">
        <div className="w-64 border border-ink/15 bg-snow p-5">
          <p className="font-display text-xs text-ink/40">ادفع باي · مبسط</p>
          <p className="mt-3 font-display text-lg">دفع مستحق</p>
          <p className="mt-1 text-sm text-ink/50">فاتورة ٤١٢ — مؤسسة النور</p>
          <p className="mt-6 font-display text-4xl">١٬٢٥٠</p>
          <p className="mt-1 text-sm text-ink/45">ر.س</p>
          <div className="mt-6 space-y-2 font-display text-sm">
            <p className="bg-lime px-4 py-2.5 text-center text-ink">ادفع الآن</p>
            <p className="border border-ink/10 px-4 py-2.5 text-center">مدى</p>
            <p className="border border-ink/10 px-4 py-2.5 text-center">آبل باي</p>
            <p className="border border-ink/10 px-4 py-2.5 text-center">بطاقة</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bills() {
  const rows = [
    ["٤١٢", "مؤسسة النور", "١٬٢٥٠", "مدفوعة", "اليوم"],
    ["٤٠٨", "أبو فهد", "٣٢٠", "مفتوحة", "تذكير أُرسل"],
    ["٤٠١", "نورة السبيعي", "٥٤٠", "مدفوعة", "أمس"],
    ["٣٩٨", "روابي", "٤٬٨٠٠", "مدفوعة", "٢١ سبتمبر"],
    ["٣٩١", "مكتب السالم", "١٬٧٥٠", "مفتوحة", "بانتظار"],
    ["٣٨٨", "خالد القصّاب", "٢٬١٠٠", "مدفوعة", "٢٠ سبتمبر"],
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">
        فاتورة إلكترونية. تُرسل رابطًا، وتُقفَل حين تُدفع.
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-right">
          <thead className="font-display text-xs text-ink/40">
            <tr className="border-b border-ink/10">
              {["رقم", "العميل", "المبلغ", "الحالة", "آخر حركة"].map((h) => (
                <th key={h} className="px-4 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-display text-sm">
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-ink/5">
                <td className="px-4 py-3 font-ui text-xs" dir="ltr">
                  {r[0]}
                </td>
                <td className="px-4 py-3">{r[1]}</td>
                <td className="px-4 py-3">{r[2]} ر.س</td>
                <td className="px-4 py-3">
                  <Pill tone={r[3] === "مدفوعة" ? "lime" : "mute"}>{r[3]}</Pill>
                </td>
                <td className="px-4 py-3 text-ink/50">{r[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pos() {
  const keys = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠٠", "٠", "⌫"];
  return (
    <div className="grid h-full min-h-0 grid-cols-[20rem_1fr]">
      <div className="flex flex-col border-l border-ink/10 p-6">
        <p className="font-display text-xs text-ink/40">الجوال نقطة بيع · NFC</p>
        <p className="mt-6 font-display text-5xl leading-none">٨٥٫٠٠</p>
        <p className="mt-2 text-sm text-ink/45">ر.س</p>
        <div className="mt-6 grid grid-cols-3 gap-px bg-ink/10">
          {keys.map((k) => (
            <span key={k} className="bg-snow py-4 text-center font-display text-lg">
              {k}
            </span>
          ))}
        </div>
        <p className="mt-4 bg-lime py-3 text-center font-display text-sm">قرّب البطاقة</p>
      </div>
      <div className="min-h-0 overflow-auto">
        <p className="border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">آخر تمريرات اليوم</p>
        <table className="w-full text-right">
          <tbody className="font-display text-sm">
            {[
              ["١٢:١٤", "مدى", "٨٥ ر.س", "نجحت"],
              ["١١:٤٠", "آبل باي", "٢١٠ ر.س", "نجحت"],
              ["١٠:٠٢", "بطاقة", "١٬٢٥٠ ر.س", "نجحت"],
              ["٠٩:٤٨", "مدى", "٤٠ ر.س", "نجحت"],
              ["٠٩:١١", "آبل باي", "٣٢٠ ر.س", "نجحت"],
            ].map((r) => (
              <tr key={r[0]} className="border-b border-ink/5">
                <td className="px-4 py-3 font-ui text-xs text-ink/45" dir="ltr">
                  {r[0]}
                </td>
                <td className="px-4 py-3">{r[1]}</td>
                <td className="px-4 py-3">{r[2]}</td>
                <td className="px-4 py-3">
                  <Pill tone="lime">{r[3]}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
