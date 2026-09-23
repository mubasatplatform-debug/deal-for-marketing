import { useId, useState, type FormEvent } from "react";
import { Building2, Loader2, Save, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { Field, TextInput } from "@/components/law/fields";
import { TextArea } from "@/components/law/kit";
import { toLatinDigits } from "@/components/law/office-options";
import { createClient, updateClient } from "@/lib/law/practice";
import type { ClientRow } from "@/lib/law/practice-core";
import type { ClientKind } from "@/lib/law/options";
import { normalizePhone } from "@/lib/phone";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Create or edit a client. Calls `onSaved(id)` after a successful save. */
export function ClientFormDialog({
  client,
  onClose,
  onSaved,
}: {
  client?: ClientRow | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const [kind, setKind] = useState<ClientKind>(client?.kind ?? "individual");
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ? client.phone.replace(/^\+966/, "0") : "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [idNumber, setIdNumber] = useState(client?.id_number ?? "");
  const [tags, setTags] = useState<string[]>(client?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "email" | "id", string>>>({});
  const [busy, setBusy] = useState(false);

  function addTag(raw: string) {
    const t = raw.trim().replace(/[,،]/g, "").slice(0, 30);
    if (t && !tags.includes(t) && tags.length < 12) setTags([...tags, t]);
    setTagDraft("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "اكتب الاسم (حرفان على الأقل).";
    if (phone.trim() && !normalizePhone(phone)) next.phone = "رقم الجوال غير صحيح. مثال: 0501234567";
    if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = "البريد الإلكتروني غير صحيح.";
    if (idNumber && !/^\d{10}$/.test(idNumber)) next.id = "الرقم ١٠ خانات.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const allTags = tagDraft.trim() ? [...new Set([...tags, tagDraft.trim()])] : tags;
    const fields = {
      workspaceId: active.workspace.id,
      kind,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      idNumber: idNumber || null,
      notes: notes.trim(),
      tags: allTags,
    };
    try {
      if (client) {
        await updateClient({ data: { ...fields, id: client.id } });
        toast.success("حُفظت بيانات العميل");
        onSaved(client.id);
      } else {
        const r = await createClient({ data: fields });
        toast.success("أُضيف العميل");
        onSaved(r.id);
      }
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={client ? "تعديل بيانات العميل" : "عميل جديد"}
      description={client ? undefined : "فرد أو منشأة. يمكنك إكمال البيانات لاحقًا."}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Save} disabled={busy}>
            {busy ? "جارٍ الحفظ…" : client ? "حفظ" : "إضافة العميل"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <div role="radiogroup" aria-label="نوع العميل" className="grid grid-cols-2 gap-2 sm:col-span-2">
          {(
            [
              ["individual", "فرد", User],
              ["company", "منشأة", Building2],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={kind === v}
              onClick={() => setKind(v)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors",
                kind === v ? "border-pine bg-pine-50 text-pine-deep ring-2 ring-pine/15" : "border-line-strong text-slate hover:bg-paper",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="sm:col-span-2">
          <Field id={`${uid}-name`} label={kind === "company" ? "اسم المنشأة" : "الاسم الكامل"} error={errors.name}>
            <TextInput
              id={`${uid}-name`}
              data-autofocus
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              invalid={Boolean(errors.name)}
            />
          </Field>
        </div>
        <Field id={`${uid}-phone`} label="الجوال" optional error={errors.phone}>
          <TextInput
            id={`${uid}-phone`}
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            placeholder="05xxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(toLatinDigits(e.target.value))}
            invalid={Boolean(errors.phone)}
            className="text-left font-ui"
          />
        </Field>
        <Field id={`${uid}-email`} label="البريد الإلكتروني" optional error={errors.email}>
          <TextInput
            id={`${uid}-email`}
            type="email"
            dir="ltr"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(errors.email)}
            className="text-left font-ui"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            id={`${uid}-id`}
            label={kind === "company" ? "رقم السجل التجاري" : "رقم الهوية / الإقامة"}
            optional
            error={errors.id}
          >
            <TextInput
              id={`${uid}-id`}
              inputMode="numeric"
              dir="ltr"
              maxLength={10}
              value={idNumber}
              onChange={(e) => setIdNumber(toLatinDigits(e.target.value).replace(/\D/g, ""))}
              invalid={Boolean(errors.id)}
              className="text-left font-ui sm:max-w-xs"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id={`${uid}-tags`} label="الوسوم" optional hint="اضغط Enter بعد كل وسم، مثل: عقاري، شركات، VIP">
            <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-2 py-1.5 focus-within:border-pine focus-within:ring-4 focus-within:ring-pine/10">
              {tags.map((t) => (
                <span key={t} className="inline-flex h-8 items-center gap-1 rounded-lg bg-pine-50 ps-2.5 pe-1 text-[13px] font-semibold text-pine">
                  {t}
                  <button
                    type="button"
                    aria-label={`حذف الوسم ${t}`}
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="grid size-6 place-items-center rounded-md hover:bg-pine-100"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id={`${uid}-tags`}
                value={tagDraft}
                maxLength={30}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === "،") {
                    e.preventDefault();
                    addTag(tagDraft);
                  } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={() => tagDraft && addTag(tagDraft)}
                className="h-8 min-w-24 flex-1 bg-transparent px-1.5 text-[15px] outline-none"
              />
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id={`${uid}-notes`} label="ملاحظات" optional>
            <TextArea id={`${uid}-notes`} rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
