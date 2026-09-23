import { CalendarDays, FileText, ListChecks, Scale, UserRound, Video } from "lucide-react";
import type { ComponentType } from "react";

/**
 * The practice modules of «مكتب المحامي» (phase 2) — the app navigation and
 * the /law feature list read from here.
 */
export type ModuleId = "appointments" | "consultations" | "clients" | "cases" | "tasks" | "documents";

export type LawModule = {
  id: ModuleId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  points: string[];
};

export const MODULES: readonly LawModule[] = [
  {
    id: "appointments",
    label: "المواعيد",
    icon: CalendarDays,
    title: "المواعيد والتقويم",
    blurb: "تقويم أسبوعي للمكتب يجمع الجلسات والمواعيد والاستشارات لكل عضو في الفريق.",
    points: ["عرض أسبوعي على الحاسب ويومي على الجوال", "تصفية حسب المحامي", "ساعات العمل ومدة الموعد والفاصل بين المواعيد"],
  },
  {
    id: "consultations",
    label: "الاستشارات",
    icon: Video,
    title: "الاستشارات عن بُعد",
    blurb: "استشارات بالفيديو أو بالهاتف أو حضوريًا، مع صفحة حجز إلكتروني لمكتبك يحجز منها العميل بنفسه.",
    points: [
      "مكالمة فيديو داخل المتصفح دون تطبيق، مع غرفة انتظار يسمح منها المحامي بدخول العميل",
      "صفحة حجز عامة تعرض الأوقات المتاحة فعلًا",
      "رابط خاص لكل عميل، وملاحظات خاصة بالمحامي بعد المكالمة",
    ],
  },
  {
    id: "clients",
    label: "العملاء",
    icon: UserRound,
    title: "ملفات العملاء",
    blurb: "ملف واحد لكل عميل، فردًا أو منشأة: بياناته وقضاياه ومواعيده ومستنداته وسجل ملاحظاته.",
    points: ["بحث بالاسم أو الجوال أو رقم الهوية", "وسوم لتصنيف العملاء", "سجل ملاحظات داخلي"],
  },
  {
    id: "cases",
    label: "القضايا",
    icon: Scale,
    title: "إدارة القضايا",
    blurb: "تابع كل قضية من الاستشارة إلى التنفيذ: المرحلة، الجلسات، المهام، الأتعاب والمستندات.",
    points: ["مراحل واضحة من الاستشارة حتى الإغلاق", "جلسات بتاريخها وقاعتها ونتيجتها", "أتعاب ودفعات لا يراها إلا المحامون"],
  },
  {
    id: "tasks",
    label: "المهام",
    icon: ListChecks,
    title: "المهام",
    blurb: "مهام مسندة لأعضاء الفريق، مرتبطة بقضية أو مستقلة، مع تاريخ استحقاق.",
    points: ["مهامي ومهام اليوم في الرئيسية", "تنبيه للمهام المتأخرة", "إسناد لأي عضو في الفريق"],
  },
  {
    id: "documents",
    label: "المستندات",
    icon: FileText,
    title: "المستندات",
    blurb: "مستندات المكتب في مجلدات حسب العميل والقضية، محفوظة بصلاحيات المكتب.",
    points: ["رفع حتى 10 ملفات في المرة", "فحص نوع الملف ومحتواه قبل الحفظ", "مساحة تخزين حسب الخطة"],
  },
];

export function moduleById(id: string): LawModule | undefined {
  return MODULES.find((m) => m.id === id);
}
