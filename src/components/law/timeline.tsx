import { useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { dateAr, timeAr } from "@/components/law/format";
import { TextArea, useCan } from "@/components/law/kit";
import { canDeleteNote } from "@/lib/law/permissions";
import { addNote, deleteNote } from "@/lib/law/practice";
import type { NoteRow } from "@/lib/law/practice-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

/** Extra, derived timeline entries (a case opened, a document uploaded…). */
export type TimelineExtra = {
  id: string;
  at: string;
  icon: ComponentType<{ className?: string }>;
  body: ReactNode;
};

/**
 * Notes timeline for a client or a case: write a note, and read notes,
 * automatic events and the derived entries merged by date (newest first).
 */
export function Timeline({
  target,
  notes,
  extras = [],
  onChanged,
}: {
  target: { clientId?: string; caseId?: string };
  notes: NoteRow[];
  extras?: TimelineExtra[];
  onChanged: () => void;
}) {
  const { active, ctx } = useLawApp();
  const allowed = useCan();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await addNote({
        data: { workspaceId: active.workspace.id, clientId: target.clientId ?? null, caseId: target.caseId ?? null, body: text },
      });
      setBody("");
      onChanged();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  type Entry = { id: string; at: string; node: ReactNode };
  const entries: Entry[] = [
    ...notes.map((n) => ({
      id: n.id,
      at: n.created_at,
      node:
        n.kind === "event" ? (
          <p className="text-[13px] text-slate">
            {n.body}
            {n.author_name ? <span className="text-slate/70"> — {n.author_name}</span> : null}
          </p>
        ) : (
          <div className="rounded-xl bg-paper px-4 py-3 ring-1 ring-line">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold">{n.author_name ?? "عضو سابق"}</p>
              {canDeleteNote(active.role, ctx.user.id, n.author_id) && !active.lifecycle.readOnly ? (
                <button
                  type="button"
                  aria-label="حذف الملاحظة"
                  onClick={async () => {
                    try {
                      await deleteNote({ data: { workspaceId: active.workspace.id, id: n.id } });
                      onChanged();
                    } catch (err) {
                      toast.error(workspaceErrorMessage(err));
                    }
                  }}
                  className="grid size-7 place-items-center rounded-lg text-slate hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{n.body}</p>
          </div>
        ),
      kind: n.kind,
      author: n.author_name,
    })),
    ...extras.map((x) => ({
      id: x.id,
      at: x.at,
      node: (
        <p className="flex items-center gap-2 text-[13px] text-slate">
          <x.icon className="size-3.5 shrink-0 text-pine" />
          {x.body}
        </p>
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="px-5 pt-4 pb-6 md:px-6">
      {allowed("note.create") ? (
        <form onSubmit={submit} className="mb-6 flex items-end gap-2">
          <Avatar name={ctx.user.name || ctx.user.email} className="mb-1 hidden size-8 text-xs sm:grid" />
          <label className="sr-only" htmlFor="timeline-note">
            ملاحظة جديدة
          </label>
          <TextArea
            id="timeline-note"
            rows={2}
            maxLength={4000}
            value={body}
            placeholder="اكتب ملاحظة داخلية (لا يراها العميل)…"
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
            }}
            className="min-h-12 flex-1"
          />
          <Button type="submit" variant="dark" icon={busy ? Loader2 : Send} disabled={busy || !body.trim()} aria-label="إضافة الملاحظة" className="h-12">
            <span className="hidden sm:inline">إضافة</span>
          </Button>
        </form>
      ) : null}
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate">لا شيء في السجل بعد.</p>
      ) : (
        <ol className="relative space-y-4 border-s border-line ps-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span
                aria-hidden="true"
                className={cn("absolute -start-[25px] top-1.5 size-2.5 rounded-full bg-line-strong ring-4 ring-surface")}
              />
              <p className="mb-1 font-ui text-[11px] text-slate/80">
                {dateAr(e.at)} · {timeAr(e.at)}
              </p>
              {e.node}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
