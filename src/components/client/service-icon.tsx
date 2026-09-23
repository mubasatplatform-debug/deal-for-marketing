import {
  BrainCircuit,
  Clapperboard,
  CreditCard,
  FileText,
  Headset,
  Megaphone,
  PenTool,
  RadioTower,
  Scale,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  crm: Headset,
  law: Scale,
  ai: BrainCircuit,
  pay: CreditCard,
  brand: PenTool,
  influencers: Megaphone,
  production: Clapperboard,
  events: Ticket,
  media: RadioTower,
};

function serviceIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? FileText;
}

/** Rounded tile that identifies a service at a glance. */
export function ServiceTile({
  slug,
  size = "md",
  className,
}: {
  slug: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = serviceIcon(slug);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center bg-pine-50 text-pine",
        size === "sm" && "size-9 rounded-[10px]",
        size === "md" && "size-10 rounded-xl",
        size === "lg" && "size-12 rounded-[14px]",
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-[22px]" : "size-[18px]"} strokeWidth={1.75} />
    </span>
  );
}
