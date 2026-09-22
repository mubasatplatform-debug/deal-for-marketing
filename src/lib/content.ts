export const phone = {
  display: "0548127444",
  tel: "+966548127444",
  wa: "https://wa.me/966548127444",
} as const;

export const nav = [
  { href: "/", label: "الرئيسية" },
  { href: "/#instant", label: "الحل اللحظي" },
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
    slug: "brand",
    n: "02",
    title: "بناء العلامة التجارية",
    body: "نصنع لعلامتك هوية متكاملة تعبّر عن قصتها وقيمها، وتمنحها حضورًا مميزًا يرسخ في ذهن جمهورها.",
  },
  {
    slug: "influencers",
    n: "03",
    title: "التسويق عبر المؤثرين",
    body: "نختار المؤثرين الأنسب لعلامتك، ونبتكر حملات مؤثرة تصل إلى جمهورك بأسلوب طبيعي يحقق الانتشار والتفاعل.",
  },
  {
    slug: "production",
    n: "04",
    title: "التصوير والإنتاج المرئي",
    body: "نقدّم تصوير المنتجات والفعاليات والفيديو والمحتوى الإعلاني، لنحوّل أفكارك إلى مشاهد احترافية تحكي قصة علامتك.",
  },
  {
    slug: "events",
    n: "05",
    title: "تنظيم الفعاليات",
    body: "نخطط ونصمم وننفذ الفعاليات والمعارض والمؤتمرات، ونهتم بجميع التفاصيل لنصنع تجربة متكاملة لا تُنسى.",
  },
  {
    slug: "media",
    n: "06",
    title: "إدارة المراكز الإعلامية",
    body: "ندير التغطيات والمحتوى والتواصل الإعلامي باحترافية، لنضمن حضورًا منظمًا ورسالة واضحة تصل إلى الجمهور في الوقت المناسب.",
  },
] as const;

export type Service = (typeof services)[number];

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
  { src: "/video/chairman.mp4", poster: "/images/chairman-now.jpg" },
] as const;
