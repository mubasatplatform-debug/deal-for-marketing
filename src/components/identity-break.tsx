export function IdentityBreak() {
  return (
    <section
      id="mark"
      aria-label="حيث يبقى التأثير — DEAL"
      className="relative isolate overflow-hidden bg-lime text-ink"
    >
      <Grain />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[46%] md:w-[42%]">
        <Geometry />
      </div>

      <div className="relative z-10 flex min-h-[18rem] flex-col justify-center px-6 pt-14 pb-6 md:min-h-[26rem] md:px-16 md:pt-20 md:pb-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-balance font-display text-[clamp(1.7rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
            حيث يبقى التأثير
          </h2>
          <p dir="ltr" lang="en" className="font-script mt-3 text-[clamp(1.35rem,3vw,2.15rem)] leading-none text-ink">
            Where Impact Stays
          </p>
        </div>
      </div>

      <div dir="ltr" className="relative z-10 flex items-center gap-3 px-6 pb-7 md:px-16 md:pb-9">
        <span className="flex items-center gap-2">
          <PlayMark />
          <span className="font-ui text-2xl font-extrabold tracking-tighter md:text-4xl">DEAL</span>
        </span>
        <span className="h-px flex-1 bg-ink" />
      </div>
    </section>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 18 20" className="h-5 w-auto md:h-7" aria-hidden="true">
      <polygon points="0,0 18,10 0,20" fill="currentColor" />
    </svg>
  );
}

function Geometry() {
  return (
    <svg viewBox="0 0 520 640" preserveAspectRatio="xMaxYMid meet" className="h-full w-full text-snow">
      <polygon points="20,40 500,320 20,600" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <polygon points="150,130 500,320 170,510" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.85" />
      <polygon points="300,230 490,320 300,410" fill="none" stroke="currentColor" strokeWidth="2" />
      <polygon points="330,255 470,320 330,385" fill="var(--color-ink)" />
      <polygon points="348,268 455,320 348,372" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="390" y1="320" x2="390" y2="640" stroke="currentColor" strokeWidth="1.8" />
      <polyline points="250,470 330,530 410,470" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Grain() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30 mix-blend-multiply" aria-hidden="true">
      <filter id="deal-identity-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#deal-identity-grain)" />
    </svg>
  );
}
