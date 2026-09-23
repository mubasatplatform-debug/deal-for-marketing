import { useId, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { toHalalas } from "@/components/law/format";
import { ClientPicker, MemberChecklist, TextArea, lawyersOf, useCan, useMembers, type PickedClient } from "@/components/law/kit";
import { CASE_STAGES, CASE_STAGE_LABELS, CASE_TYPES, CASE_TYPE_LABELS, type CaseStage, type CaseType } from "@/lib/law/options";
import { createCase, updateCase } from "@/lib/law/practice";
import type { CaseRow } from "@/lib/law/practice-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";

const riyalText = (h: number | null | undefined) => (h ? String(h / 100) : "");

/** Create or edit a case. */
export function CaseFormDialog({
  kase,
  presetClient,
  onClose,
  onSaved,
}: {
  kase?: CaseRow | null;
  presetClient?: PickedClient | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { active, ctx } = useLawApp();
  const uid = useId();
  const allowed = useCan();
  const members = lawyersOf(useMembers());
  const showFees = allowed("case.fees.view", { write: false });
  const [title, setTitle] = useState(kase?.title ?? "");
  const [client, setClient] = useState<PickedClient | null>(
    kase?.client_id ? { id: kase.client_id, name: kase.client_name ?? "" } : (presetClient ?? null),
  );
  const [caseType, setCaseType] = useState<CaseType>(kase?.case_type ?? "commercial");
  const [stage, setStage] = useState<CaseStage>(kase?.stage ?? "consultation");
  const [court, setCourt] = useState(kase?.court ?? "");
  const [courtNo, setCourtNo] = useState(kase?.court_case_no ?? "");
  const [opposing, setOpposing] = useState(kase?.opposing_party ?? "");
  const [description, setDescription] = useState(kase?.description ?? "");
  const [fees, setFees] = useState(riyalText(kase?.fees_halalas));
  const [paid, setPaid] = useState(riyalText(kase?.paid_halalas));
  const [openedOn, setOpenedOn] = useState(kase?.opened_on ?? "");
  const [lawyers, setLawyers] = useState<string[]>(
    kase ? kase.lawyers.map((l) => l.id) : active.role !== "staff" ? [ctx.user.id] : [],
  );
  const [errors, setErrors] = useState<Partial<Record<"title" | "fees" | "paid", string>>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (title.trim().length < 2) next.title = "اكتب عنوانًا للقضية.";
    const feesH = toHalalas(fees);
    const paidH = toHalalas(paid);
    if (feesH === null) next.fees = "اكتب المبلغ بالأرقام، مثل 15000";
    if (paidH === null) next.paid = "اكتب المبلغ بالأرقام، مثل 5000";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const fields = {
      workspaceId: active.workspace.id,
      title: title.trim(),
      clientId: client?.id ?? null,
      caseType,
      stage,
      court: court.trim(),
      courtCaseNo: courtNo.trim() || null,
      opposingParty: opposing.trim(),
      description: description.trim(),
      // Staff never see fees; an edit by a lawyer keeps what is there.
      feesHalalas: showFees ? (feesH ?? 0) : (kase?.fees_halalas ?? 0),
      paidHalalas: showFees ? (paidH ?? 0) : (kase?.paid_halalas ?? 0),
      openedOn: openedOn || null,
      lawyerIds: lawyers,
    };
    try {
      if (kase) {
        await updateCase({ data: { ...fields, id: kase.id } });
        toast.success("حُفظت القضية");
        onSaved(kase.id);
      } else {
        const r = await createCase({ data: fields });
        toast.success(`فُتح ملف القضية رقم ${r.refNo}`);
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
      title={kase ? `تعديل القضية #${kase.ref_no}` : "قضية جديدة"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Save} disabled={busy}>
            {busy ? "جارٍ الحفظ…" : kase ? "حفظ" : "فتح ملف القضية"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id={`${uid}-title`} label="عنوان القضية" error={errors.title}>
            <TextInput
              id={`${uid}-title`}
              data-autofocus
              value={title}
              maxLength={200}
              placeholder="مثال: مطالبة مالية ضد شركة الأفق"
              onChange={(e) => setTitle(e.target.value)}
              invalid={Boolean(errors.title)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id={`${uid}-client`} label="العميل" optional>
            <ClientPicker id={`${uid}-client`} value={client} onChange={setClient} />
          </Field>
        </div>
        <Field id={`${uid}-type`} label="نوع القضية">
          <SelectInput id={`${uid}-type`} value={caseType} onChange={(e) => setCaseType(e.target.value as CaseType)}>
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CASE_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id={`${uid}-stage`} label="المرحلة">
          <SelectInput id={`${uid}-stage`} value={stage} onChange={(e) => setStage(e.target.value as CaseStage)}>
            {CASE_STAGES.map((s) => (
              <option key={s} value={s}>
                {CASE_STAGE_LABELS[s]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id={`${uid}-court`} label="المحكمة" optional>
          <TextInput
            id={`${uid}-court`}
            value={court}
            maxLength={160}
            placeholder="المحكمة التجارية بالرياض"
            onChange={(e) => setCourt(e.target.value)}
          />
        </Field>
        <Field id={`${uid}-no`} label="رقم القضية في المحكمة" optional>
          <TextInput
            id={`${uid}-no`}
            value={courtNo}
            dir="ltr"
            maxLength={60}
            onChange={(e) => setCourtNo(e.target.value)}
            className="text-left font-ui"
          />
        </Field>
        <Field id={`${uid}-opp`} label="الطرف الآخر" optional>
          <TextInput id={`${uid}-opp`} value={opposing} maxLength={200} onChange={(e) => setOpposing(e.target.value)} />
        </Field>
        <Field id={`${uid}-opened`} label="تاريخ فتح الملف" optional>
          <TextInput
            id={`${uid}-opened`}
            type="date"
            value={openedOn}
            onChange={(e) => setOpenedOn(e.target.value)}
            className="font-ui"
          />
        </Field>
        {showFees ? (
          <>
            <Field id={`${uid}-fees`} label="الأتعاب المتفق عليها (ر.س)" optional error={errors.fees}>
              <TextInput
                id={`${uid}-fees`}
                inputMode="decimal"
                dir="ltr"
                value={fees}
                placeholder="0"
                onChange={(e) => setFees(e.target.value)}
                invalid={Boolean(errors.fees)}
                className="text-left font-ui"
              />
            </Field>
            <Field id={`${uid}-paid`} label="المدفوع (ر.س)" optional error={errors.paid}>
              <TextInput
                id={`${uid}-paid`}
                inputMode="decimal"
                dir="ltr"
                value={paid}
                placeholder="0"
                onChange={(e) => setPaid(e.target.value)}
                invalid={Boolean(errors.paid)}
                className="text-left font-ui"
              />
            </Field>
          </>
        ) : null}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-pine-deep">المحامون المكلفون</p>
          <MemberChecklist members={members} value={lawyers} onChange={setLawyers} />
        </div>
        <div className="sm:col-span-2">
          <Field id={`${uid}-desc`} label="وصف مختصر" optional>
            <TextArea
              id={`${uid}-desc`}
              rows={3}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
