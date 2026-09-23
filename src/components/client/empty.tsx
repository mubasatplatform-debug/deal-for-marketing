import { ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { agency, services } from "@/lib/content";
import { cn } from "@/lib/utils";
import { ServiceTile } from "./service-icon";

const systems = services.filter((s) => !agency.some((a) => a.slug === s.slug));

/** First visit: no requests yet. Invite, then show every door in. */
export function FirstRequest() {
  return (
    <Card className="overflow-hidden">
      <div className="relative flex flex-col gap-6 px-5 py-7 sm:flex-row sm:items-center sm:gap-8 md:px-8 md:py-9">
        <MarkIllustration />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold tracking-tight text-pine-deep md:text-2xl">
            ابدأ أول طلب لك مع ديل
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">
            اختر الخدمة واكتب لنا ما تحتاجه في دقيقة. نراجع طلبك ونتواصل معك خلال يوم عمل، وتتابع كل خطوة من هنا حتى
            التسليم.
          </p>
          <Link to="/start" className={cn(buttonClass("primary"), "mt-5")}>
            ابدأ طلبك الأول
          </Link>
        </div>
      </div>

      <div className="border-t border-line bg-paper/50 px-5 py-6 md:px-8 md:py-7">
        <ServiceGroup title="الأنظمة" items={systems} />
        <ServiceGroup title="الوكالة" items={agency} className="mt-6" />
      </div>
    </Card>
  );
}

function ServiceGroup({
  title,
  items,
  className,
}: {
  title: string;
  items: readonly (typeof services)[number][];
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-xs font-semibold text-slate">{title}</h3>
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {items.map((s) => (
          <li key={s.slug}>
            <Link
              to="/start/$slug"
              params={{ slug: s.slug }}
              className="group flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_4px_16px_-8px_rgba(16,38,40,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            >
              <ServiceTile slug={s.slug} size="sm" className="transition-colors group-hover:bg-lime-50 group-hover:text-lime-600" />
              <span className="min-w-0 flex-1 text-sm font-semibold text-pine-deep">{s.title}</span>
              <ChevronLeft
                aria-hidden="true"
                className="size-4 shrink-0 text-slate/50 transition-[color,transform] group-hover:-translate-x-0.5 group-hover:text-pine-deep"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The identity's play triangles, nested like the brand board: a quiet outer
 * outline, the pine mark, and a small lime triangle at its heart.
 */
function MarkIllustration() {
  return (
    <div
      aria-hidden="true"
      className="grid size-28 shrink-0 place-items-center rounded-3xl bg-lime-50 md:size-32"
    >
      <svg viewBox="0 0 120 120" className="size-24 md:size-28">
        <polygon
          points="22,14 104,60 22,106"
          fill="none"
          className="stroke-lime"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <polygon
          points="34,34 82,60 34,86"
          fill="none"
          className="stroke-pine"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <polygon points="46,50 64,60 46,70" className="fill-pine" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
