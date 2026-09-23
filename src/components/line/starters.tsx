import { lineStarters } from "@/lib/content";
import { PlayMark } from "./marks";

export function EmptyStarters({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="motion-safe:animate-[file-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
      <p className="flex items-center gap-3 text-sm font-bold text-pine">
        <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-lime" />
        خط ديل
      </p>
      <h2 className="mt-3 font-display text-2xl font-semibold leading-snug text-pine-deep md:text-[2rem]">
        خدمة عملاء. بلهجتك.
      </h2>
      <p className="mt-3 max-w-xl text-[15px] leading-loose text-slate">
        تكلّم كزبون يتصل: يراجع السداد والطلب والموعد من الملف. أو كصاحب محل يبي الخط يرد على زبائنه — ويتكوّن
        <span className="font-bold text-pine-deep"> ملف الثبوت </span>
        مع كل رسالة.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <span className="text-xs font-bold text-slate">جرّب بداية</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {lineStarters.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.text)}
              className="group relative flex h-full w-full flex-col items-start overflow-hidden rounded-2xl border border-line bg-surface p-4 text-start transition-[border-color,box-shadow] duration-300 hover:border-pine hover:shadow-[var(--shadow-card)] disabled:opacity-50 md:p-5"
            >
              <span aria-hidden="true" className="absolute inset-y-0 start-0 w-0.5 bg-lime opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="flex w-full items-center justify-between gap-3">
                <span className="text-xs font-bold text-pine">{s.label}</span>
                <span className="font-ui text-micro font-semibold tracking-widest text-slate" aria-hidden="true">
                  0{i + 1}
                </span>
              </span>
              <span className="mt-2 text-[15px] leading-relaxed text-pine-deep">{s.text}</span>
              <span className="mt-3 hidden items-center gap-2 md:inline-flex text-xs font-bold text-slate transition-colors group-hover:text-pine">
                أرسلها
                <PlayMark className="h-2 rotate-180 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-translate-x-1" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
