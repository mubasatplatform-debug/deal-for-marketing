import { useLayoutEffect, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { LINE_MAX_CHARS, LINE_MAX_TURNS } from "@/lib/line";
import { cn } from "@/lib/utils";
import { PlayMark } from "./marks";

type Props = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onText: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  capped: boolean;
  remaining: number;
};

const MAX_H = 144;

export function Composer({ inputRef, text, onText, onSend, busy, capped, remaining }: Props) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, [text, inputRef]);

  const canSend = !busy && !capped && text.trim().length > 0;
  const near = text.length >= LINE_MAX_CHARS * 0.9;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onSend();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <form onSubmit={onSubmit} className="shrink-0 border-t border-hair bg-ink px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-10 md:pt-4 md:pb-5">
      <div className="mx-auto w-full max-w-3xl">
        <label className="sr-only" htmlFor="line-input">
          رسالتك لخط ديل
        </label>
        <div
          className={cn(
            "flex items-end gap-2 border bg-card p-2 ps-3 transition-colors duration-200",
            capped ? "border-hair" : "border-hair hover:border-pine-soft focus-within:border-lime focus-within:shadow-[0_0_0_1px_var(--color-lime)] focus-within:hover:border-lime",
          )}
        >
          <textarea
            id="line-input"
            ref={inputRef}
            rows={1}
            maxLength={LINE_MAX_CHARS}
            value={text}
            disabled={capped}
            onChange={(e) => onText(e.target.value)}
            onKeyDown={onKey}
            aria-describedby="line-input-meta"
            placeholder={capped ? "بلغت حد الجلسة — حوّل الملف أو ابدأ من جديد." : "اكتب بلهجتك…"}
            className="max-h-36 min-h-11 flex-1 resize-none bg-transparent py-2.5 font-display text-base leading-relaxed text-snow placeholder:text-dim focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={busy ? "ينتظر رد ديل" : "أرسل الرسالة"}
            className="flex size-11 shrink-0 items-center justify-center bg-lime text-pine transition-[background-color,opacity,transform] duration-200 hover:bg-snow motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:bg-pine disabled:text-pine-soft disabled:hover:bg-pine"
          >
            {busy ? (
              <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
                <span className="line-wait-bar h-2 w-0.5 bg-current" />
                <span className="line-wait-bar h-3.5 w-0.5 bg-current" />
                <span className="line-wait-bar h-2.5 w-0.5 bg-current" />
              </span>
            ) : (
              <PlayMark className="h-4 rotate-180" />
            )}
          </button>
        </div>

        <div id="line-input-meta" className="mt-2 flex items-center justify-between gap-3 px-0.5">
          <div className="flex items-center gap-2.5">
            <TurnMeter remaining={remaining} />
            <p className="font-display text-xs text-dim">
              <span className="font-ui font-semibold text-mist">{remaining}</span> رسائل متبقية
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden font-display text-xs text-dim md:block">
              <kbd className="font-ui">Enter</kbd> للإرسال · <kbd className="font-ui">Shift+Enter</kbd> سطر جديد
            </p>
            <p dir="ltr" className={cn("font-ui text-xs tabular-nums", near ? "text-lime" : "text-dim")}>
              <span className="sr-only">عدد الأحرف </span>
              {text.length}/{LINE_MAX_CHARS}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

function TurnMeter({ remaining }: { remaining: number }) {
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: LINE_MAX_TURNS }, (_, i) => (
        <span key={i} className={cn("h-2.5 w-[3px] transition-colors duration-300", i < remaining ? "bg-lime" : "bg-pine")} />
      ))}
    </span>
  );
}
