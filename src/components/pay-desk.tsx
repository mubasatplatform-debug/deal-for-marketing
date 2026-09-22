import { DeskFrame } from "@/components/desk-frame";

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

function Home() {
  const kpis = [
    ["١٨٬٤٢٠", "حُصِّل اليوم"],
    ["١٢", "رابط مفتوح"],
    ["٣", "بانتظار الدفع"],
    ["تسوية", "خلال يوم"],
  ];
  const rows = [
    ["٤١٢", "مؤسسة النور", "مدى", "١٬٢٥٠", "ناجحة"],
    ["٤١١", "أبو فهد", "آبل باي", "٣٢٠", "ناجحة"],
    ["٤١٠", "نورة", "بطاقة", "٥٤٠", "معلقة"],
  ];
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(([n, l]) => (
          <div key={l} className="border border-ink/10 p-4">
            <p className="font-display text-3xl">{n}</p>
            <p className="mt-1 font-display text-sm text-ink/50">{l}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 font-display text-sm text-ink/40">آخر العمليات</p>
      <div className="mt-3 border border-ink/10">
        {rows.map((r) => (
          <div key={r[0]} className="grid grid-cols-5 border-b border-ink/5 px-4 py-3 font-display text-sm last:border-0">
            {r.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pay() {
  return (
    <div className="mx-auto max-w-sm border border-ink/10 p-6">
      <p className="font-display text-xs text-ink/40">منصة مبسط · ادفع باي</p>
      <p className="mt-2 font-display text-2xl">دفع مستحق</p>
      <p className="mt-1 text-sm text-ink/50">فاتورة ٤١٢ — مؤسسة النور</p>
      <p className="mt-6 font-display text-4xl">١٬٢٥٠ ر.س</p>
      <div className="mt-6 space-y-2 font-display text-sm">
        <p className="bg-lime px-4 py-3 text-center text-ink">ادفع الآن</p>
        <p className="border border-ink/10 px-4 py-3 text-center">مدى</p>
        <p className="border border-ink/10 px-4 py-3 text-center">آبل باي</p>
        <p className="border border-ink/10 px-4 py-3 text-center">بطاقة</p>
      </div>
    </div>
  );
}

function Bills() {
  const rows = [
    ["٤١٢", "مؤسسة النور", "١٬٢٥٠", "مدفوعة"],
    ["٤٠٨", "أبو فهد", "٣٢٠", "مفتوحة"],
    ["٤٠١", "نورة", "٥٤٠", "مدفوعة"],
  ];
  return (
    <div>
      <p className="mb-4 font-display text-sm text-ink/50">فاتورة إلكترونية. تُرسل رابطًا، وتُقفَل حين تُدفع.</p>
      <div className="border border-ink/10">
        <div className="grid grid-cols-4 border-b border-ink/10 px-4 py-2 font-display text-xs text-ink/40">
          <span>رقم</span>
          <span>العميل</span>
          <span>المبلغ</span>
          <span>الحالة</span>
        </div>
        {rows.map((r) => (
          <div key={r[0]} className="grid grid-cols-4 border-b border-ink/5 px-4 py-3 font-display text-sm last:border-0">
            {r.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pos() {
  return (
    <div className="grid grid-cols-[16rem_1fr] gap-6">
      <div className="border border-ink/10 p-6 text-center">
        <p className="font-display text-xs text-ink/40">الجوال نقطة بيع</p>
        <p className="mt-8 font-display text-5xl text-lime">NFC</p>
        <p className="mt-6 font-display text-lg">قرّب البطاقة</p>
        <p className="mt-2 text-sm text-ink/50">بدون جهاز إضافي</p>
      </div>
      <div>
        <p className="font-display text-sm text-ink/50">آخر تمريرات اليوم</p>
        <div className="mt-3 border border-ink/10">
          {[
            ["١٢:١٤", "مدى", "٨٥ ر.س"],
            ["١١:٤٠", "آبل باي", "٢١٠ ر.س"],
            ["١٠:٠٢", "بطاقة", "١٬٢٥٠ ر.س"],
          ].map((r) => (
            <div key={r[0]} className="grid grid-cols-3 border-b border-ink/5 px-4 py-3 font-display text-sm last:border-0">
              {r.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
