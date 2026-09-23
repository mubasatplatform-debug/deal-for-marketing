import type { ReactNode } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  FileSignature,
  FileText,
  FolderOpen,
  Gavel,
  Lock,
  MapPin,
  Mic,
  MonitorUp,
  PhoneOff,
  Plus,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  VideoIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DeskFrame, LiveChip } from "@/components/desk-frame";
import { LAW_PRODUCT, lawNav, type LawView } from "@/components/desks/navs";
import { Button, Card, CardHeader, Num, Pill, type Tone } from "@/components/dash/ui";
import { ChartTip, Face, Meter, Money, Stat, TableHead, td } from "@/components/desks/kit";
import { chart } from "@/components/desks/tokens";
import { cn } from "@/lib/utils";

const pages: Record<
  LawView,
  { title?: ReactNode; subtitle?: string; bare?: boolean; path: string }
> = {
  home: {
    title: "صباح الخير، أبو فيصل",
    subtitle: "الأربعاء 23 سبتمبر 2026 · 11 ربيع الآخر 1448 هـ",
    path: "law",
  },
  book: {
    title: "المواعيد",
    subtitle: "الأسبوع من 20 إلى 24 سبتمبر · 14 موعدًا",
    path: "law/calendar",
  },
  crm: { bare: true, path: "law/clients" },
  cases: {
    title: "القضايا وناجز",
    subtitle: "الذكاء يرتّب اللائحة، أنت تعتمد، ثم تُرفع إلى ناجز",
    path: "law/cases",
  },
  docs: {
    title: "عقد توريد — مؤسسة النور",
    subtitle: "مسودة الذكاء · بانتظار اعتماد المحامي · النسخة 3",
    path: "law/contracts/1447-21",
  },
  video: { bare: true, path: "law/session" },
  staff: { title: "الفريق", subtitle: "6 أعضاء · الصلاحيات والمهام اليوم", path: "law/team" },
};

export type { LawView };

export function LawDesk({ view }: { view: LawView }) {
  const screens: Record<LawView, ReactNode> = {
    home: <HomeView />,
    book: <BookView />,
    crm: <ClientView />,
    staff: <StaffView />,
    docs: <DocsView />,
    cases: <CasesView />,
    video: <VideoView />,
  };
  const actions: Partial<Record<LawView, ReactNode>> = {
    home: (
      <>
        <Button size="sm" icon={CalendarPlus}>
          موعد جديد
        </Button>
        <Button size="sm" variant="primary" icon={Plus}>
          قضية جديدة
        </Button>
      </>
    ),
    book: (
      <Button size="sm" variant="primary" icon={CalendarPlus}>
        موعد جديد
      </Button>
    ),
    cases: (
      <Button size="sm" variant="primary" icon={Plus}>
        قضية جديدة
      </Button>
    ),
    docs: (
      <>
        <Button size="sm">أعد الصياغة</Button>
        <Button size="sm" variant="primary" icon={Check}>
          اعتماد الصياغة
        </Button>
      </>
    ),
    staff: (
      <Button size="sm" variant="primary" icon={Plus}>
        دعوة عضو
      </Button>
    ),
  };
  const p = pages[view];
  return (
    <DeskFrame
      product={LAW_PRODUCT}
      workspace="مكتب واصل للمحاماة"
      workspaceMark={<Scale className="size-4" />}
      workspaceMeta="بريدة · 6 أعضاء"
      path={p.path}
      route="/desk/law/$view"
      view={view}
      nav={lawNav}
      user={{ name: "أبو فيصل", role: "الشريك المؤسس" }}
      searchHint="ابحث برقم قضية، اسم موكل، أو عقد"
      status={<LiveChip>ناجز متصل</LiveChip>}
      title={p.title}
      subtitle={p.subtitle}
      actions={actions[view]}
      bare={p.bare}
    >
      {screens[view]}
    </DeskFrame>
  );
}

type Status = "session" | "approve" | "prep" | "draft" | "filed" | "numbered";
const statusPill: Record<Status, [string, Tone]> = {
  session: ["في الجلسة", "pine"],
  approve: ["بانتظار اعتمادك", "lime"],
  prep: ["قيد الإعداد", "neutral"],
  draft: ["مسودة", "neutral"],
  filed: ["رُفعت إلى ناجز", "pine"],
  numbered: ["لها رقم قيد", "pine"],
};

const cases: {
  no: string;
  client: string;
  kind: string;
  court: string;
  next: string;
  owner: string;
  s: Status;
}[] = [
  {
    no: "1447/12",
    client: "مؤسسة النور",
    kind: "تجاري",
    court: "المحكمة التجارية ببريدة",
    next: "اليوم · 8:00 ص",
    owner: "سلطان الحربي",
    s: "session",
  },
  {
    no: "1447/09",
    client: "نورة السبيعي",
    kind: "عمالي",
    court: "المحكمة العمالية ببريدة",
    next: "28 سبتمبر",
    owner: "أبو فيصل",
    s: "approve",
  },
  {
    no: "1446/18",
    client: "أبو فهد العنزي",
    kind: "إيجار",
    court: "مركز التسوية",
    next: "1 أكتوبر",
    owner: "هند العلي",
    s: "prep",
  },
  {
    no: "1446/44",
    client: "خالد القصّاب",
    kind: "تنفيذ",
    court: "محكمة التنفيذ ببريدة",
    next: "5 أكتوبر",
    owner: "ماجد الشمري",
    s: "filed",
  },
  {
    no: "1447/21",
    client: "روابي للتجارة",
    kind: "عقد توريد",
    court: "—",
    next: "—",
    owner: "سلطان الحربي",
    s: "draft",
  },
];

