import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Skeleton } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { TextArea } from "@/components/law/kit";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { DRAFT_DISCLAIMER, DRAFT_KIND_LIST } from "@/components/law/ai/draft-kinds";
import { getFilesStatus, startDraft, type FilesStatus } from "@/lib/law/ai/ai";
import type { DraftKind } from "@/lib/law/ai/drafts-core";
import { cn } from "@/lib/utils";

const MAX_SOURCES = 20;

/**
 * «صياغة مستند بالذكاء الاصطناعي»: pick a kind, add instructions and the
 * case's / client's read files, and the assistant writes the draft in the
 * background — we go straight to its page, which waits for it.
 */
export function DraftDialog({
  caseId,
  clientId,
  subject,
  onClose,
}: {
  caseId?: string;
  clientId?: string;
  /** Shown in the description: the case title or the client name. */
  subject?: string;
  onClose: () => void;
}) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const uid = useId();
  const navigate = useNavigate();
  const [kind, setKind] = useState<DraftKind | null>(null);
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<FilesStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getFilesStatus({ data: { workspaceId: wsId, ...(caseId ? { caseId } : { clientId: clientId ?? null }) } })
      .then((s) => {
        if (!alive) return;
        setStatus(s);
        setPicked(new Set(s.docs.filter((d) => d.text_status === "ready").slice(0, MAX_SOURCES).map((d) => d.id)));
      })
      .catch((err) => alive && setLoadError(aiErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [wsId, caseId, clientId]);

  const ready = useMemo(() => status?.docs.filter((d) => d.text_status === "ready") ?? [], [status]);
  const notReady = (status?.docs.length ?? 0) - ready.length;
  const unavailable = status !== null && !status.aiAvailable;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SOURCES) next.add(id);
      else toast.error(`يمكن اختيار ${MAX_SOURCES} ملفًا على الأكثر.`);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!kind) {
      setError("اختر نوع المستند أولًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { id } = await startDraft({
        data: {
          workspaceId: wsId,
          kind,
          caseId: caseId ?? null,
          clientId: caseId ? null : (clientId ?? null),
          instructions: instructions.trim(),
          sourceIds: [...picked],
        },
      });
      toast.success("بدأ المساعد كتابة المسودة");
      void navigate({ to: "/app/drafts/$id", params: { id } });
    } catch (err) {
      setError(aiErrorMessage(err));
      setBusy(false);
    }
  }

  const allOn = ready.length > 0 && ready.slice(0, MAX_SOURCES).every((d) => picked.has(d.id));

  return (
    <Dialog
      title="صياغة مستند بالذكاء الاصطناعي"
      description={
        subject
          ? `يكتب المساعد مسودة من بيانات «${subject}» ومستنداته، ثم تراجعها وتعدّلها.`
          : "يكتب المساعد مسودة من بيانات الملف ومستنداته، ثم تراجعها وتعدّلها."
      }
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button
            type="submit"
            form={`${uid}-form`}
            variant="primary"
            icon={busy ? Loader2 : Sparkles}
            disabled={busy || !kind || unavailable || !status}
          >
            {busy ? "جارٍ البدء…" : "اكتب المسودة"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate className="space-y-5">
        {unavailable ? (
          <p className="flex items-start gap-2 rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-slate ring-1 ring-line">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            الصياغة بالذكاء الاصطناعي غير متاحة لمكتبك حاليًا — ليست ضمن الخطة أو لم تُفعَّل بعد.
          </p>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-pine-deep">نوع المستند</legend>
          <div role="radiogroup" aria-label="نوع المستند" className="grid grid-cols-2 gap-2">
            {DRAFT_KIND_LIST.map((k) => {
              const on = kind === k.kind;
              return (
                <button
                  key={k.kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setKind(k.kind);
                    setError(null);
                  }}
                  className={cn(
                    "relative flex min-h-[72px] flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-start transition-colors",
                    on ? "border-pine bg-pine-50 ring-2 ring-pine/15" : "border-line-strong bg-surface hover:border-pine/30 hover:bg-paper",
                  )}
                >
                  <span className="pe-5 text-[13.5px] leading-snug font-bold text-pine-deep">{k.label}</span>
                  <span className="text-[11.5px] leading-snug text-slate">{k.hint}</span>
                  {on ? (
                    <span className="absolute end-2 top-2 grid size-4 place-items-center rounded-full bg-pine text-snow" aria-hidden="true">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${uid}-ins`} className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-pine-deep">
            تعليماتك للمساعد <span className="text-xs font-normal text-slate">(اختياري)</span>
          </label>
          <TextArea
            id={`${uid}-ins`}
            rows={4}
            maxLength={4000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="مثال: ركّز على المطالبة بالأجور المتأخرة من يناير إلى مارس والتعويض عن الفصل غير المشروع، والدعوى أمام المحكمة العمالية بالرياض."
          />
          <p className="mt-1.5 text-[12.5px] text-slate">الوقائع والطلبات والجهة المختصة وأي نقطة تريد التركيز عليها.</p>
        </div>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-2">
            <legend className="text-sm font-semibold text-pine-deep">
              المستندات المرجعية{" "}
              {status ? (
                <span className="font-ui text-xs font-normal text-slate tabular-nums">
                  ({picked.size}/{Math.min(MAX_SOURCES, ready.length)})
                </span>
              ) : null}
            </legend>
            {ready.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  setPicked(allOn ? new Set() : new Set(ready.slice(0, MAX_SOURCES).map((d) => d.id)))
                }
                className="min-h-10 rounded-lg px-2 text-[12.5px] font-semibold text-pine hover:bg-paper"
              >
                {allOn ? "إلغاء الكل" : "تحديد الكل"}
              </button>
            ) : null}
          </div>
          {loadError ? (
            <p className="text-[13px] text-red-700">{loadError}</p>
          ) : !status ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : ready.length === 0 ? (
            <p className="rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-slate ring-1 ring-line">
              {status.docs.length
                ? "لم تُقرأ الملفات بعد. تُكتب المسودة من بيانات الملف وحدها، أو انتظر دقيقة ثم أعد فتح النافذة."
                : "لا مستندات مرفوعة. تُكتب المسودة من بيانات الملف وتعليماتك."}
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl p-1 ring-1 ring-line">
              {ready.map((d) => {
                const on = picked.has(d.id);
                return (
                  <li key={d.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(d.id)}
                        className="size-4 shrink-0 accent-[var(--color-pine)]"
                      />
                      <FileText className="size-4 shrink-0 text-slate" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-pine-deep">{d.name}</span>
                      {d.pages ? (
                        <span className="shrink-0 font-ui text-[11px] text-slate tabular-nums">{d.pages} ص</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {status && notReady > 0 && ready.length > 0 ? (
            <p className="mt-1.5 text-[12px] text-slate">
              <span className="font-ui tabular-nums">{notReady}</span> من الملفات لم تُقرأ بعد أو لا نص فيها، فلن تُضمَّن.
            </p>
          ) : null}
        </fieldset>

        {error ? (
          <p role="alert" className="flex items-start gap-2 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <p className="text-[12px] text-slate">{DRAFT_DISCLAIMER} تستغرق الكتابة عادةً بين نصف دقيقة ودقيقة ونصف.</p>
      </form>
    </Dialog>
  );
}
