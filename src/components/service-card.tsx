import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ServiceTile } from "@/components/client/service-icon";
import { Photo } from "@/components/site-ui";
import type { Service } from "@/lib/content";
import { servicePhotos } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * A service as a photo card: the whole card is the tap target. `wide` lays the
 * photo beside the text from lg up (for cards spanning two grid columns).
 */
export function ServiceCard({
  s,
  wide = false,
  className,
}: {
  s: Service;
  wide?: boolean;
  className?: string;
}) {
  const p = servicePhotos[s.slug];
  return (
    <li className={className}>
      <Link
        to="/start/$slug"
        params={{ slug: s.slug }}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-3xl bg-surface ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-card)] focus-visible:ring-2 focus-visible:ring-pine",
          wide && "lg:flex-row",
        )}
      >
        <div
          className={cn(
            "relative aspect-[16/10] shrink-0 overflow-hidden bg-pine-100",
            wide && "lg:aspect-auto lg:w-1/2",
          )}
        >
          {p ? (
            <Photo
              name={p.name}
              alt={p.alt}
              position={p.position}
              fill
              sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
              className="transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-5 md:p-6">
          <div className="flex items-center justify-between">
            <ServiceTile slug={s.slug} />
            <span className="font-ui text-xs font-bold text-slate">{s.n}</span>
          </div>
          <h3 className="mt-4 font-display text-xl text-pine-deep md:text-2xl">{s.title}</h3>
          <p className="mt-2 flex-1 text-[15px] leading-relaxed text-slate">{s.body}</p>
          <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-[15px] font-bold text-pine">
            اطلب هذه الخدمة
            <ArrowLeft
              className="size-4 transition-transform group-hover:-translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}
