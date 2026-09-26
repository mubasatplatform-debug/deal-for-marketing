import { useId, useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Pill } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useCopy } from "@/components/keys/use-copy";
import { useLawApp } from "@/components/law/app-context";
import { Field, TextInput } from "@/components/law/fields";
import { TextArea } from "@/components/law/kit";
import { ChannelIcon } from "@/components/law/inbox/inbox-ui";
import { deleteQuickReply, saveInboxSettings, saveQuickReply, type InboxSetup } from "@/lib/law/inbox";
import type { QuickReply } from "@/lib/law/inbox-core";
import { canInbox } from "@/lib/law/inbox-options";
import { workspaceErrorMessage } from "@/lib/saas/errors";

/**
 * «إعدادات مركز التواصل» — a drawer on the inbox page (kept out of
 * /app/settings): the channels and their state, web chat on/off, the AI
 * first responder, welcome and away texts, and the office's quick replies.
 * Everyone sees it; admins and owners change it (the server re-checks).
 */
export function InboxSettingsDialog({
  setup,
  onClose,
  onSaved,
}: {
  setup: InboxSetup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const readOnly = active.lifecycle.readOnly;
  const canEdit = canInbox(active.role, "settings") && !readOnly;
  const canQuick = canInbox(active.role, "quickReplies") && !readOnly;
  const [s, setS] = useState(setup.settings);
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopy();
  const dirty = JSON.stringify(s) !== JSON.stringify(setup.settings);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      await saveInboxSettings({ data: { workspaceId: active.workspace.id, ...s } });
      toast.success("حُفظت إعدادات مركز التواصل.");
      onSaved();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="إعدادات مركز التواصل"
      description="القنوات التي تصلك منها رسائل العملاء، والدردشة المباشرة على صفحة مكتبك."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إغلاق
          </Button>
          {canEdit ? (
            <Button variant="primary" icon={busy ? Loader2 : Check} disabled={busy || !dirty} onClick={() => void save()}>
              حفظ الإعدادات
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-7">
        <section aria-labelledby={`${uid}-channels`}>
          <h3 id={`${uid}-channels`} className="mb-2 text-sm font-bold">
            القنوات
          </h3>
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {setup.channels.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-pine-50 text-pine">
                  <ChannelIcon channel={ch.id} className="size-[18px]" />
                </span>
                <span className="flex-1 text-sm font-semibold">{ch.label}</span>
                {ch.connected ? <Pill tone="pine">متصل</Pill> : <Pill tone="neutral" dot={false}>قريبًا</Pill>}
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={save} aria-labelledby={`${uid}-chat`} className="space-y-4">
          <h3 id={`${uid}-chat`} className="text-sm font-bold">
            الدردشة المباشرة
          </h3>
          {!canEdit ? (
            <p className="rounded-xl bg-paper px-4 py-3 text-[13px] text-slate ring-1 ring-line">
              {readOnly ? "المكتب للقراءة فقط حاليًا." : "يغيّر هذه الإعدادات مالك المكتب أو مديره."}
            </p>
          ) : null}
          <label className="flex items-start gap-3 rounded-xl bg-paper p-4 ring-1 ring-line">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={s.webchatEnabled}
              onChange={(e) => setS({ ...s, webchatEnabled: e.target.checked })}
              className="mt-1 size-4 accent-[var(--color-pine)]"
            />
            <span>
              <span className="block text-sm font-bold">إظهار الدردشة على صفحة الحجز</span>
              <span className="mt-0.5 block text-[13px] text-slate">
                يظهر زر «تحدّث معنا» لزوار صفحة مكتبك، وتصلك رسائلهم هنا فورًا.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-paper p-4 ring-1 ring-line">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={s.aiFirstReply}
              onChange={(e) => setS({ ...s, aiFirstReply: e.target.checked })}
              className="mt-1 size-4 accent-[var(--color-pine)]"
            />
            <span>
              <span className="block text-sm font-bold">المساعد الآلي يرد أولًا</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-slate">
                يرحّب بالزائر ويجمع اسمه وجواله وموضوعه ويجيب عن أسئلة المكتب العامة ويعرض الحجز، دون أي رأي قانوني.
                يحوّل المحادثة إلى الفريق متى طلب الزائر ذلك أو لم يكن متأكدًا.
              </span>
              {!setup.ai.planAllows ? (
                <span className="mt-1 block text-[12.5px] font-semibold text-lime-600">
                  ضمن خطتي «احترافي» و«مؤسسي»؛ في خطتك تصل الرسائل إلى الفريق مباشرة.
                </span>
              ) : !setup.ai.configured ? (
                <span className="mt-1 block text-[12.5px] font-semibold text-lime-600">
                  المساعد قيد التجهيز؛ حتى ذلك الحين تصل الرسائل إلى الفريق مباشرة.
                </span>
              ) : null}
            </span>
          </label>
          <Field id={`${uid}-welcome`} label="رسالة الترحيب" optional hint="أول ما يراه الزائر عند فتح الدردشة.">
            <TextArea
              id={`${uid}-welcome`}
              disabled={!canEdit}
              maxLength={500}
              value={s.welcome}
              placeholder="أهلًا بك في مكتبنا. كيف نخدمك؟"
              onChange={(e) => setS({ ...s, welcome: e.target.value })}
              className="min-h-20"
            />
          </Field>
          <Field id={`${uid}-away`} label="رسالة خارج أوقات العمل" optional hint="تُرسل تلقائيًا لمن يكتب خارج ساعات العمل المحددة في إعدادات الحجز (عندما لا يرد المساعد الآلي).">
            <TextArea
              id={`${uid}-away`}
              disabled={!canEdit}
              maxLength={500}
              value={s.awayText}
              placeholder="شكرًا لتواصلك. نحن خارج أوقات العمل الآن، وسنرد عليك في أول يوم عمل."
              onChange={(e) => setS({ ...s, awayText: e.target.value })}
              className="min-h-20"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-4 py-3 text-[13px] ring-1 ring-line">
            <span className="text-slate">صفحة الحجز التي تظهر عليها الدردشة:</span>
            <span dir="ltr" className="min-w-0 flex-1 truncate font-ui text-[12.5px] font-semibold">
              {setup.bookingUrl}
            </span>
            <button
              type="button"
              onClick={() => void copy(setup.bookingUrl)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-pine hover:bg-surface"
            >
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? "نُسخ" : "نسخ"}
            </button>
            <a
              href={setup.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-pine hover:bg-surface"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              فتح
            </a>
          </div>
        </form>

        <QuickReplies items={setup.quickReplies} canEdit={canQuick} onChanged={onSaved} />
      </div>
    </Dialog>
  );
}

function QuickReplies({ items, canEdit, onChanged }: { items: QuickReply[]; canEdit: boolean; onChanged: () => void }) {
  const { active } = useLawApp();
  const uid = useId();
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<QuickReply | null>(null);
  const [open, setOpen] = useState(false);

  const reset = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setOpen(false);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("اكتب عنوان الرد ونصه.");
      return;
    }
    setBusy(true);
    try {
      await saveQuickReply({ data: { workspaceId: active.workspace.id, id: editing?.id ?? null, title: title.trim(), body: body.trim() } });
      toast.success(editing ? "حُدّث الرد الجاهز." : "أُضيف الرد الجاهز.");
      reset();
      onChanged();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (q: QuickReply) => {
    setBusy(true);
    try {
      await deleteQuickReply({ data: { workspaceId: active.workspace.id, id: q.id } });
      setRemoving(null);
      onChanged();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${uid}-qr`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id={`${uid}-qr`} className="text-sm font-bold">
          الردود الجاهزة
        </h3>
        {canEdit && !open ? (
          <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>
            رد جديد
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="mb-3 space-y-3 rounded-xl bg-paper p-4 ring-1 ring-line">
          <Field id={`${uid}-qt`} label="العنوان">
            <TextInput id={`${uid}-qt`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: طلب المستندات" />
          </Field>
          <Field id={`${uid}-qb`} label="نص الرد">
            <TextArea id={`${uid}-qb`} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={reset} disabled={busy}>
              إلغاء
            </Button>
            <Button size="sm" variant="dark" icon={busy ? Loader2 : Check} disabled={busy} onClick={() => void submit()}>
              {editing ? "حفظ التعديل" : "إضافة"}
            </Button>
          </div>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-xl bg-paper px-4 py-3 text-[13px] text-slate ring-1 ring-line">
          لا ردود جاهزة بعد. أضف الردود المتكررة (الترحيب، طلب المستندات، مواعيد العمل) ليستخدمها الفريق بضغطة.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
          {items.map((q) => (
            <li key={q.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{q.title}</p>
                <p className="line-clamp-2 text-[13px] text-slate">{q.body}</p>
              </div>
              {canEdit && removing?.id === q.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" onClick={() => setRemoving(null)} disabled={busy}>
                    تراجع
                  </Button>
                  <Button size="sm" variant="dark" className="bg-red-700 hover:bg-red-800" disabled={busy} onClick={() => void remove(q)}>
                    تأكيد الحذف
                  </Button>
                </div>
              ) : canEdit ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`تعديل ${q.title}`}
                    onClick={() => {
                      setEditing(q);
                      setTitle(q.title);
                      setBody(q.body);
                      setOpen(true);
                    }}
                    className="grid size-8 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`حذف ${q.title}`}
                    onClick={() => setRemoving(q)}
                    className="grid size-8 place-items-center rounded-lg text-slate hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
