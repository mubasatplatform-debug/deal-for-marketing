import { useEffect, useRef, type RefObject } from "react";
import type { LineTurn } from "@/lib/line";
import { FilePanel } from "./file-panel";

const FOCUSABLE = 'button:not([disabled]), [href], textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Mobile bottom sheet holding the same ملف الثبوت record as the desktop side panel. */
export function FileSheet({
  open,
  onClose,
  file,
  onFile,
  trigger,
}: {
  open: boolean;
  onClose: () => void;
  file: LineTurn | null;
  onFile: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const back = trigger.current;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const nodes = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheetRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [open, onClose, trigger]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-ink/75 backdrop-blur-[2px] motion-safe:animate-[file-in_0.25s_ease-out_both] md:hidden"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-file-title"
        tabIndex={-1}
        className="flex max-h-[86dvh] w-full flex-col overflow-hidden border-t border-pine-soft bg-pine-deep focus:outline-none motion-safe:animate-[file-in_0.45s_cubic-bezier(0.16,1,0.3,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-pine px-5 pt-3 pb-3">
          <span aria-hidden="true" className="mx-auto block h-[3px] w-10 bg-pine-soft" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p id="line-file-title" className="text-kicker text-lime">
                ملف الثبوت //
              </p>
              <p className="mt-0.5 text-xs text-mist">يتكوّن مع كل رسالة. هذا ما يسمعه الفريق.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق ملف الثبوت"
              className="flex size-11 shrink-0 items-center justify-center border border-pine-soft text-snow transition-colors hover:border-lime hover:text-lime"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <FilePanel file={file} onFile={onFile} showHeader={false} />
        </div>
      </div>
    </div>
  );
}
