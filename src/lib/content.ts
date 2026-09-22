export const phone = {
  display: "0165107138",
  tel: "+966165107138",
  wa: "https://wa.me/966165107138",
} as const;

export const nav = [
  { href: "/", label: "الرئيسية" },
  { href: "/#instant", label: "الحل اللحظي" },
  { href: "/#law", label: "للمحامين" },
  { href: "/#ai", label: "الذكاء الاصطناعي" },
  { href: "/start", label: "اطلب خدمتك" },
  { href: "/#works", label: "أعمالنا" },
  { href: "/#about", label: "من نحن" },
  { href: "/client", label: "مشاريعي" },
  { href: "/#contact", label: "تواصل معنا" },
] as const;

export const services = [
  {
    slug: "crm",
    n: "01",
    title: "الحل اللحظي",
    body: "نظام CRM متكامل مع واتساب وكول سنتر. نعطيك السلوشن لحظي: رقم جوال، رد سريع، وكل المحادثات في شاشة واحدة.",
  },
  {
    slug: "law",
    n: "02",
    title: "مكتب المحامي",
    body: "نظام متكامل لإدارة المكتب القانوني: موقع وصفحة ثبوت، حجوزات بالذكاء الاصطناعي، عملاء وموظفون، عقود وقضايا، واستشارات فيديو من داخل الموقع.",
  },
  {
    slug: "ai",
    n: "03",
    title: "استخدام الذكاء الاصطناعي",
    body: "مو روبوت. نظام سعودي — من عيالنا. يتحمل اللهجات، يرد بأسلوبك، يفاوت بين العملاء، يوجّه المحادثات، ويدير المنصات والنشر. إدارة فعلية تنوب عن الموظف في آخر الخط.",
  },
  {
    slug: "brand",
    n: "04",
    title: "بناء العلامة التجارية",
    body: "نصنع لعلامتك هوية متكاملة تعبّر عن قصتها وقيمها، وتمنحها حضورًا مميزًا يرسخ في ذهن جمهورها.",
  },
  {
    slug: "influencers",
    n: "05",
    title: "التسويق عبر المؤثرين",
    body: "نختار المؤثرين الأنسب لعلامتك، ونبتكر حملات مؤثرة تصل إلى جمهورك بأسلوب طبيعي يحقق الانتشار والتفاعل.",
  },
  {
    slug: "production",
    n: "06",
    title: "التصوير والإنتاج المرئي",
    body: "نقدّم تصوير المنتجات والفعاليات والفيديو والمحتوى الإعلاني، لنحوّل أفكارك إلى مشاهد احترافية تحكي قصة علامتك.",
  },
  {
    slug: "events",
    n: "07",
    title: "تنظيم الفعاليات",
    body: "نخطط ونصمم وننفذ الفعاليات والمعارض والمؤتمرات، ونهتم بجميع التفاصيل لنصنع تجربة متكاملة لا تُنسى.",
  },
  {
    slug: "media",
    n: "08",
    title: "إدارة المراكز الإعلامية",
    body: "ندير التغطيات والمحتوى والتواصل الإعلامي باحترافية، لنضمن حضورًا منظمًا ورسالة واضحة تصل إلى الجمهور في الوقت المناسب.",
  },
] as const;

export type Service = (typeof services)[number];

export function serviceBySlug(slug: string) {
  return services.find((s) => s.slug === slug);
}

export const lawModules = [
  {
    n: "01",
    title: "موقع وصفحة ثبوت",
    body: "حضور رقمي يليق بالمكتب، وصفحة ثبوت تبني الثقة من أول زيارة.",
  },
  {
    n: "02",
    title: "حجوزات بالذكاء الاصطناعي",
    body: "الموعد يُحجز وحده. بلا تنسيق يدوي، وبلا فوضى في الجدول.",
  },
  {
    n: "03",
    title: "إدارة العملاء والردود",
    body: "كل ملف ومحادثة في شاشة واحدة. الرد يصل في وقته، والسياق لا يضيع.",
  },
  {
    n: "04",
    title: "إدارة الموظفين والمكتب",
    body: "صلاحيات ومهام ومتابعة يومية. المكتب يعمل كنظام واحد، لا كجزر متفرقة.",
  },
  {
    n: "05",
    title: "تحليل العقود",
    body: "يقرأ العقد، يستخرج المخاطر، ويعيد الصياغة بلغة قانونية أوضح.",
  },
  {
    n: "06",
    title: "رفع القضايا",
    body: "مسار منظم من التوكيل حتى المرافعة، بملف رقمي مكتمل.",
  },
  {
    n: "07",
    title: "استشارات الفيديو",
    body: "جلسة الفيديو داخل موقع المحامي. سرية، ووقار، وحضور يليق بالمهنة.",
  },
  {
    n: "08",
    title: "التسويق من الداخل",
    body: "يظهر المكتب لمن يبحث عن محامٍ، دون أن يخرج عن هيبته.",
  },
] as const;

export const aiModules = [
  {
    n: "01",
    title: "يتحمل اللهجات",
    body: "نجدية، قصيمية، حجازية. يفهم الكلام كما يُقال، ويرد كما يُرد عندك في المحل.",
  },
  {
    n: "02",
    title: "يرد بأسلوبك",
    body: "يتعلّم نبرتك. مو جمل جاهزة. كل عميل له رد، وكل رد على مقاس المحادثة.",
  },
  {
    n: "03",
    title: "يفاوت بين العملاء",
    body: "الزبون الدائم غير الزبون الجديد. يعرف الفرق، وما يخلط الملفات.",
  },
  {
    n: "04",
    title: "يوجّه المحادثات",
    body: "يرد هو، أو يحوّل لك، أو يقفل الموضوع. التوجيه شغل، مو زر تحويل.",
  },
  {
    n: "05",
    title: "يدير المنصات والنشر",
    body: "تيك توك وباقي القنوات: الجدولة، النشر، والردود من شاشة واحدة.",
  },
  {
    n: "06",
    title: "ينوب عن آخر السلسلة",
    body: "مو إدارة فلسفية. يخلّص شغل الموظف في نهاية الخط: يرد، يوجّه، يتابع، يقفل.",
  },
] as const;

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
    text: "نؤمن في ديل أن التأثير الحقيقي لا يأتي صدفة؛ بل تصنعه فكرة واضحة، وإبداع متجدد، وتنفيذ احترافي.",
    by: "خالد العنزي",
  },
  {
    text: "في ديل، لا نسعى إلى الظهور فقط؛ بل نصنع حضورًا يترك أثرًا، ونحوّل الأفكار إلى نجاحات مستدامة.",
    by: "خالد العنزي",
  },
] as const;

export const clients = ["NORAH", "QIDDIYA", "DIRIYAH", "STC", "ROSHN", "NEOM"] as const;

export const heroSlides = [
  { src: "/video/hero.mp4", poster: "/images/hero.jpg" },
  { src: "/video/about.mp4", poster: "/images/about.jpg" },
] as const;

export const lawShots = [
  { image: "/images/law-site.jpg", n: "01", title: "موقع وصفحة ثبوت" },
  { image: "/images/law-book.jpg", n: "02", title: "حجوزات بالذكاء الاصطناعي" },
  { image: "/images/law-phone.jpg", n: "03", title: "إدارة العملاء والردود" },
  { image: "/images/law-doc.jpg", n: "04", title: "العقود والقضايا والفيديو" },
] as const;
