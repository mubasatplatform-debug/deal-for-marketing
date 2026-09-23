import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Centered modal for the keys pages: traps focus, closes on Esc and backdrop
 * click (unless `locked`), and gives focus back to its opener. On phones it
 * sits at the bottom as a sheet.
 */
export function Dialog({
  title,
  description,
  onClose,
  locked,
  busy,
  size = "md",
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  /** Ignore Esc and backdrop clicks; only the dialog's own buttons close it. */
  locked?: boolean;
  /** A request is in flight: nothing closes the dialog. */
  busy?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked || busy;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const auto =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    auto?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!lockedRef.current) closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <style>{`@keyframes keys-fade{from{opacity:0}}@keyframes keys-rise{from{transform:translateY(12px);opacity:0}}`}</style>
      <button
        type="button"
        tabIndex={-1}
        aria-label="إغلاق"
        onClick={() => !(locked || busy) && onClose()}
        className="absolute inset-0 bg-pine-deep/40 backdrop-blur-[2px] motion-safe:animate-[keys-fade_160ms_ease-out]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-dialog-title"
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface font-dash text-pine-deep shadow-[0_0_0_1px_rgba(16,38,40,0.06),0_24px_64px_-12px_rgba(16,38,40,0.35)] sm:rounded-2xl motion-safe:animate-[keys-rise_220ms_cubic-bezier(0.16,1,0.3,1)]",
          size === "sm" ? "sm:max-w-[420px]" : "sm:max-w-[560px]",
        )}
      >
        <header className="flex items-start gap-3 px-6 pt-6 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="keys-dialog-title" className="text-lg font-extrabold">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-slate">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            disabled={busy}
            onClick={onClose}
            className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate transition-colors hover:bg-paper hover:text-pine-deep focus-visible:outline-2 focus-visible:outline-pine disabled:opacity-40"
          >
            <X className="size-[18px]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
