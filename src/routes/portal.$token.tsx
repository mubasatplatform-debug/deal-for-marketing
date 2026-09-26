import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarX2,
  Download,
  FileText,
  Gavel,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  RotateCw,
  Scale,
  UserRound,
  Video,
} from "lucide-react";
import { buttonClass } from "@/components/dash/button-class";
import { dateAr, dayAr, timeAr } from "@/components/law/format";
import { PublicShell } from "@/components/law/public-shell";
import { formatBytes } from "@/lib/files/validate";
import { CASE_STAGE_LABELS, MODE_LABELS } from "@/lib/law/options";
import { getPortal } from "@/lib/law/portal";
import type { PortalAppointment, PortalHearing, PortalView } from "@/lib/law/portal-core";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/$token")({
  head: () => pageHead({ title: "بوابة العميل — مكتب المحامي", noindex: true }),
  component: PortalPage,
});

function PortalPage() {
  const { token } = Route.useParams();
  const [view, setView] = useState<PortalView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setView(await getPortal({ data: { token } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(/[؀-ۿ]/.test(msg) ? msg : "تعذّر تحميل الصفحة. تحقق من الاتصال وحاول مرة أخرى.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PublicShell office={view?.office.name ?? null} city={view?.office.city || undefined} eyebrow="بوابة العميل">
      {error && view === undefined ? (
        <Card className="mx-auto max-w-md text-center">
          <Badge>
            <RotateCw className="size-6" aria-hidden="true" />
          </Badge>
          <p className="mt-4 text-sm leading-relaxed text-slate">{error}</p>
          <button type="button" onClick={() => void load()} className={cn(buttonClass("dark"), "mt-4 h-11")}>
            إعادة المحاولة
          </button>
        </Card>
      ) : view === undefined ? (
        <div className="grid h-72 place-items-center">
          <Loader2 className="size-6 animate-spin text-slate" aria-hidden="true" />
          <span className="sr-only">جارٍ التحميل…</span>
        </div>
      ) : view === null ? (
        <Card className="mx-auto max-w-md text-center">
          <Badge>
            <CalendarX2 className="size-6" aria-hidden="true" />
          </Badge>
          <h1 className="mt-4 text-xl font-extrabold">الرابط غير صالح</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            قد يكون المكتب أوقف هذا الرابط أو أصدر رابطًا جديدًا بدلًا منه. اطلب الرابط الأحدث من مكتب المحاماة.
          </p>
        </Card>
      ) : (
        <Portal view={view} token={token} />
      )}
    </PublicShell>
  );
}

type Upcoming =
  | { kind: "hearing"; at: string; h: PortalHearing }
  | { kind: "appointment"; at: string; a: PortalAppointment };

function Portal({ view, token }: { view: PortalView; token: string }) {
  const upcoming: Upcoming[] = [
    ...view.hearings.map((h) => ({ kind: "hearing" as const, at: h.starts_at, h })),
    ...view.appointments.map((a) => ({ kind: "appointment" as const, at: a.starts_at, a })),
  ].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] font-semibold text-slate">مرحبًا {view.client.name}،</p>
        <h1 className="mt-1 text-[22px] leading-snug font-extrabold">ملفك لدى {view.office.name}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate">
          هذه صفحتك الخاصة لمتابعة قضاياك ومواعيدك والمستندات التي شاركها المكتب معك. لا تشارك الرابط مع غيرك.
        </p>
      </div>

      <Section icon={Scale} title="قضاياك" count={view.cases.length}>
        {view.cases.length === 0 ? (
          <Empty text="لا توجد قضايا مسجلة باسمك حاليًا." />
        ) : (
          <ul className="divide-y divide-line">
            {view.cases.map((k) => (
              <li key={k.id} className="px-5 py-4 md:px-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-10 shrink-0 font-ui text-[13px] font-bold text-slate tabular-nums">#{k.ref_no}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug font-bold break-words">{k.title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate">
                      {k.court ? (
                        <span className="inline-flex items-center gap-1">
                          <Landmark className="size-3.5" aria-hidden="true" />
                          {k.court}
                        </span>
                      ) : null}
                      {k.next_hearing_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Gavel className="size-3.5" aria-hidden="true" />
                          الجلسة القادمة: {dayAr(k.next_hearing_at)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                      k.stage === "closed" ? "bg-paper text-slate ring-line" : "bg-pine-50 text-pine ring-pine-100",
                    )}
                  >
                    {CASE_STAGE_LABELS[k.stage]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={CalendarClock} title="المواعيد والجلسات القادمة" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <Empty text="لا مواعيد ولا جلسات قادمة. سيظهر هنا كل موعد يحدده المكتب." />
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map((u) => (u.kind === "hearing" ? <HearingItem key={`h-${u.h.id}`} h={u.h} /> : <AppointmentItem key={`a-${u.a.id}`} a={u.a} />))}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-xs text-slate md:px-6">الأوقات بتوقيت الرياض.</p>
      </Section>

      <Section icon={FileText} title="المستندات" count={view.documents.length}>
        {view.documents.length === 0 ? (
          <Empty text="لم يشارك المكتب معك مستندات بعد." />
        ) : (
          <ul className="divide-y divide-line">
            {view.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={`/api/portal/documents/${d.id}?t=${encodeURIComponent(token)}`}
                  className="flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-paper md:px-6"
                  aria-label={`تنزيل ${d.name}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine">
                    <FileText className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" title={d.name}>
                      {d.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-slate">
                      <span className="font-ui">{formatBytes(d.size)}</span>
                      <span>{dateAr(d.created_at)}</span>
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl text-pine">
                    <Download className="size-5" aria-hidden="true" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-center text-xs leading-relaxed text-slate">
        لأي استفسار عن قضيتك تواصل مع المكتب مباشرة. تُعرض هنا المعلومات التي يتيحها المكتب فقط.
      </p>
    </div>
  );
}

function HearingItem({ h }: { h: PortalHearing }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4 md:px-6">
      <DateChip iso={h.starts_at} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          جلسة قضية #{h.case_ref}
          {h.status === "postponed" ? <span className="ms-2 text-xs font-semibold text-slate">(مؤجلة)</span> : null}
        </p>
        <p className="mt-0.5 text-[13px] text-slate break-words">{h.case_title}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate">
          <span>
            {dayAr(h.starts_at)} · {timeAr(h.starts_at)}
          </span>
          {h.court ? (
            <span className="inline-flex items-center gap-1">
              <Landmark className="size-3.5" aria-hidden="true" />
              {h.court}
              {h.room ? ` · قاعة ${h.room}` : ""}
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function AppointmentItem({ a }: { a: PortalAppointment }) {
  const ModeIcon = a.mode === "video" ? Video : a.mode === "phone" ? Phone : MapPin;
  return (
    <li className="flex items-start gap-3 px-5 py-4 md:px-6">
      <DateChip iso={a.starts_at} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {a.title || (a.kind === "consultation" ? "استشارة" : "موعد في المكتب")}
          <span
            className={cn(
              "ms-2 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              a.status === "confirmed" ? "bg-pine-50 text-pine" : "bg-lime-50 text-pine-deep",
            )}
          >
            {a.status === "confirmed" ? "مؤكد" : "بانتظار التأكيد"}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate">
          <span>
            {dayAr(a.starts_at)} · {timeAr(a.starts_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ModeIcon className="size-3.5" aria-hidden="true" />
            {MODE_LABELS[a.mode]}
          </span>
          {a.lawyer_name ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden="true" />
              {a.lawyer_name}
            </span>
          ) : null}
          {a.location ? <span>{a.location}</span> : null}
        </p>
        {a.meet_url ? (
          <a href={a.meet_url} className={cn(buttonClass("dark"), "mt-3 h-11")}>
            <Video className="size-4" aria-hidden="true" />
            صفحة المكالمة
          </a>
        ) : null}
      </div>
    </li>
  );
}

function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", timeZone: "Asia/Riyadh" });
  const month = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short", timeZone: "Asia/Riyadh" });
  return (
    <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-paper py-1.5 text-center ring-1 ring-line">
      <span className="font-ui text-lg leading-none font-extrabold">{day}</span>
      <span className="mt-0.5 text-[11px] text-slate">{month}</span>
    </span>
  );
}

function Section({
  icon: I,
  title,
  count,
  children,
}: {
  icon: typeof Scale;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-4 md:px-6">
        <span className="grid size-8 place-items-center rounded-lg bg-lime-50 text-lime-600">
          <I className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {count ? <span className="ms-auto font-ui text-[13px] font-bold text-slate tabular-nums">{count}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-slate md:px-6">{text}</p>;
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl bg-surface p-5 ring-1 ring-line md:p-6", className)}>{children}</section>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">{children}</span>;
}
