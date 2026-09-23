/**
 * The desks' navigation (sidebar and mobile tab row) and product names, kept
 * apart from the desk components so the routes can build document titles.
 */
import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  FileText,
  FolderOpen,
  Headset,
  Inbox as InboxIcon,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  ReceiptText,
  Scale,
  Smartphone,
  Sparkles,
  UserCog,
  Users,
  Video,
} from "lucide-react";
import type { DeskNavItem } from "@/components/desk-frame";

/** "<view> — <product>", for the desk routes' document titles. */
function deskTitle(nav: readonly DeskNavItem[], view: string, product: string) {
  const item = nav.find((n) => n.id === view);
  return item ? `${item.label} — ${product}` : product;
}

export const crmNav = [
  { id: "home", label: "غرفة العمليات", icon: LayoutGrid },
  { id: "inbox", label: "الوارد", icon: InboxIcon, badge: 7 },
  { id: "calls", label: "الكول سنتر", icon: Headset, badge: 4 },
  { id: "ai", label: "الذكاء يدير", icon: Sparkles },
] as const satisfies readonly DeskNavItem[];

export const crmMore: DeskNavItem[] = [
  { id: "customers", label: "العملاء", icon: Users },
  { id: "reports", label: "التقارير", icon: BarChart3 },
];

export type CrmView = (typeof crmNav)[number]["id"];

export const CRM_PRODUCT = "الحل اللحظي";

/** Document title for a CRM desk view, e.g. "غرفة العمليات — الحل اللحظي". */
export const crmDeskTitle = (view: string) => deskTitle(crmNav, view, CRM_PRODUCT);

export const lawNav = [
  { id: "home", label: "لوحة التحكم", icon: LayoutDashboard },
  { id: "book", label: "المواعيد", icon: CalendarDays, badge: 2 },
  { id: "crm", label: "ملفات العملاء", icon: FolderOpen },
  { id: "cases", label: "القضايا وناجز", icon: Scale },
  { id: "docs", label: "العقود", icon: FileText, badge: 4 },
  { id: "video", label: "جلسة الفيديو", icon: Video },
  { id: "staff", label: "الفريق", icon: UserCog },
] as const satisfies readonly DeskNavItem[];

export type LawView = (typeof lawNav)[number]["id"];

export const LAW_PRODUCT = "مكتب المحامي";

/** Document title for a law desk view, e.g. "المواعيد — مكتب المحامي". */
export const lawDeskTitle = (view: string) => deskTitle(lawNav, view, LAW_PRODUCT);

export const payNav = [
  { id: "home", label: "التحصيل", icon: LayoutDashboard },
  { id: "pay", label: "روابط الدفع", icon: Link2, badge: 12 },
  { id: "bills", label: "الفواتير", icon: ReceiptText },
  { id: "pos", label: "نقطة البيع", icon: Smartphone },
] as const satisfies readonly DeskNavItem[];

export const payMore: DeskNavItem[] = [
  { id: "tx", label: "العمليات", icon: ArrowLeftRight },
  { id: "settle", label: "التسويات", icon: Landmark },
];

export type PayView = (typeof payNav)[number]["id"];

export const PAY_PRODUCT = "مبسط باي";

/** Document title for a pay desk view, e.g. "الفواتير — مبسط باي". */
export const payDeskTitle = (view: string) => deskTitle(payNav, view, PAY_PRODUCT);