/* ───────────────────────── Home ───────────────────────── */

const fees = [
  { m: "أبريل", v: 58200 },
  { m: "مايو", v: 64800 },
  { m: "يونيو", v: 61300 },
  { m: "يوليو", v: 70400 },
  { m: "أغسطس", v: 75900 },
  { m: "سبتمبر", v: 86500 },
];

function HomeView() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
        <Stat label="قضايا مفتوحة" value="24" delta="3 جديدة" foot="11 تجاري · 8 إيجار · 5 عمالي" />
        <Stat
          label="جلسات هذا الأسبوع"
          value="6"
          foot="أقربها اليوم 8:00 ص"
          side={<Gavel className="size-6 text-pine-100" />}
        />
        <Stat
          label="بانتظار اعتمادك"
          value="4"
          foot="لائحة، عقد، مذكرة وتوكيل"
          side={
            <span className="flex -space-x-2 space-x-reverse">
              {["نورة", "روابي", "أبو فهد"].map((n) => (
                <Face key={n} name={n} className="size-7 text-[11px] ring-2 ring-surface" />
              ))}
            </span>
          }
        />
        <Stat
          label="أتعاب سبتمبر"
          value={<Money value={86500} unitClass="text-[13px]" />}
          delta="14%"
          foot="عن أغسطس"
          spark={fees.map((f) => f.v)}
        />
      </div>

      <div className="grid grid-cols-12 gap-5 max-lg:grid-cols-1 max-sm:gap-4">
        <Card className="col-span-7 max-lg:col-span-full">
          <CardHeader
            title="جدول اليوم"
            description="4 مواعيد · جلسة واحدة في المحكمة"
            actions={
              <Button size="sm" variant="ghost">
                التقويم
              </Button>
            }
          />
          <ol className="mt-4 px-5 pb-4">
            {[
              {
                t: "8:00",
                p: "ص",
                title: "جلسة — مؤسسة النور ضد شركة الوادي",
                meta: "المحكمة التجارية ببريدة · الدائرة الثالثة",
                who: "سلطان الحربي",
                tone: "pine",
                tag: "جلسة",
                icon: MapPin,
                done: true,
              },
              {
                t: "10:30",
                p: "ص",
                title: "استشارة — أبو فهد العنزي",
                meta: "عقد إيجار تجاري · في المكتب",
                who: "أبو فيصل",
                tone: "soft",
                tag: "استشارة",
                icon: MapPin,
                now: true,
              },
              {
                t: "12:00",
                p: "م",
                title: "مراجعة لائحة — نورة السبيعي",
                meta: "قضية عمالية 1447/09 · قبل الرفع إلى ناجز",
                who: "أبو فيصل",
                tone: "lime",
                tag: "اعتماد",
                icon: FileSignature,
              },
              {
                t: "5:00",
                p: "م",
                title: "جلسة فيديو — روابي للتجارة",
                meta: "مراجعة عقد التوريد · داخل المنصة",
                who: "سلطان الحربي",
                tone: "soft",
                tag: "فيديو",
                icon: VideoIcon,
              },
            ].map((e) => (
              <li
                key={e.t}
                className={cn(
                  "relative flex items-center gap-4 rounded-xl px-3 py-3 max-sm:gap-3 max-sm:px-2",
                  e.now && "bg-pine-50/70",
                )}
              >
                <div className="w-14 shrink-0 text-center max-sm:w-11">
                  <Num className={cn("block text-[15px] font-bold", e.done && "text-slate")}>
                    {e.t}
                  </Num>
                  <span className="text-[11px] text-slate">{e.p === "ص" ? "صباحًا" : "مساءً"}</span>
                </div>
                <span
                  className={cn(
                    "h-10 w-[3px] shrink-0 rounded-full",
                    e.tone === "pine" ? "bg-pine" : e.tone === "lime" ? "bg-lime" : "bg-pine-100",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[13.5px] font-bold",
                      e.done && "text-slate line-through decoration-line-strong",
                    )}
                  >
                    {e.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate">
                    <e.icon className="size-3.5 shrink-0" />
                    {e.meta}
                  </p>
                </div>
                {e.now ? <Pill tone="pine">الآن</Pill> : null}
                <span className="flex items-center gap-2 text-xs text-slate">
                  <Face name={e.who} className="size-7 text-[11px]" />
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="col-span-5 max-lg:col-span-full">
          <CardHeader
            title="بانتظار اعتمادك"
            description="جهّزها الفريق والذكاء، والقرار لك"
            actions={
              <Pill tone="lime" dot={false}>
                4 عناصر
              </Pill>
            }
          />
          <ul className="mt-4 space-y-2.5 px-5 pb-5">
            {[
              {
                title: "لائحة دعوى عمالية",
                who: "نورة السبيعي · 1447/09",
                note: "جاهزة للرفع إلى ناجز",
                icon: Scale,
              },
              {
                title: "عقد توريد — مسودة 3",
                who: "روابي للتجارة · 1447/21",
                note: "بند الغرامة يحتاج رأيك",
                icon: FileText,
                flag: true,
              },
              {
                title: "مذكرة رد",
                who: "أبو فهد العنزي · 1446/18",
                note: "أعدّتها هند العلي",
                icon: FileSignature,
              },
              {
                title: "توكيل عام",
                who: "مكتب السالم · 1447/03",
                note: "جاهز للتوقيع",
                icon: ShieldCheck,
              },
            ].map((a) => (
              <li
                key={a.title}
                className="flex items-center gap-3 rounded-xl border border-line p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine">
                  <a.icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{a.title}</p>
                  <p className="truncate text-xs text-slate">
                    {a.who} ·{" "}
                    <span className={a.flag ? "font-semibold text-lime-600" : ""}>{a.note}</span>
                  </p>
                </div>
                <Button size="sm" variant={a.flag ? "secondary" : "dark"}>
                  {a.flag ? "راجع" : "اعتماد"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-5 max-lg:grid-cols-1 max-sm:gap-4">
        <Card className="col-span-8 max-lg:col-span-full">
          <CardHeader
            title="القضايا النشطة"
            description="مرتبة حسب أقرب جلسة"
            actions={
              <Button size="sm" variant="ghost">
                كل القضايا
              </Button>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <TableHead
                cols={["رقم القضية", "الموكل", "النوع", "الجلسة القادمة", "المسؤول", "الحالة"]}
              />
              <tbody className="divide-y divide-line">
                {cases.map((c) => (
                  <tr key={c.no}>
                    <td className={td}>
                      <Num className="font-bold">{c.no}</Num>
                    </td>
                    <td className={cn(td, "font-bold")}>{c.client}</td>
                    <td className={cn(td, "text-slate")}>{c.kind}</td>
                    <td className={td}>{c.next}</td>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <Face name={c.owner} className="size-6 text-[10px]" />
                        {c.owner}
                      </span>
                    </td>
                    <td className={td}>
                      <Pill tone={statusPill[c.s][1]}>{statusPill[c.s][0]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="col-span-4 max-lg:col-span-full">
          <CardHeader title="الأتعاب المحصّلة" description="آخر 6 أشهر · ر.س" />
          <div className="h-[230px] px-3 pt-4 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fees} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis
                  dataKey="m"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Cairo" }}
                  dy={6}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  tickFormatter={(v: number) => (v ? `${v / 1000}k` : "0")}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Manrope" }}
                />
                <Tooltip
                  cursor={{ fill: "#eaf0ef80" }}
                  content={<ChartTip unit="ر.س" names={{ v: "الأتعاب" }} />}
                />
                <Bar dataKey="v" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {fees.map((f, i) => (
                    <Cell key={f.m} fill={i === fees.length - 1 ? chart.lime : chart.pine} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── Calendar ───────────────────────── */

const days = [
  ["الأحد", "20"],
  ["الإثنين", "21"],
  ["الثلاثاء", "22"],
  ["الأربعاء", "23"],
  ["الخميس", "24"],
] as const;
const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const HOUR = 52;

const events: {
  d: number;
  start: number;
  len: number;
  title: string;
  meta: string;
  tone: "pine" | "soft" | "lime" | "ghost";
}[] = [
  { d: 0, start: 9, len: 1, title: "استشارة — مكتب السالم", meta: "توكيل عام", tone: "soft" },
  { d: 0, start: 13, len: 1.5, title: "إعداد لائحة 1447/09", meta: "هند العلي", tone: "soft" },
  { d: 1, start: 8, len: 2, title: "جلسة — القصّاب", meta: "محكمة التنفيذ", tone: "pine" },
  { d: 1, start: 14, len: 1, title: "مكالمة موكل", meta: "روابي للتجارة", tone: "soft" },
  { d: 2, start: 10, len: 1, title: "اجتماع الفريق", meta: "المكتب", tone: "soft" },
  {
    d: 2,
    start: 16,
    len: 1,
    title: "نورة السبيعي — مقترح",
    meta: "بانتظار تأكيدها",
    tone: "ghost",
  },
  { d: 3, start: 8, len: 2, title: "جلسة — مؤسسة النور", meta: "التجارية ببريدة", tone: "pine" },
  { d: 3, start: 10.5, len: 1, title: "استشارة — أبو فهد", meta: "عقد إيجار", tone: "soft" },
  { d: 3, start: 12, len: 1, title: "مراجعة لائحة", meta: "نورة السبيعي", tone: "lime" },
  { d: 3, start: 17, len: 1, title: "فيديو — روابي", meta: "داخل المنصة", tone: "soft" },
  { d: 4, start: 9, len: 1.5, title: "جلسة صلح", meta: "مركز التسوية", tone: "pine" },
  { d: 4, start: 13, len: 1, title: "توقيع توكيل", meta: "مكتب السالم", tone: "soft" },
];

function BookView() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5 max-lg:grid-cols-1 max-sm:gap-4">
      <Agenda />
      <Card className="overflow-hidden max-sm:hidden">
        <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] border-b border-line">
          <span />
          {days.map(([d, n], i) => (
            <div key={d} className="border-s border-line px-3 py-3 text-center">
              <p className={cn("text-xs", i === 3 ? "font-bold text-pine" : "text-slate")}>{d}</p>
              <p
                className={cn(
                  "mx-auto mt-1 grid size-8 place-items-center rounded-full font-ui text-[15px] font-bold",
                  i === 3 ? "bg-pine text-snow" : "",
                )}
              >
                {n}
              </p>
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[64px_repeat(5,minmax(0,1fr))]">
          <div>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR }}
                className="pe-2 pt-1 text-end font-ui text-[11px] text-slate"
              >
                {h > 12 ? h - 12 : h}:00
              </div>
            ))}
          </div>
          {days.map(([d], di) => (
            <div
              key={d}
              className={cn("relative border-s border-line", di === 3 && "bg-pine-50/40")}
            >
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR }} className="border-b border-line/70" />
              ))}
              {events
                .filter((e) => e.d === di)
                .map((e) => (
                  <div
                    key={e.title}
                    className={cn(
                      "absolute inset-x-1.5 overflow-hidden rounded-lg px-2.5 py-1.5",
                      e.tone === "pine" && "bg-pine text-snow",
                      e.tone === "soft" && "border-s-[3px] border-pine bg-pine-50 text-pine-deep",
                      e.tone === "lime" &&
                        "border-s-[3px] border-lime-600 bg-lime-50 text-pine-deep",
                      e.tone === "ghost" &&
                        "border border-dashed border-lime-600 bg-surface text-pine-deep",
                    )}
                    style={{ top: (e.start - 8) * HOUR + 2, height: e.len * HOUR - 4 }}
                  >
                    <p className="truncate text-[12px] leading-tight font-bold">{e.title}</p>
                    <p
                      className={cn(
                        "truncate text-[11px]",
                        e.tone === "pine" ? "text-snow/70" : "text-slate",
                      )}
                    >
                      {e.meta}
                    </p>
                  </div>
                ))}
            </div>
          ))}
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{ top: (11.4 - 8) * HOUR }}
          >
            <div className="ms-[64px] flex items-center">
              <span className="size-2 rounded-full bg-lime-600" />
              <span className="h-px flex-1 bg-lime-600" />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 max-lg:grid max-lg:grid-cols-2 max-lg:gap-4 max-lg:space-y-0 max-sm:grid-cols-1">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <Sparkles className="size-4 text-lime-600" />
            اقتراح النظام
          </p>
          <p className="mt-3 text-[17px] font-extrabold">
            الثلاثاء 22 · <Num>4:00</Num> م
          </p>
          <p className="mt-1 text-xs text-slate">30 دقيقة · نورة السبيعي</p>
          <p className="mt-3 text-[13px] leading-relaxed text-pine-deep">
            طلبت موعدًا بعد الدوام. لا يتعارض مع جلسة الأربعاء ولا مع توكيل السالم.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="primary" className="flex-1">
              اعتماد وإرسال
            </Button>
            <Button size="sm">وقت آخر</Button>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-bold">طلبات الحجز</p>
          <ul className="mt-3 divide-y divide-line">
            {[
              ["نورة السبيعي", "استشارة عمالية", "واتساب"],
              ["عبدالله المطيري", "صياغة عقد شراكة", "الموقع"],
            ].map(([n, r, src]) => (
              <li key={n} className="flex items-center gap-3 py-3">
                <Face name={n} className="size-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">{n}</p>
                  <p className="text-xs text-slate">{r}</p>
                </div>
                <Pill tone="neutral" dot={false}>
                  {src}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/** Phones: the week grid reads as a day-by-day agenda of the same events. */
function Agenda() {
  const clock = (t: number) => {
    const h = Math.floor(t);
    const m = Math.round((t - h) * 60);
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}`;
  };
  return (
    <Card className="overflow-hidden sm:hidden">
      {days.map(([d, n], di) => (
        <section key={d} className="border-t border-line first:border-t-0">
          <p
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold",
              di === 3 ? "bg-pine-50/60 text-pine" : "bg-paper/60 text-slate",
            )}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full font-ui text-[13px]",
                di === 3 ? "bg-pine text-snow" : "bg-surface text-pine-deep ring-1 ring-line",
              )}
            >
              {n}
            </span>
            {d}
            {di === 3 ? <span className="ms-auto text-[11px] font-semibold">اليوم</span> : null}
          </p>
          <ul className="divide-y divide-line/70">
            {events
              .filter((e) => e.d === di)
              .sort((x, y) => x.start - y.start)
              .map((e) => (
                <li key={e.title} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-11 shrink-0 text-center">
                    <Num className="block text-[13px] font-bold">{clock(e.start)}</Num>
                    <span className="text-[10.5px] text-slate">
                      {e.start < 12 ? "صباحًا" : "مساءً"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "h-9 w-[3px] shrink-0 rounded-full",
                      e.tone === "pine" && "bg-pine",
                      e.tone === "soft" && "bg-pine-100",
                      e.tone === "lime" && "bg-lime",
                      e.tone === "ghost" && "border-s-[3px] border-dashed border-lime-600",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{e.title}</p>
                    <p className="truncate text-xs text-slate">{e.meta}</p>
                  </div>
                  {e.tone === "ghost" ? (
                    <Pill tone="lime" dot={false}>
                      مقترح
                    </Pill>
                  ) : e.tone === "pine" ? (
                    <Pill tone="pine" dot={false}>
                      جلسة
                    </Pill>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </Card>
  );
}

/* ───────────────────────── Client file ───────────────────────── */

function ClientView() {
  const files = [
    ["مؤسسة النور", "تجاري · 1447/12", true],
    ["نورة السبيعي", "عمالي · 1447/09", false],
    ["أبو فهد العنزي", "إيجار · 1446/18", false],
    ["روابي للتجارة", "عقد توريد · 1447/21", false],
    ["خالد القصّاب", "تنفيذ · 1446/44", false],
    ["مكتب السالم", "أحوال · 1447/03", false],
  ] as const;
  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_310px] max-lg:h-auto max-lg:grid-cols-[260px_minmax(0,1fr)] max-md:flex max-md:flex-col">
      <aside className="border-e border-line bg-surface max-md:order-last max-md:border-e-0 max-md:border-t max-md:pb-3">
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-[17px] font-extrabold">ملفات العملاء</h1>
          <p className="text-xs text-slate">
            <Num>38</Num> موكلًا · <Num>24</Num> قضية مفتوحة
          </p>
        </div>
        <ul>
          {files.map(([n, k, on]) => (
            <li
              key={n}
              className={cn(
                "relative flex items-center gap-3 border-t border-line px-5 py-3.5",
                on && "bg-pine-50/70",
              )}
            >
              {on ? (
                <span className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-pine" />
              ) : null}
              <Face name={n} tone={on ? "pine" : "soft"} />
              <div>
                <p className="text-[13px] font-bold">{n}</p>
                <p className="text-xs text-slate">
                  {k.replace(/\d+\/\d+/, "")}
                  <Num>{k.match(/\d+\/\d+/)?.[0]}</Num>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-0 flex-col bg-paper">
        <header className="shrink-0 border-b border-line bg-surface px-6 pt-4 max-sm:px-4">
          <div className="flex items-center gap-3">
            <Face name="مؤسسة النور" tone="pine" className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold">مؤسسة النور التجارية</p>
              <p className="text-xs text-slate">
                موكل منذ 2023 · <Num>1447/12</Num> · المسؤول سلطان الحربي
              </p>
            </div>
            <Pill tone="pine">جلسة اليوم</Pill>
          </div>
          <div className="mt-4 flex gap-6 text-[13px] max-sm:-mx-4 max-sm:gap-5 max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none]">
            {["المحادثات", "القضايا", "العقود", "المواعيد", "المستندات"].map((t, i) => (
              <span
                key={t}
                className={cn(
                  "shrink-0 border-b-2 pb-2.5 font-semibold whitespace-nowrap",
                  i === 0 ? "border-pine text-pine-deep" : "border-transparent text-slate",
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-8 py-6 max-sm:px-4 max-sm:py-5">
          <Bubble time="7:12">السلام عليكم، جلسة اليوم باقية على موعدها؟</Bubble>
          <Bubble mine time="7:14">
            وعليكم السلام. باقية الساعة الثامنة، والملف مكتمل. سلطان يحضر عنكم.
          </Bubble>
          <Bubble time="7:15">الله يعطيكم العافية. والتوكيل يحتاج تجديد؟</Bubble>
          <Bubble mine time="7:18">
            التوكيل ساري حتى جمادى الآخرة، وصورة السجل التجاري محفوظة في الملف. ما ينقص شيء.
          </Bubble>
          <p className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-xs text-slate">
            <Gavel className="size-3.5 text-pine" />
            حُدّثت حالة القضية في ناجز — <Num>8:41</Num>
          </p>
        </div>
      </section>

      <aside className="border-s border-line bg-surface px-5 py-5 max-lg:col-span-full max-lg:border-s-0 max-lg:border-t max-lg:pb-6">
        <p className="text-xs font-semibold text-slate">ملخص القضية</p>
        <dl className="mt-3 space-y-3 text-[13px]">
          {[
            ["النوع", "تجاري — توريد"],
            ["المحكمة", "التجارية ببريدة · الدائرة 3"],
            ["الخصم", "شركة الوادي للتوريد"],
            ["قيمة المطالبة", "412,000 ر.س"],
            ["ناجز", "رقم القيد 4102198"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-slate">{k}</dt>
              <dd className="text-end font-semibold">{/\d/.test(v) ? <Num>{v}</Num> : v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs font-semibold text-slate">اكتمال الملف</p>
        <div className="mt-2 flex items-center gap-3">
          <Meter value={100} className="flex-1" />
          <Num className="text-xs font-bold">100%</Num>
        </div>
        <ul className="mt-3 space-y-2 text-[13px]">
          {["التوكيل", "السجل التجاري", "العقد الأصلي", "المراسلات"].map((d) => (
            <li key={d} className="flex items-center gap-2">
              <span className="grid size-4 place-items-center rounded-full bg-pine text-snow">
                <Check className="size-2.5" />
              </span>
              {d}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Bubble({
  mine = false,
  time,
  children,
}: {
  mine?: boolean;
  time: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[70%] flex-col max-sm:max-w-[86%]",
        mine ? "ms-auto items-end" : "items-start",
      )}
    >
      <p
        className={cn(
          "rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
          mine ? "rounded-ee-md bg-pine text-snow" : "rounded-es-md bg-surface ring-1 ring-line",
        )}
      >
        {children}
      </p>
      <Num className="mt-1 px-1 text-[11px] text-slate">{time} ص</Num>
    </div>
  );
}

/* ───────────────────────── Team ───────────────────────── */

function StaffView() {
  const rows: [string, string, string, string, Tone, number, string][] = [
    ["أبو فيصل", "الشريك المؤسس", "اعتماد لائحة 1447/09", "في المكتب", "lime", 64, "كاملة"],
    ["سلطان الحربي", "محامٍ", "جلسة مؤسسة النور", "في المحكمة", "pine", 88, "كاملة"],
    ["هند العلي", "إدارة المكتب", "توكيلات اليوم", "في المكتب", "lime", 52, "محدودة"],
    ["ماجد الشمري", "محامٍ متدرب", "متابعة التنفيذ", "في المكتب", "lime", 41, "القضايا"],
    ["ريم الدوسري", "سكرتارية", "مواعيد الغد", "عن بُعد", "neutral", 35, "المواعيد"],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
        <Stat label="في المكتب" value="3" foot="من 6 أعضاء" />
        <Stat label="في المحكمة" value="1" foot="سلطان · حتى 10:00 ص" />
        <Stat label="مهام مفتوحة" value="17" delta="5 أُنجزت اليوم" />
        <Stat label="متوسط الحمل" value="56%" foot="متوازن هذا الأسبوع" />
      </div>
      <Card>
        <CardHeader
          title="أعضاء المكتب"
          description="الصلاحيات تحدد ما يراه كل عضو من ملفات العملاء"
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["العضو", "مهمة اليوم", "المكان", "الحمل", "الصلاحية"]} />
            <tbody className="divide-y divide-line">
              {rows.map(([n, role, task, where, tone, load, perm]) => (
                <tr key={n}>
                  <td className={td}>
                    <span className="flex items-center gap-3">
                      <Face name={n} />
                      <span>
                        <span className="block font-bold">{n}</span>
                        <span className="block text-xs text-slate">{role}</span>
                      </span>
                    </span>
                  </td>
                  <td className={td}>
                    {task.replace(/\d+\/\d+/, "")}
                    <Num>{task.match(/\d+\/\d+/)?.[0]}</Num>
                  </td>
                  <td className={td}>
                    <Pill tone={tone}>{where}</Pill>
                  </td>
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <Meter value={load} className="w-28" />
                      <Num className="text-xs text-slate">{load}%</Num>
                    </span>
                  </td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      <ShieldCheck className="size-4 text-pine" />
                      {perm}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Contract review ───────────────────────── */

function DocsView() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5 max-lg:grid-cols-1 max-sm:gap-4">
      <Card className="px-12 py-10 max-lg:px-8 max-sm:px-5 max-sm:py-7">
        <p className="text-center text-xs font-semibold text-slate">بسم الله الرحمن الرحيم</p>
        <h2 className="mt-4 text-center text-[19px] font-extrabold">عقد توريد</h2>
        <p className="mt-1 text-center text-xs text-slate">
          بين مؤسسة النور التجارية (الطرف الأول) وروابي للتجارة (الطرف الثاني) · رقم{" "}
          <Num>1447/21</Num>
        </p>
        <div className="mt-8 space-y-5 text-[14px] leading-loose text-pine-deep/90 max-sm:mt-6">
          <Clause n="4" title="التسليم">
            يلتزم الطرف الثاني بتسليم البضاعة خلال <Num>15</Num> يوم عمل من تاريخ أمر الشراء، في
            مستودع الطرف الأول ببريدة.
          </Clause>
          <Clause n="7" title="الغرامة" flag>
            في حال التأخير تُستحق غرامة حسب ما يراه الطرف الأول.
          </Clause>
          <Clause n="9" title="الضمان">
            يضمن الطرف الثاني البضاعة لمدة سنة من تاريخ الاستلام ضد العيوب الخفية.
          </Clause>
          <Clause n="12" title="الاختصاص">
            تختص المحكمة التجارية ببريدة بالنظر في أي نزاع ينشأ عن هذا العقد.
          </Clause>
          <Clause n="14" title="إنهاء العقد">
            يجوز لأي طرف إنهاء العقد بإشعار كتابي مدته <Num>30</Num> يومًا، دون المساس بالمستحقات
            القائمة.
          </Clause>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <Sparkles className="size-4 text-lime-600" />
            مراجعة الذكاء
            <span className="ms-auto text-xs font-semibold text-slate">
              <Num>14</Num> بندًا
            </span>
          </p>
          <ul className="mt-4 space-y-3">
            {[
              [
                "البند 7 — الغرامة غير محددة",
                "اقتراح: 0.5% عن كل يوم تأخير، بحد أقصى 10% من قيمة الطلب.",
                "danger",
                "عالٍ",
              ],
              ["لا سقف للتعويض", "يُقترح ربط التعويض بقيمة العقد.", "lime", "متوسط"],
              ["الاختصاص واضح", "المحكمة التجارية ببريدة.", "neutral", "سليم"],
              ["التسليم مربوط بمكان محدد", "مستودع الطرف الأول.", "neutral", "سليم"],
            ].map(([t, d, tone, level]) => (
              <li key={t} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-bold">{t}</p>
                  <Pill tone={tone as Tone}>{level}</Pill>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate">{d}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-bold">سجل النسخ</p>
          <ol className="relative mt-3 space-y-3 border-s border-line ps-4 text-xs">
            {[
              ["النسخة 3", "الذكاء · اليوم 9:40 ص"],
              ["النسخة 2", "سلطان الحربي · أمس"],
              ["النسخة 1", "من الموكل · الأحد"],
            ].map(([v, m]) => (
              <li key={v} className="relative">
                <span className="absolute -start-[21px] top-1 size-2 rounded-full bg-pine ring-2 ring-surface" />
                <span className="font-bold">{v}</span> <span className="text-slate">· {m}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Clause({
  n,
  title,
  flag = false,
  children,
}: {
  n: string;
  title: string;
  flag?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        flag &&
          "-mx-4 rounded-xl border border-lime/60 bg-lime-50/70 px-4 py-3 max-sm:-mx-2 max-sm:px-3",
      )}
    >
      <p className="text-[13px] font-extrabold">
        البند <Num>{n}</Num> — {title}
        {flag ? <span className="ms-2 text-xs font-semibold text-lime-600">يحتاج رأيك</span> : null}
      </p>
      <p className={cn(flag && "font-semibold")}>{children}</p>
    </div>
  );
}

/* ───────────────────────── Cases board ───────────────────────── */

function CasesView() {
  const cols: {
    name: string;
    tone: string;
    items: {
      no: string;
      client: string;
      kind: string;
      when: string;
      owner: string;
      flag?: string;
    }[];
  }[] = [
    {
      name: "قيد الإعداد",
      tone: "bg-pine-100",
      items: [
        {
          no: "1447/09",
          client: "نورة السبيعي",
          kind: "لائحة دعوى عمالية",
          when: "28 سبتمبر",
          owner: "هند العلي",
          flag: "بانتظار اعتمادك",
        },
        {
          no: "1446/18",
          client: "أبو فهد العنزي",
          kind: "مذكرة رد — إيجار",
          when: "1 أكتوبر",
          owner: "هند العلي",
        },
      ],
    },
    {
      name: "جاهزة للرفع",
      tone: "bg-lime",
      items: [
        {
          no: "1447/12",
          client: "مؤسسة النور",
          kind: "ملف مكتمل — تجاري",
          when: "اليوم",
          owner: "سلطان الحربي",
        },
        {
          no: "1447/03",
          client: "مكتب السالم",
          kind: "توكيل — أحوال",
          when: "26 سبتمبر",
          owner: "ريم الدوسري",
        },
      ],
    },
    {
      name: "رُفعت إلى ناجز",
      tone: "bg-pine-soft",
      items: [
        {
          no: "1446/44",
          client: "خالد القصّاب",
          kind: "طلب تنفيذ",
          when: "5 أكتوبر",
          owner: "ماجد الشمري",
        },
        {
          no: "1447/01",
          client: "عبدالله المطيري",
          kind: "دعوى عمالية",
          when: "12 أكتوبر",
          owner: "سلطان الحربي",
        },
      ],
    },
    {
      name: "لها رقم قيد",
      tone: "bg-pine",
      items: [
        {
          no: "4102198",
          client: "خالد القصّاب",
          kind: "تنفيذ",
          when: "جلسة 5 أكتوبر",
          owner: "ماجد الشمري",
        },
        {
          no: "4101884",
          client: "مؤسسة النور",
          kind: "تجاري",
          when: "جلسة اليوم",
          owner: "سلطان الحربي",
        },
        {
          no: "4099310",
          client: "روابي للتجارة",
          kind: "تجاري",
          when: "حُكم ابتدائي",
          owner: "أبو فيصل",
        },
      ],
    },
  ];
  return (
    <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
      {cols.map((c) => (
        <div key={c.name} className="rounded-2xl bg-pine-50/50 p-3 ring-1 ring-line">
          <p className="flex items-center gap-2 px-1 pb-3 text-[13px] font-bold">
            <span className={cn("size-2 rounded-full", c.tone)} />
            {c.name}
            <Num className="ms-auto rounded-full bg-surface px-2 text-[11px] text-slate ring-1 ring-line">
              {c.items.length}
            </Num>
          </p>
          <div className="space-y-2.5">
            {c.items.map((it) => (
              <Card key={it.no} className="rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <Num className="text-xs font-bold text-slate">{it.no}</Num>
                  <Face name={it.owner} className="size-6 text-[10px]" />
                </div>
                <p className="mt-1.5 text-[13.5px] font-bold">{it.client}</p>
                <p className="text-xs text-slate">{it.kind}</p>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate">
                    <CalendarDays className="size-3.5" />
                    {it.when.replace(/\d+/, "")}
                    <Num>{it.when.match(/\d+/)?.[0]}</Num>
                  </span>
                  {it.flag ? <Pill tone="lime">{it.flag}</Pill> : null}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Video session ───────────────────────── */

function VideoView() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_320px] max-lg:h-auto max-lg:grid-cols-1">
      <section className="flex min-h-0 flex-col bg-pine-deep p-5 max-sm:p-4">
        <div className="flex items-center gap-3 text-snow max-sm:flex-wrap max-sm:gap-x-2 max-sm:gap-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold">
            <Lock className="size-3.5 text-lime" />
            جلسة مشفّرة · داخل المنصة
          </span>
          <p className="text-[13px] font-bold max-sm:order-last max-sm:w-full">
            مراجعة عقد التوريد — روابي للتجارة
          </p>
          <Num className="ms-auto rounded-full bg-white/[0.08] px-3 py-1 text-xs text-snow/80">
            42:18
          </Num>
        </div>
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-4 max-lg:flex-none max-sm:gap-2.5">
          {[
            { n: "سلطان الحربي", r: "مكتب واصل للمحاماة", speaking: true },
            { n: "روابي للتجارة", r: "ممثل الموكل" },
          ].map((p) => (
            <div
              key={p.n}
              className={cn(
                "relative grid place-items-center rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#24484c_0%,#16302f_70%)] max-lg:aspect-[4/3] max-sm:aspect-[3/4]",
                p.speaking && "ring-2 ring-lime",
              )}
            >
              <Face
                name={p.n}
                tone={p.speaking ? "lime" : "pine"}
                className="size-24 text-4xl ring-4 ring-white/5 max-sm:size-16 max-sm:text-2xl"
              />
              <span className="absolute start-3 bottom-3 inline-flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1 text-xs text-snow max-sm:start-2 max-sm:bottom-2 max-sm:max-w-[calc(100%-1rem)] max-sm:gap-1.5 max-sm:px-2">
                <Mic className="size-3.5 shrink-0 text-lime" />
                <span className="max-sm:truncate max-sm:pb-0.5">
                  {p.n}
                  <span className="max-sm:hidden"> ·</span>
                </span>
                <span className="text-snow/60 max-sm:hidden">{p.r}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 max-sm:gap-2">
          {[Mic, VideoIcon, MonitorUp].map((I, i) => (
            <span
              key={i}
              className="grid size-11 place-items-center rounded-full bg-white/[0.08] text-snow"
            >
              <I className="size-5" />
            </span>
          ))}
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-[13px] font-bold text-pine-deep">
            <PhoneOff className="size-4" />
            إنهاء الجلسة
          </span>
        </div>
      </section>

      <aside className="flex flex-col border-s border-line bg-surface px-5 py-5 max-lg:border-s-0 max-lg:pb-6">
        <p className="flex items-center gap-2 text-[13px] font-bold">
          <Sparkles className="size-4 text-lime-600" />
          مذكرة الجلسة
          <span className="ms-auto text-[11px] font-semibold text-slate">تُكتب الآن</span>
        </p>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed">
          <li>
            اتفق الطرفان على مهلة <Num>7</Num> أيام لتسليم المستندات الناقصة.
          </li>
          <li>يُعدَّل بند الغرامة إلى نسبة محددة بسقف أعلى.</li>
          <li>
            موعد المتابعة: الأحد <Num>28</Num> سبتمبر.
          </li>
        </ul>
        <p className="mt-6 text-xs font-semibold text-slate">الحضور</p>
        <ul className="mt-2 space-y-2.5">
          {["سلطان الحربي", "ممثل روابي للتجارة", "أبو فيصل"].map((n) => (
            <li key={n} className="flex items-center gap-2.5 text-[13px]">
              <Face name={n} className="size-7 text-[11px]" />
              {n}
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-2 pt-6">
          <Button variant="dark" className="w-full" icon={FolderOpen}>
            حفظ في ملف العميل
          </Button>
          <Button className="w-full" icon={Send}>
            إرسال الملخص للموكل
          </Button>
        </div>
      </aside>
    </div>
  );
}
