import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  FolderInput,
  Loader2,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Segmented, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { documentUrl } from "@/components/law/documents-ui";
import { dateAr, timeAr } from "@/components/law/format";
import { ConfirmDialog, ErrorCard, TextArea, useCan, useLoad } from "@/components/law/kit";
import { aiErrorMessage } from "@/components/law/ai/ai-errors";
import { DRAFT_DISCLAIMER, DRAFT_KIND_LABEL } from "@/components/law/ai/draft-kinds";
import { DraftStatusPill } from "@/components/law/ai/drafts-ui";
import { LightText } from "@/components/law/ai/light-text";
import { deleteDraft, getDraft, reviseDraft, saveDraft, saveDraftToDocuments, startDraft } from "@/lib/law/ai/ai";
import type { DraftRow } from "@/lib/law/ai/drafts-core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/drafts/$id")({
  component: DraftPage,
});

const POLL_MS = 3000;
const LEAVE_PROMPT = "لديك تعديلات غير محفوظة على المسودة. هل تريد المغادرة دون حفظ؟";

function DraftPage() {
  const { id } = Route.useParams();
  const { active } = useLawApp();
  const res = useLoad(() => getDraft({ data: { workspaceId: active.workspace.id, id } }), [active.workspace.id, id]);
  const d = res.data;

  // Poll while the assistant is writing.
  const reload = res.reload;
  useEffect(() => {
    if (d?.status !== "pending") return;
    const t = setTimeout(() => void reload(), POLL_MS);
    return () => clearTimeout(t);
  }, [d, reload]);

  if (res.error && (!d || d.id !== id)) {
    return (
      <>
        <BackLink />
        <ErrorCard title="تعذّر فتح المسودة" message={res.error} onRetry={() => void res.reload()} />
      </>
    );
  }
  if (!d || d.id !== id) {
    return (
      <>
        <BackLink />
        <Card className="h-72 animate-pulse bg-pine-50/40">
          <span className="sr-only">جارٍ التحميل…</span>
        </Card>
      </>
    );
  }
  return <DraftView key={d.id} draft={d} onReload={res.reload} />;
}

function BackLink() {
  return (
    <Link to="/app/drafts" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep">
      <ArrowRight className="size-4" aria-hidden="true" />
      المسودات
    </Link>
  );
}

