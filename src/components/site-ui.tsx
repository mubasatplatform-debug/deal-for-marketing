import type { CSSProperties, ReactNode } from "react";
import { photos, type PhotoName } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * Public-site primitives. Same paper / pine / lime language and radii as the
 * dashboards (src/components/dash): rounded-xl controls, rounded-2xl+ cards.
 */

/** Short lime rule + label: the section's quiet signpost. */
export function Eyebrow({
  children,
  className,
  dark,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-sm font-bold",
        dark ? "text-lime" : "text-pine",
        className,
      )}
    >
      <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-lime" />
      {children}
    </p>
  );
}

/** Responsive <picture> for /public/photos, sized so the box never shifts. */
export function Photo({
  name,
  alt,
  sizes,
  className,
  position,
  priority = false,
  fill = false,
}: {
  name: PhotoName;
  alt: string;
  sizes: string;
  className?: string;
  /** CSS object-position for the crop inside its frame. */
  position?: string;
  priority?: boolean;
  /** Cover a positioned parent instead of sizing the box from the image. */
  fill?: boolean;
}) {
  const p = photos[name];
  const set = (ext: string) => p.widths.map((w) => `/photos/${name}-${w}.${ext} ${w}w`).join(", ");
  const style: CSSProperties | undefined = position ? { objectPosition: position } : undefined;
  return (
    <picture>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      <img
        src={`/photos/${name}-${p.widths[0]}.webp`}
        alt={alt}
        width={p.width}
        height={p.height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? undefined : "async"}
        fetchPriority={priority ? "high" : undefined}
        style={style}
        className={cn("block h-full w-full object-cover", fill && "absolute inset-0", className)}
      />
    </picture>
  );
}

/** Rounded photo frame with a hairline edge, the site's one image treatment. */
export function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-pine-100 ring-1 ring-pine-deep/5",
        className,
      )}
    >
      {children}
    </div>
  );
}
