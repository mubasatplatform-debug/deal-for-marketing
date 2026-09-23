import { useId, useRef, useState } from "react";
import { Download, Eye, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { Field } from "@/components/law/fields";
import { dateAr } from "@/components/law/format";
import { ClientPicker, ConfirmDialog, useCan, type PickedClient } from "@/components/law/kit";
import { deleteDocument, LAW_MAX_FILES, LAW_MAX_FILE_BYTES } from "@/lib/law/documents";
import type { DocumentRow } from "@/lib/law/documents-core";
import { ACCEPT_ATTR, FILE_KINDS, checkFile, formatBytes, kindFromName } from "@/lib/files/validate";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

/** Download / view URL of an office document. */
export function documentUrl(workspaceId: string, id: string, inline = false): string {
  return `/api/law/documents/${id}?ws=${workspaceId}${inline ? "&inline=1" : ""}`;
}

function iconFor(name: string) {
  const k = kindFromName(name);
  if (!k) return FileText;
  if (FILE_KINDS[k].image) return FileImage;
  if (k === "xlsx") return FileSpreadsheet;
  if (k === "zip") return FileArchive;
  if (k === "mp4" || k === "mov") return FileVideo;
  return FileText;
}

/** Rows of documents with view / download / delete. */
export function DocumentRows({
  rows,
  onChanged,
  showLinks = true,
}: {
  rows: DocumentRow[];
  onChanged: () => void;
  showLinks?: boolean;
}) {
  const { active } = useLawApp();
  const allowed = useCan();
  const [confirm, setConfirm] = useState<DocumentRow | null>(null);
  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((d) => {
          const Icon = iconFor(d.name);
          const k = kindFromName(d.name);
          const viewable = k ? FILE_KINDS[k].inline : false;
          return (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3 md:px-6">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold" title={d.name}>
                  {d.name}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-slate">
                  <span className="font-ui">{formatBytes(d.size)}</span>
                  <span>{dateAr(d.created_at)}</span>
                  {showLinks && d.client_name ? <span className="truncate">{d.client_name}</span> : null}
                  {showLinks && d.case_ref ? <span className="truncate">قضية #{d.case_ref}</span> : null}
                  {d.uploaded_by_name ? <span className="hidden truncate sm:inline">رفعه {d.uploaded_by_name}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {viewable ? (
                  <a
                    href={documentUrl(active.workspace.id, d.id, true)}
                    target="_blank"
                    rel="noopener"
                    aria-label={`عرض ${d.name}`}
                    className="hidden size-9 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep sm:grid"
                  >
                    <Eye className="size-4" />
                  </a>
                ) : null}
                <a
                  href={documentUrl(active.workspace.id, d.id)}
                  aria-label={`تنزيل ${d.name}`}
                  className="grid size-9 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
                >
                  <Download className="size-4" />
                </a>
                {allowed("document.delete") ? (
                  <button
                    type="button"
                    aria-label={`حذف ${d.name}`}
                    onClick={() => setConfirm(d)}
                    className="grid size-9 place-items-center rounded-lg text-slate hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {confirm ? (
        <ConfirmDialog
          title="حذف المستند؟"
          body={
            <>
              سيُحذف «<strong className="text-pine-deep">{confirm.name}</strong>» نهائيًا من مستندات المكتب.
            </>
          }
          confirmLabel="حذف"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await deleteDocument({ data: { workspaceId: active.workspace.id, id: confirm.id } });
              toast.success("حُذف المستند");
              setConfirm(null);
              onChanged();
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
            }
          }}
        />
      ) : null}
    </>
  );
}

type Picked = { file: File; problem: string | null };

async function precheck(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  const r = checkFile(file.name, head, file.size, LAW_MAX_FILE_BYTES);
  if (r.ok) return null;
  return {
    type: "نوع الملف غير مسموح",
    empty: "الملف فارغ",
    size: `أكبر من ${formatBytes(LAW_MAX_FILE_BYTES)}`,
    content: "المحتوى لا يطابق الامتداد",
  }[r.problem];
}

/** Upload dialog: files + where they go (client and/or case, preset or picked). */
export function UploadDialog({
  presetClient,
  presetCase,
  onClose,
  onDone,
}: {
  presetClient?: PickedClient | null;
  presetCase?: { id: string; label: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [client, setClient] = useState<PickedClient | null>(presetClient ?? null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function add(list: FileList | File[]) {
    const incoming = [...list].slice(0, LAW_MAX_FILES - files.length);
    const checked = await Promise.all(incoming.map(async (file) => ({ file, problem: await precheck(file) })));
    setFiles((prev) => [...prev, ...checked].slice(0, LAW_MAX_FILES));
  }

  const good = files.filter((f) => !f.problem);

  async function upload() {
    if (busy || good.length === 0) return;
    setBusy(true);
    const form = new FormData();
    for (const f of good) form.append("files", f.file, f.file.name);
    if (client) form.append("clientId", client.id);
    if (presetCase) form.append("caseId", presetCase.id);
    try {
      const res = await fetch(`/api/law/documents/upload?ws=${active.workspace.id}`, {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; message?: string; ids?: string[] } | null;
      if (!res.ok || !body?.ok) {
        toast.error(body?.message ?? "تعذّر رفع الملفات. حاول مرة أخرى.");
        if (body?.ids?.length) onDone();
        return;
      }
      toast.success(good.length === 1 ? "رُفع المستند" : `رُفعت ${good.length} مستندات`);
      onDone();
    } catch {
      toast.error("تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="رفع مستندات"
      description={`حتى ${LAW_MAX_FILES} ملفات في المرة، ${formatBytes(LAW_MAX_FILE_BYTES)} للملف: PDF وWord وExcel والصور وغيرها.`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="primary" icon={busy ? Loader2 : Upload} disabled={busy || good.length === 0} onClick={() => void upload()}>
            {busy ? "جارٍ الرفع…" : good.length > 1 ? `رفع ${good.length} ملفات` : "رفع"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {presetCase ? (
          <p className="rounded-xl bg-paper px-4 py-3 text-[13px] text-slate ring-1 ring-line">
            تُحفظ في ملف القضية <strong className="text-pine-deep">{presetCase.label}</strong>
          </p>
        ) : (
          <Field id={`${uid}-client`} label="العميل" optional hint="بدون عميل تُحفظ في «غير مصنفة».">
            <ClientPicker id={`${uid}-client`} value={client} onChange={setClient} />
          </Field>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void add(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            drag ? "border-pine bg-pine-50" : "border-line-strong hover:bg-paper",
          )}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-lime-50 text-lime-600">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold">اختر الملفات أو اسحبها هنا</span>
          <span className="text-xs text-slate">يُفحص نوع كل ملف ومحتواه قبل الحفظ</span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length ? (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {files.map((f, i) => (
              <li key={`${f.file.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.file.name}</p>
                  <p className={cn("text-xs", f.problem ? "text-red-700" : "text-slate")}>
                    {f.problem ?? <span className="font-ui">{formatBytes(f.file.size)}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`إزالة ${f.file.name}`}
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="grid size-8 place-items-center rounded-lg text-slate hover:bg-paper"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}
