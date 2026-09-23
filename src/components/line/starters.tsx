import { lineStarters } from "@/lib/content";
import { PlayMark } from "./marks";

export function EmptyStarters({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="motion-safe:animate-[file-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
      <p className="text-kicker text-lime">خط ديل //</p>
      <h2 className="mt-2 font-display text-2xl font-semibold leading-snug text-snow md:text-[2rem]">
        خدمة عملاء. بلهجتك.
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-loose text-mist">
        تكلّم كزبون يتصل: يراجع السداد والطلب والموعد من الملف. أو كصاحب محل يبي الخط يرد على زبائنه — ويتكوّن
        <span className="text-snow"> ملف الثبوت </span>
        مع كل رسالة.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <span className="font-display text-xs text-dim">جرّب بداية</span>
        <span className="h-px flex-1 bg-hair" aria-hidden="true" />
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {lineStarters.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.text)}
              className="group relative flex h-full w-full flex-col items-start border border-hair bg-card p-4 text-start transition-colors duration-300 hover:border-pine-soft hover:bg-pine-deep disabled:opacity-50 md:p-5"
            >
              <span aria-hidden="true" className="absolute inset-y-0 start-0 w-0.5 bg-lime opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="flex w-full items-center justify-between gap-3">
                <span className="font-display text-xs font-semibold text-lime">{s.label}</span>
                <span className="font-ui text-micro font-semibold tracking-widest text-dim" aria-hidden="true">
                  0{i + 1}
                </span>
              </span>
              <span className="mt-2 text-sm leading-relaxed text-snow">{s.text}</span>
              <span className="mt-3 hidden items-center gap-2 md:inline-flex font-display text-xs text-mist transition-colors group-hover:text-lime">
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
