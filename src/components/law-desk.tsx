import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { id: "home", label: "لوحة التحكم" },
  { id: "book", label: "المواعيد" },
  { id: "crm", label: "ملف العميل" },
  { id: "staff", label: "الموظفون" },
  { id: "docs", label: "العقود" },
  { id: "cases", label: "القضايا وناجز" },
  { id: "video", label: "جلسة الفيديو" },
] as const;

export type LawView = (typeof nav)[number]["id"];

export function LawDesk({ view }: { view: LawView }) {
  const screens: Record<LawView, ReactNode> = {
    home: <HomeView />,
    book: <BookView />,
    crm: <CrmView />,
    staff: <StaffView />,
    docs: <DocsView />,
    cases: <CasesView />,
    video: <VideoView />,
  };

  return (
    <div className="flex min-h-dvh bg-ink text-snow" dir="rtl">
      <aside className="flex w-56 shrink-0 flex-col border-l border-hair bg-ink">
        <div className="border-b border-hair px-5 py-5">
          <p className="font-display text-lg text-lime">ديل</p>
          <p className="mt-1 font-display text-sm text-snow">مكتب واصل</p>
          <p className="mt-1 text-xs text-dim">نظام المكتب القانوني</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {nav.map((item) => (
            <span
              key={item.id}
              className={cn(
                "px-3 py-2.5 font-display text-sm",
                item.id === view ? "bg-lime text-ink" : "text-mist",
              )}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <p className="mt-auto border-t border-hair px-5 py-4 font-display text-xs text-dim">أبو فيصل · بريدة</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-snow text-ink">
        <header className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
          <p className="font-display text-sm text-ink">{nav.find((n) => n.id === view)?.label}</p>
          <p className="font-display text-xs text-ink/40">الثلاثاء ٢٢ سبتمبر · جلسة الساعة ٨ صباحًا</p>
        </header>
        <div className="flex-1 overflow-hidden p-6">{screens[view]}</div>
      </div>
    </div>
  );
}

function HomeView() {
  const kpis = [
    ["٢٤", "قضايا مفتوحة"],
    ["٦", "مواعيد اليوم"],
    ["٣", "بانتظار اعتمادك"],
    ["١١", "رُفع إلى ناجز"],
  ];
  const rows = [
    ["١٤٤٧/١٢", "مؤسسة النور", "تجاري", "جلسة ٨:٠٠", "المحكمة"],
    ["١٤٤٦/١٨", "أبو فهد", "إيجار", "مذكرة", "على المكتب"],
    ["١٤٤٧/٠٩", "نورة السبيعي", "عمالي", "اعتماد لائحة", "بانتظارك"],
  ];
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(([n, l]) => (
          <div key={l} className="border border-ink/10 bg-snow p-4">
            <p className="font-display text-3xl text-ink">{n}</p>
            <p className="mt-1 font-display text-sm text-ink/50">{l}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 font-display text-sm text-ink/40">حركة اليوم</p>
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

function BookView() {
  const days = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس"];
  const slots = [
    ["٤:٠٠", "متاح"],
    ["٥:٠٠", "مؤسسة النور"],
    ["٦:٣٠", "متاح"],
    ["٨:٠٠", "جلسة محكمة"],
  ];
  return (
    <div className="grid grid-cols-[1fr_16rem] gap-6">
      <div>
        <div className="grid grid-cols-5 gap-2">
          {days.map((d, i) => (
            <div key={d} className={cn("p-3 text-center", i === 2 ? "bg-lime" : "border border-ink/10")}>
              <p className="font-display text-xs text-ink/40">{d}</p>
              <p className="mt-1 font-display text-xl">{12 + i}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {slots.map(([t, s]) => (
            <div key={t} className="flex items-center justify-between border border-ink/10 px-4 py-3">
              <span className="font-display">{t}</span>
              <span className={cn("font-display text-sm", s === "متاح" ? "text-lime" : "text-ink/50")}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <aside className="border border-ink/10 p-4">
        <p className="font-display text-xs text-lime">اقتراح النظام</p>
        <p className="mt-3 font-display text-lg">ثلاثاء ٥:٠٠ — ٣٠ دقيقة</p>
        <p className="mt-3 text-sm leading-loose text-ink/55">لا يتعارض مع جلسة الغد. العميل طلب بعد الدوام.</p>
        <p className="mt-6 bg-lime px-4 py-2 text-center font-display text-sm">اعتماد الموعد</p>
      </aside>
    </div>
  );
}

function CrmView() {
  return (
    <div className="grid h-full grid-cols-[15rem_1fr] gap-4">
      <ul className="border border-ink/10">
        {[
          ["مؤسسة النور", "قضية تجارية", true],
          ["أبو فهد", "عقد إيجار", false],
          ["نورة السبيعي", "عمالي", false],
        ].map(([name, k, on]) => (
          <li key={String(name)} className={cn("border-b border-ink/5 px-4 py-3", on && "bg-lime/25")}>
            <p className="font-display text-sm">{name}</p>
            <p className="text-xs text-ink/45">{k}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col border border-ink/10">
        <div className="border-b border-ink/10 px-4 py-3">
          <p className="font-display">مؤسسة النور — ١٤٤٧/١٢</p>
          <p className="mt-1 text-xs text-ink/40">رسائل · عقود · قضية · مواعيد</p>
        </div>
        <div className="flex-1 space-y-2 p-4">
          <p className="bg-ink/5 px-3 py-2 text-sm">السلام عليكم، جلسة الأحد باقية؟</p>
          <p className="mr-10 bg-lime px-3 py-2 text-sm">وعليكم السلام. باقية، الثامنة صباحًا. الملف مكتمل قبل الرفع إلى ناجز.</p>
          <p className="bg-ink/5 px-3 py-2 text-sm">تم، الله يعطيكم العافية.</p>
        </div>
      </div>
    </div>
  );
}

function StaffView() {
  const rows = [
    ["سلطان الحربي", "محامي", "جلسة النور", "في المحكمة", "كامل"],
    ["هند العلي", "إدارة المكتب", "توكيلات اليوم", "على المكتب", "محدود"],
    ["ماجد", "سكرتارية", "مواعيد الغد", "يرد الآن", "مواعيد"],
  ];
  return (
    <div className="border border-ink/10">
      <div className="grid grid-cols-5 border-b border-ink/10 px-4 py-2 font-display text-xs text-ink/40">
        <span>الاسم</span>
        <span>الدور</span>
        <span>مهمة اليوم</span>
        <span>الحالة</span>
        <span>الصلاحية</span>
      </div>
      {rows.map((r) => (
        <div key={r[0]} className="grid grid-cols-5 border-b border-ink/5 px-4 py-3 font-display text-sm last:border-0">
          {r.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function DocsView() {
  return (
    <div className="grid h-full grid-cols-[1fr_16rem] gap-4">
      <div className="border border-ink/10 p-5 text-sm leading-loose text-ink/70">
        <p className="font-display text-ink">عقد توريد — مؤسسة النور</p>
        <p className="mt-4">البند ٧ — الغرامة:</p>
        <p className="mt-2 bg-lime/35 px-2 py-1 text-ink">«في حال التأخير تُستحق غرامة حسب ما يراه الطرف الأول.»</p>
        <p className="mt-4">البند ١٢ — الاختصاص: محاكم بريدة.</p>
      </div>
      <aside className="border border-ink/10 p-4">
        <p className="font-display text-xs text-lime">ملاحظات النظام</p>
        <ul className="mt-3 space-y-3 font-display text-sm">
          <li>الغرامة غير محددة — خطر.</li>
          <li>لا سقف للتعويض.</li>
          <li>الاختصاص واضح.</li>
        </ul>
        <p className="mt-8 bg-lime px-3 py-2 text-center font-display text-sm">اعتماد الصياغة</p>
      </aside>
    </div>
  );
}

function CasesView() {
  const cols = [
    { name: "قيد الإعداد", items: ["١٤٤٧/٠٩ لائحة"] },
    { name: "جاهز للرفع", items: ["١٤٤٧/١٢ النور"] },
    { name: "رُفع إلى ناجز", items: ["١٤٤٦/٤٤", "١٤٤٦/١٨"] },
    { name: "لها رقم", items: ["٤١٠٢١٩٨"] },
  ];
  return (
    <div>
      <p className="mb-4 font-display text-sm text-ink/50">الذكاء يرتّب اللائحة. أنت تعتمد. ثم يُرفع إلى ناجز.</p>
      <div className="grid grid-cols-4 gap-3">
        {cols.map((c) => (
          <div key={c.name} className="border border-ink/10 p-3">
            <p className="font-display text-xs text-lime">{c.name}</p>
            {c.items.map((it) => (
              <p key={it} className="mt-2 bg-ink/5 px-2 py-3 font-display text-sm">
                {it}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoView() {
  return (
    <div className="grid h-full grid-cols-[1fr_16rem] gap-4">
      <div className="relative min-h-80 bg-ink">
        <div className="absolute inset-6 border border-lime/50" />
        <p className="absolute top-4 right-4 font-display text-xs text-lime">سرية · داخل المنصة · ٤٢:١٨</p>
        <p className="absolute bottom-5 right-6 font-display text-snow">المحامي — مكتب واصل</p>
        <p className="absolute bottom-5 left-6 font-display text-snow/70">الموكل — مؤسسة النور</p>
      </div>
      <aside className="border border-ink/10 p-4">
        <p className="font-display text-xs text-lime">مذكرة الجلسة</p>
        <p className="mt-3 text-sm leading-loose text-ink/60">اتفق الطرفان على مهلة ٧ أيام لتسليم المستندات. تُحفظ في ملف العميل.</p>
        <p className="mt-8 border border-ink/15 px-3 py-2 text-center font-display text-sm">إنهاء الجلسة</p>
      </aside>
    </div>
  );
}
