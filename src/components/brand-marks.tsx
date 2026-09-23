import { cn } from "@/lib/utils";

/**
 * The play-triangle geometry of the DEAL brand board (outline triangles, the
 * heavy pine play mark, a drop line and a chevron). `tone` picks the stroke
 * set: "on-lime" is white + pine as on the board; "on-ink" is hairline snow +
 * lime for the black cinematic surfaces.
 */
export function PlayMarks({ className, tone = "on-ink" }: { className?: string; tone?: "on-ink" | "on-lime" }) {
  const thin = tone === "on-lime" ? "var(--color-snow)" : "color-mix(in oklab, var(--color-snow) 22%, transparent)";
  const bold = tone === "on-lime" ? "var(--color-pine)" : "var(--color-lime)";
  return (
    <svg viewBox="0 0 520 640" preserveAspectRatio="xMaxYMid meet" className={cn("h-full w-full", className)} aria-hidden="true">
      <polygon points="20,40 500,320 20,600" fill="none" stroke={thin} strokeWidth="2.2" />
      <polygon points="150,130 500,320 170,510" fill="none" stroke={thin} strokeWidth="1.6" opacity="0.85" />
      <polygon points="300,230 490,320 300,410" fill="none" stroke={bold} strokeWidth={tone === "on-lime" ? 7 : 4} strokeLinejoin="round" />
      <polygon points="348,268 455,320 348,372" fill="none" stroke={thin} strokeWidth="1.4" />
      <line x1="390" y1="320" x2="390" y2="640" stroke={thin} strokeWidth="1.6" />
      <polyline points="250,470 330,530 410,470" fill="none" stroke={thin} strokeWidth="1.6" />
    </svg>
  );
}

/** Paper grain for lime surfaces (the board's printed texture). */
export function Grain({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute inset-0 h-full w-full opacity-30 mix-blend-multiply", className)} aria-hidden="true">
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}
