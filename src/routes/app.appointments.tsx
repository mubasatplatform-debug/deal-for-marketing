import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Gavel, Phone, Plus, Settings2, Users, Video } from "lucide-react";
import { Button, Card, EmptyState, Select } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { AppointmentFormDialog } from "@/components/law/appointment-form";
import { shortDateAr, timeAr } from "@/components/law/format";
import { ErrorCard, useCan, useLoad, useMembers } from "@/components/law/kit";
import { APPOINTMENT_STATUS_LABELS, WEEKDAY_LABELS, type AppointmentStatus } from "@/lib/law/options";
import { getCalendar } from "@/lib/law/schedule";
import type { CalendarItem } from "@/lib/law/schedule-core";
import { addDays, riyadhMinutes, riyadhYmd, weekStart } from "@/lib/law/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/appointments")({
  component: Appointments,
});

const HOUR_PX = 56;

function Appointments() {
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const members = useMembers();
  const today = riyadhYmd();
  const [week, setWeek] = useState(() => weekStart(today));
  const [day, setDay] = useState(today);
  const [memberId, setMemberId] = useState("");
  const [adding, setAdding] = useState<null | { date?: string; time?: string }>(null);
  const cal = useLoad(
    () => getCalendar({ data: { workspaceId: active.workspace.id, from: week, days: 7, memberId: memberId || null } }),
    [active.workspace.id, week, memberId],
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  // Keep the mobile day inside the shown week.
  useEffect(() => {
    if (day < week || day > addDays(week, 6)) setDay(week <= today && today <= addDays(week, 6) ? today : week);
  }, [week, day, today]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const d of days) m.set(d, []);
    for (const it of cal.data ?? []) m.get(riyadhYmd(it.starts_at))?.push(it);
    return m;
  }, [cal.data, days]);

  const open = (it: CalendarItem) => {
    if (it.type === "hearing" && it.case_id) void navigate({ to: "/app/cases/$id", params: { id: it.case_id } });
    else void navigate({ to: "/app/consultations/$id", params: { id: it.id } });
  };

  const rangeLabel = `${shortDateAr(days[0])} – ${shortDateAr(days[6])}`;
  const count = cal.data?.length ?? 0;

  return (
    <>
      <PageHead
        title="المواعيد"
        subtitle="الجلسات والاستشارات والمواعيد في تقويم واحد (بتوقيت الرياض)"
        actions={
          <>
            {allowed("settings.booking") ? (
              <Link to="/app/settings" hash="booking" className={buttonClass("secondary")}>
                <Settings2 className="size-4" aria-hidden="true" />
                ساعات العمل والحجز
              </Link>
            ) : null}
            {allowed("appointment.manage") ? (
              <Button variant="primary" icon={Plus} onClick={() => setAdding({})}>
                موعد جديد
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3 md:p-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="الأسبوع السابق"
            onClick={() => setWeek(addDays(week, -7))}
            className="grid size-10 place-items-center rounded-xl border border-line hover:bg-paper"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            aria-label="الأسبوع التالي"
            onClick={() => setWeek(addDays(week, 7))}
            className="grid size-10 place-items-center rounded-xl border border-line hover:bg-paper"
          >
            <ChevronLeft className="size-4" />
          </button>
          <Button
            onClick={() => {
              setWeek(weekStart(today));
              setDay(today);
            }}
            disabled={week === weekStart(today)}
          >
            اليوم
          </Button>
        </div>
        <p className="text-[15px] font-bold">{rangeLabel}</p>
        <span className="text-[13px] text-slate">
          <span className="font-ui tabular-nums">{count}</span> {count === 1 ? "موعد" : "مواعيد"}
        </span>
        <div className="ms-auto flex w-full items-center gap-3 sm:w-auto">
          <Select aria-label="عضو الفريق" value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-full sm:w-48">
            <option value="">كل الفريق</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <Legend />
      </Card>

      {cal.error && !cal.data ? (
        <ErrorCard title="تعذّر تحميل التقويم" message={cal.error} onRetry={() => void cal.reload()} />
      ) : (
        <>
          {/* Phones and tablets: a day strip and that day's list. */}
          <div className="lg:hidden">
            <div role="tablist" aria-label="أيام الأسبوع" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {days.map((d, i) => {
                const n = byDay.get(d)?.length ?? 0;
                const on = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setDay(d)}
                    className={cn(
                      "flex w-[52px] shrink-0 flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors",
                      on ? "border-pine bg-pine text-snow" : "border-line bg-surface",
                      d === today && !on && "border-lime",
                    )}
                  >
                    <span className={cn("text-[11px]", on ? "text-snow/70" : "text-slate")}>{WEEKDAY_LABELS[i].replace("ال", "")}</span>
                    <span className="font-ui text-[17px] font-bold tabular-nums">{Number(d.slice(8))}</span>
                    <span className={cn("size-1.5 rounded-full", n ? (on ? "bg-lime" : "bg-pine") : "bg-transparent")} />
                  </button>
                );
              })}
            </div>
            <Card className="overflow-hidden">
              {!cal.data ? (
                <div className="h-40 animate-pulse bg-pine-50/40" />
              ) : (byDay.get(day) ?? []).length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="لا مواعيد في هذا اليوم"
                  action={
                    allowed("appointment.manage") ? (
                      <Button icon={Plus} onClick={() => setAdding({ date: day })}>
                        إضافة موعد
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {(byDay.get(day) ?? []).map((it) => (
                    <li key={`${it.type}-${it.id}`}>
                      <button type="button" onClick={() => open(it)} className="flex w-full items-stretch gap-3 px-4 py-3 text-start hover:bg-paper">
                        <div className="w-16 shrink-0 pt-0.5">
                          <p className="font-ui text-[13px] font-bold tabular-nums">{timeAr(it.starts_at)}</p>
                          <p className="font-ui text-[11px] text-slate tabular-nums">{timeAr(it.ends_at)}</p>
                        </div>
                        <span className={cn("w-1 shrink-0 rounded-full", barClass(it))} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                            <TypeIcon it={it} />
                            <span className="truncate">{itemTitle(it)}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate">{itemSub(it, members)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Desktop: week grid. */}
          <Card className="hidden overflow-hidden lg:block">
            <WeekGrid
              days={days}
              today={today}
              byDay={byDay}
              loading={!cal.data}
              onOpen={open}
              onEmpty={allowed("appointment.manage") ? (date, time) => setAdding({ date, time }) : undefined}
            />
          </Card>
        </>
      )}

      {adding ? (
        <AppointmentFormDialog
          presetDate={adding.date}
          presetTime={adding.time}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            void cal.reload();
          }}
        />
      ) : null}
    </>
  );
}

function itemTitle(it: CalendarItem): string {
  if (it.type === "hearing") return `جلسة: ${it.title}`;
  // The camera/phone icon already says "consultation"; the name is what matters.
  if (it.type === "consultation") return it.client_name || it.title || "استشارة";
  return it.title || it.client_name || "موعد";
}

function itemSub(it: CalendarItem, members: { user_id: string; name: string }[]): string {
  const who = it.member_ids
    .map((id) => members.find((m) => m.user_id === id)?.name)
    .filter(Boolean)
    .join("، ");
  const parts = [
    it.type === "consultation" && it.title ? it.title : null,
    it.location || null,
    who || null,
    it.status === "pending" ? APPOINTMENT_STATUS_LABELS[it.status as AppointmentStatus] : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function barClass(it: CalendarItem) {
  if (it.type === "hearing") return "bg-pine-deep";
  if (it.type === "consultation") return "bg-lime";
  return "bg-slate/40";
}

function TypeIcon({ it }: { it: CalendarItem }) {
  const cls = "size-3.5 shrink-0";
  if (it.type === "hearing") return <Gavel className={cls} aria-hidden="true" />;
  if (it.mode === "video") return <Video className={cls} aria-hidden="true" />;
  if (it.mode === "phone") return <Phone className={cls} aria-hidden="true" />;
  return <Users className={cls} aria-hidden="true" />;
}

function Legend() {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-slate">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-pine-deep" /> جلسة
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-lime" /> استشارة
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-slate/40" /> موعد
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-dashed border-pine" /> بانتظار التأكيد
      </span>
    </div>
  );
}

/** Lay out one day's overlapping items side by side. */
function lanes(items: CalendarItem[]) {
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const out: { it: CalendarItem; lane: number; lanes: number }[] = [];
  let group: { it: CalendarItem; lane: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) out.push({ ...g, lanes: n });
    group = [];
  };
  for (const it of sorted) {
    const s = Date.parse(it.starts_at);
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => Date.parse(g.it.ends_at) > s).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    group.push({ it, lane });
    groupEnd = Math.max(groupEnd, Date.parse(it.ends_at));
  }
  if (group.length) flush();
  return out;
}

function WeekGrid({
  days,
  today,
  byDay,
  loading,
  onOpen,
  onEmpty,
}: {
  days: string[];
  today: string;
  byDay: Map<string, CalendarItem[]>;
  loading: boolean;
  onOpen: (it: CalendarItem) => void;
  onEmpty?: (date: string, time: string) => void;
}) {
  const all = [...byDay.values()].flat();
  const minH = Math.min(8, ...all.map((it) => Math.floor(riyadhMinutes(it.starts_at) / 60)));
  const maxH = Math.max(19, ...all.map((it) => Math.ceil((riyadhMinutes(it.starts_at) + minutesOf(it)) / 60)));
  const startH = Math.max(0, minH);
  const endH = Math.min(24, maxH);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowMin = riyadhMinutes(now);

  return (
    <div className={cn("relative", loading && "opacity-60")}>
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line bg-paper/60">
        <div />
        {days.map((d, i) => (
          <div key={d} className={cn("border-s border-line px-2 py-2.5 text-center", d === today && "bg-lime-50")}>
            <p className="text-[12px] text-slate">{WEEKDAY_LABELS[i]}</p>
            <p className={cn("font-ui text-[17px] font-bold tabular-nums", d === today && "text-lime-600")}>{Number(d.slice(8))}</p>
          </div>
        ))}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="relative">
                <span className={cn("absolute end-2 font-ui text-[11px] text-slate tabular-nums", h === startH ? "top-0.5" : "-top-2")}>
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className={cn("relative border-s border-line", d === today && "bg-lime-50/40")}>
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  tabIndex={onEmpty ? 0 : -1}
                  aria-label={onEmpty ? `موعد جديد ${shortDateAr(d)} الساعة ${h}:00` : undefined}
                  disabled={!onEmpty}
                  onClick={() => onEmpty?.(d, `${String(h).padStart(2, "0")}:00`)}
                  style={{ height: HOUR_PX }}
                  className="block w-full border-t border-line/70 enabled:hover:bg-pine-50/50"
                />
              ))}
              {d === today && nowMin / 60 >= startH && nowMin / 60 <= endH ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500"
                  style={{ top: ((nowMin - startH * 60) / 60) * HOUR_PX }}
                />
              ) : null}
              {lanes(byDay.get(d) ?? []).map(({ it, lane, lanes: n }) => {
                const top = ((riyadhMinutes(it.starts_at) - startH * 60) / 60) * HOUR_PX;
                const height = Math.max(24, (minutesOf(it) / 60) * HOUR_PX - 2);
                return (
                  <button
                    key={`${it.type}-${it.id}`}
                    type="button"
                    onClick={() => onOpen(it)}
                    title={`${itemTitle(it)} — ${timeAr(it.starts_at)}`}
                    style={{ top, height, insetInlineStart: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                    className={cn(
                      "absolute z-[5] overflow-hidden rounded-lg px-2 py-1 text-start text-[11.5px] leading-tight shadow-sm transition-transform hover:z-20 hover:scale-[1.02]",
                      it.type === "hearing" && "bg-pine-deep text-snow",
                      it.type === "consultation" && "bg-lime text-pine-deep",
                      it.type === "appointment" && "bg-surface text-pine-deep ring-1 ring-line-strong",
                      it.status === "pending" && "border-2 border-dashed border-pine bg-lime-50",
                      (it.status === "done" || it.status === "held") && "opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-1 font-bold">
                      <TypeIcon it={it} />
                      <span className="truncate">{itemTitle(it)}</span>
                    </span>
                    {height > 34 ? <span className="block truncate font-ui opacity-80">{timeAr(it.starts_at)}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function minutesOf(it: CalendarItem) {
  return Math.max(15, Math.round((Date.parse(it.ends_at) - Date.parse(it.starts_at)) / 60_000));
}
