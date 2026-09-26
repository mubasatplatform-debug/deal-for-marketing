import { useEffect, useId, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Loader2, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Pill, Segmented, type Tone } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { TextInput } from "@/components/law/fields";
import { phoneAr, whenAr } from "@/components/law/format";
import { ErrorCard, ListSkeleton, Pagination, useLoad } from "@/components/law/kit";
import { CALLS_CHANGED, useSoftphone } from "@/components/law/voice/softphone-context";
import { listCalls, saveVoiceSettings, summarizeCall } from "@/lib/law/voice";
import type { CallRow } from "@/lib/law/voice-core";
import { CALL_STATUS_LABELS, formatDuration, saudiPhone, type CallStatus } from "@/lib/law/voice-options";
import { workspaceErrorMessage } from "@/lib/saas/errors";

export const Route = createFileRoute("/app/calls")({
  component: CallsPage,
});

const STATUS_TONE: Record<CallStatus, Tone> = {
  queued: "lime",
  initiated: "lime",
  ringing: "lime",
  in_progress: "lime",
  completed: "pine",
  busy: "neutral",
  no_answer: "neutral",
  failed: "danger",
  canceled: "neutral",
};

type Filter = "all" | "mine";

function CallsPage() {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const readOnly = active.lifecycle.readOnly;
  const sp = useSoftphone();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const list = useLoad(
    () => listCalls({ data: { workspaceId: wsId, page, mine: filter === "mine" } }),
    [wsId, page, filter],
  );

  // A call that just ended: reload now and again once the relay has reported.
  const reload = list.reload;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      void reload();
      clearTimeout(t);
      t = setTimeout(() => void reload(), 5000);
    };
    window.addEventListener(CALLS_CHANGED, on);
    return () => {
      window.removeEventListener(CALLS_CHANGED, on);
      clearTimeout(t);
    };
  }, [reload]);

  const setup = sp.setup;
  const data = list.data;

  return (
    <>
      <PageHead title="المكالمات" subtitle="اتصل بعملائك من المتصفح مباشرة، وراجع سجل المكالمات وتسجيلاتها وملخصاتها" />

      {setup && !setup.planAllows ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-lime-50 px-4 py-3 text-[13px] text-pine-deep ring-1 ring-lime/40">
          الاتصال من المتصفح وتلخيص المكالمات ضمن خطتي «احترافي» و«مؤسسي».
          <Link to="/app/billing" className="font-bold text-pine underline underline-offset-2">
            ترقية الخطة
          </Link>
        </p>
      ) : setup && !setup.configured ? (
        <p className="mb-4 rounded-xl bg-paper px-4 py-3 text-[13px] text-slate ring-1 ring-line">
          الاتصال من المتصفح قيد التجهيز لمكتبك. حتى ذلك الحين تفتح أزرار «اتصال» تطبيق الهاتف في جهازك.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="سجل المكالمات"
              description={data ? `${data.total} مكالمة` : undefined}
              actions={
                <Segmented
                  label="تصفية المكالمات"
                  value={filter}
                  onChange={(v) => {
                    setFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "كل المكالمات" },
                    { value: "mine", label: "مكالماتي" },
                  ]}
                />
              }
            />
            <div className="mt-4 border-t border-line">
              {list.error && !data ? (
                <div className="p-4">
                  <ErrorCard title="تعذّر تحميل المكالمات" message={list.error} onRetry={() => void list.reload()} />
                </div>
              ) : !data ? (
                <ListSkeleton rows={5} />
              ) : data.rows.length === 0 ? (
                <EmptyState
                  icon={PhoneCall}
                  title={filter === "mine" ? "لم تُجرِ مكالمات بعد" : "لا مكالمات بعد"}
                  body="اتصل برقم من لوحة الاتصال، أو من زر «اتصال» في ملف العميل أو في مركز التواصل، وستظهر المكالمات هنا."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {data.rows.map((c) => (
                    <CallItem
                      key={c.id}
                      c={c}
                      canSummarize={Boolean(setup?.planAllows && setup.aiConfigured && setup.configured && !readOnly)}
                      onChanged={() => void list.reload()}
                    />
                  ))}
                </ul>
              )}
              {data ? <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} /> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <DialCard />
          <SettingsCard />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* One call                                                                  */
/* ------------------------------------------------------------------------ */

function CallItem({ c, canSummarize, onChanged }: { c: CallRow; canSummarize: boolean; onChanged: () => void }) {
  const { active } = useLawApp();
  const [busy, setBusy] = useState(false);
  const Icon = c.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  const who = c.client_name ?? phoneAr(c.to_phone);

  const summarize = async () => {
    setBusy(true);
    try {
      await summarizeCall({ data: { workspaceId: active.workspace.id, callId: c.id } });
      toast.success("لُخّصت المكالمة.");
      onChanged();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-5 py-4 md:px-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine-50 text-pine" aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {c.client_id ? (
              <Link to="/app/clients/$id" params={{ id: c.client_id }} className="truncate text-[14px] font-bold text-pine hover:underline">
                {who}
              </Link>
            ) : (
              <span dir={c.client_name ? undefined : "ltr"} className="truncate font-ui text-[14px] font-bold">{who}</span>
            )}
            <Pill tone={STATUS_TONE[c.status]}>{CALL_STATUS_LABELS[c.status]}</Pill>
            {c.recorded ? (
              <Pill tone="neutral" dot={false}>
                مسجّلة
              </Pill>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-slate">
            {c.client_name ? (
              <span dir="ltr" className="font-ui">
                {phoneAr(c.to_phone)}
              </span>
            ) : null}
            <span>{whenAr(c.created_at)}</span>
            {c.user_name ? <span>· بواسطة {c.user_name}</span> : null}
            {c.duration_sec > 0 ? (
              <span>
                · المدة <span className="font-ui tabular-nums">{formatDuration(c.duration_sec)}</span>
              </span>
            ) : null}
          </p>

          {c.has_recording ? (
            <audio
              controls
              preload="none"
              src={`/api/voice/recording/${c.id}`}
              aria-label={`تسجيل المكالمة مع ${who}`}
              className="mt-3 h-10 w-full max-w-md"
            />
          ) : null}

          {c.ai_summary ? (
            <div className="mt-3 rounded-xl bg-lime-50 px-3.5 py-2.5 ring-1 ring-lime/40">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-lime-600">
                <Sparkles className="size-3.5" aria-hidden="true" /> ملخص المكالمة
              </p>
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-pine-deep">{c.ai_summary}</p>
            </div>
          ) : null}

          {c.transcript ? (
            <details className="mt-2 text-[13px]">
              <summary className="cursor-pointer font-semibold text-slate hover:text-pine-deep">نص المكالمة</summary>
              <p className="mt-1.5 max-h-60 overflow-y-auto rounded-lg bg-paper p-3 leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                {c.transcript}
              </p>
            </details>
          ) : null}

          {c.has_recording && canSummarize ? (
            <Button
              size="sm"
              variant="ghost"
              icon={busy ? Loader2 : FileText}
              disabled={busy}
              onClick={() => void summarize()}
              className="mt-2 -ms-3"
            >
              {c.ai_summary ? "أعد التلخيص" : "لخّص المكالمة"}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------------ */
/* Dial box                                                                  */
/* ------------------------------------------------------------------------ */

function DialCard() {
  const sp = useSoftphone();
  const id = useId();
  const [number, setNumber] = useState("");
  const [touched, setTouched] = useState(false);
  const e164 = saudiPhone(number);
  const invalid = touched && number.trim() !== "" && !e164;

  const dial = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!e164) return;
    sp.call({ to: e164, label: phoneAr(e164) });
  };

  return (
    <Card>
      <CardHeader title="لوحة الاتصال" description="اتصل بأي رقم سعودي، جوالًا كان أو ثابتًا." />
      <form onSubmit={dial} className="space-y-3 px-5 pt-4 pb-5 md:px-6" noValidate>
        <label htmlFor={`${id}-to`} className="block text-[13px] font-semibold">
          الرقم
        </label>
        <TextInput
          id={`${id}-to`}
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          placeholder="05X XXX XXXX"
          value={number}
          invalid={invalid}
          aria-describedby={`${id}-hint`}
          disabled={!sp.ready}
          onChange={(e) => setNumber(e.target.value)}
          onBlur={() => setTouched(true)}
          className="text-start font-ui"
        />
        <p id={`${id}-hint`} className={invalid ? "text-[12.5px] text-red-700" : "text-[12.5px] text-slate"}>
          {invalid ? "أدخل رقمًا سعوديًا صحيحًا، مثل 0501234567 أو 0112345678." : "يُقبل الرقم المحلي (05…) أو الدولي (+966…)."}
        </p>
        <Button type="submit" variant="dark" icon={Phone} disabled={!sp.ready || sp.busy} className="w-full">
          اتصال
        </Button>
        {!sp.ready && sp.setup ? (
          <p className="text-[12.5px] text-slate">
            {!sp.setup.planAllows
              ? "الاتصال من المتصفح غير متاح في خطتك الحالية."
              : !sp.setup.configured
                ? "الاتصال من المتصفح قيد التجهيز لمكتبك."
                : "المكتب للقراءة فقط حاليًا."}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Settings                                                                  */
/* ------------------------------------------------------------------------ */

function SettingsCard() {
  const { active } = useLawApp();
  const sp = useSoftphone();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const setup = sp.setup;
  if (!setup) return null;
  const canEdit = setup.canManage && !active.lifecycle.readOnly;

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      await saveVoiceSettings({ data: { workspaceId: active.workspace.id, recordCalls: on } });
      await sp.reloadSetup();
      toast.success(on ? "فُعّل تسجيل المكالمات." : "أُوقف تسجيل المكالمات.");
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="إعدادات المكالمات" />
      <div className="space-y-3 px-5 pt-4 pb-5 md:px-6">
        <label htmlFor={`${id}-rec`} className="flex items-start gap-3 rounded-xl bg-paper p-4 ring-1 ring-line">
          <input
            id={`${id}-rec`}
            type="checkbox"
            disabled={!canEdit || busy}
            checked={setup.recordCalls}
            onChange={(e) => void toggle(e.target.checked)}
            className="mt-1 size-4 accent-[var(--color-pine)]"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-bold">
              تسجيل المكالمات
              {busy ? <Loader2 className="size-3.5 animate-spin text-slate" aria-hidden="true" /> : null}
            </span>
            <span className="mt-1 block text-[13px] leading-relaxed text-slate">
              يسمع الطرف الآخر قبل بدء المكالمة: «هذه المكالمة مسجّلة لأغراض الجودة». تُحفظ التسجيلات لدى مزوّد الاتصالات
              Twilio، ويستمع إليها أعضاء المكتب فقط، ويمكن تفريغها نصيًا وتلخيصها بالذكاء الاصطناعي.
            </span>
          </span>
        </label>
        {!canEdit ? (
          <p className="text-[12.5px] text-slate">
            {active.lifecycle.readOnly ? "المكتب للقراءة فقط حاليًا." : "يغيّر هذا الإعداد مالك المكتب أو مديره."}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
