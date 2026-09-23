/** Landline for calls. WhatsApp runs on the mobile line (`mobile`). */
export const phone = {
  display: "0165107138",
  tel: "+966165107138",
  wa: "https://wa.me/966571920000",
} as const;

export const mobile = {
  display: "0571920000",
  tel: "+966571920000",
  /** Digits only, for wa.me links (`https://wa.me/${mobile.wa}?text=…`). */
  wa: "966571920000",
} as const;

export const nav = [
  { href: "/", label: "الرئيسية" },
  { href: "/#systems", label: "الأنظمة" },
  { href: "/line", label: "خط ديل" },
  { href: "/law", label: "مكتب المحامي" },
  { href: "/#works", label: "أعمالنا" },
  { href: "/#about", label: "من نحن" },
  { href: "/start", label: "اطلب خدمتك" },
  { href: "/client", label: "مشاريعي" },
  { href: "/#contact", label: "تواصل معنا" },
] as const;

export const systems = [
  { href: "/#instant", n: "01", title: "الحل اللحظي", line: "واتساب وكول سنتر. الذكاء يدير الخط." },
  { href: "/#law", n: "02", title: "مكتب المحامي", line: "من الملف إلى ناجز، والفيديو من داخل الموقع." },
  { href: "/#ai", n: "03", title: "ذكاء سعودي", line: "لهجتك، أسلوبك، وينوب عن آخر السلسلة." },
  { href: "/#pay", n: "04", title: "الدفع المبسط", line: "مبسط × ادفع باي. رابط، فاتورة، سوفت POS." },
] as const;

export const services = [
  {
    slug: "crm",
    n: "01",
    title: "الحل اللحظي",
    body: "كول سنتر وواتساب: الذكاء يرد بلهجتكم، يراجع هل الزبون سدّد، هل الطلب واصل، ويحوّل لك إذا احتجت. أنت لا تدخل إلا إذا احتاجك.",
  },
  {
    slug: "law",
    n: "02",
    title: "مكتب المحامي",
    body: "نظام المكتب القانوني كاملًا: ثبوت، حجوزات، CRM، موظفون، عقود، رفع إلى ناجز، وجلسات فيديو من داخل الموقع.",
  },
  {
    slug: "ai",
    n: "03",
    title: "استخدام الذكاء الاصطناعي",
    body: "مو روبوت. نظام سعودي — يتحمل اللهجات، يرد بأسلوب المحل، يراجع ملف الزبون، ويدير الخط حتى يقفل.",
  },
  {
    slug: "pay",
    n: "04",
    title: "الدفع المبسط",
    body: "من منصة مبسط وعلى بوابة ادفع باي: رابط دفع، فاتورة إلكترونية، والجوال نقطة بيع. مرخّصة، والتسوية سريعة.",
  },
  {
    slug: "brand",
    n: "05",
    title: "بناء العلامة التجارية",
    body: "نصنع لعلامتك هوية متكاملة تعبّر عن قصتها وقيمها، وتمنحها حضورًا مميزًا يرسخ في ذهن جمهورها.",
  },
  {
    slug: "influencers",
    n: "06",
    title: "التسويق عبر المؤثرين",
    body: "نختار المؤثرين الأنسب لعلامتك، ونبتكر حملات مؤثرة تصل إلى جمهورك بأسلوب طبيعي يحقق الانتشار والتفاعل.",
  },
  {
    slug: "production",
    n: "07",
    title: "التصوير والإنتاج المرئي",
    body: "نقدّم تصوير المنتجات والفعاليات والفيديو والمحتوى الإعلاني، لنحوّل أفكارك إلى مشاهد احترافية تحكي قصة علامتك.",
  },
  {
    slug: "events",
    n: "08",
    title: "تنظيم الفعاليات",
    body: "نخطط ونصمم وننفذ الفعاليات والمعارض والمؤتمرات، ونهتم بجميع التفاصيل لنصنع تجربة متكاملة لا تُنسى.",
  },
  {
    slug: "media",
    n: "09",
    title: "إدارة المراكز الإعلامية",
    body: "ندير التغطيات والمحتوى والتواصل الإعلامي باحترافية، لنضمن حضورًا منظمًا ورسالة واضحة تصل إلى الجمهور في الوقت المناسب.",
  },
] as const;

export type Service = (typeof services)[number];

export const agency = services.filter((s) => ["brand", "influencers", "production", "events", "media"].includes(s.slug));

export const lineStarters = [
  {
    label: "تتبع الطلب",
    text: "السلام عليكم، طلبي رقم ٣٨١٢ وصل ولا باقي؟",
  },
  {
    label: "السداد",
    text: "أخوي أنا دفعت الفاتورة ولا زال يطلبني المبلغ؟",
  },
  {
    label: "موعد",
    text: "أبغى ألغي الموعد حق بعد العشاء وأحوّله ليوم ثاني.",
  },
  {
    label: "خط المحل",
    text: "عندي محل في بريدة والواتساب يذبحنا. أبغى الخط يرد على الزبائن بلهجتنا.",
  },
] as const;

export function serviceBySlug(slug: string) {
  return services.find((s) => s.slug === slug);
}

export const requestStatus: Record<string, string> = {
  new: "طلب جديد",
  review: "قيد المراجعة",
  production: "قيد التنفيذ",
  delivered: "تم التسليم",
};

export const works = [
  {
    image: "/images/work-beat.jpg",
    ar: "تصميم تجربة وهوية صوتية",
    title: "UI/UX design for SEO and marketing Startup",
    cats: "Copywriting · UI/UX Design",
  },
  {
    image: "/images/work-desert.jpg",
    ar: "هوية بصرية لوجهة سياحية",
    title: "Brand identity for silicon valley startup",
    cats: "Copywriting · Branding",
  },
  {
    image: "/images/work-app.jpg",
    ar: "تصميم تطبيق فريد",
    title: "Unique app design for fortune 500",
    cats: "UI/UX Design · Product",
  },
  {
    image: "/images/work-luxe.jpg",
    ar: "إنتاج مرئي لعلامة فاخرة",
    title: "Cinematic product film & stills",
    cats: "Production · Art Direction",
  },
  {
    image: "/images/work-event.jpg",
    ar: "تغطية وإدارة فعالية كبرى",
    title: "Live event identity & media center",
    cats: "Events · Media",
  },
  {
    image: "/images/work-shop.jpg",
    ar: "تجربة تجارة إلكترونية",
    title: "E-commerce experience design",
    cats: "UX · Commerce",
  },
] as const;

export const quotes = [
  {
    text: "أبو فيصل لا يجمّل النقص. يكره الخطأ فيعالج أصله، ويخوض الصعب حتى ينفتح الطريق لغيره. صفقة التاجر، وتشخيص الطبيب، وحجة المحامي — في معيار واحد لا يقبل أنصاف الحلول.",
    by: "خالد العنزي — أبو فيصل",
  },
  {
    text: "المعيار ليس شعارًا نعلّقه. إما أن يرتفع العمل إلى مستواه، أو لا يستحق أن يُوقَّع باسم ديل.",
    by: "خالد العنزي — أبو فيصل",
  },
  {
    text: "التأثير لا يأتي صدفة. تصنعه فكرة واضحة، وعقل لا يهادن الغلط، وتنفيذ يبلغ غايته.",
    by: "خالد العنزي",
  },
] as const;

export const clients = ["NORAH", "QIDDIYA", "DIRIYAH", "STC", "ROSHN", "NEOM"] as const;
