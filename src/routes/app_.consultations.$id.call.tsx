import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, ExternalLink, Loader2, LockKeyhole, PhoneOff, RotateCw } from "lucide-react";
import { toast, Toaster } from "sonner";
import { DealWordmark } from "@/components/logo";
import { buttonClass } from "@/components/dash/button-class";
import { untilAr, useNow, windowOf } from "@/components/law/countdown";
import { dayAr, timeAr } from "@/components/law/format";
import { PreJoin, type DeviceChoices } from "@/components/law/call/prejoin";
import { usePolicyReload } from "@/components/law/call/use-policy-reload";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { admitClient, getHostJoin, type HostJoin } from "@/lib/law/schedule";
import { workspaceErrorCode, workspaceErrorMessage } from "@/lib/saas/errors";
import { pageHead } from "@/lib/seo";

const CallRoom = lazy(() => import("@/components/law/call/call-room"));

export const Route = createFileRoute("/app_/consultations/$id/call")({
  head: () => pageHead({ title: "مكالمة الاستشارة — مكتب المحامي", noindex: true }),
  component: HostCall,
});

type Phase = { kind: "prejoin" } | { kind: "call"; choices: DeviceChoices; join: Extract<NonNullable<HostJoin["join"]>, { kind: "embed" }> } | { kind: "left"; reason: string };

function HostCall() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [info, setInfo] = useState<HostJoin | null>(null);
  const [error, setError] = useState<{ code: string | null; message: string } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "prejoin" });
  const [joining, setJoining] = useState(false);
  usePolicyReload(`host-${id}`);

  const load = useCallback(async () => {
    try {
      setInfo(await getHostJoin({ data: { id } }));
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setError({ code: workspaceErrorCode(err), message: workspaceErrorMessage(err) });
    }
  }, [id]);

  useEffect(() => {
    if (user?.id) void load();
    else if (!isPending) window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [user?.id, isPending, load]);

  const back = `/app/consultations/${id}`;

  if (phase.kind === "call") {
    return (
      <Suspense fallback={<Dark><Loader2 className="size-8 animate-spin text-lime" /></Dark>}>
        <CallRoom
          serverUrl={phase.join.serverUrl}
          token={phase.join.token}
          role="host"
          choices={phase.choices}
          title={info?.clientName ? `استشارة ${info.clientName}` : "الاستشارة"}
          subtitle={info ? `${info.office} · ${timeAr(info.startsAt)}` : undefined}
          onAdmit={async () => {
            if (!info) return;
            try {
              await admitClient({ data: { workspaceId: info.workspaceId, id } });
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
            }
          }}
          onLeave={(reason) => setPhase({ kind: "left", reason })}
        />
        <Toaster position="top-center" dir="rtl" richColors />
      </Suspense>
    );
  }

  return (
    <div className="min-h-dvh bg-paper font-dash text-pine-deep">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 md:px-8">
          <a href={back} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep">
            <ArrowRight className="size-4" aria-hidden="true" />
            العودة للاستشارة
          </a>
          <DealWordmark className="ms-auto h-5 w-auto text-pine" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {phase.kind === "left" ? (
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
              <PhoneOff className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">{phase.reason === "error" ? "انقطع الاتصال" : "غادرت المكالمة"}</h1>
            <p className="mt-2 text-sm text-slate">دوّن ملاحظاتك الخاصة وسجّل نتيجة الاستشارة من صفحتها.</p>
            <div className="mt-6 flex flex-col gap-2">
              <a href={back} className={buttonClass("dark")}>
                الملاحظات ونتيجة الاستشارة
              </a>
              <button type="button" onClick={() => setPhase({ kind: "prejoin" })} className={buttonClass("secondary")}>
                <RotateCw className="size-4" aria-hidden="true" />
                العودة للمكالمة
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
              <LockKeyhole className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">تعذّر فتح المكالمة</h1>
            <p className="mt-2 text-sm text-slate">{error.message}</p>
            <a href={error.code === "not_found" || error.code === "forbidden" ? "/app/consultations" : back} className={`${buttonClass("dark")} mt-6 w-full`}>
              العودة
            </a>
          </div>
        ) : !info ? (
          <div className="grid h-72 place-items-center">
            <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-extrabold md:text-[26px]">
              {info.clientName ? `استشارة ${info.clientName}` : "الاستشارة"}
            </h1>
            <p className="mt-1 mb-6 text-sm text-slate">
              {dayAr(info.startsAt, true)} · {timeAr(info.startsAt)}
              {info.title ? ` · ${info.title}` : ""}
            </p>
            <HostPrejoin
              info={info}
              joining={joining}
              onJoin={async (choices) => {
                setJoining(true);
                try {
                  // A fresh, short-lived token at the moment of joining.
                  const fresh = await getHostJoin({ data: { id } });
                  setInfo(fresh);
                  if (fresh.join?.kind === "embed") setPhase({ kind: "call", choices, join: fresh.join });
                  else if (fresh.join?.kind === "link") window.location.assign(fresh.join.url);
                  else toast.error("الدخول غير متاح الآن.");
                } catch (err) {
                  toast.error(workspaceErrorMessage(err));
                } finally {
                  setJoining(false);
                }
              }}
            />
          </>
        )}
      </main>
      <Toaster position="top-center" dir="rtl" richColors />
    </div>
  );
}

function HostPrejoin({ info, joining, onJoin }: { info: HostJoin; joining: boolean; onJoin: (c: DeviceChoices) => void }) {
  const now = useNow(1000);
  const w = windowOf(info.startsAt, info.endsAt, now);
  const blocked =
    info.blocked === "not_video"
      ? "هذه الاستشارة ليست مكالمة فيديو."
      : info.blocked === "status"
        ? "أكّد الموعد أولًا من صفحة الاستشارة."
        : info.blocked === "no_room"
          ? "لا توجد غرفة فيديو لهذه الاستشارة. أصدر رابطًا جديدًا من صفحتها."
          : w.state === "ended"
            ? "انتهى وقت هذه المكالمة."
            : null;
  const early = w.state === "early";
  // When the window opens while this page is up, fetch a join token.
  if (info.join?.kind === "link") {
    return (
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <p className="text-sm text-slate">{info.join.note}</p>
        <a href={info.join.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary")} mt-4`}>
          <ExternalLink className="size-4" aria-hidden="true" />
          ادخل الاستشارة
        </a>
      </div>
    );
  }
  return (
    <PreJoin
      onJoin={onJoin}
      joinDisabled={Boolean(blocked) || early || joining}
      joinLabel={
        joining ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> جارٍ الدخول…
          </>
        ) : early ? (
          <>
            <CalendarClock className="size-4" aria-hidden="true" /> يفتح الدخول {untilAr(w.opens, now)}
          </>
        ) : (
          "ادخل الاستشارة"
        )
      }
      joinHint={blocked ?? (info.clientAdmitted ? "سبق أن سمحت للعميل بالدخول." : "حين يصل العميل يظهر لك في الانتظار لتسمح له بالدخول.")}
    >
      <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <p className="text-sm font-bold">قبل الدخول</p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-slate">
          <li>تأكد أن الكاميرا والصوت يعملان هنا.</li>
          <li>العميل يدخل غرفة الانتظار ولا يرى أو يسمع أحدًا حتى تسمح له.</li>
          <li>المحادثة النصية داخل المكالمة لا تُحفظ بعد انتهائها.</li>
        </ul>
      </div>
    </PreJoin>
  );
}

function Dark({ children }: { children: React.ReactNode }) {
  return <div className="grid h-dvh place-items-center bg-[#0b1f21]">{children}</div>;
}
