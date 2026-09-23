/**
 * Editorial photography for the public site (free Unsplash license; sources
 * and photographers in docs/photo-credits.md). Every file is generated under
 * /public/photos as `<name>-<w>.avif|webp`. The people are illustrative of the
 * service context only: never present them as DEAL clients or staff.
 */
export const photos = {
  "hero-man": { widths: [640, 1200], width: 1200, height: 1500 },
  "hero-woman": { widths: [480, 900], width: 900, height: 1125 },
  "ops-desk": { widths: [480, 900], width: 900, height: 675 },
  "team-talk": { widths: [800, 1600], width: 1600, height: 1066 },
  portrait: { widths: [800, 1600], width: 1600, height: 1066 },
  shopkeeper: { widths: [640, 1200], width: 1200, height: 1500 },
  handshake: { widths: [640, 1200], width: 1200, height: 800 },
  "pay-qr": { widths: [640, 1200], width: 1200, height: 1500 },
  "brand-abaya": { widths: [640, 1200], width: 1200, height: 1500 },
  "audience-phone": { widths: [640, 1200], width: 1200, height: 800 },
  studio: { widths: [800, 1600], width: 1600, height: 1066 },
  conference: { widths: [800, 1600], width: 1600, height: 1066 },
  microphone: { widths: [640, 1200], width: 1200, height: 800 },
  najd: { widths: [800, 1600], width: 1600, height: 1066 },
  "riyadh-road": { widths: [640, 1200], width: 1200, height: 1500 },
  analyst: { widths: [640, 1200], width: 1200, height: 800 },
} as const satisfies Record<string, { widths: readonly number[]; width: number; height: number }>;

export type PhotoName = keyof typeof photos;

/** One photograph per service, with Arabic alt text describing the scene (not the service). */
export const servicePhotos: Record<string, { name: PhotoName; alt: string; position?: string }> = {
  crm: { name: "shopkeeper", alt: "صاحب محل بزيّ خليجي يقف أمام متجره", position: "50% 58%" },
  law: { name: "handshake", alt: "مصافحة على طاولة اجتماع فوقها ملف عقد", position: "50% 50%" },
  ai: {
    name: "hero-woman",
    alt: "موظفة بحجاب تحمل حاسوبها المحمول في مساحة عمل",
    position: "50% 38%",
  },
  pay: {
    name: "pay-qr",
    alt: "جوالان متقابلان لإتمام دفع برمز QR عند نقطة البيع",
    position: "50% 45%",
  },
  brand: { name: "brand-abaya", alt: "جلسة تصوير لعبايات بتصميم هادئ", position: "50% 40%" },
  influencers: {
    name: "audience-phone",
    alt: "سيدتان بعباءة ونقاب تتابع إحداهما جوالها",
    position: "60% 50%",
  },
  production: {
    name: "studio",
    alt: "فريق تصوير يجهّز الكاميرات والإضاءة في استوديو",
    position: "50% 50%",
  },
  events: {
    name: "conference",
    alt: "متحدث على المسرح أمام قاعة مؤتمر ممتلئة",
    position: "50% 70%",
  },
  media: { name: "microphone", alt: "ميكروفون على منصة مؤتمر صحفي", position: "35% 50%" },
};
