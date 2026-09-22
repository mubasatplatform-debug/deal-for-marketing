import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DeskFrame({
  brand,
  office,
  crumb,
  view,
  items,
  children,
}: {
  brand: string;
  office: string;
  crumb: string;
  view: string;
  items: readonly { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-ink text-snow" dir="rtl">
      <aside className="flex w-56 shrink-0 flex-col border-l border-hair bg-ink">
        <div className="border-b border-hair px-5 py-5">
          <p className="font-display text-lg text-lime">ديل</p>
          <p className="mt-1 font-display text-sm text-snow">{brand}</p>
          <p className="mt-1 text-xs text-dim">{office}</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {items.map((item) => (
            <span
              key={item.id}
              className={cn("px-3 py-2.5 font-display text-sm", item.id === view ? "bg-lime text-ink" : "text-mist")}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <p className="mt-auto border-t border-hair px-5 py-4 font-display text-xs text-dim">{crumb}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-snow text-ink">
        <header className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
          <p className="font-display text-sm">{items.find((n) => n.id === view)?.label}</p>
          <p className="font-display text-xs text-ink/40">حي · مباشر</p>
        </header>
        <div className="flex-1 overflow-hidden p-6">{children}</div>
      </div>
    </div>
  );
}
