import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function useShot() {
  const [shot, setShot] = useState(false);
  useEffect(() => {
    setShot(new URLSearchParams(window.location.search).get("shot") === "1");
  }, []);
  return shot;
}

const team = ["هـ", "س", "م"] as const;

function TeamMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2 space-x-reverse">
        {team.map((t) => (
          <span
            key={t}
            className={cn(
              "flex size-6 items-center justify-center font-display text-micro",
              dark ? "bg-ink text-lime outline outline-1 outline-snow" : "bg-lime text-ink",
            )}
          >
            {t}
          </span>
        ))}
      </div>
      <span className={cn("font-display text-xs", dark ? "text-snow/70" : "text-ink/45")}>فريق ديل</span>
    </div>
  );
}

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
  const shot = useShot();

  const shell = (
    <div className={cn("flex bg-ink text-snow", shot ? "h-full min-h-0" : "min-h-dvh")} dir="rtl">
      <aside className="flex w-52 shrink-0 flex-col border-l border-hair bg-ink">
        <div className="border-b border-hair px-5 py-5">
          <p className="font-display text-lg text-lime">ديل</p>
          <p className="mt-1 font-display text-sm text-snow">{brand}</p>
          <p className="mt-1 text-xs leading-relaxed text-dim">{office}</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {items.map((item) => (
            <span
              key={item.id}
              className={cn("px-3 py-2 font-display text-sm", item.id === view ? "bg-lime text-ink" : "text-mist")}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <p className="mt-auto border-t border-hair px-5 py-4 font-display text-xs text-dim">{crumb}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-snow text-ink">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-ink/10 px-5">
          <p className="font-display text-sm">{items.find((n) => n.id === view)?.label}</p>
          <div className="flex items-center gap-4">
            <TeamMark />
            <span className="flex items-center gap-2 font-display text-xs text-ink/45">
              <span className="size-1.5 bg-lime" />
              حي · مباشر
            </span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );

  if (!shot) return shell;

  return (
    <div className="flex h-dvh flex-col bg-ink p-6">
      <div className="flex min-h-0 flex-1 flex-col outline outline-1 outline-white/12">
        <div className="flex h-10 shrink-0 items-center justify-between bg-card px-4" dir="ltr">
          <div className="flex items-center gap-2.5">
            <span className="size-2 bg-lime" />
            <span className="font-ui text-micro font-semibold tracking-[0.22em] text-mist">DEALADV.SA</span>
            <span className="text-hair">/</span>
            <span className="font-display text-xs text-snow">{brand}</span>
          </div>
          <TeamMark dark />
        </div>
        <div className="min-h-0 flex-1">{shell}</div>
      </div>
    </div>
  );
}

export function Kpi({ n, l, hint }: { n: string; l: string; hint?: string }) {
  return (
    <div className="border-l border-ink/10 px-4 py-3 first:border-l-0">
      <p className="font-display text-xs text-ink/45">{l}</p>
      <p className="mt-1 font-display text-2xl leading-none tabular-nums">{n}</p>
      {hint ? <p className="mt-2 font-display text-xs text-ink/40">{hint}</p> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "mute",
}: {
  children: ReactNode;
  tone?: "lime" | "mute" | "ink";
}) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 font-display text-xs",
        tone === "lime" && "bg-lime text-ink",
        tone === "ink" && "bg-ink text-snow",
        tone === "mute" && "bg-ink/5 text-ink/55",
      )}
    >
      {children}
    </span>
  );
}

export function Initials({ name }: { name: string }) {
  const letter = name.replace(/^ال/, "").replace(/^أبو /, "أ").charAt(0);
  return (
    <span className="flex size-8 shrink-0 items-center justify-center bg-ink font-display text-xs text-lime">
      {letter}
    </span>
  );
}
