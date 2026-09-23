import { useId, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Check,
  FilePlus2,
  FileText,
  Gavel,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, Pill } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useLawApp } from "@/components/law/app-context";
import { AppointmentFormDialog } from "@/components/law/appointment-form";
import { CaseFormDialog } from "@/components/law/case-form";
import { DocumentRows, UploadDialog } from "@/components/law/documents-ui";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { dateAr, dayAr, hmOf, sar, timeAr, toHalalas, whenAr, ymdFromNow, ymdOf } from "@/components/law/format";
import { ConfirmDialog, ErrorCard, InfoRow, StatusPill, Tabs, TextArea, useCan, useLoad } from "@/components/law/kit";
import { TaskFormDialog, TaskItem } from "@/components/law/tasks-ui";
import { Timeline } from "@/components/law/timeline";
import {
  CASE_STAGES,
  CASE_STAGE_LABELS,
  CASE_TYPE_LABELS,
  HEARING_STATUSES,
  HEARING_STATUS_LABELS,
  type CaseStage,
  type HearingStatus,
} from "@/lib/law/options";
import {
  addCasePayment,
  createHearing,
  deleteCase,
  deleteHearing,
  getCase,
  setCaseStage,
  updateHearing,
} from "@/lib/law/practice";
import type { HearingRow } from "@/lib/law/practice-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/cases/$id")({
  component: CasePage,
});

type Tab = "hearings" | "tasks" | "documents" | "appointments" | "log";

