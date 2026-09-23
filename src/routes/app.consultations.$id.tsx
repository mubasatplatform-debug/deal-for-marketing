import { useEffect, useId, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  RefreshCcw,
  Save,
  Trash2,
  UserPlus,
  UserX,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Pill } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { useLawApp } from "@/components/law/app-context";
import { AppointmentFormDialog } from "@/components/law/appointment-form";
import { untilAr, useNow, windowOf } from "@/components/law/countdown";
import { Field, TextInput } from "@/components/law/fields";
import { dayAr, durationAr, phoneAr, timeAr } from "@/components/law/format";
import { ConfirmDialog, ErrorCard, InfoRow, ModePill, StatusPill, TextArea, useCan, useLoad } from "@/components/law/kit";
import { ShareLink } from "@/components/law/share-link";
import { MODE_LABELS, type AppointmentStatus } from "@/lib/law/options";
import {
  convertLead,
  deleteAppointment,
  getAppointment,
  getHostJoin,
  rotateMeetLink,
  saveConsultNotes,
  sendConsultReminder,
  setAppointmentStatus,
  setExternalLink,
  type AppointmentView,
} from "@/lib/law/schedule";
import { EXTERNAL_HOSTS_LABEL, validateExternalUrl } from "@/lib/law/video/external";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/consultations/$id")({
  component: ConsultationPage,
});

const PROVIDER_LABEL = {
  livekit: "غرفة فيديو مدمجة في المتصفح (مع غرفة انتظار)",
  jitsi: "Jitsi Meet — تفتح في نافذة جديدة",
  external: "رابط خارجي أضافه المكتب",
} as const;