function DraftView({ draft: d, onReload }: { draft: DraftRow; onReload: () => Promise<void> }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const allowed = useCan();
  const canEdit = allowed("draft.manage");
  const navigate = useNavigate();

  const [base, setBase] = useState(d.body);
  const [body, setBody] = useState(d.body);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState<null | "save" | "doc" | "retry" | "word">(null);
  const [dialog, setDialog] = useState<null | "revise" | "delete">(null);
  const [savedDocId, setSavedDocId] = useState<string | null>(d.document_id);
  const dirty = d.status === "ready" && body !== base;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // The draft finished writing (or was reloaded) while nothing was edited.
  useEffect(() => {
    if (!dirtyRef.current) {
      setBase(d.body);
      setBody(d.body);
    }
    setSavedDocId(d.document_id);
  }, [d.body, d.status, d.document_id]);

  useBlocker({
    shouldBlockFn: () => dirtyRef.current && !window.confirm(LEAVE_PROMPT),
    enableBeforeUnload: () => dirtyRef.current,
  });

  const wordUrl = `/api/law/drafts/${d.id}?ws=${wsId}`;

  async function save(quiet = false): Promise<boolean> {
    if (!dirtyRef.current) return true;
    setBusy("save");
    try {
      await saveDraft({ data: { workspaceId: wsId, id: d.id, body } });
      setBase(body);
      if (!quiet) toast.success("حُفظت التعديلات");
      return true;
    } catch (err) {
      toast.error(aiErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function downloadWord() {
    if (dirty && canEdit) {
      setBusy("word");
      const ok = await save(true);
      setBusy(null);
      if (!ok) return;
    }
    const a = document.createElement("a");
    a.href = wordUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function toDocuments() {
    if (!(await save(true))) return;
    setBusy("doc");
    try {
      const { documentId } = await saveDraftToDocuments({ data: { workspaceId: wsId, id: d.id } });
      setSavedDocId(documentId);
      toast.success(d.case_id ? "حُفظت المسودة في مستندات القضية" : "حُفظت المسودة في مستندات العميل", {
        action: { label: "فتح", onClick: () => window.open(documentUrl(wsId, documentId), "_blank", "noopener") },
      });
    } catch (err) {
      toast.error(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy("retry");
    try {
      const { id } = await startDraft({
        data: {
          workspaceId: wsId,
          kind: d.kind,
          caseId: d.case_id,
          clientId: d.case_id ? null : d.client_id,
          instructions: d.instructions,
          sourceIds: d.source_ids.slice(0, 20),
        },
      });
      toast.success("بدأ المساعد كتابة المسودة من جديد");
      void navigate({ to: "/app/drafts/$id", params: { id } });
    } catch (err) {
      toast.error(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const target = d.case_id ? (
    <Link to="/app/cases/$id" params={{ id: d.case_id }} className="font-semibold text-pine hover:underline">
      {d.case_ref !== null ? <span className="font-ui tabular-nums">#{d.case_ref} </span> : null}
      {d.case_title}
    </Link>
  ) : d.client_id ? (
    <Link to="/app/clients/$id" params={{ id: d.client_id }} className="font-semibold text-pine hover:underline">
      {d.client_name}
    </Link>
  ) : null;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <>
      <BackLink />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate">
            <span>{DRAFT_KIND_LABEL[d.kind]}</span>
            {target ? (
              <>
                <span aria-hidden="true">·</span>
                {target}
              </>
            ) : null}
          </p>
          <h1 className="mt-1.5 text-[22px] leading-snug font-extrabold break-words md:text-[26px]">{d.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate">
            <DraftStatusPill status={d.status} />
            {d.created_by_name ? <span>أعدّها {d.created_by_name}</span> : null}
            <span aria-hidden="true">·</span>
            <span>
              {dateAr(d.created_at)} {timeAr(d.created_at)}
            </span>
            {d.parent_id ? (
              <>
                <span aria-hidden="true">·</span>
                <Link to="/app/drafts/$id" params={{ id: d.parent_id }} className="font-semibold text-pine hover:underline">
                  النسخة السابقة
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canEdit && d.status !== "pending" ? (
          <Button
            icon={Trash2}
            variant="ghost"
            onClick={() => setDialog("delete")}
            className="self-start hover:bg-red-50 hover:text-red-700"
          >
            حذف
          </Button>
        ) : null}
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-lime-50 px-4 py-3 text-[13px] leading-relaxed font-semibold text-pine-deep ring-1 ring-lime/40 ring-inset">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-lime-600" aria-hidden="true" />
        {DRAFT_DISCLAIMER}
      </p>

      {d.status === "pending" ? (
        <Card className="px-6 py-14 text-center">
          <div role="status" className="flex flex-col items-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-lime-50 text-lime-600">
              <Loader2 className="size-6 motion-safe:animate-spin" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-bold text-pine-deep">يكتب المساعد المسودة… قد يستغرق دقيقة</p>
            <p className="mt-1 max-w-sm text-sm text-slate">
              يمكنك مغادرة الصفحة؛ تبقى الكتابة جارية وتجد المسودة في قائمة المسودات حين تكتمل.
            </p>
            <div className="mt-6 w-full max-w-md space-y-2.5" aria-hidden="true">
              <Skeleton className="mx-auto h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </Card>
      ) : null}

      {d.status === "failed" ? (
        <Card className="px-6 py-12 text-center">
          <div className="flex flex-col items-center" role="alert">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-bold text-pine-deep">تعذّرت كتابة المسودة</p>
            <p className="mt-1 max-w-sm text-sm text-slate">
              {d.error === "timeout"
                ? "انقطعت الكتابة قبل أن تكتمل."
                : "لم يُكمل المساعد الكتابة هذه المرة (قد يكون مشغولًا أو الملفات كبيرة)."}{" "}
              أعد المحاولة بنفس النوع والتعليمات والمستندات.
            </p>
            {canEdit ? (
              <Button variant="primary" icon={busy === "retry" ? Loader2 : RotateCw} disabled={Boolean(busy)} onClick={() => void retry()} className="mt-5">
                أعد المحاولة
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {d.status === "ready" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 md:px-5">
            <Segmented
              label="طريقة العرض"
              value={mode}
              onChange={setMode}
              options={[
                { value: "edit", label: "تحرير" },
                { value: "preview", label: "معاينة" },
              ]}
            />
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {canEdit ? (
                <Button
                  variant="primary"
                  icon={busy === "save" ? Loader2 : Save}
                  disabled={!dirty || Boolean(busy)}
                  onClick={() => void save()}
                >
                  حفظ التعديلات
                </Button>
              ) : null}
              <a
                href={wordUrl}
                download
                onClick={(e) => {
                  if (dirty && canEdit) {
                    e.preventDefault();
                    void downloadWord();
                  }
                }}
                className={buttonClass("secondary")}
              >
                {busy === "word" ? <Loader2 className="size-4 motion-safe:animate-spin" /> : <Download className="size-4" aria-hidden="true" />}
                تنزيل Word
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper/60 px-4 py-2.5 md:px-5">
            {canEdit ? (
              <>
                <Button size="sm" icon={busy === "doc" ? Loader2 : FolderInput} disabled={Boolean(busy)} onClick={() => void toDocuments()} className="h-10">
                  {savedDocId ? "حفظ نسخة في المستندات" : d.case_id ? "حفظ في مستندات القضية" : "حفظ في مستندات العميل"}
                </Button>
                <Button size="sm" icon={Wand2} disabled={Boolean(busy)} onClick={() => setDialog("revise")} className="h-10">
                  إعادة الصياغة بتعليمات
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              icon={Copy}
              className="h-10"
              onClick={() =>
                void navigator.clipboard
                  .writeText(body)
                  .then(() => toast.success("نُسخ نص المسودة"))
                  .catch(() => toast.error("تعذّر النسخ"))
              }
            >
              نسخ
            </Button>
            <span className="ms-auto font-ui text-[12px] text-slate tabular-nums" aria-live="polite">
              {dirty ? <span className="me-2 font-dash font-semibold text-lime-600">تعديلات غير محفوظة</span> : null}
              {words.toLocaleString("en-US")} كلمة
            </span>
          </div>
          {savedDocId ? (
            <p className="border-b border-line px-4 py-2.5 text-[13px] text-slate md:px-5">
              حُفظت نسخة في مستندات {d.case_id ? "القضية" : "العميل"} —{" "}
              <a
                href={documentUrl(wsId, savedDocId)}
                target="_blank"
                rel="noopener"
                className="font-semibold text-pine hover:underline"
              >
                تنزيل المستند المحفوظ
              </a>
            </p>
          ) : null}
          {mode === "edit" ? (
            <AutoTextarea
              value={body}
              readOnly={!canEdit}
              onChange={setBody}
              onSave={() => void save()}
            />
          ) : (
            <div className="px-5 py-6 md:px-10 md:py-8">
              <div className="mx-auto max-w-[760px]">
                <LightText text={body} size="lg" />
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {d.instructions.trim() ? (
        <details className="group rounded-2xl border border-line bg-surface px-5 py-1 md:px-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-slate hover:text-pine-deep">
            <Sparkles className="size-4" aria-hidden="true" />
            التعليمات التي كُتبت بها المسودة
          </summary>
          <p className="pb-4 text-[13px] leading-relaxed whitespace-pre-wrap text-pine-deep">{d.instructions}</p>
        </details>
      ) : null}

      {dialog === "revise" ? (
        <ReviseDialog
          draftId={d.id}
          beforeRevise={() => save(true)}
          onClose={() => setDialog(null)}
          onStarted={(id) => {
            setDialog(null);
            void navigate({ to: "/app/drafts/$id", params: { id } });
          }}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title="حذف المسودة؟"
          body={
            savedDocId
              ? "تُحذف المسودة نهائيًا. النسخة المحفوظة في المستندات تبقى كما هي."
              : "تُحذف المسودة ونصها نهائيًا ولا يمكن استعادتها."
          }
          confirmLabel="حذف نهائيًا"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await deleteDraft({ data: { workspaceId: wsId, id: d.id } });
              dirtyRef.current = false;
              setBase(body);
              toast.success("حُذفت المسودة");
              void navigate({ to: "/app/drafts" });
            } catch (err) {
              toast.error(aiErrorMessage(err));
              setDialog(null);
              void onReload();
            }
          }}
        />
      ) : null}
    </>
  );
}

/** The draft body: a tall, comfortable RTL editor that grows with its text. */
function AutoTextarea({
  value,
  readOnly,
  onChange,
  onSave,
}: {
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const uid = useId();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const y = window.scrollY;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 480)}px`;
    window.scrollTo({ top: y });
  }, [value]);
  return (
    <div className="bg-paper/40 px-3 py-4 md:px-8 md:py-6">
      <label htmlFor={`${uid}-body`} className="sr-only">
        نص المسودة
      </label>
      <textarea
        ref={ref}
        id={`${uid}-body`}
        dir="rtl"
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            onSave();
          }
        }}
        className={cn(
          "mx-auto block w-full max-w-[820px] resize-none overflow-hidden rounded-xl border border-line bg-surface px-4 py-5 font-dash text-[15.5px] leading-[2] text-pine-deep shadow-[0_1px_2px_rgba(16,38,40,0.04)] outline-none focus:border-pine/40 focus:ring-4 focus:ring-pine/10 md:px-8 md:py-7",
          readOnly && "cursor-default",
        )}
      />
    </div>
  );
}

function ReviseDialog({
  draftId,
  beforeRevise,
  onClose,
  onStarted,
}: {
  draftId: string;
  beforeRevise: () => Promise<boolean>;
  onClose: () => void;
  onStarted: (id: string) => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (text.trim().length < 3) {
      setError("اكتب ما تريد تغييره في المسودة.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!(await beforeRevise())) {
        setBusy(false);
        return;
      }
      const { id } = await reviseDraft({ data: { workspaceId: active.workspace.id, id: draftId, instructions: text.trim() } });
      toast.success("يكتب المساعد نسخة معدّلة");
      onStarted(id);
    } catch (err) {
      setError(aiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="إعادة الصياغة بتعليمات"
      description="يكتب المساعد نسخة جديدة من المسودة وفق تعليماتك، وتبقى هذه النسخة كما هي."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Wand2} disabled={busy}>
            أعد الصياغة
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate>
        <label htmlFor={`${uid}-ins`} className="mb-1.5 block text-sm font-semibold text-pine-deep">
          ما الذي تريد تغييره؟
        </label>
        <TextArea
          id={`${uid}-ins`}
          data-autofocus
          rows={5}
          maxLength={4000}
          value={text}
          invalid={Boolean(error)}
          onChange={(e) => setText(e.target.value)}
          placeholder="مثال: اختصر الوقائع، وأضف طلبًا احتياطيًا بالتعويض، واجعل اللهجة أكثر حزمًا."
        />
        {error ? (
          <p role="alert" className="mt-1.5 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