function CasePage() {
  const { id } = Route.useParams();
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const [tab, setTab] = useState<Tab>("hearings");
  const [dialog, setDialog] = useState<
    null | "edit" | "hearing" | "task" | "upload" | "payment" | "delete" | "appointment" | { hearing: HearingRow }
  >(null);
  const [moving, setMoving] = useState<CaseStage | null>(null);
  const res = useLoad(() => getCase({ data: { workspaceId: active.workspace.id, id } }), [active.workspace.id, id]);
  const p = res.data;

  if (res.error && !p) {
    return (
      <>
        <BackLink />
        <ErrorCard title="تعذّر فتح القضية" message={res.error} onRetry={() => void res.reload()} />
      </>
    );
  }
  if (!p) {
    return (
      <>
        <BackLink />
        <Card className="h-64 animate-pulse bg-pine-50/40">
          <span className="sr-only">جارٍ التحميل…</span>
        </Card>
      </>
    );
  }
  const k = p.case;
  const stageIndex = CASE_STAGES.indexOf(k.stage);
  const now = Date.now();
  const upcoming = p.hearings.filter((h) => h.status === "scheduled" && Date.parse(h.starts_at) >= now);
  const openTasks = p.tasks.filter((t) => !t.done_at);
  const due = k.fees_halalas !== null && k.paid_halalas !== null ? k.fees_halalas - k.paid_halalas : null;

  async function moveStage(s: CaseStage) {
    if (s === k.stage || moving) return;
    setMoving(s);
    try {
      await setCaseStage({ data: { workspaceId: active.workspace.id, id: k.id, stage: s } });
      toast.success(`المرحلة الآن: ${CASE_STAGE_LABELS[s]}`);
      await res.reload();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setMoving(null);
    }
  }

  return (
    <>
      <BackLink />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-slate">
            <span className="font-ui font-bold tabular-nums">#{k.ref_no}</span>
            <span>·</span>
            <span>{CASE_TYPE_LABELS[k.case_type]}</span>
            {k.client_id ? (
              <>
                <span>·</span>
                <Link to="/app/clients/$id" params={{ id: k.client_id }} className="font-semibold text-pine hover:underline">
                  {k.client_name}
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="mt-1.5 text-[22px] leading-snug font-extrabold md:text-[26px]">{k.title}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {allowed("case.edit") ? (
            <Button icon={Pencil} onClick={() => setDialog("edit")}>
              تعديل
            </Button>
          ) : null}
          {allowed("case.delete") ? (
            <Button icon={Trash2} variant="ghost" onClick={() => setDialog("delete")} className="hover:bg-red-50 hover:text-red-700">
              حذف
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="mb-4 p-4 md:p-5">
        <p className="mb-3 text-[13px] font-semibold text-slate">مرحلة القضية</p>
        <ol className="grid grid-cols-7 gap-1.5" aria-label="مراحل القضية">
          {CASE_STAGES.map((s, i) => {
            const done = i < stageIndex;
            const current = i === stageIndex;
            const canMove = allowed("case.edit");
            return (
              <li key={s} className="min-w-0">
                <button
                  type="button"
                  disabled={!canMove || Boolean(moving)}
                  aria-current={current ? "step" : undefined}
                  onClick={() => void moveStage(s)}
                  title={canMove ? `نقل إلى: ${CASE_STAGE_LABELS[s]}` : CASE_STAGE_LABELS[s]}
                  className="group flex w-full flex-col items-stretch gap-2 text-start disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "h-2 rounded-full transition-colors",
                      current ? "bg-lime" : done ? "bg-pine" : "bg-pine-50 group-enabled:group-hover:bg-pine-100",
                    )}
                  />
                  <span
                    className={cn(
                      "hidden truncate text-[12px] font-semibold sm:block",
                      current ? "text-pine-deep" : done ? "text-pine" : "text-slate",
                    )}
                  >
                    {moving === s ? <Loader2 className="inline size-3 animate-spin" /> : null} {CASE_STAGE_LABELS[s]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm font-bold sm:hidden">{CASE_STAGE_LABELS[k.stage]}</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Card className="p-5 md:p-6">
            <p className="text-[15px] font-bold">تفاصيل القضية</p>
            <dl className="mt-2 divide-y divide-line">
              <InfoRow k="المحكمة" v={k.court || "—"} />
              <InfoRow k="رقم القضية" v={<span className="font-ui">{k.court_case_no ?? "—"}</span>} />
              <InfoRow k="الطرف الآخر" v={k.opposing_party || "—"} />
              <InfoRow k="فُتح الملف" v={dateAr(k.opened_on)} />
              {k.closed_on ? <InfoRow k="أُغلق" v={dateAr(k.closed_on)} /> : null}
              <InfoRow
                k="المحامون"
                v={k.lawyers.length ? k.lawyers.map((l) => l.name).join("، ") : <span className="text-slate">غير محدد</span>}
              />
              <InfoRow
                k="الجلسة القادمة"
                v={upcoming.length ? whenAr(upcoming[upcoming.length - 1].starts_at) : <span className="text-slate">لا يوجد</span>}
              />
            </dl>
            {k.description ? (
              <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                {k.description}
              </p>
            ) : null}
          </Card>

          {k.fees_halalas !== null && k.paid_halalas !== null ? (
            <Card className="p-5 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[15px] font-bold">
                  <Wallet className="size-[18px] text-pine" aria-hidden="true" />
                  الأتعاب
                </p>
                {allowed("case.edit") ? (
                  <Button size="sm" icon={Plus} onClick={() => setDialog("payment")}>
                    تسجيل دفعة
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Money label="المتفق عليه" v={k.fees_halalas} />
                <Money label="المدفوع" v={k.paid_halalas} tone="lime" />
                <Money label="المتبقي" v={Math.max(0, due ?? 0)} tone={due && due > 0 ? "danger" : undefined} />
              </div>
              {k.fees_halalas > 0 ? (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-pine-50" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-lime"
                    style={{ width: `${Math.min(100, (k.paid_halalas / k.fees_halalas) * 100)}%` }}
                  />
                </div>
              ) : null}
              <p className="mt-3 text-xs text-slate">لا يرى الأتعاب إلا المحامون ومديرو المكتب.</p>
            </Card>
          ) : null}
        </div>

        <Card className="overflow-hidden xl:col-span-2">
          <Tabs
            label="ملف القضية"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "hearings", label: "الجلسات", count: p.hearings.length },
              { value: "tasks", label: "المهام", count: openTasks.length },
              { value: "documents", label: "المستندات", count: p.documents.length },
              { value: "appointments", label: "المواعيد", count: p.appointments.length },
              { value: "log", label: "السجل" },
            ]}
          />
          {tab === "hearings" ? (
            <>
              {allowed("hearing.manage") ? (
                <div className="flex justify-end px-5 pt-4 md:px-6">
                  <Button size="sm" variant="dark" icon={Plus} onClick={() => setDialog("hearing")}>
                    جلسة جديدة
                  </Button>
                </div>
              ) : null}
              {p.hearings.length === 0 ? (
                <EmptyState icon={Gavel} title="لا جلسات" body="أضف مواعيد الجلسات لتظهر في تقويم المكتب وفي يوم المحامين المكلفين." />
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {p.hearings.map((h) => {
                    const past = Date.parse(h.starts_at) < now;
                    return (
                      <li key={h.id} className="flex items-start gap-4 px-5 py-4 md:px-6">
                        <div
                          className={cn(
                            "w-16 shrink-0 rounded-xl py-2 text-center ring-1 ring-inset",
                            past ? "bg-paper text-slate ring-line" : "bg-pine-50 text-pine-deep ring-pine-100",
                          )}
                        >
                          <p className="font-ui text-lg leading-none font-bold tabular-nums">{ymdOf(h.starts_at).slice(8)}</p>
                          <p className="mt-1 text-[11px]">{dayAr(h.starts_at).split(" ").slice(2, 3).join(" ")}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                            {dayAr(h.starts_at, true)} · {timeAr(h.starts_at)}
                            <Pill tone={h.status === "scheduled" ? "pine" : h.status === "held" ? "lime" : "neutral"}>
                              {HEARING_STATUS_LABELS[h.status]}
                            </Pill>
                          </p>
                          <p className="mt-0.5 text-xs text-slate">
                            {[h.court || k.court, h.room ? `قاعة ${h.room}` : ""].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {h.outcome ? (
                            <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                              {h.outcome}
                            </p>
                          ) : null}
                        </div>
                        {allowed("hearing.manage") ? (
                          <button
                            type="button"
                            aria-label="تعديل الجلسة"
                            onClick={() => setDialog({ hearing: h })}
                            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate hover:bg-paper hover:text-pine-deep"
                          >
                            <Pencil className="size-4" />
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}
          {tab === "tasks" ? (
            <>
              {allowed("task.create") ? (
                <div className="flex justify-end px-5 pt-4 md:px-6">
                  <Button size="sm" variant="dark" icon={Plus} onClick={() => setDialog("task")}>
                    مهمة جديدة
                  </Button>
                </div>
              ) : null}
              {p.tasks.length === 0 ? (
                <EmptyState icon={ListChecks} title="لا مهام" body="قسّم العمل على القضية إلى مهام مسندة بتواريخ استحقاق." />
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {p.tasks.map((t) => (
                    <TaskItem key={t.id} task={t} showCase={false} onChanged={() => void res.reload()} />
                  ))}
                </ul>
              )}
            </>
          ) : null}
          {tab === "documents" ? (
            <>
              {allowed("document.upload") ? (
                <div className="flex justify-end px-5 pt-4 md:px-6">
                  <Button size="sm" variant="dark" icon={Upload} onClick={() => setDialog("upload")}>
                    رفع مستند
                  </Button>
                </div>
              ) : null}
              {p.documents.length === 0 ? (
                <EmptyState icon={FileText} title="لا مستندات" body="صحيفة الدعوى، المذكرات، الوكالة والأحكام — في ملف القضية." />
              ) : (
                <DocumentRows rows={p.documents} showLinks={false} onChanged={() => void res.reload()} />
              )}
            </>
          ) : null}
          {tab === "appointments" ? (
            <>
              {allowed("appointment.manage") ? (
                <div className="flex justify-end px-5 pt-4 md:px-6">
                  <Button size="sm" variant="dark" icon={CalendarPlus} onClick={() => setDialog("appointment")}>
                    موعد جديد
                  </Button>
                </div>
              ) : null}
              {p.appointments.length === 0 ? (
                <EmptyState icon={CalendarClock} title="لا مواعيد مرتبطة" body="المواعيد والاستشارات المرتبطة بهذه القضية تظهر هنا." />
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {p.appointments.map((a) => (
                    <li key={a.id}>
                      <Link to="/app/consultations/$id" params={{ id: a.id }} className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper md:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{a.title || (a.kind === "consultation" ? "استشارة" : "موعد")}</p>
                          <p className="text-xs text-slate">{whenAr(a.starts_at)}</p>
                        </div>
                        <StatusPill status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
          {tab === "log" ? (
            <Timeline
              target={{ caseId: k.id }}
              notes={p.notes}
              onChanged={() => void res.reload()}
              extras={[
                { id: "opened", at: k.created_at, icon: Check, body: `فُتح ملف القضية #${k.ref_no}` },
                ...p.hearings.map((h) => ({ id: `h-${h.id}`, at: h.starts_at, icon: Gavel, body: `جلسة ${HEARING_STATUS_LABELS[h.status]} — ${whenAr(h.starts_at)}` })),
                ...p.documents.map((d) => ({ id: `d-${d.id}`, at: d.created_at, icon: FilePlus2, body: `رُفع مستند: ${d.name}` })),
              ].filter((x) => Date.parse(x.at) <= now)}
            />
          ) : null}
        </Card>
      </div>

      {dialog === "edit" ? (
        <CaseFormDialog
          kase={k}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "hearing" || (dialog && typeof dialog === "object") ? (
        <HearingDialog
          caseId={k.id}
          defaultCourt={k.court}
          hearing={typeof dialog === "object" ? dialog.hearing : null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "task" ? (
        <TaskFormDialog
          caseId={k.id}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "upload" ? (
        <UploadDialog
          presetCase={{ id: k.id, label: `#${k.ref_no} ${k.title}` }}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "appointment" ? (
        <AppointmentFormDialog
          kind="appointment"
          presetCaseId={k.id}
          presetClient={k.client_id ? { id: k.client_id, name: k.client_name ?? "" } : null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "payment" ? (
        <PaymentDialog
          caseId={k.id}
          remaining={Math.max(0, due ?? 0)}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title={`حذف القضية #${k.ref_no}؟`}
          body="تُحذف القضية وجلساتها ومهامها وسجلها نهائيًا. تبقى مستنداتها في ملف العميل."
          confirmLabel="حذف نهائيًا"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await deleteCase({ data: { workspaceId: active.workspace.id, id: k.id } });
              toast.success("حُذفت القضية");
              void navigate({ to: "/app/cases" });
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
              setDialog(null);
            }
          }}
        />
      ) : null}
    </>
  );
}

function BackLink() {
  return (
    <Link to="/app/cases" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep">
      <ArrowRight className="size-4" aria-hidden="true" />
      القضايا
    </Link>
  );
}

function Money({ label, v, tone }: { label: string; v: number; tone?: "lime" | "danger" }) {
  return (
    <div className="rounded-xl bg-paper px-2 py-3 ring-1 ring-line">
      <p className="text-[11px] font-semibold text-slate">{label}</p>
      <p
        className={cn(
          "mt-1 font-ui text-[15px] font-bold tabular-nums",
          tone === "lime" ? "text-lime-600" : tone === "danger" ? "text-red-700" : "text-pine-deep",
        )}
      >
        {sar(v, 0)}
      </p>
    </div>
  );
}

function HearingDialog({
  caseId,
  defaultCourt,
  hearing,
  onClose,
  onSaved,
}: {
  caseId: string;
  defaultCourt: string;
  hearing: HearingRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const [date, setDate] = useState(hearing ? ymdOf(hearing.starts_at) : ymdFromNow(7));
  const [time, setTime] = useState(hearing ? hmOf(hearing.starts_at) : "09:00");
  const [duration, setDuration] = useState(hearing?.duration_minutes ?? 60);
  const [court, setCourt] = useState(hearing?.court ?? defaultCourt);
  const [room, setRoom] = useState(hearing?.room ?? "");
  const [status, setStatus] = useState<HearingStatus>(hearing?.status ?? "scheduled");
  const [outcome, setOutcome] = useState(hearing?.outcome ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !date || !time) return;
    setBusy(true);
    const fields = {
      workspaceId: active.workspace.id,
      date,
      time,
      durationMinutes: duration,
      court: court.trim(),
      room: room.trim(),
      status,
      outcome: outcome.trim(),
    };
    try {
      if (hearing) await updateHearing({ data: { ...fields, id: hearing.id } });
      else await createHearing({ data: { ...fields, caseId } });
      toast.success(hearing ? "حُفظت الجلسة" : "أُضيفت الجلسة");
      onSaved();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (confirmDelete && hearing) {
    return (
      <ConfirmDialog
        title="حذف الجلسة؟"
        body={`جلسة ${whenAr(hearing.starts_at)} ستُحذف من القضية والتقويم.`}
        confirmLabel="حذف"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteHearing({ data: { workspaceId: active.workspace.id, id: hearing.id } });
            toast.success("حُذفت الجلسة");
            onSaved();
          } catch (err) {
            toast.error(workspaceErrorMessage(err));
          }
        }}
      />
    );
  }

  return (
    <Dialog
      title={hearing ? "تعديل الجلسة" : "جلسة جديدة"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {hearing ? (
            <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)} className="me-auto hover:bg-red-50 hover:text-red-700">
              حذف
            </Button>
          ) : null}
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Save} disabled={busy}>
            حفظ
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-date`} label="التاريخ">
          <TextInput id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-ui" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${uid}-time`} label="الوقت">
            <TextInput id={`${uid}-time`} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="font-ui" />
          </Field>
          <Field id={`${uid}-dur`} label="المدة">
            <SelectInput id={`${uid}-dur`} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[30, 60, 90, 120, 180].map((d) => (
                <option key={d} value={d}>
                  {d} د
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field id={`${uid}-court`} label="المحكمة" optional>
          <TextInput id={`${uid}-court`} value={court} maxLength={160} onChange={(e) => setCourt(e.target.value)} />
        </Field>
        <Field id={`${uid}-room`} label="القاعة / الدائرة" optional>
          <TextInput id={`${uid}-room`} value={room} maxLength={60} onChange={(e) => setRoom(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field id={`${uid}-status`} label="الحالة">
            <SelectInput id={`${uid}-status`} value={status} onChange={(e) => setStatus(e.target.value as HearingStatus)}>
              {HEARING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {HEARING_STATUS_LABELS[s]}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id={`${uid}-outcome`} label="ما جرى في الجلسة" optional hint="القرار، التأجيل وسببه، والمطلوب للجلسة القادمة.">
            <TextArea id={`${uid}-outcome`} rows={4} maxLength={4000} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

function PaymentDialog({
  caseId,
  remaining,
  onClose,
  onSaved,
}: {
  caseId: string;
  remaining: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { active } = useLawApp();
  const uid = useId();
  const [amount, setAmount] = useState(remaining ? String(remaining / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    const h = toHalalas(amount);
    if (!h || h <= 0) {
      setError("اكتب مبلغًا صحيحًا بالريال.");
      return;
    }
    setBusy(true);
    try {
      await addCasePayment({ data: { workspaceId: active.workspace.id, id: caseId, amountHalalas: h } });
      toast.success("سُجّلت الدفعة");
      onSaved();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="تسجيل دفعة"
      description="تُضاف إلى المدفوع وتظهر في سجل القضية."
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" icon={busy ? Loader2 : Save} disabled={busy}>
            تسجيل
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} noValidate>
        <Field id={`${uid}-amount`} label="المبلغ (ر.س)" error={error ?? undefined} hint={remaining ? `المتبقي ${sar(remaining, 0)} ر.س` : undefined}>
          <TextInput
            id={`${uid}-amount`}
            data-autofocus
            inputMode="decimal"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            invalid={Boolean(error)}
            className="text-left font-ui"
          />
        </Field>
      </form>
    </Dialog>
  );
}

