import type { ReactNode } from "react";
import {
  BarChart3,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Headset,
  Inbox as InboxIcon,
  LayoutGrid,
  Link2,
  MessageCircle,
  MicOff,
  MoreHorizontal,
  Package,
  Pause,
  Paperclip,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Send,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DeskFrame, LiveChip, type DeskNavItem } from "@/components/desk-frame";
import { Button, Card, CardHeader, Num, Pill, type Tone } from "@/components/dash/ui";
import {
  ChartTip,
  Face,
  IconButton,
  LegendDot,
  Masked,
  Meter,
  Money,
  Stat,
  TableHead,
  td,
} from "@/components/desks/kit";
import { chart } from "@/components/desks/tokens";
import { cn } from "@/lib/utils";

const nav = [
  { id: "home", label: "غرفة العمليات", icon: LayoutGrid },
  { id: "inbox", label: "الوارد", icon: InboxIcon, badge: 7 },
  { id: "calls", label: "الكول سنتر", icon: Headset, badge: 4 },
  { id: "ai", label: "الذكاء يدير", icon: Sparkles },
] as const satisfies readonly DeskNavItem[];

const more: DeskNavItem[] = [
  { id: "customers", label: "العملاء", icon: Users },
  { id: "reports", label: "التقارير", icon: BarChart3 },
];

export type CrmView = (typeof nav)[number]["id"];

const pages: Record<CrmView, { title?: string; subtitle?: string; bare?: boolean; path: string }> =
  {
    home: {
      title: "غرفة العمليات",
      subtitle: "الأربعاء 23 سبتمبر · واتساب والكول سنتر",
      path: "instant",
    },
    inbox: { bare: true, path: "instant/inbox" },
    calls: { bare: true, path: "instant/calls" },
    ai: {
      title: "الذكاء يدير الخط",
      subtitle: "آخر 24 ساعة · يرد، يراجع الملف، ويحوّل لك ما يحتاجك",
      path: "instant/ai",
    },
  };

export function CrmDesk({ view }: { view: CrmView }) {
  const screens: Record<CrmView, ReactNode> = {
    home: <Home />,
    inbox: <Inbox />,
    calls: <Calls />,
    ai: <AiRun />,
  };
  const actions: Partial<Record<CrmView, ReactNode>> = {
    home: (
      <>
        <RangeTabs active="اليوم" />
        <Button size="sm" icon={Download}>
          تصدير
        </Button>
      </>
    ),
    ai: (
      <>
        <Button size="sm" icon={SlidersHorizontal}>
          حدود الذكاء
        </Button>
        <Button size="sm" variant="dark" icon={Pause}>
          إيقاف مؤقت
        </Button>
      </>
    ),
  };
  const p = pages[view];
  return (
    <DeskFrame
      product="الحل اللحظي"
      workspace="محامص الريم"
      workspaceMark="ر"
      workspaceMeta="بريدة · 3 فروع"
      path={p.path}
      view={view}
      nav={nav}
      more={more}
      user={{ name: "هند العلي", role: "مشرفة خدمة العملاء" }}
      searchHint="ابحث باسم عميل، رقم طلب، أو محادثة"
      status={<LiveChip>الخط يعمل · 3 وكلاء</LiveChip>}
      title={p.title}
      subtitle={p.subtitle}
      actions={actions[view]}
      bare={p.bare}
    >
      {screens[view]}
    </DeskFrame>
  );
}

function RangeTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 rounded-xl bg-pine-50/70 p-1">
      {["اليوم", "7 أيام", "30 يومًا"].map((r) => (
        <span
          key={r}
          className={cn(
            "inline-flex h-6 items-center rounded-lg px-3 text-xs font-semibold",
            r === active ? "bg-surface text-pine-deep shadow-sm ring-1 ring-line" : "text-slate",
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

type State = "ai" | "need" | "team" | "done" | "draft";
const stateLabel: Record<State, [string, Tone]> = {
  ai: ["يرد الذكاء", "pine"],
  need: ["يحتاجك", "lime"],
  team: ["مع الفريق", "neutral"],
  done: ["مغلقة", "neutral"],
  draft: ["مسودة رد", "neutral"],
};

function StatePill({ s }: { s: State }) {
  const [label, tone] = stateLabel[s];
  return <Pill tone={tone}>{label}</Pill>;
}

type Channel = "wa" | "call";
function ChannelTag({ ch, className }: { ch: Channel; className?: string }) {
  const Icon = ch === "wa" ? MessageCircle : Phone;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-slate", className)}>
      <Icon className="size-3.5" />
      {ch === "wa" ? "واتساب" : "مكالمة"}
    </span>
  );
}

const threads: {
  name: string;
  ch: Channel;
  preview: string;
  time: string;
  state: State;
  unread?: number;
  agent: string;
}[] = [
  {
    name: "أبو فهد العنزي",
    ch: "wa",
    preview: "والفاتورة تجي مع المندوب ولا على الواتساب؟",
    time: "14:02",
    state: "ai",
    unread: 2,
    agent: "الذكاء",
  },
  {
    name: "نورة السبيعي",
    ch: "call",
    preview: "أبغى موعد استلام بعد العشاء",
    time: "13:51",
    state: "need",
    unread: 1,
    agent: "هند",
  },
  {
    name: "مؤسسة النور",
    ch: "wa",
    preview: "أرسلنا الحوالة، تأكدون الاستلام؟",
    time: "13:40",
    state: "done",
    agent: "الذكاء",
  },
  {
    name: "خالد القصّاب",
    ch: "wa",
    preview: "عرض سعر جملة لثلاث فروع",
    time: "13:18",
    state: "draft",
    agent: "ماجد",
  },
  {
    name: "أم ريان",
    ch: "wa",
    preview: "المندوب قريب؟ أنا بالبيت",
    time: "12:55",
    state: "done",
    agent: "الذكاء",
  },
  {
    name: "روابي للتجارة",
    ch: "call",
    preview: "استفسار عن بند الغرامة بالعقد",
    time: "12:21",
    state: "need",
    unread: 3,
    agent: "سلطان",
  },
  {
    name: "فهد العتيبي",
    ch: "wa",
    preview: "درجة التحميص غير اللي طلبتها",
    time: "11:44",
    state: "team",
    agent: "هند",
  },
  {
    name: "مكتب السالم",
    ch: "wa",
    preview: "نحتاج عرض سعر هذا الأسبوع",
    time: "11:02",
    state: "done",
    agent: "الذكاء",
  },
];

/* ───────────────────────── Operations room ───────────────────────── */

const hourly = [
  { h: "8:00", ai: 6, team: 1 },
  { h: "9:00", ai: 9, team: 2 },
  { h: "10:00", ai: 12, team: 2 },
  { h: "11:00", ai: 14, team: 3 },
  { h: "12:00", ai: 11, team: 2 },
  { h: "13:00", ai: 15, team: 1 },
  { h: "14:00", ai: 13, team: 2 },
  { h: "15:00", ai: 8, team: 1 },
  { h: "16:00", ai: 10, team: 2 },
  { h: "17:00", ai: 12, team: 1 },
  { h: "18:00", ai: 7, team: 1 },
  { h: "19:00", ai: 5, team: 0 },
];

function Home() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="محادثات اليوم"
          value="142"
          delta="18%"
          foot="118 واتساب · 24 مكالمة"
          spark={[82, 94, 90, 108, 101, 126, 142]}
        />
        <Stat
          label="أنهاها الذكاء وحده"
          value="91%"
          delta="4 نقاط"
          foot="129 من 142"
          spark={[84, 85, 87, 86, 89, 90, 91]}
        />
        <Stat
          label="زمن أول رد"
          value="4 ث"
          delta="1.2 ث"
          deltaDown
          deltaSoft
          foot="أسرع من الأسبوع الماضي"
          spark={[7, 6.4, 6, 5.6, 5.2, 4.6, 4]}
        />
        <Stat
          label="تنتظر قرارك"
          value="7"
          foot="أقدمها منذ 6 دقائق"
          side={
            <span className="flex -space-x-2 space-x-reverse">
              {["نورة", "روابي", "فهد"].map((n) => (
                <Face key={n} name={n} className="size-7 text-[11px] ring-2 ring-surface" />
              ))}
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-8">
          <CardHeader
            title="المحادثات حسب الساعة"
            description="من ردّ على كل محادثة اليوم"
            actions={
              <div className="flex gap-4">
                <LegendDot color={chart.pine}>الذكاء</LegendDot>
                <LegendDot color={chart.lime}>الفريق</LegendDot>
              </div>
            }
          />
          <div className="h-[232px] px-3 pt-3 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourly}
                barCategoryGap="32%"
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis
                  dataKey="h"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Manrope" }}
                  dy={6}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Manrope" }}
                />
                <Tooltip
                  cursor={{ fill: "#eaf0ef80" }}
                  content={<ChartTip names={{ ai: "الذكاء", team: "الفريق" }} />}
                />
                <Bar
                  dataKey="ai"
                  stackId="a"
                  fill={chart.pine}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="team"
                  stackId="a"
                  fill={chart.lime}
                  maxBarSize={22}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="col-span-4">
          <CardHeader title="الفريق الآن" description="3 وكلاء والذكاء على الخط" />
          <ul className="mt-3 divide-y divide-line px-5 pb-2">
            {[
              {
                n: "الذكاء",
                r: "واتساب والمكالمات",
                s: "يرد على 12",
                tone: "pine" as Tone,
                ai: true,
              },
              { n: "هند العلي", r: "الوارد", s: "متاحة", tone: "lime" as Tone },
              { n: "سلطان الحربي", r: "الكول سنتر", s: "في مكالمة", tone: "neutral" as Tone },
              { n: "ماجد الشمري", r: "الطلبات والجملة", s: "متاح", tone: "lime" as Tone },
            ].map((a) => (
              <li key={a.n} className="flex items-center gap-3 py-3">
                {a.ai ? (
                  <span className="grid size-9 place-items-center rounded-full bg-pine-deep text-lime">
                    <Sparkles className="size-4" />
                  </span>
                ) : (
                  <Face name={a.n} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">{a.n}</p>
                  <p className="text-xs text-slate">{a.r}</p>
                </div>
                <Pill tone={a.tone}>{a.s}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="آخر المحادثات"
          description="كل القنوات · محدّثة لحظيًا"
          actions={
            <Button size="sm" variant="ghost">
              عرض الوارد
            </Button>
          }
        />
        <table className="mt-4 w-full">
          <TableHead cols={["العميل", "القناة", "الموضوع", "المسؤول", "الحالة", "الوقت"]} />
          <tbody className="divide-y divide-line">
            {threads.slice(0, 6).map((t) => (
              <tr key={t.name}>
                <td className={td}>
                  <span className="flex items-center gap-2.5">
                    <Face name={t.name} className="size-7 text-[11px]" />
                    <span className="font-bold">{t.name}</span>
                  </span>
                </td>
                <td className={td}>
                  <ChannelTag ch={t.ch} />
                </td>
                <td className={cn(td, "max-w-[280px] truncate text-slate")}>{t.preview}</td>
                <td className={td}>{t.agent}</td>
                <td className={td}>
                  <StatePill s={t.state} />
                </td>
                <td className={cn(td, "text-slate")}>
                  <Num>{t.time}</Num>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ───────────────────────── Inbox ───────────────────────── */

function Inbox() {
  const active = threads[0];
  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_320px]">
      <ThreadList />

      <section className="flex min-h-0 flex-col bg-paper">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
          <Face name={active.name} tone="pine" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">{active.name}</p>
            <p className="flex items-center gap-2 text-xs text-slate">
              <ChannelTag ch="wa" />
              <span className="text-line-strong">·</span>
              <Masked tail="891" />
            </p>
          </div>
          <Pill tone="pine">يرد الذكاء · هند تراقب</Pill>
          <Button size="sm" icon={UserPlus}>
            إسناد
          </Button>
          <Button size="sm" variant="dark" icon={Check}>
            إغلاق
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-8 py-6">
          <p className="text-center">
            <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-slate ring-1 ring-line">
              اليوم
            </span>
          </p>
          <Msg from="them" time="13:58">
            السلام عليكم، الطلب وصل ولا باقي؟
          </Msg>
          <SystemNote icon={Package}>
            الذكاء راجع الطلب <Num className="font-bold text-pine-deep">#3812</Num> — خرج مع المندوب{" "}
            <Num>11:20</Num>
          </SystemNote>
          <Msg from="ai" time="13:58">
            وعليكم السلام أبو فهد، طلبك مع المندوب الحين ويوصلك قبل العصر بإذن الله.
          </Msg>
          <Msg from="them" time="14:00">
            تمام، وإذا تأخر؟
          </Msg>
          <Msg from="ai" time="14:01">
            إذا صار أي تأخير نكلمك قبل ما يفوت الموعد. أبشر.
          </Msg>
          <Msg from="them" time="14:02">
            والفاتورة تجي مع المندوب ولا على الواتساب؟
          </Msg>
          <p className="flex items-center gap-2 ps-1 text-xs text-slate">
            <span className="flex gap-0.5">
              <span className="size-1.5 rounded-full bg-pine/40" />
              <span className="size-1.5 rounded-full bg-pine/60" />
              <span className="size-1.5 rounded-full bg-pine" />
            </span>
            الذكاء يكتب ردًا…
          </p>
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-6 py-4">
          <div className="rounded-xl border border-line-strong bg-surface">
            <p className="px-4 pt-3 pb-6 text-[13px] text-slate/80">
              اكتب ردك، أو اعتمد اقتراح الذكاء…
            </p>
            <div className="flex items-center gap-1 border-t border-line px-2 py-2">
              <IconButton icon={Paperclip} label="إرفاق" className="border-0" />
              <IconButton icon={FileText} label="قالب" className="border-0" />
              <IconButton icon={Link2} label="رابط دفع" className="border-0" />
              <Button size="sm" variant="primary" icon={Send} className="ms-auto">
                أرسل
              </Button>
            </div>
          </div>
        </div>
      </section>

      <CustomerPanel />
    </div>
  );
}

function ThreadList() {
  return (
    <aside className="flex min-h-0 flex-col border-e border-line bg-surface">
      <div className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[17px] font-extrabold">الوارد</h1>
          <span className="text-xs text-slate">
            <Num>24</Num> مفتوحة
          </span>
        </div>
        <div className="mt-3 flex gap-1 rounded-xl bg-paper p-1">
          {[
            ["الكل", 24, true],
            ["يحتاجك", 7, false],
            ["الذكاء", 17, false],
          ].map(([l, n, on]) => (
            <span
              key={String(l)}
              className={cn(
                "inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold",
                on ? "bg-surface text-pine-deep shadow-sm ring-1 ring-line" : "text-slate",
              )}
            >
              {l}
              <Num className={cn("text-[11px]", on ? "text-lime-600" : "text-slate/70")}>{n}</Num>
            </span>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-hidden">
        {threads.map((t, i) => (
          <li
            key={t.name}
            className={cn(
              "relative flex gap-3 border-t border-line px-5 py-3.5",
              i === 0 && "bg-pine-50/70",
            )}
          >
            {i === 0 ? (
              <span className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-pine" />
            ) : null}
            <Face name={t.name} tone={i === 0 ? "pine" : "soft"} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn("truncate text-[13px]", t.unread ? "font-extrabold" : "font-bold")}
                >
                  {t.name}
                </p>
                <Num className="shrink-0 text-[11px] text-slate">{t.time}</Num>
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-xs",
                  t.unread ? "text-pine-deep" : "text-slate",
                )}
              >
                {t.preview}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <ChannelTag ch={t.ch} className="text-[11px]" />
                <span className="ms-auto flex items-center gap-1.5">
                  {t.state === "need" || t.state === "ai" ? <StatePill s={t.state} /> : null}
                  {t.unread ? (
                    <span className="grid size-5 place-items-center rounded-full bg-lime font-ui text-[10px] font-bold text-pine-deep">
                      {t.unread}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Msg({
  from,
  time,
  children,
}: {
  from: "them" | "ai" | "agent";
  time: string;
  children: ReactNode;
}) {
  const mine = from !== "them";
  return (
    <div className={cn("flex max-w-[72%] flex-col", mine ? "ms-auto items-end" : "items-start")}>
      <p
        className={cn(
          "rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
          mine ? "rounded-ee-md bg-pine text-snow" : "rounded-es-md bg-surface ring-1 ring-line",
        )}
      >
        {children}
      </p>
      <p className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-slate">
        {from === "ai" ? (
          <>
            <Sparkles className="size-3 text-lime-600" />
            الذكاء
            <span className="text-line-strong">·</span>
          </>
        ) : null}
        <Num>{time}</Num>
        {mine ? <CheckCheck className="size-3.5 text-pine-soft" /> : null}
      </p>
    </div>
  );
}

function SystemNote({ icon: Icon, children }: { icon: typeof Package; children: ReactNode }) {
  return (
    <p className="mx-auto flex w-fit items-center gap-2 rounded-full border border-dashed border-line-strong bg-surface/60 px-3.5 py-1.5 text-xs text-slate">
      <Icon className="size-3.5 text-pine" />
      {children}
    </p>
  );
}

function CustomerPanel() {
  return (
    <aside className="min-h-0 overflow-hidden border-s border-line bg-surface">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Face name="أبو فهد العنزي" tone="pine" className="size-11 text-base" />
          <div className="min-w-0">
            <p className="text-[15px] font-bold">أبو فهد العنزي</p>
            <p className="text-xs text-slate">عميل دائم · بريدة</p>
          </div>
          <IconButton icon={MoreHorizontal} label="المزيد" className="ms-auto" />
        </div>
        <div className="mt-4 grid grid-cols-3 rounded-xl border border-line">
          {[
            ["الطلبات", "14"],
            ["الإنفاق", "8,420"],
            ["منذ", "2024"],
          ].map(([k, v]) => (
            <div key={k} className="border-s border-line px-3 py-2.5 text-center first:border-s-0">
              <p className="font-ui text-[15px] font-bold tabular-nums">{v}</p>
              <p className="text-[11px] text-slate">{k}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-4 rounded-2xl border border-lime/50 bg-lime-50/70 p-4">
        <p className="flex items-center gap-2 text-[13px] font-bold">
          <Sparkles className="size-4 text-lime-600" />
          اقتراح الرد
          <span className="ms-auto text-[11px] font-semibold text-lime-600">من سياسة المحل</span>
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-pine-deep">
          الفاتورة الإلكترونية توصلك هنا على الواتساب أول ما يسلّمك المندوب، ونسخة ورقية مع الطلب.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="primary" icon={Send} className="flex-1">
            اعتمد وأرسل
          </Button>
          <Button size="sm">عدّل</Button>
        </div>
      </div>

      <div className="px-5 pt-5">
        <p className="text-xs font-semibold text-slate">الطلب الحالي</p>
        <div className="mt-2 rounded-xl border border-line p-3.5">
          <div className="flex items-baseline justify-between">
            <Num className="text-[13px] font-bold">#3812</Num>
            <Money value={1250} className="text-[13px] font-bold" />
          </div>
          <p className="mt-1 text-xs text-slate">خولاني 1 كجم × 2 · هيل · فلتر ورقي</p>
          <ol className="mt-3 grid grid-cols-4 gap-1">
            {["تأكيد", "تجهيز", "مع المندوب", "تسليم"].map((s, i) => (
              <li key={s}>
                <span className={cn("block h-1 rounded-full", i < 3 ? "bg-pine" : "bg-pine-100")} />
                <span
                  className={cn(
                    "mt-1.5 block text-[10.5px]",
                    i === 2 ? "font-bold text-pine-deep" : "text-slate",
                  )}
                >
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="px-5 pt-5">
        <p className="text-xs font-semibold text-slate">السجل</p>
        <ol className="relative mt-3 space-y-3 border-s border-line ps-4">
          {[
            ["14:01", "الذكاء أكّد موعد التسليم"],
            ["أمس", "فاتورة 3790 سُدّدت عبر مدى"],
            ["الأحد", "طلب جملة: 3 أكياس خولاني"],
          ].map(([t, e]) => (
            <li key={e} className="relative text-xs">
              <span className="absolute -start-[21px] top-1 size-2 rounded-full bg-pine-100 ring-2 ring-surface" />
              <span className="text-pine-deep">{e}</span>
              <span className="ms-2 text-slate">{/\d/.test(t) ? <Num>{t}</Num> : t}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

/* ───────────────────────── Call center ───────────────────────── */

function Calls() {
  const queue = [
    { name: "نورة السبيعي", wait: "0:41", reason: "موعد استلام بعد العشاء", on: true },
    { name: "روابي للتجارة", wait: "1:12", reason: "بند الغرامة في العقد" },
    { name: "أم ريان", wait: "0:18", reason: "تتبع المندوب" },
    { name: "خالد القصّاب", wait: "0:09", reason: "عرض جملة" },
  ];
  const transcript: [string, string, boolean][] = [
    ["0:04", "هلا والله، محامص الريم معك. كيف أقدر أخدمك؟", true],
    ["0:11", "هلا، أبغى أستلم طلبي من الفرع بعد العشاء إذا ممكن.", false],
    ["0:19", "أكيد. طلبك رقم 3807 جاهز، والثلاثاء الساعة 9 مساءً متاح. يناسبك؟", true],
    ["0:31", "يناسبني. بس أبغى أكلم أحد بخصوص الخصم على الجملة.", false],
    ["0:38", "أبشري، أحولك الحين على سلطان وأثبّت لك الموعد مبدئيًا.", true],
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_320px]">
      <aside className="flex min-h-0 flex-col border-e border-line bg-surface">
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-[17px] font-extrabold">الكول سنتر</h1>
          <p className="mt-0.5 text-xs text-slate">
            <Num>4</Num> في الانتظار · متوسط <Num>0:35</Num>
          </p>
        </div>
        <ul>
          {queue.map((q) => (
            <li
              key={q.name}
              className={cn(
                "relative flex items-center gap-3 border-t border-line px-5 py-3.5",
                q.on && "bg-pine-50/70",
              )}
            >
              {q.on ? (
                <span className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-pine" />
              ) : null}
              <Face name={q.name} tone={q.on ? "pine" : "soft"} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">{q.name}</p>
                <p className="truncate text-xs text-slate">{q.reason}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-slate">
                <Clock className="size-3.5" />
                <Num>{q.wait}</Num>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line px-5 pt-4 text-xs font-semibold text-slate">
          الوكلاء
        </p>
        {[
          ["سلطان الحربي", "في مكالمة", "neutral"],
          ["هند العلي", "متاحة", "lime"],
          ["ماجد الشمري", "استراحة", "neutral"],
        ].map(([n, s, t]) => (
          <div key={n} className="flex items-center gap-3 px-5 py-2.5">
            <Face name={n} className="size-7 text-[11px]" />
            <span className="flex-1 text-[13px] font-semibold">{n}</span>
            <Pill tone={t as Tone}>{s}</Pill>
          </div>
        ))}
      </aside>

      <section className="flex min-h-0 flex-col bg-paper px-8 py-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Face name="نورة السبيعي" tone="pine" className="size-14 text-xl" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-lime-600">مكالمة جارية · الذكاء يستمع</p>
              <p className="mt-0.5 text-[20px] font-extrabold">نورة السبيعي</p>
              <Masked tail="418" className="text-[13px] text-slate" />
            </div>
            <div className="text-end">
              <Num className="block text-[34px] leading-none font-bold tracking-tight">4:12</Num>
              <span className="mt-1.5 block text-xs text-slate">مدة المكالمة</span>
            </div>
          </div>
          <div className="mt-6 flex h-12 items-center gap-[3px]" aria-hidden="true">
            {Array.from(
              { length: 72 },
              (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 0.7) * 18 + Math.cos(i * 0.31) * 12)),
            ).map((h, i) => (
              <span
                key={i}
                className={cn("flex-1 rounded-full", i < 50 ? "bg-pine" : "bg-pine-100")}
                style={{ height: h }}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            {[
              [MicOff, "كتم"],
              [Pause, "انتظار"],
              [PhoneForwarded, "تحويل"],
            ].map(([Icon, l]) => {
              const I = Icon as typeof MicOff;
              return (
                <span
                  key={String(l)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[13px] font-semibold"
                >
                  <I className="size-4 text-slate" />
                  {String(l)}
                </span>
              );
            })}
            <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-pine-deep px-5 text-[13px] font-semibold text-snow">
              <PhoneOff className="size-4" />
              إنهاء
            </span>
          </div>
        </Card>

        <Card className="mt-5 min-h-0 flex-1 overflow-hidden">
          <CardHeader
            title="التفريغ المباشر"
            description="يُحفظ في ملف العميلة تلقائيًا"
            actions={
              <div className="flex gap-1.5">
                <Pill tone="pine" dot={false}>
                  موعد استلام
                </Pill>
                <Pill tone="lime" dot={false}>
                  طلب خصم
                </Pill>
              </div>
            }
          />
          <ul className="space-y-3 px-6 pt-4 pb-6">
            {transcript.map(([t, line, ai]) => (
              <li key={t} className="flex gap-3 text-[13px]">
                <Num className="w-10 shrink-0 pt-0.5 text-[11px] text-slate">{t}</Num>
                <span
                  className={cn("w-14 shrink-0 font-bold", ai ? "text-lime-600" : "text-pine-deep")}
                >
                  {ai ? "الذكاء" : "نورة"}
                </span>
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <aside className="min-h-0 overflow-hidden border-s border-line bg-surface px-5 py-5">
        <p className="text-xs font-semibold text-slate">ملف المتصلة</p>
        <p className="mt-2 text-[15px] font-bold">نورة السبيعي</p>
        <p className="text-xs text-slate">عميلة منذ 2025 · استلام من الفرع</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="lime">يحتاجك</Pill>
          <Pill tone="neutral" dot={false}>
            طلب خصم
          </Pill>
        </div>
        <div className="mt-5 rounded-2xl border border-lime/50 bg-lime-50/70 p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <Sparkles className="size-4 text-lime-600" />
            سبب التحويل
          </p>
          <p className="mt-2 text-[13px] leading-relaxed">
            طلبت خصمًا خارج صلاحية الذكاء. الموعد محجوز مبدئيًا: الثلاثاء <Num>9:00</Num> مساءً.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" className="flex-1">
              اعتمد الموعد
            </Button>
            <Button size="sm">غيّر الوقت</Button>
          </div>
        </div>
        <p className="mt-6 text-xs font-semibold text-slate">مسار المكالمة</p>
        <ol className="relative mt-3 space-y-3 border-s border-line ps-4 text-xs">
          {[
            ["12:00", "الذكاء ردّ ورحّب"],
            ["12:03", "اقترح موعدًا من الجدول"],
            ["12:06", "حُوّلت إلى سلطان"],
          ].map(([t, e]) => (
            <li key={t} className="relative">
              <span className="absolute -start-[21px] top-1 size-2 rounded-full bg-pine ring-2 ring-surface" />
              {e} <Num className="ms-1 text-slate">{t}</Num>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

/* ───────────────────────── AI runs the line ───────────────────────── */

const resolution = [
  { d: "10", v: 78 },
  { d: "11", v: 80 },
  { d: "12", v: 79 },
  { d: "13", v: 83 },
  { d: "14", v: 84 },
  { d: "15", v: 82 },
  { d: "16", v: 86 },
  { d: "17", v: 87 },
  { d: "18", v: 86 },
  { d: "19", v: 89 },
  { d: "20", v: 88 },
  { d: "21", v: 90 },
  { d: "22", v: 89 },
  { d: "23", v: 91 },
];

const decisions: [string, string, Channel, string, "done" | "handoff" | "draft", number, string][] =
  [
    ["14:02", "أبو فهد العنزي", "wa", "تأكيد موعد التسليم", "done", 97, "4 ث"],
    ["14:00", "نورة السبيعي", "call", "طلب خصم", "handoff", 62, "11 ث"],
    ["13:51", "أم ريان", "wa", "تتبع المندوب", "done", 98, "3 ث"],
    ["13:40", "مؤسسة النور", "wa", "تأكيد حوالة", "done", 94, "5 ث"],
    ["13:22", "فهد العتيبي", "wa", "شكوى درجة التحميص", "handoff", 71, "9 ث"],
    ["13:18", "خالد القصّاب", "wa", "عرض سعر جملة", "draft", 83, "7 ث"],
    ["12:55", "مكتب السالم", "wa", "عرض سعر", "done", 92, "5 ث"],
  ];

const decisionPill: Record<"done" | "handoff" | "draft", [string, Tone]> = {
  done: ["أنهاها", "pine"],
  handoff: ["حوّلها لك", "lime"],
  draft: ["مسودة للاعتماد", "neutral"],
};

function AiRun() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="ردود أنهاها وحده"
          value="84"
          delta="12%"
          foot="دون أي وكيل"
          spark={[61, 66, 70, 68, 75, 79, 84]}
        />
        <Stat
          label="مكالمات أغلقها"
          value="31"
          delta="9%"
          foot="من 38 مكالمة"
          spark={[22, 24, 23, 27, 26, 29, 31]}
        />
        <Stat
          label="حوّلها لفريقك"
          value="7"
          foot="شكوى، خصم، أو مبلغ عالٍ"
          side={
            <span className="flex -space-x-2 space-x-reverse">
              {["هند", "سلطان", "ماجد"].map((n) => (
                <Face key={n} name={n} className="size-7 text-[11px] ring-2 ring-surface" />
              ))}
            </span>
          }
        />
        <Stat
          label="رضا العملاء"
          value="4.8"
          delta="0.2"
          foot="من 5 · 96 تقييمًا"
          spark={[4.5, 4.6, 4.6, 4.7, 4.7, 4.8, 4.8]}
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-8">
          <CardHeader
            title="نسبة الحل دون تدخّل"
            description="10 إلى 23 سبتمبر · الهدف 85%"
            actions={<Pill tone="lime">91% اليوم</Pill>}
          />
          <div className="h-[236px] px-3 pt-3 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resolution} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="res-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.pine} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={chart.pine} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis
                  dataKey="d"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Manrope" }}
                  dy={6}
                />
                <YAxis
                  orientation="right"
                  domain={[70, 100]}
                  ticks={[70, 80, 90, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Manrope" }}
                />
                <ReferenceLine
                  y={85}
                  stroke={chart.limeDeep}
                  strokeWidth={1}
                  label={{
                    value: "الهدف",
                    position: "insideTopLeft",
                    fill: chart.axis,
                    fontSize: 11,
                    fontFamily: "Cairo",
                  }}
                />
                <Tooltip content={<ChartTip unit="%" names={{ v: "حُلّت دون تدخّل" }} />} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={chart.pine}
                  strokeWidth={2}
                  fill="url(#res-fill)"
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="col-span-4">
          <CardHeader title="حدود الذكاء" description="ما يقفله وحده، وما يحوّله لك" />
          <div className="mt-3 px-5 pb-5">
            <p className="text-[11px] font-semibold text-slate">يقفله وحده</p>
            {["تتبع الطلب والمندوب", "مواعيد ضمن الجدول", "فاتورة أو رابط دفع"].map((r) => (
              <Rule key={r} on>
                {r}
              </Rule>
            ))}
            <p className="mt-3 text-[11px] font-semibold text-slate">يحوّله لك</p>
            {["شكوى أو منتج مختلف", "خصم أو مبلغ فوق 500 ر.س"].map((r) => (
              <Rule key={r} on>
                {r}
              </Rule>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="سجل القرارات"
          description="كل محادثة: ماذا فهم الذكاء، وماذا فعل"
          actions={
            <Button size="sm" variant="ghost">
              السجل كاملًا
            </Button>
          }
        />
        <table className="mt-4 w-full">
          <TableHead
            cols={["الوقت", "العميل", "القناة", "ما طلبه العميل", "القرار", "الثقة", "زمن الرد"]}
          />
          <tbody className="divide-y divide-line">
            {decisions.map(([t, n, ch, intent, d, conf, speed]) => (
              <tr key={t}>
                <td className={cn(td, "text-slate")}>
                  <Num>{t}</Num>
                </td>
                <td className={cn(td, "font-bold")}>{n}</td>
                <td className={td}>
                  <ChannelTag ch={ch} />
                </td>
                <td className={td}>{intent}</td>
                <td className={td}>
                  <Pill tone={decisionPill[d][1]}>{decisionPill[d][0]}</Pill>
                </td>
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <Meter value={conf} tone={conf > 80 ? "pine" : "lime"} className="w-20" />
                    <Num className="text-xs text-slate">{conf}%</Num>
                  </span>
                </td>
                <td className={cn(td, "text-slate")}>
                  <Num>{speed.replace(" ث", "")}</Num> ث
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Rule({ on = false, children }: { on?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
      <span className="text-[13px]">{children}</span>
      <span
        className={cn(
          "flex h-5 w-9 items-center rounded-full p-0.5",
          on ? "justify-end bg-pine" : "justify-start bg-line-strong",
        )}
      >
        <span className="size-4 rounded-full bg-surface shadow-sm" />
      </span>
    </div>
  );
}
