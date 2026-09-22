import { AppBar } from "@/components/product-tour";

export function LawThubut() {
  return (
    <div className="bg-snow text-ink">
      <AppBar title="موقع المكتب" crumb="الثبوت · عام" />
      <div className="grid md:grid-cols-[16rem_1fr]">
        <aside className="border-b border-ink/10 p-5 md:border-l md:border-b-0">
          <div className="flex size-16 items-center justify-center bg-lime font-display text-3xl text-ink">و</div>
          <p className="mt-4 font-display text-xl">مكتب واصل</p>
          <p className="mt-1 text-sm text-ink/45">للمحاماة والاستشارات</p>
          <p className="mt-4 text-sm leading-loose text-ink/60">القصيم — بريدة</p>
          <p className="mt-1 text-sm text-ink/60">ترخيص ١١٤٢</p>
          <span className="mt-6 inline-block bg-lime px-4 py-2 font-display text-sm text-ink">احجز استشارة</span>
        </aside>
        <div className="p-5">
          <p className="font-display text-xs text-lime">صفحة الثبوت</p>
          <h4 className="mt-2 font-display text-2xl">ما يثبت المكتب قبل أن تسأل.</h4>
          <ul className="mt-5 space-y-3">
            {[
              ["الترخيص", "ساري — وزارة العدل"],
              ["التخصص", "تجاري · عمالي · أحوال"],
              ["الخبرة", "١٢ سنة — ١٢٤ قضية"],
              ["العضوية", "الهيئة السعودية للمحامين"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between border-b border-ink/10 py-2">
                <span className="font-display text-ink">{k}</span>
                <span className="text-sm text-ink/50">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function LawBooking() {
  const days = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس"];
  const slots = ["٤:٠٠", "٥:٠٠", "٦:٣٠", "٨:٠٠"];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="الحجوزات" crumb="الذكاء يجدول · أنت تعتمد" />
      <div className="grid md:grid-cols-[1fr_14rem]">
        <div className="p-5">
          <p className="font-display text-sm text-ink/50">هذا الأسبوع — الاستشارات</p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {days.map((d, i) => (
              <div key={d} className={`p-2 text-center ${i === 2 ? "bg-lime" : "bg-ink/5"}`}>
                <p className="font-display text-xs text-ink/50">{d}</p>
                <p className="mt-1 font-display text-lg">{12 + i}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {slots.map((t, i) => (
              <span key={t} className={`px-4 py-2 font-display text-sm ${i === 1 ? "bg-lime text-ink" : "border border-ink/15"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <aside className="border-t border-ink/10 p-5 md:border-t-0 md:border-r">
          <p className="font-display text-xs text-lime">اقتراح النظام</p>
          <p className="mt-2 font-display text-lg">ثلاثاء ٥:٠٠ — ٣٠ دقيقة</p>
          <p className="mt-2 text-sm leading-loose text-ink/55">العميل طلب بعد الدوام. هذا أقرب فراغ بلا تعارض مع جلسة الغد.</p>
          <span className="mt-5 inline-block bg-lime px-4 py-2 font-display text-sm">اعتماد الموعد</span>
        </aside>
      </div>
    </div>
  );
}

export function LawClients() {
  return (
    <div className="bg-snow text-ink">
      <AppBar title="العملاء" crumb="ملف · محادثة · سياق واحد" />
      <div className="grid md:grid-cols-[14rem_1fr]">
        <ul className="border-b border-ink/10 md:border-l md:border-b-0">
          {[
            ["مؤسسة النور", "قضية تجارية", true],
            ["أبو فهد", "عقد إيجار", false],
            ["نورة السبيعي", "عمالي", false],
          ].map(([name, kind, on]) => (
            <li key={String(name)} className={`px-4 py-3 ${on ? "bg-lime/25" : ""}`}>
              <p className="font-display">{name}</p>
              <p className="text-xs text-ink/45">{kind}</p>
            </li>
          ))}
        </ul>
        <div className="p-5">
          <p className="font-display text-sm">مؤسسة النور — ١٤٤٧/١٢</p>
          <div className="mt-4 space-y-2">
            <p className="bg-ink/5 px-3 py-2 text-sm leading-relaxed">السلام عليكم، جلسة الأحد باقية؟</p>
            <p className="mr-8 bg-lime px-3 py-2 text-sm leading-relaxed">وعليكم السلام. باقية، الثامنة صباحًا. الملف مكتمل.</p>
            <p className="bg-ink/5 px-3 py-2 text-sm leading-relaxed">تم، الله يعطيكم العافية.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LawStaff() {
  const rows = [
    ["سلطان الحربي", "محامي", "جلسة النور", "في المحكمة"],
    ["هند العلي", "إدارة المكتب", "توكيلات اليوم", "على المكتب"],
    ["ماجد", "سكرتارية", "مواعيد الغد", "يرد الآن"],
  ];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="الموظفون" crumb="صلاحية · مهمة · حالة" />
      <div className="p-4">
        <div className="hidden grid-cols-4 border-b border-ink/10 py-2 font-display text-xs text-ink/40 md:grid">
          <span>الاسم</span>
          <span>الدور</span>
          <span>مهمة اليوم</span>
          <span>الحالة</span>
        </div>
        {rows.map((r) => (
          <div key={r[0]} className="border-b border-ink/5 py-3 md:grid md:grid-cols-4">
            <p className="font-display text-sm">{r[0]}</p>
            <p className="text-sm text-ink/50 md:text-ink">{r[1]}</p>
            <p className="hidden text-sm md:block">{r[2]}</p>
            <p className="font-display text-sm text-lime">{r[3]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LawContracts() {
  return (
    <div className="bg-snow text-ink">
      <AppBar title="تحليل العقود" crumb="يقرأ · يستخرج · يوضح" />
      <div className="grid md:grid-cols-[1fr_14rem]">
        <div className="p-5 text-sm leading-loose text-ink/70">
          <p>البند ٧ — الغرامة:</p>
          <p className="mt-2 bg-lime/30 px-2 py-1 text-ink">«في حال التأخير تُستحق غرامة حسب ما يراه الطرف الأول.»</p>
          <p className="mt-4">البند ١٢ — الاختصاص:</p>
          <p className="mt-1">المحاكم في مدينة بريدة هي المختصة بنظر أي نزاع.</p>
        </div>
        <aside className="border-t border-ink/10 p-5 md:border-t-0 md:border-r">
          <p className="font-display text-xs text-lime">ملاحظات النظام</p>
          <ul className="mt-3 space-y-3 font-display text-sm">
            <li>الغرامة غير محددة — خطر.</li>
            <li>لا يوجد سقف للتعويض.</li>
            <li>الاختصاص واضح.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

export function LawCases() {
  const cols = [
    { name: "توكيل", items: ["١٤٤٧/٠٩"] },
    { name: "قيد الدراسة", items: ["١٤٤٧/١٢"] },
    { name: "رُفعت", items: ["١٤٤٦/٤٤"] },
    { name: "جلسة", items: ["١٤٤٦/١٨"] },
  ];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="القضايا" crumb="من التوكيل إلى الجلسة" />
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

export function LawVideo() {
  return (
    <div className="bg-snow text-ink">
      <AppBar title="جلسة الفيديو" crumb="داخل الموقع · سرية" />
      <div className="grid md:grid-cols-[1fr_13rem]">
        <div className="relative min-h-52 bg-ink">
          <div className="absolute inset-6 border border-lime/40" />
          <p className="absolute top-4 right-4 font-display text-xs text-lime">سرية · ٤٢:١٨</p>
          <p className="absolute bottom-4 right-4 font-display text-snow">المحامي — مكتب واصل</p>
        </div>
        <aside className="p-4">
          <p className="font-display text-xs text-lime">ملاحظات الجلسة</p>
          <p className="mt-3 text-sm leading-loose text-ink/60">اتفق الطرفان على مهلة ٧ أيام لتسليم المستندات.</p>
          <span className="mt-6 inline-block border border-ink/15 px-3 py-2 font-display text-sm">إنهاء الجلسة</span>
        </aside>
      </div>
    </div>
  );
}

export function LawMarketing() {
  const posts = [
    ["مقال", "حقوق المستأجر في القصيم", "مجدول"],
    ["قصة", "سؤال الأسبوع", "نُشر"],
    ["تنويه", "إجازة العيد — المكتب", "قيدك"],
  ];
  return (
    <div className="bg-snow text-ink">
      <AppBar title="التسويق من الداخل" crumb="يظهر المكتب بهيبته" />
      <ul className="p-4">
        {posts.map(([k, t, s]) => (
          <li key={t} className="flex items-center justify-between border-b border-ink/10 py-3">
            <div>
              <p className="font-display text-xs text-ink/40">{k}</p>
              <p className="font-display text-ink">{t}</p>
            </div>
            <span className="font-display text-sm text-lime">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
