import { ClipboardList, KeyRound, MessageCircle, Plus } from "lucide-react";
import type { NavItem } from "@/components/dash/shell";

/** Sidebar of the customer area. */
export const CLIENT_NAV: NavItem[] = [
  { href: "#requests", label: "طلباتي", icon: ClipboardList, active: true },
  { href: "/start", label: "طلب جديد", icon: Plus },
  { href: "#contact", label: "تواصل معنا", icon: MessageCircle },
  { href: "/client/keys", label: "مفاتيح API", icon: KeyRound },
];
