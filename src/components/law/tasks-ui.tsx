import { useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { shortDateAr } from "@/components/law/format";
import { TextArea, useCan, useMembers } from "@/components/law/kit";
import { riyadhYmd } from "@/lib/law/time";
import { canEditTask } from "@/lib/law/permissions";
import { createTask, deleteTask, setTaskDone, updateTask } from "@/lib/law/practice";
import type { TaskRow } from "@/lib/law/practice-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

/** One task line: done toggle, title, case, assignee, due date, edit/delete. */
export function TaskItem({
  task,
  onChanged,
  showCase = true,
  compact,
}: {
  task: TaskRow;
  onChanged: () => void;
  showCase?: boolean;
  compact?: boolean;
}) {
  const { active, ctx } = useLawApp();
  const allowed = useCan();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const done = Boolean(task.done_at);
  const today = riyadhYmd();
  const overdue = !done && task.due_on !== null && task.due_on < today;
  const dueToday = !done && task.due_on === today;
  const mayEdit = canEditTask(active.role, ctx.user.id, task) && !active.lifecycle.readOnly;
  const mayDelete = (allowed("task.delete") || task.created_by === ctx.user.id) && !active.lifecycle.readOnly;

  async function toggle() {
    if (busy || !allowed("task.complete")) return;
    setBusy(true);
    try {
      await setTaskDone({ data: { workspaceId: active.workspace.id, id: task.id, done: !done } });
      onChanged();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("group flex items-start gap-3 px-5 md:px-6", compact ? "py-2.5" : "py-3.5")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `إعادة فتح: ${task.title}` : `إنجاز: ${task.title}`}
        disabled={busy || !allowed("task.complete")}
        onClick={() => void toggle()}
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors",
          done ? "border-lime-600 bg-lime text-pine-deep" : "border-line-strong hover:border-pine",
        )}
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", done && "text-slate line-through decoration-slate/40")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate">
          {task.due_on ? (
            <span className={cn(overdue && "font-bold text-red-700", dueToday && "font-bold text-lime-600")}>
              {overdue ? "متأخرة · " : dueToday ? "اليوم · " : ""}
              {shortDateAr(task.due_on)}
            </span>
          ) : null}
          {task.assignee_name ? <span>{task.assignee_name}</span> : <span className="text-slate/60">غير مسندة</span>}
          {showCase && task.case_id ? (
            <Link to="/app/cases/$id" params={{ id: task.case_id }} className="truncate text-pine hover:underline">
              قضية #{task.case_ref} {task.case_title}
            </Link>
          ) : null}
        </p>
        {task.notes && !compact ? <p className="mt-1 text-[13px] leading-relaxed text-slate">{task.notes}</p> : null}
      </div>
      {mayEdit || mayDelete ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {mayEdit ? (
            <button
              type="button"
              aria-label={`تعديل ${task.title}`}
              onClick={() => setEditing(true)}
              className="grid size-8 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {mayDelete ? (
            <button
              type="button"
              aria-label={`حذف ${task.title}`}
              onClick={async () => {
                try {
                  await deleteTask({ data: { workspaceId: active.workspace.id, id: task.id } });
                  onChanged();
                } catch (err) {
                  toast.error(workspaceErrorMessage(err));
                }
              }}
              className="grid size-8 place-items-center rounded-lg text-slate hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {editing ? (
        <TaskFormDialog
          task={task}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : null}
    </li>
  );
}

/** New / edit task. `caseId` attaches a new task to a case. */
export function TaskFormDialog({
  task,
  caseId,
  onClose,
  onSaved,
}: {
  task?: TaskRow | null;
  caseId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { active, ctx } = useLawApp();
  const uid = useId();
  const members = useMembers();
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [assignee, setAssignee] = useState(task ? (task.assignee_id ?? "") : ctx.user.id);
  const [due, setDue] = useState(task?.due_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (title.trim().length < 2) {
      setError("اكتب المهمة (حرفان على الأقل).");
      return;
    }
    setError(null);
    setBusy(true);
    const fields = {
      workspaceId: active.workspace.id,
      title: title.trim(),
      notes: notes.trim(),
      caseId: task ? task.case_id : (caseId ?? null),
      assigneeId: assignee || null,
      dueOn: due || null,
    };
    try {
      if (task) await updateTask({ data: { ...fields, id: task.id } });
      else await createTask({ data: fields });
      toast.success(task ? "حُفظت المهمة" : "أُضيفت المهمة");
      onSaved();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={task ? "تعديل المهمة" : "مهمة جديدة"}
      onClose={onClose}
      busy={busy}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Save} disabled={busy}>
            حفظ
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} noValidate className="grid gap-4">
        <Field id={`${uid}-title`} label="المهمة" error={error ?? undefined}>
          <TextInput
            id={`${uid}-title`}
            data-autofocus
            value={title}
            maxLength={200}
            placeholder="مثال: إعداد مذكرة الرد"
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(error)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${uid}-who`} label="مسندة إلى">
            <SelectInput id={`${uid}-who`} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— بدون —</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === ctx.user.id ? `${m.name} (أنا)` : m.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id={`${uid}-due`} label="تاريخ الاستحقاق" optional>
            <TextInput id={`${uid}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className="font-ui" />
          </Field>
        </div>
        <Field id={`${uid}-notes`} label="تفاصيل" optional>
          <TextArea id={`${uid}-notes`} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
