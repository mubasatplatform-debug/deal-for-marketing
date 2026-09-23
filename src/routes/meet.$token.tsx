import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hourglass,
  Loader2,
  MapPin,
  Phone,
  PhoneOff,
  RotateCw,
  Scale,
  UserRound,
  Video,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { buttonClass } from "@/components/dash/button-class";
import { untilAr, useNow, windowOf } from "@/components/law/countdown";
import { dayAr, durationAr, timeAr } from "@/components/law/format";
import { PreJoin, type DeviceChoices } from "@/components/law/call/prejoin";
import { usePolicyReload } from "@/components/law/call/use-policy-reload";
import { PublicShell } from "@/components/law/public-shell";
import { MODE_LABELS } from "@/lib/law/options";
import { getMeet, getMeetJoin, type MeetView } from "@/lib/law/public";
import type { JoinInfo } from "@/lib/law/video/types";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

const CallRoom = lazy(() => import("@/components/law/call/call-room"));

export const Route = createFileRoute("/meet/$token")({
  head: () => pageHead({ title: "استشارتك — مكتب المحامي", noindex: true }),
  component: MeetPage,
});

type Embed = Extract<JoinInfo, { kind: "embed" }>;

function MeetPage() {
  const { token } = Route.useParams();
  const [view, setView] = useState<MeetView | null | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [call, setCall] = useState<{ join: Embed; choices: DeviceChoices } | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  usePolicyReload(`meet-${token.slice(0, 8)}`);

  const load = useCallback(async () => {
    try {
      const v = await getMeet({ data: { token } });
      setView(v);
      if (v) setOffset(Date.parse(v.serverNow) - Date.now());
    } catch {
      setView((cur) => cur ?? null);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Waiting for the office to confirm: check again every 30 seconds.
  useEffect(() => {
    if (view?.status !== "pending" || call) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [view?.status, call, load]);

  if (call && view) {
    return (
      <Suspense fallback={<div className="grid h-dvh place-items-center bg-[#0b1f21]"><Loader2 className="size-8 animate-spin text-lime" /></div>}>
        <CallRoom
          serverUrl={call.join.serverUrl}
          token={call.join.token}
          role="guest"
          choices={call.choices}
          title={view.lawyer ? `استشارتك مع ${view.lawyer}` : "استشارتك"}
          subtitle={view.office}
          onLeave={(reason) => {
            setCall(null);
            setLeft(reason);
          }}
        />
        <Toaster position="top-center" dir="rtl" richColors />
      </Suspense>
    );
  }

  return (
    <PublicShell office={view?.office ?? null} eyebrow="استشارة قانونية">
      {view === undefined ? (
        <div className="grid h-72 place-items-center">
          <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
        </div>
      ) : view === null ? (
        <Card className="mx-auto max-w-md text-center">
          <Icon tone="neutral">
            <CalendarX2 className="size-6" />
          </Icon>
          <h1 className="mt-4 text-xl font-extrabold">الرابط غير صحيح</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            قد يكون المكتب أصدر رابطًا جديدًا لهذه الاستشارة. اطلب الرابط الأحدث من المكتب.
          </p>
        </Card>
      ) : (
        <Meet view={view} token={token} offset={offset} left={left} onJoin={(join, choices) => setCall({ join, choices })} onRefresh={load} />
      )}
      <Toaster position="top-center" dir="rtl" richColors />
    </PublicShell>
  );
}

function Meet({
  view,
  token,
  offset,
  left,
  onJoin,
  onRefresh,
}: {
  view: MeetView;
  token: string;
  offset: number;
  left: string | null;
  onJoin: (join: Embed, choices: DeviceChoices) => void;
  onRefresh: () => Promise<void>;
}) {
  const now = useNow(1000, offset);
  const w = windowOf(view.startsAt, view.endsAt, now);
  const minutes = Math.round((Date.parse(view.endsAt) - Date.parse(view.startsAt)) / 60_000);
  const [link, setLink] = useState<{ url: string; note: string | null } | null>(null);
  const [joining, setJoining] = useState(false);
  const video = view.mode === "video";
  const confirmed = view.status === "confirmed";

  // Link providers: fetch the room link once the window opens, so the button
  // is a real link (a tab opened after an await is blocked by browsers).
  const linkProvider = video && confirmed && w.state === "open" && view.provider !== "livekit";
  useEffect(() => {
    if (!linkProvider) return;
    let alive = true;
    getMeetJoin({ data: { token } })
      .then((j) => alive && j.kind === "link" && setLink({ url: j.url, note: j.note }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [linkProvider, token]);

  return (
    <div className="space-y-5">
      {view.memberUrl ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-pine-50 p-4 ring-1 ring-pine-100 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">أنت عضو في هذا المكتب. هذه صفحة العميل؛ أدِر الاستشارة من مكتبك.</p>
          <a href={view.memberUrl} className={buttonClass("dark", "sm")}>
            فتح في مكتبي
          </a>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <StatusBanner view={view} />
        <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
          <div>
            <p className="text-[13px] font-semibold text-slate">{view.clientName ? `مرحبًا ${view.clientName}،` : "مرحبًا،"}</p>
            <h1 className="mt-1 text-[22px] leading-snug font-extrabold">{view.title || "استشارتك القانونية"}</h1>
          </div>
          <dl className="space-y-2.5 text-sm">
            <Row icon={CalendarCheck2} k="اليوم" v={dayAr(view.startsAt, true)} />
            <Row icon={Clock} k="الوقت" v={`${timeAr(view.startsAt)} · ${durationAr(minutes)} (بتوقيت الرياض)`} />
            <Row icon={video ? Video : view.mode === "phone" ? Phone : MapPin} k="الطريقة" v={MODE_LABELS[view.mode]} />
            {view.lawyer ? <Row icon={UserRound} k="المحامي" v={view.lawyer} /> : null}
            {view.location ? <Row icon={MapPin} k="المكان" v={view.location} /> : null}
          </dl>
        </div>
      </Card>

      {left ? (
        <Card className="text-center">
          <Icon tone="neutral">
            <PhoneOff className="size-6" />
          </Icon>
          <p className="mt-3 font-bold">{left === "error" ? "انقطع الاتصال بالمكالمة" : "خرجت من المكالمة"}</p>
          <p className="mt-1 text-sm text-slate">يمكنك العودة ما دام وقت الاستشارة قائمًا.</p>
        </Card>
      ) : null}

      {video && confirmed && w.state !== "ended" ? (
        <Card>
          <h2 className="mb-1 text-[17px] font-extrabold">جهّز الكاميرا والصوت</h2>
          <p className="mb-5 text-[13px] text-slate">
            {view.provider === "livekit"
              ? "تعمل المكالمة داخل المتصفح دون تطبيق. عند دخولك تنتظر قليلًا حتى يسمح لك المحامي."
              : "تأكد أن الكاميرا والصوت يعملان، ثم ادخل من الزر في الموعد."}
          </p>
          {view.provider === "livekit" ? (
            <PreJoin
              joinDisabled={w.state !== "open" || joining}
              joinLabel={
                joining ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> جارٍ الدخول…
                  </>
                ) : w.state === "early" ? (
                  <>
                    <Hourglass className="size-4" aria-hidden="true" /> يفتح الدخول {untilAr(w.opens, now)}
                  </>
                ) : (
                  "ادخل الاستشارة"
                )
              }
              joinHint={w.state === "early" ? "يفتح الدخول قبل الموعد بعشر دقائق." : undefined}
              onJoin={async (choices) => {
                setJoining(true);
                try {
                  const j = await getMeetJoin({ data: { token } });
                  if (j.kind === "embed") onJoin(j, choices);
                  else window.location.assign(j.url);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "";
                  toast.error(/[؀-ۿ]/.test(msg) ? msg : "تعذّر الدخول. حاول مرة أخرى.");
                  void onRefresh();
                } finally {
                  setJoining(false);
                }
              }}
            />
          ) : (
            <PreJoin
              joinDisabled
              joinLabel={w.state === "early" ? `يفتح الدخول ${untilAr(w.opens, now)}` : "الكاميرا والصوت جاهزان"}
              onJoin={() => {}}
            >
              {w.state === "open" ? (
                link ? (
                  <div className="rounded-2xl bg-pine-deep p-5 text-snow">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className={cn(buttonClass("primary"), "h-12 w-full text-[15px]")}>
                      <ExternalLink className="size-4" aria-hidden="true" />
                      ادخل الاستشارة
                    </a>
                    {link.note ? <p className="mt-3 text-[13px] leading-relaxed text-snow/75">{link.note}</p> : null}
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-slate">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> تجهيز رابط الدخول…
                  </p>
                )
              ) : null}
            </PreJoin>
          )}
        </Card>
      ) : null}

      {view.status === "pending" ? (
        <p className="flex items-center justify-center gap-2 text-[13px] text-slate">
          <RotateCw className="size-3.5" aria-hidden="true" />
          تتحدث هذه الصفحة تلقائيًا عند تأكيد المكتب.
        </p>
      ) : null}
      {view.status === "cancelled" ? (
        <div className="text-center">
          <a href={`/o/${view.officeSlug}/book`} className={buttonClass("dark")}>
            احجز موعدًا آخر
          </a>
        </div>
      ) : null}
    </div>
  );
}

function StatusBanner({ view }: { view: MeetView }) {
  const map = {
    pending: { icon: Hourglass, text: "بانتظار تأكيد المكتب", cls: "bg-lime-50 text-pine-deep" },
    confirmed: { icon: CheckCircle2, text: "موعدك مؤكد", cls: "bg-pine text-snow" },
    done: { icon: CheckCircle2, text: "اكتملت الاستشارة. شكرًا لك", cls: "bg-paper text-slate" },
    cancelled: { icon: CalendarX2, text: "أُلغي هذا الموعد", cls: "bg-red-50 text-red-800" },
    no_show: { icon: CalendarX2, text: "انتهى الموعد", cls: "bg-paper text-slate" },
  }[view.status];
  const I = map.icon;
  return (
    <div className={cn("flex items-center gap-2.5 px-5 py-3 text-sm font-bold md:px-6", map.cls)} role="status">
      <I className="size-4" aria-hidden="true" />
      {map.text}
    </div>
  );
}

function Row({ icon: I, k, v }: { icon: typeof Scale; k: string; v: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <I className="mt-0.5 size-4 shrink-0 text-pine" aria-hidden="true" />
      <dt className="w-16 shrink-0 text-slate">{k}</dt>
      <dd className="min-w-0 font-semibold">{v}</dd>
    </div>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl bg-surface p-5 ring-1 ring-line md:p-6", className)}>{children}</section>;
}

function Icon({ tone, children }: { tone: "neutral"; children: React.ReactNode }) {
  return <span className={cn("mx-auto grid size-12 place-items-center rounded-2xl", tone === "neutral" && "bg-pine-50 text-pine")}>{children}</span>;
}
