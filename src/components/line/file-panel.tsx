import { serviceBySlug } from "@/lib/content";
import type { LineTurn } from "@/lib/line";
import { cn } from "@/lib/utils";
import { PlayMark } from "./marks";

const IN = "file-in";

function canFileRequest(file: LineTurn | null) {
  const service = file && file.service_slug !== "unknown" ? serviceBySlug(file.service_slug) : undefined;
  return Boolean(file && service && (file.brief_so_far.trim().length >= 8 || file.intent.length >= 8));
}

export function FilePanel({
  file,
  onFile,
  titleId,
  showHeader = true,
}: {
  file: LineTurn | null;
  onFile: () => void;
  titleId?: string;
  showHeader?: boolean;
}) {
  const service = file && file.service_slug !== "unknown" ? serviceBySlug(file.service_slug) : undefined;
  const canFile = canFileRequest(file);
  const confidence = file ? Math.round(file.confidence) : 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-5 py-6 md:px-7 md:py-7">
        {showHeader ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id={titleId} className="text-kicker text-lime">
                ملف الثبوت //
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-mist">يتكوّن مع كل رسالة. هذا ما يسمعه الفريق.</p>
            </div>
            <RecordState live={Boolean(file)} />
          </div>
        ) : null}

        {/* Confidence */}
        <section aria-label="الثقة" className={cn("border border-pine bg-ink/40 p-4", showHeader && "mt-6")}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-xs text-mist">الثقة في الفهم</span>
            <span dir="ltr" className="font-ui text-2xl font-bold tabular-nums leading-none text-lime">
              {file ? confidence : "—"}
              {file ? <span className="text-sm font-semibold text-mist">%</span> : null}
            </span>
          </div>
          <div
            role="meter"
            aria-label="الثقة"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={confidence}
            className="mt-3 h-[3px] w-full bg-pine"
          >
            <div
              className="h-full bg-lime motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip label="اللهجة" value={file?.dialect_label} tone="pine" />
            <Chip label="التوجيه" value={file?.route_label} tone="lime" />
          </div>
        </section>

        <dl className="mt-6 divide-y divide-pine border-y border-pine">
          <Row k="النية" v={file?.intent} />
          <Row k="الخدمة" v={service?.title} accent />
          {file?.company ? <Row k="الجهة" v={file.company} /> : null}
          <div className="py-3.5">
            <dt className="font-display text-xs text-mist">الحزمة</dt>
            <dd className="mt-2.5">
              {file && file.stack.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {file.stack.map((item) => (
                    <li
                      key={item}
                      className={`${IN} inline-flex items-center gap-1.5 border border-pine-soft bg-pine px-2.5 py-1 font-display text-xs text-snow`}
                    >
                      <PlayMark className="h-1.5 text-lime" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <Dash />
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <p className="font-display text-xs text-mist">الموجز</p>
          <div className="mt-2.5 border-s-2 border-lime ps-4">
            {file?.brief_so_far ? (
              <p key={file.brief_so_far} className={`${IN} text-sm leading-loose text-snow`}>
                {file.brief_so_far}
              </p>
            ) : (
              <p className="text-sm leading-loose text-dim">ما وصلنا شيء بعد. ابدأ المحادثة.</p>
            )}
          </div>
        </div>

        {file?.next_need ? (
          <div className="mt-5 flex items-start gap-2.5 border border-dashed border-pine-soft px-3.5 py-3">
            <span className="mt-0.5 font-display text-xs text-lime">ينقص</span>
            <p key={file.next_need} className={`${IN} text-sm leading-relaxed text-mist`}>
              {file.next_need}
            </p>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-pine bg-pine-deep px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7 md:pb-5">
        <button
          type="button"
          disabled={!canFile}
          onClick={onFile}
          className="group flex h-12 w-full items-center justify-between gap-3 bg-lime px-5 font-display text-sm font-semibold text-pine transition-colors duration-200 hover:bg-snow disabled:cursor-not-allowed disabled:border disabled:border-pine-soft disabled:bg-transparent disabled:font-normal disabled:text-mist disabled:hover:bg-transparent"
        >
          <span>{canFile ? "حوّل الملف لطلب" : "الملف يتكوّن…"}</span>
          <PlayMark
            className={cn(
              "h-3 rotate-180 motion-safe:transition-transform motion-safe:duration-300",
              canFile ? "motion-safe:group-hover:-translate-x-1" : "opacity-50",
            )}
          />
        </button>
        <p className="mt-2.5 text-center font-display text-xs text-mist">
          {canFile ? "ينتقل الموجز لنموذج الطلب — تراجعه قبل الإرسال." : "يكتمل حين تتضح الخدمة والموجز."}
        </p>
      </div>
    </div>
  );
}

function RecordState({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 font-display text-xs",
        live ? "border-lime/60 text-lime" : "border-pine-soft text-mist",
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5", live ? "line-live bg-lime" : "bg-pine-soft")} />
      {live ? "سجل حي" : "فارغ"}
    </span>
  );
}

function Chip({ label, value, tone }: { label: string; value?: string; tone: "pine" | "lime" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1.5 font-display text-xs",
        tone === "lime" ? "border-lime/50 text-lime" : "border-pine-soft bg-pine text-snow",
      )}
    >
      <span className="text-mist">{label}</span>
      <span aria-hidden="true" className="h-3 w-px bg-current opacity-40" />
      {value ? (
        <span key={value} className={IN}>
          {value}
        </span>
      ) : (
        <span className="text-mist">—</span>
      )}
    </span>
  );
}

function Row({ k, v, accent }: { k: string; v?: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="shrink-0 font-display text-xs text-mist">{k}</dt>
      <dd className={cn("min-w-0 text-end font-display text-sm", accent ? "text-lime" : "text-snow")}>
        {v ? (
          <span key={v} className={IN}>
            {v}
          </span>
        ) : (
          <Dash />
        )}
      </dd>
    </div>
  );
}

function Dash() {
  return <span className="text-dim">—</span>;
}
