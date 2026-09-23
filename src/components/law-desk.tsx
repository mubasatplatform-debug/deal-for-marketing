import type { ReactNode } from "react";
import { DeskFrame, Initials, Kpi, Pill } from "@/components/desk-frame";
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
    <DeskFrame brand="مكتب واصل" office="نظام المكتب القانوني" crumb="أبو فيصل · بريدة" view={view} items={nav}>
      {screens[view]}
    </DeskFrame>
  );
}

function HomeView() {
  const rows = [
    ["١٤٤٧/١٢", "مؤسسة النور", "تجاري", "جلسة ٨:٠٠", "المحكمة", "رُفع"],
    ["١٤٤٦/١٨", "أبو فهد", "إيجار", "مذكرة", "على المكتب", "قيد الإعداد"],
    ["١٤٤٧/٠٩", "نورة السبيعي", "عمالي", "اعتماد لائحة", "بانتظارك", "يحتاجك"],
    ["١٤٤٧/٢١", "روابي للتجارة", "تجاري", "عقد توريد", "تحليل", "مسودة"],
    ["١٤٤٦/٤٤", "خالد القصّاب", "تنفيذ", "رقم ٤١٠٢١٩٨", "ناجز", "لها رقم"],
    ["١٤٤٧/٠٣", "مكتب السالم", "أحوال", "توكيل", "على المكتب", "جاهز"],
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-4 border-b border-ink/10">
        <Kpi n="٢٤" l="قضايا مفتوحة" hint="١١ تجاري · ٨ إيجار" />
        <Kpi n="٦" l="مواعيد اليوم" hint="جلسة واحدة في المحكمة" />
        <Kpi n="٣" l="بانتظار اعتمادك" hint="لائحتان وعقد" />
        <Kpi n="١١" l="رُفع إلى ناجز" hint="آخر رفع أمس ١٤:٢٠" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <p className="border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">حركة اليوم</p>
        <table className="w-full text-right">
          <thead className="font-display text-xs text-ink/40">
            <tr className="border-b border-ink/10">
              {["الرقم", "الموكل", "النوع", "المهمة", "المكان", "الحالة"].map((h) => (
                <th key={h} className="px-4 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-display text-sm">
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-ink/5">
                {r.slice(0, 5).map((c) => (
                  <td key={c} className="px-4 py-2.5">
                    {c}
                  </td>
                ))}
                <td className="px-4 py-2.5">
                  <Pill tone={r[5] === "يحتاجك" ? "ink" : r[5] === "رُفع" || r[5] === "لها رقم" ? "lime" : "mute"}>{r[5]}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookView() {
  const days = [
    ["أحد", "٢١"],
    ["إثنين", "٢٢"],
    ["ثلاثاء", "٢٣"],
    ["أربعاء", "٢٤"],
    ["خميس", "٢٥"],
  ];
  const slots = [
    ["٨:٠٠", "جلسة مؤسسة النور — المحكمة"],
    ["١٠:٣٠", "أبو فهد — عقد إيجار"],
    ["١٢:٠٠", "فراغ"],
    ["٤:٠٠", "فراغ — مقترح للعميلة نورة"],
    ["٥:٠٠", "نورة السبيعي — ٣٠ د"],
    ["٦:٣٠", "فراغ"],
    ["٨:٠٠", "مغلق — جلسة الغد"],
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_18rem]">
      <div className="min-h-0 overflow-auto border-l border-ink/10 p-4">
        <div className="grid grid-cols-5 gap-2">
          {days.map(([d, n], i) => (
            <div key={d} className={cn("px-3 py-3 text-center", i === 1 ? "bg-lime" : "border border-ink/10")}>
              <p className="font-display text-xs text-ink/45">{d}</p>
              <p className="mt-1 font-display text-2xl">{n}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 divide-y divide-ink/5 border border-ink/10">
          {slots.map(([t, s]) => (
            <div key={t} className="flex items-center justify-between px-4 py-3">
              <span className="font-ui text-sm text-ink/50" dir="ltr">
                {t}
              </span>
              <span className={cn("font-display text-sm", s.includes("فراغ") ? "text-lime" : "text-ink")}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <aside className="overflow-auto px-4 py-4">
        <p className="font-display text-xs text-lime">اقتراح النظام</p>
        <p className="mt-3 font-display text-lg leading-snug">ثلاثاء ٥:٠٠ — ٣٠ دقيقة</p>
        <p className="mt-3 text-sm leading-loose text-ink/60">
          نورة طلبت بعد الدوام. لا يتعارض مع جلسة الغد ولا مع توكيل السالم.
        </p>
        <p className="mt-6 bg-lime px-4 py-2.5 text-center font-display text-sm">اعتماد الموعد</p>
        <p className="mt-8 font-display text-xs text-ink/40">تعارضات اليوم</p>
        <ul className="mt-3 space-y-2 font-display text-sm text-ink/65">
          <li>٨:٠٠ — جلسة النور في المحكمة.</li>
          <li>٨ مساءً — محجوز لجلسة الغد.</li>
        </ul>
      </aside>
    </div>
  );
}

function CrmView() {
  const files = [
    ["مؤسسة النور", "تجاري · ١٤٤٧/١٢", true],
    ["أبو فهد", "إيجار · ١٤٤٦/١٨", false],
    ["نورة السبيعي", "عمالي · ١٤٤٧/٠٩", false],
    ["روابي للتجارة", "عقد توريد · ١٤٤٧/٢١", false],
    ["خالد القصّاب", "تنفيذ · ١٤٤٦/٤٤", false],
    ["مكتب السالم", "أحوال · ١٤٤٧/٠٣", false],
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[16.5rem_minmax(0,1fr)_16rem]">
      <ul className="min-h-0 overflow-auto border-l border-ink/10">
        {files.map(([name, k, on]) => (
          <li key={String(name)} className={cn("flex gap-3 border-b border-ink/5 px-3 py-3", on && "bg-lime/30")}>
            <Initials name={String(name)} />
            <div>
              <p className="font-display text-sm">{name}</p>
              <p className="text-xs text-ink/45">{k}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-ink/10 px-4 py-3">
          <p className="font-display text-sm">مؤسسة النور — ١٤٤٧/١٢</p>
          <p className="mt-1 text-xs text-ink/45">رسائل · عقود · قضية · مواعيد · ناجز</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
          <p className="max-w-[80%] bg-ink/6 px-3 py-2 text-sm">السلام عليكم، جلسة الأحد باقية؟</p>
          <p className="mr-auto max-w-[80%] bg-lime px-3 py-2 text-sm">وعليكم السلام. باقية، الثامنة صباحًا. الملف مكتمل قبل الرفع إلى ناجز.</p>
          <p className="max-w-[80%] bg-ink/6 px-3 py-2 text-sm">تم، الله يعطيكم العافية. والتوكيل؟</p>
          <p className="mr-auto max-w-[80%] bg-lime px-3 py-2 text-sm">التوكيل في الملف، وصورة الهوية. ما ينقص شيء للرفع.</p>
        </div>
      </div>
      <aside className="overflow-auto border-r border-ink/10 px-4 py-4">
        <p className="font-display text-xs text-ink/40">الثبوت</p>
        <dl className="mt-3 space-y-3 font-display text-sm">
          {[
            ["النوع", "تجاري — توريد"],
            ["المحكمة", "تجارية بريدة"],
            ["الجلسة", "الأحد ٨:٠٠"],
            ["ناجز", "جاهز للرفع"],
            ["المسؤول", "سلطان الحربي"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-ink/40">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-1.5">
          <Pill tone="lime">جلسة اليوم</Pill>
          <Pill>توكيل مكتمل</Pill>
        </div>
      </aside>
    </div>
  );
}

function StaffView() {
  const rows = [
    ["سلطان الحربي", "محامي", "جلسة النور ٨:٠٠", "في المحكمة", "كامل"],
    ["هند العلي", "إدارة المكتب", "توكيلات اليوم", "على المكتب", "محدود"],
    ["ماجد", "سكرتارية", "مواعيد الغد", "يرد الآن", "مواعيد"],
    ["أبو فيصل", "الشريك", "اعتماد لائحة ١٤٤٧/٠٩", "مكتب", "كامل"],
  ];
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-right">
        <thead className="font-display text-xs text-ink/40">
          <tr className="border-b border-ink/10">
            {["الاسم", "الدور", "مهمة اليوم", "المكان", "الصلاحية"].map((h) => (
              <th key={h} className="px-5 py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-display text-sm">
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-ink/5">
              {r.map((c, i) => (
                <td key={c} className="px-5 py-3.5">
                  {i === 4 ? <Pill tone={c === "كامل" ? "lime" : "mute"}>{c}</Pill> : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-3 border-t border-ink/10">
        {[
          ["٣", "على المكتب"],
          ["١", "في المحكمة"],
          ["٠", "إجازة"],
        ].map(([n, l]) => (
          <div key={l} className="border-l border-ink/10 px-5 py-4 last:border-0">
            <p className="font-display text-2xl">{n}</p>
            <p className="mt-1 text-xs text-ink/45">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsView() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_18rem]">
      <div className="min-h-0 overflow-auto border-l border-ink/10 p-6 text-sm leading-loose text-ink/75">
        <p className="font-display text-ink">عقد توريد — مؤسسة النور · ١٤٤٧/٢١</p>
        <p className="mt-4 text-xs text-ink/40">مسودة الذكاء · بانتظار اعتماد المحامي</p>
        <p className="mt-6">البند ٤ — التسليم: خلال ١٥ يوم عمل من أمر الشراء، في مستودع بريدة.</p>
        <p className="mt-4">البند ٧ — الغرامة:</p>
        <p className="mt-2 bg-lime/40 px-3 py-2 text-ink">
          «في حال التأخير تُستحق غرامة حسب ما يراه الطرف الأول.»
        </p>
        <p className="mt-4">البند ٩ — الضمان: سنة على العيوب الخفية من تاريخ الاستلام.</p>
        <p className="mt-4">البند ١٢ — الاختصاص: محاكم بريدة التجارية.</p>
        <p className="mt-4">البند ١٤ — إنهاء العقد: بإشعار ٣٠ يومًا، دون المساس بالمستحقات القائمة.</p>
      </div>
      <aside className="overflow-auto px-4 py-4">
        <p className="font-display text-xs text-lime">ملاحظات النظام</p>
        <ul className="mt-3 space-y-3 font-display text-sm leading-relaxed">
          <li className="text-ink">الغرامة غير محددة — خطر.</li>
          <li className="text-ink">لا سقف للتعويض.</li>
          <li className="text-ink/55">الاختصاص واضح.</li>
          <li className="text-ink/55">التسليم مربوط بمكان محدد.</li>
        </ul>
        <p className="mt-8 bg-lime px-3 py-2.5 text-center font-display text-sm">اعتماد الصياغة</p>
        <p className="mt-3 border border-ink/15 px-3 py-2.5 text-center font-display text-sm">أعد الصياغة</p>
      </aside>
    </div>
  );
}

function CasesView() {
  const cols = [
    { name: "قيد الإعداد", items: ["١٤٤٧/٠٩ نورة — لائحة", "١٤٤٦/١٨ أبو فهد — مذكرة"] },
    { name: "جاهز للرفع", items: ["١٤٤٧/١٢ النور — ملف مكتمل", "١٤٤٧/٠٣ السالم — توكيل"] },
    { name: "رُفع إلى ناجز", items: ["١٤٤٦/٤٤ القصّاب", "١٤٤٧/٠١ العمالي"] },
    { name: "لها رقم", items: ["٤١٠٢١٩٨ — تنفيذ", "٤١٠١٨٨٤ — تجاري"] },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-ink/10 px-4 py-2.5 font-display text-xs text-ink/45">
        الذكاء يرتّب اللائحة. أنت تعتمد. ثم يُرفع إلى ناجز.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-4">
        {cols.map((c, i) => (
          <div key={c.name} className={cn("min-h-0 overflow-auto p-3", i !== 0 && "border-r border-ink/10")}>
            <p className="mb-3 font-display text-xs text-lime">
              {c.name} · {c.items.length}
            </p>
            {c.items.map((it) => (
              <p key={it} className="mb-2 border border-ink/10 bg-snow px-3 py-3 font-display text-sm leading-relaxed">
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
    <div className="grid h-full min-h-0 grid-cols-[1fr_17rem]">
      <div className="relative min-h-0 bg-ink">
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative flex flex-col items-center justify-center border-l border-hair">
            <span className="flex size-28 items-center justify-center bg-lime font-display text-4xl text-ink">س</span>
            <p className="mt-4 font-display text-sm text-snow">سلطان الحربي — مكتب واصل</p>
          </div>
          <div className="relative flex flex-col items-center justify-center">
            <span className="flex size-28 items-center justify-center bg-snow font-display text-4xl text-ink">ن</span>
            <p className="mt-4 font-display text-sm text-snow/80">الموكل — مؤسسة النور</p>
          </div>
        </div>
        <p className="absolute top-4 right-4 font-display text-xs text-lime">سرية · داخل المنصة · ٤٢:١٨</p>
      </div>
      <aside className="overflow-auto border-r border-ink/10 px-4 py-4">
        <p className="font-display text-xs text-lime">مذكرة الجلسة</p>
        <p className="mt-3 text-sm leading-loose text-ink/65">
          اتفق الطرفان على مهلة ٧ أيام لتسليم المستندات الناقصة. تُحفظ المذكرة في ملف العميل نفسه، لا في منصة خارجة.
        </p>
        <p className="mt-6 font-display text-xs text-ink/40">الحضور</p>
        <ul className="mt-2 space-y-1 font-display text-sm">
          <li>سلطان الحربي</li>
          <li>ممثل مؤسسة النور</li>
        </ul>
        <p className="mt-8 border border-ink/15 px-3 py-2.5 text-center font-display text-sm">إنهاء الجلسة</p>
      </aside>
    </div>
  );
}
