import { useId, useState } from "react";
import type { RequestRow } from "@/lib/requests";
import { PlayMark, StatusChip } from "./parts";
import { STEPS, followUpText, statusLabel, stepIndex, waLink } from "./status";

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "long", year: "numeric" });

/** Briefs longer than this (or multi-line) start collapsed. */
const LONG_BRIEF = 160;

function formatDate(value: string | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
}

function isoDate(value: string | Date): string | undefined {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function RequestCard({ row }: { row: RequestRow }) {
  const current = stepIndex(row.status);
  const briefId = useId();
  const brief = row.brief.trim();
  const long = brief.length > LONG_BRIEF || brief.split("\n").length > 3;
  const [open, setOpen] = useState(false);
  const delivered = current === STEPS.length - 1;

  return (
    <article
      aria-labelledby={`${briefId}-title`}
      className="border border-hair bg-card transition-colors hover:border-pine-soft"
    >
      <header className="flex items-start justify-between gap-4 p-5 pb-0 md:p-7 md:pb-0">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-xs">
            <span dir="ltr" className="font-bold tracking-wider text-lime">
              #{row.id}
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-hair" />
            <time dateTime={isoDate(row.created_at)} className="text-dim">
              {formatDate(row.created_at)}
            </time>
          </p>
          <h3 id={`${briefId}-title`} className="mt-3 font-display text-xl leading-snug text-snow md:text-2xl">
            {row.service_title}
          </h3>
          {row.company ? <p className="mt-1 truncate text-sm text-mist">{row.company}</p> : null}
        </div>
        <StatusChip status={row.status} />
      </header>

      <Tracker current={current} />

      {brief ? (
        <div className="border-t border-hair px-5 py-4 md:px-7">
          <p className="font-display text-xs text-dim">تفاصيل الطلب</p>
          <p
            id={briefId}
            className={`mt-2 max-w-2xl text-sm leading-loose whitespace-pre-line text-mist ${
              long && !open ? "line-clamp-2" : ""
            }`}
          >
            {brief}
          </p>
          {long ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={briefId}
              onClick={() => setOpen((v) => !v)}
              className="mt-2 inline-flex min-h-10 items-center gap-2 font-display text-xs text-lime hover:text-snow focus-visible:outline-2 focus-visible:outline-lime"
            >
              {open ? "إخفاء التفاصيل" : "عرض التفاصيل كاملة"}
              <PlayMark className={`h-2 w-auto transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
            </button>
          ) : null}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-5 py-3 md:px-7">
        <p className="text-xs text-dim">
          {delivered ? "تم تسليم هذا الطلب. سعدنا بالعمل معك." : "نحدّث الحالة هنا مع كل خطوة."}
        </p>
        <a
          href={waLink(`${followUpText(row.id)} (${row.service_title})`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 font-display text-xs text-lime hover:text-snow focus-visible:outline-2 focus-visible:outline-lime"
        >
          تابع الطلب على واتساب
          <PlayMark className="h-2 w-auto -scale-x-100" />
        </a>
      </footer>
    </article>
  );
}

function Tracker({ current }: { current: number }) {
  return (
    <ol aria-label="مراحل الطلب" className="grid grid-cols-4 gap-1.5 px-5 pt-6 pb-5 md:gap-2 md:px-7">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="min-w-0">
            <span
              aria-hidden="true"
              className={`block h-1 ${state === "todo" ? "bg-pine" : "bg-lime"}`}
            />
            <span className="mt-2.5 flex items-center gap-1.5">
              <span
                className={`font-ui text-[0.65rem] font-bold ${state === "todo" ? "text-pine-soft" : "text-lime"}`}
              >
                0{i + 1}
              </span>
              {state === "done" ? <span className="sr-only">(مكتملة)</span> : null}
              {state === "current" ? <span className="sr-only">(المرحلة الحالية)</span> : null}
            </span>
            <span
              className={`mt-0.5 block font-display text-[0.7rem] leading-tight md:text-xs ${
                state === "current" ? "text-snow" : state === "done" ? "text-mist" : "text-dim"
              }`}
            >
              {statusLabel(s)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
