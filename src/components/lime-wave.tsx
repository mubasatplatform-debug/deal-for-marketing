import { cn } from "@/lib/utils";

const PATHS = Array.from({ length: 13 }, (_, i) => {
  const y = 18 + i * 12;
  const a = 16 + (i % 5) * 5;
  return `M-80 ${y} C 200 ${y - a}, 480 ${y + a}, 720 ${y} S 1240 ${y - a}, 1600 ${y}`;
});

export function LimeWave({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden text-lime", className)} aria-hidden="true">
      <svg
        viewBox="0 0 1440 180"
        preserveAspectRatio="none"
        className="wave-drift h-full w-full min-h-24 origin-center scale-110"
      >
        {PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={i % 4 === 0 ? 1.35 : 0.9}
            opacity={0.55 + (i % 3) * 0.12}
          />
        ))}
      </svg>
    </div>
  );
}