function ConsultationPage() {
  const { id } = Route.useParams();
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const res = useLoad(() => getAppointment({ data: { workspaceId: active.workspace.id, id } }), [active.workspace.id, id]);
  const [dialog, setDialog] = useState<null | "edit" | "delete" | "cancel">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const a = res.data;

  if (res.error && !a) {
    return (
      <>
        <BackLink kind="consultation" />
        <ErrorCard title="تعذّر فتح الموعد" message={res.error} onRetry={() => void res.reload()} />
      </>
    );
  }
  if (!a) {
    return (
      <>
        <BackLink kind="consultation" />
        <Card className="h-64 animate-pulse bg-pine-50/40">
          <span className="sr-only">جارٍ التحميل…</span>
        </Card>
      </>
    );
  }

  const consult = a.kind === "consultation";
  const who = a.client_name ?? a.lead_name;
  const minutes = Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60_000);
  const manage = allowed(consult ? "consult.manage" : "appointment.manage");
  const outcome = allowed("consult.outcome") && (a.canHost || !consult);

  async function move(to: AppointmentStatus, reason?: string) {
    setBusy(to);
    try {
      const r = await setAppointmentStatus({
        data: { workspaceId: active.workspace.id, id, status: to, reason: reason ?? null, notify: true },
      });
      const msg: Partial<Record<AppointmentStatus, string>> = {
        confirmed: "أُكد الموعد",
        cancelled: "أُلغي الموعد",
        done: "سُجّلت الاستشارة كمكتملة",
        no_show: "سُجّل عدم حضور العميل",
      };
      toast.success(msg[to] ?? "تم");
      if (r.emailed) toast.message("أُرسل بريد للعميل");
      await res.reload();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <BackLink kind={a.kind} />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={a.status} />
            {consult ? <ModePill mode={a.mode} /> : <Pill tone="neutral" dot={false}>موعد</Pill>}
            {a.source === "booking" ? (
              <Pill tone="lime" dot={false}>
                حجز إلكتروني
              </Pill>
            ) : null}
          </div>
          <h1 className="mt-2 text-[22px] leading-snug font-extrabold md:text-[26px]">
            {a.title || (consult ? "استشارة" : "موعد")}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck2 className="size-4 text-pine" aria-hidden="true" />
              {dayAr(a.starts_at, true)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4 text-pine" aria-hidden="true" />
              {timeAr(a.starts_at)} · {durationAr(minutes)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {manage ? (
            <Button icon={Pencil} onClick={() => setDialog("edit")}>
              تعديل
            </Button>
          ) : null}
          {allowed("appointment.delete") ? (
            <Button icon={Trash2} variant="ghost" onClick={() => setDialog("delete")} className="hover:bg-red-50 hover:text-red-700">
              حذف
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <StatusActions a={a} manage={manage} outcome={outcome} busy={busy} onMove={(s) => void move(s)} onCancel={() => setDialog("cancel")} />
          {consult && a.mode === "video" ? <VideoCard a={a} onChanged={() => void res.reload()} /> : null}
          {consult && a.private_notes !== null ? <NotesCard a={a} /> : null}
          {consult && !a.canHost && allowed("consult.host", { write: false }) ? (
            <Card className="flex items-start gap-3 p-5 text-sm text-slate md:p-6">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              الاستشارة مسندة لمحامٍ آخر؛ الدخول إلى المكالمة والملاحظات الخاصة له ولمديري المكتب.
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="p-5 md:p-6">
            <p className="text-[15px] font-bold">{consult ? "العميل" : "التفاصيل"}</p>
            {who ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {a.client_id ? (
                    <Link to="/app/clients/$id" params={{ id: a.client_id }} className="truncate text-sm font-bold text-pine hover:underline">
                      {who}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-bold">{who}</p>
                  )}
                  {!a.client_id ? <p className="text-xs text-slate">غير مسجل في ملفات العملاء</p> : null}
                </div>
                {!a.client_id && a.lead_name && allowed("client.create") ? (
                  <Button
                    size="sm"
                    icon={busy === "convert" ? Loader2 : UserPlus}
                    disabled={busy === "convert"}
                    onClick={async () => {
                      setBusy("convert");
                      try {
                        const r = await convertLead({ data: { workspaceId: active.workspace.id, id } });
                        toast.success("حُفظ في ملفات العملاء");
                        void navigate({ to: "/app/clients/$id", params: { id: r.clientId } });
                      } catch (err) {
                        toast.error(workspaceErrorMessage(err));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    حفظ كعميل
                  </Button>
                ) : null}
              </div>
            ) : null}
            <dl className="mt-3 divide-y divide-line border-t border-line">
              {a.lead_phone ? (
                <InfoRow
                  k="الجوال"
                  v={
                    <a href={`tel:${a.lead_phone}`} dir="ltr" className="font-ui text-pine hover:underline">
                      {phoneAr(a.lead_phone)}
                    </a>
                  }
                />
              ) : null}
              {a.lead_email ? <InfoRow k="البريد" v={<span dir="ltr" className="font-ui text-[13px]">{a.lead_email}</span>} /> : null}
              <InfoRow k={consult ? "المحامي" : "عضو الفريق"} v={a.lawyer_name ?? <span className="text-slate">غير محدد</span>} />
              {consult ? <InfoRow k="الطريقة" v={MODE_LABELS[a.mode]} /> : null}
              {a.location ? (
                <InfoRow
                  k="المكان"
                  v={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5 text-pine" aria-hidden="true" />
                      {a.location}
                    </span>
                  }
                />
              ) : null}
              {a.case_id ? (
                <InfoRow
                  k="القضية"
                  v={
                    <Link to="/app/cases/$id" params={{ id: a.case_id }} className="text-pine hover:underline">
                      #{a.case_ref} {a.case_title}
                    </Link>
                  }
                />
              ) : null}
              {a.cancel_reason ? <InfoRow k="سبب الإلغاء" v={a.cancel_reason} /> : null}
            </dl>
          </Card>
          {consult && a.meetUrl && a.mode !== "video" ? (
            <Card className="p-5 md:p-6">
              <p className="text-[15px] font-bold">صفحة العميل</p>
              <p className="mt-1 text-[13px] text-slate">يرى فيها العميل موعده وحالته.</p>
              <ShareLink className="mt-3" url={a.meetUrl} label="رابط صفحة العميل" message="تفاصيل موعد استشارتك:" />
            </Card>
          ) : null}
        </div>
      </div>

      {dialog === "edit" ? (
        <AppointmentFormDialog
          appointment={a}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "cancel" ? (
        <CancelDialog
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            setDialog(null);
            await move("cancelled", reason);
          }}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title="حذف الموعد نهائيًا؟"
          body="يُحذف الموعد وملاحظاته من التقويم. يُفضّل «إلغاء» إن أردت إبقاء السجل."
          confirmLabel="حذف"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await deleteAppointment({ data: { workspaceId: active.workspace.id, id } });
              toast.success("حُذف الموعد");
              void navigate({ to: consult ? "/app/consultations" : "/app/appointments" });
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

function BackLink({ kind }: { kind: "consultation" | "appointment" }) {
  return (
    <Link
      to={kind === "consultation" ? "/app/consultations" : "/app/appointments"}
      className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep"
    >
      <ArrowRight className="size-4" aria-hidden="true" />
      {kind === "consultation" ? "الاستشارات" : "المواعيد"}
    </Link>
  );
}

function StatusActions({
  a,
  manage,
  outcome,
  busy,
  onMove,
  onCancel,
}: {
  a: AppointmentView;
  manage: boolean;
  outcome: boolean;
  busy: string | null;
  onMove: (s: AppointmentStatus) => void;
  onCancel: () => void;
}) {
  const now = useNow(1000);
  const w = windowOf(a.starts_at, a.ends_at, now);
  const started = now >= Date.parse(a.starts_at);
  const spin = (s: string) => (busy === s ? Loader2 : undefined);

  if (a.status === "pending") {
    return (
      <Card className="border-lime/50 bg-lime-50/60 p-5 md:p-6">
        <p className="text-[15px] font-bold">طلب بانتظار تأكيدك</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate">
          {a.source === "booking"
            ? "حجز العميل هذا الموعد من صفحة الحجز. أكّده ليصله رابط الاستشارة، أو ألغه إن لم يناسب."
            : "أكّد الموعد بعد الاتفاق مع العميل."}
        </p>
        {manage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={spin("confirmed") ?? CheckCircle2} disabled={Boolean(busy)} onClick={() => onMove("confirmed")}>
              تأكيد الموعد
            </Button>
            <Button icon={XCircle} disabled={Boolean(busy)} onClick={onCancel}>
              إلغاء
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }
  if (a.status === "confirmed") {
    return (
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold">
              {w.state === "ended" ? "انتهى وقت الموعد" : started ? "الموعد جارٍ الآن" : `يبدأ ${untilAr(Date.parse(a.starts_at), now)}`}
            </p>
            <p className="mt-0.5 text-[13px] text-slate">
              {a.kind === "consultation" && a.mode === "video"
                ? "يفتح دخول المكالمة قبل الموعد بعشر دقائق ويبقى حتى نصف ساعة بعد نهايته."
                : "سجّل النتيجة بعد انتهاء الموعد."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {outcome ? (
              <>
                <Button icon={spin("done") ?? CheckCircle2} disabled={Boolean(busy)} onClick={() => onMove("done")}>
                  تمت
                </Button>
                <Button icon={spin("no_show") ?? UserX} disabled={Boolean(busy)} onClick={() => onMove("no_show")}>
                  لم يحضر
                </Button>
              </>
            ) : null}
            {manage ? (
              <Button variant="ghost" icon={XCircle} disabled={Boolean(busy)} onClick={onCancel}>
                إلغاء الموعد
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-6">
      <p className="text-sm text-slate">
        {a.status === "done" ? "اكتملت الاستشارة." : a.status === "no_show" ? "لم يحضر العميل." : "أُلغي الموعد."}
      </p>
      {manage ? (
        <Button icon={spin("confirmed") ?? RefreshCcw} disabled={Boolean(busy)} onClick={() => onMove("confirmed")}>
          إعادة فتح الموعد
        </Button>
      ) : null}
    </Card>
  );
}

function VideoCard({ a, onChanged }: { a: AppointmentView; onChanged: () => void }) {
  const { active } = useLawApp();
  const allowed = useCan();
  const uid = useId();
  const now = useNow(1000);
  const w = windowOf(a.starts_at, a.ends_at, now);
  const provider = a.video?.provider ?? "jitsi";
  const confirmed = a.status === "confirmed";
  const [link, setLink] = useState<{ url: string; note: string | null } | null>(null);
  const [external, setExternal] = useState(a.external_url ?? "");
  const [externalError, setExternalError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Link providers (Jitsi / external): fetch the host link once the window
  // opens, so the button is a real link (new tabs opened after an await are
  // blocked by browsers).
  const canJoin = a.canHost && confirmed && w.state === "open";
  useEffect(() => {
    if (!canJoin || provider === "livekit") return;
    let alive = true;
    getHostJoin({ data: { id: a.id, workspaceId: active.workspace.id } })
      .then((r) => {
        if (alive && r.join?.kind === "link") setLink({ url: r.join.url, note: r.join.note });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canJoin, provider, a.id, a.external_url, active.workspace.id]);

  async function saveExternal(url: string | null) {
    if (url && !validateExternalUrl(url)) {
      setExternalError(`الرابط يجب أن يبدأ بـ https ومن: ${EXTERNAL_HOSTS_LABEL}.`);
      return;
    }
    setExternalError(null);
    setBusy("external");
    try {
      await setExternalLink({ data: { workspaceId: active.workspace.id, id: a.id, url } });
      toast.success(url ? "سيستخدم العميل رابطك الخارجي" : "عادت الاستشارة إلى غرفة المكتب");
      setLink(null);
      onChanged();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative isolate overflow-hidden bg-pine-deep px-5 py-6 text-snow md:px-6">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_0%_100%,rgba(194,207,48,0.22),transparent_60%)]" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lime text-pine-deep">
              <Video className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[16px] font-bold">مكالمة الفيديو</p>
              <p className="mt-0.5 text-[13px] text-snow/70">{PROVIDER_LABEL[provider]}</p>
            </div>
          </div>
          {a.canHost ? (
            !confirmed ? (
              <span className="text-[13px] text-snow/70">أكّد الموعد أولًا ليُفتح الدخول.</span>
            ) : w.state === "early" ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold">
                <Clock className="size-4" aria-hidden="true" />
                يفتح الدخول {untilAr(w.opens, now)}
              </span>
            ) : w.state === "ended" ? (
              <span className="text-[13px] text-snow/70">انتهى وقت المكالمة.</span>
            ) : provider === "livekit" ? (
              // A full page load: the call page carries the camera/microphone policy.
              <a href={`/app/consultations/${a.id}/call`} className={cn(buttonClass("primary"), "h-11 px-6 text-[15px]")}>
                <Video className="size-4" aria-hidden="true" />
                ادخل الاستشارة
              </a>
            ) : link ? (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className={cn(buttonClass("primary"), "h-11 px-6 text-[15px]")}>
                <ExternalLink className="size-4" aria-hidden="true" />
                ادخل الاستشارة
              </a>
            ) : (
              <span className="inline-flex h-11 items-center gap-2 text-sm text-snow/70">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                تجهيز الرابط…
              </span>
            )
          ) : null}
        </div>
        {link?.note && canJoin ? <p className="mt-4 text-[13px] leading-relaxed text-snow/75">{link.note}</p> : null}
      </div>

      {a.meetUrl ? (
        <div className="border-b border-line p-5 md:p-6">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Link2 className="size-4 text-pine" aria-hidden="true" />
            رابط العميل
          </p>
          <p className="mt-1 text-[13px] text-slate">
            لا يحتاج العميل حسابًا: يفحص الكاميرا والميكروفون ثم يدخل
            {provider === "livekit" ? " غرفة الانتظار حتى تسمح له بالدخول" : " المكالمة"}.
          </p>
          <ShareLink
            className="mt-3"
            url={a.meetUrl}
            label="رابط العميل"
            message={`رابط استشارتك مع ${active.workspace.name} (${dayAr(a.starts_at)} الساعة ${timeAr(a.starts_at)}):`}
          />
          {allowed("consult.manage") ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={busy === "remind" ? Loader2 : BellRing}
                disabled={Boolean(busy) || !confirmed}
                onClick={async () => {
                  setBusy("remind");
                  try {
                    const r = await sendConsultReminder({ data: { workspaceId: active.workspace.id, id: a.id } });
                    if (r.emailed) toast.success("أُرسل التذكير بالبريد");
                    else if (r.reason === "no_email") toast.error("لا يوجد بريد لهذا العميل. أرسل الرابط بالواتساب.");
                    else toast.error("تعذّر إرسال البريد الآن. أرسل الرابط بالواتساب.");
                  } catch (err) {
                    toast.error(workspaceErrorMessage(err));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                تذكير بالبريد
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={busy === "rotate" ? Loader2 : RefreshCcw}
                disabled={Boolean(busy)}
                onClick={async () => {
                  setBusy("rotate");
                  try {
                    await rotateMeetLink({ data: { workspaceId: active.workspace.id, id: a.id } });
                    toast.success("أُصدر رابط جديد، والرابط القديم لم يعد يعمل");
                    onChanged();
                  } catch (err) {
                    toast.error(workspaceErrorMessage(err));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                إصدار رابط جديد
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {a.canHost ? (
        <div className="p-5 md:p-6">
          <p className="text-sm font-bold">تفضّل Zoom أو Google Meet أو Teams؟</p>
          <p className="mt-1 text-[13px] text-slate">
            ضع رابط اجتماعك وسيدخل منه العميل بدل غرفة المكتب. يبقى رابط العميل نفسه.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveExternal(external.trim() || null);
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="flex-1">
              <label htmlFor={`${uid}-ext`} className="sr-only">
                رابط الاجتماع الخارجي
              </label>
              <TextInput
                id={`${uid}-ext`}
                dir="ltr"
                type="url"
                placeholder="https://zoom.us/j/…"
                value={external}
                onChange={(e) => setExternal(e.target.value)}
                invalid={Boolean(externalError)}
                className="h-11 text-left font-ui text-[13px]"
              />
              {externalError ? <p className="mt-1.5 text-[13px] text-red-700">{externalError}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="dark" className="h-11" disabled={busy === "external" || external.trim() === (a.external_url ?? "")}>
                حفظ الرابط
              </Button>
              {a.external_url ? (
                <Button className="h-11" disabled={busy === "external"} onClick={() => void saveExternal(null)}>
                  إزالة
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </Card>
  );
}

function NotesCard({ a }: { a: AppointmentView }) {
  const { active } = useLawApp();
  const uid = useId();
  const [notes, setNotes] = useState(a.private_notes ?? "");
  const [saved, setSaved] = useState(a.private_notes ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = notes !== saved;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Lock className="size-4 text-pine" aria-hidden="true" />
            ملاحظاتك الخاصة
          </span>
        }
        description="لا يراها العميل ولا موظفو الاستقبال."
      />
      <form
        className="px-5 pt-4 pb-5 md:px-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await saveConsultNotes({ data: { workspaceId: active.workspace.id, id: a.id, notes } });
            setSaved(notes);
            toast.success("حُفظت الملاحظات");
          } catch (err) {
            toast.error(workspaceErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field id={`${uid}-notes`} label="ملخص الاستشارة وما اتُّفق عليه">
          <TextArea
            id={`${uid}-notes`}
            rows={6}
            maxLength={8000}
            value={notes}
            placeholder="الوقائع، الرأي القانوني المبدئي، المستندات المطلوبة، الخطوة التالية…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" variant="primary" icon={busy ? Loader2 : Save} disabled={busy || !dirty}>
            حفظ
          </Button>
          {dirty ? <span className="text-[13px] text-slate">تغييرات غير محفوظة</span> : null}
        </div>
      </form>
    </Card>
  );
}

function CancelDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const uid = useId();
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      title="إلغاء الموعد؟"
      confirmLabel="إلغاء الموعد"
      danger
      onClose={onClose}
      onConfirm={() => onConfirm(reason.trim())}
      body={
        <div className="space-y-3">
          <p>يُبلَّغ العميل بالإلغاء إن كان له بريد، مع رابط لحجز موعد آخر.</p>
          <Field id={`${uid}-reason`} label="السبب" optional>
            <TextInput id={`${uid}-reason`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      }
    />
  );
}

