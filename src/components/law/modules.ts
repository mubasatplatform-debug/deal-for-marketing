import { CalendarDays, FileText, FolderOpen, Scale } from "lucide-react";
import type { ComponentType } from "react";

/**
 * The practice modules of «مكتب المحامي». Phase 1 ships the office, team and
 * subscription; these arrive in phase 2 and show a "قريبًا" page meanwhile,
 * with a link to the matching view of the public demo (/desk/law/*).
 */
export type ModuleId = "appointments" | "clients" | "cases" | "documents";

export type LawModule = {
  id: ModuleId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  points: string[];
  /** The demo view that shows the idea (mock data). */
  demo: string;
};

export const MODULES: readonly LawModule[] = [
  {
    id: "appointments",
    label: "المواعيد",
    icon: CalendarDays,
    title: "المواعيد والحجوزات",
    blurb: "تقويم المكتب لكل المحامين: استشارات، جلسات، ومواعيد العملاء في مكان واحد.",
    points: ["تقويم أسبوعي لكل عضو في الفريق", "حجز استشارة من رابط تشاركه مع العميل", "تذكير قبل الموعد"],
    demo: "/desk/law/book",
  },
  {
    id: "clients",
    label: "العملاء",
    icon: FolderOpen,
    title: "ملفات العملاء",
    blurb: "ملف واحد لكل عميل: بياناته، قضاياه، مستنداته، ومواعيده.",
    points: ["ملف موحّد لكل عميل", "سجل تواصل وملاحظات داخلية", "صلاحيات تحدد من يرى ماذا"],
    demo: "/desk/law/crm",
  },
  {
    id: "cases",
    label: "القضايا",
    icon: Scale,
    title: "إدارة القضايا",
    blurb: "تابع كل قضية من فتح الملف إلى الحكم: المراحل، الجلسات، والمهام.",
    points: ["مراحل واضحة لكل قضية", "جلسات ومهام مسندة لأعضاء الفريق", "لوحة لما يستحق اليوم"],
    demo: "/desk/law/cases",
  },
  {
    id: "documents",
    label: "المستندات",
    icon: FileText,
    title: "العقود والمستندات",
    blurb: "مستندات المكتب مرتبة حسب العميل والقضية، مع نماذج العقود.",
    points: ["أرشفة حسب العميل والقضية", "نماذج عقود قابلة لإعادة الاستخدام", "مسودات تنتظر اعتماد المحامي"],
    demo: "/desk/law/docs",
  },
];

export function moduleById(id: string): LawModule | undefined {
  return MODULES.find((m) => m.id === id);
}
