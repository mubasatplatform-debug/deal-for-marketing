import type { ReactNode } from "react";
import {
  Copy,
  CreditCard,
  Delete,
  Download,
  Landmark,
  Link2,
  Lock,
  MessageCircle,
  Nfc,
  Plus,
  QrCode,
  ShieldCheck,
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
import { PAY_PRODUCT, payMore, payNav, type PayView } from "@/components/desks/navs";
import { Button, Card, CardHeader, Num, Pill, type Tone } from "@/components/dash/ui";
import {
  ChartTip,
  Face,
  LegendDot,
  Masked,
  Meter,
  Money,
  Stat,
  TableHead,
  td,
} from "@/components/desks/kit";
import { chart, fmt } from "@/components/desks/tokens";
import { cn } from "@/lib/utils";

const pages: Record<PayView, { title: string; subtitle: string; path: string }> = {
  home: {
    title: "التحصيل",
    subtitle: "الأربعاء 23 سبتمبر · التسوية التالية غدًا عبر ادفع باي",
    path: "pay",
  },
  pay: {
    title: "رابط دفع جديد",
    subtitle: "يصل عميلك على الواتساب، ويدفع بمدى أو آبل باي أو البطاقة",
    path: "pay/links/new",
  },
  bills: {
    title: "الفواتير",
    subtitle: "فاتورة إلكترونية تُرسل رابطًا، وتُقفل حين تُدفع",
    path: "pay/invoices",
  },
  pos: {
    title: "نقطة البيع",
    subtitle: "جوالك جهاز دفع · قرّب البطاقة أو الجوال",
    path: "pay/pos",
  },
};

export type { PayView };

export function PayDesk({ view }: { view: PayView }) {
  const screens: Record<PayView, ReactNode> = {
    home: <Home />,
    pay: <PayLink />,
    bills: <Bills />,
    pos: <Pos />,
  };
  const actions: Record<PayView, ReactNode> = {
    home: (
      <>
        <Button size="sm" icon={Download}>
          تصدير
        </Button>
        <Button size="sm" variant="primary" icon={Plus}>
          رابط دفع جديد
        </Button>
      </>
    ),
    pay: <Button size="sm">حفظ كمسودة</Button>,
    bills: (
      <Button size="sm" variant="primary" icon={Plus}>
        فاتورة جديدة
      </Button>
    ),
    pos: (
      <Button size="sm" icon={Download}>
        تقرير اليوم
      </Button>
    ),
  };
  const p = pages[view];
  return (
    <DeskFrame
      product={PAY_PRODUCT}
      workspace="دار العود الفاخر"
      workspaceMark="ع"
      workspaceMeta="بريدة · متجر وفرعان"
      path={p.path}
      route="/desk/pay/$view"
      view={view}
      nav={payNav}
      more={payMore}
      user={{ name: "عبدالرحمن الحربي", role: "المدير المالي" }}
      searchHint="ابحث برقم عملية، فاتورة، أو اسم عميل"
      status={<LiveChip>البوابة تعمل</LiveChip>}
      title={p.title}
      subtitle={p.subtitle}
      actions={actions[view]}
    >
      {screens[view]}
    </DeskFrame>
  );
}

type TxState = "paid" | "pending" | "refund";
const txPill: Record<TxState, [string, Tone]> = {
  paid: ["ناجحة", "pine"],
  pending: ["بانتظار الدفع", "lime"],
  refund: ["مستردة", "neutral"],
};

const tx: {
  id: string;
  name: string;
  via: string;
  method: string;
  amount: number;
  s: TxState;
  time: string;
}[] = [
  {
    id: "TX-20412",
    name: "مؤسسة النور",
    via: "فاتورة",
    method: "مدى",
    amount: 1250,
    s: "paid",
    time: "14:02",
  },
  {
    id: "TX-20411",
    name: "أبو فهد العنزي",
    via: "رابط دفع",
    method: "آبل باي",
    amount: 320,
    s: "paid",
    time: "13:40",
  },
  {
    id: "TX-20410",
    name: "نورة السبيعي",
    via: "رابط دفع",
    method: "بطاقة",
    amount: 540,
    s: "pending",
    time: "13:18",
  },
  {
    id: "TX-20409",
    name: "عميل الفرع",
    via: "نقطة البيع",
    method: "مدى",
    amount: 2100,
    s: "paid",
    time: "12:55",
  },
  {
    id: "TX-20408",
    name: "أم ريان",
    via: "رابط دفع",
    method: "آبل باي",
    amount: 85,
    s: "paid",
    time: "12:21",
  },
  {
    id: "TX-20407",
    name: "روابي للتجارة",
    via: "فاتورة",
    method: "مدى",
    amount: 4800,
    s: "paid",
    time: "11:44",
  },
  {
    id: "TX-20406",
    name: "مكتب السالم",
    via: "فاتورة",
    method: "بطاقة",
    amount: 1750,
    s: "pending",
    time: "11:02",
  },
];

/* ───────────────────────── Collections overview ───────────────────────── */

const daily = [
  { d: "10", v: 12400 },
  { d: "11", v: 14100 },
  { d: "12", v: 9800 },
  { d: "13", v: 11600 },
  { d: "14", v: 15200 },
  { d: "15", v: 13900 },
  { d: "16", v: 16800 },
  { d: "17", v: 14300 },
  { d: "18", v: 17500 },
  { d: "19", v: 12900 },
  { d: "20", v: 15100 },
  { d: "21", v: 16400 },
  { d: "22", v: 19200 },
  { d: "23", v: 18420 },
];

function Home() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
        <Stat
          label="حُصّل اليوم"
          value={<Money value={18420} unitClass="text-[13px]" />}
          delta="12.4%"
          foot="عن الأربعاء الماضي"
          spark={daily.slice(-7).map((x) => x.v)}
        />
        <Stat
          label="روابط مفتوحة"
          value="12"
          foot="3 لم تُفتح بعد"
          side={<Link2 className="size-6 text-pine-100" />}
        />
        <Stat
          label="فواتير مستحقة"
          value={<Money value={4690} unitClass="text-[13px]" />}
          foot="3 فواتير · تذكير آلي كل 48 ساعة"
        />
        <Stat
          label="نجاح العمليات"
          value="97.2%"
          delta="0.6 نقطة"
          foot="آخر 30 يومًا"
          spark={[95.8, 96.1, 96.4, 96.2, 96.9, 97, 97.2]}
        />
      </div>

      <div className="grid grid-cols-12 gap-5 max-lg:grid-cols-1 max-sm:gap-4">
        <Card className="col-span-8 max-lg:col-span-full">
          <CardHeader
            title="التحصيل اليومي"
            description="آخر 14 يومًا · ر.س"
            actions={
              <div className="text-end">
                <Money value={207620} className="text-[17px] font-bold text-pine-deep" />
                <p className="text-[11px] text-slate">إجمالي الفترة</p>
              </div>
            }
          />
          <div className="flex gap-4 px-6 pt-3">
            <LegendDot color={chart.lime}>اليوم</LegendDot>
            <LegendDot color={chart.pine}>الأيام السابقة</LegendDot>
          </div>
          <div className="h-[262px] px-3 pt-1 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
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
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  tickFormatter={(v: number) => (v ? `${v / 1000}k` : "0")}
                  tick={{ fill: chart.axis, fontSize: 11, fontFamily: "Manrope" }}
                />
                <Tooltip
                  cursor={{ fill: "#eaf0ef80" }}
                  content={<ChartTip unit="ر.س" names={{ v: "المحصّل" }} />}
                />
                <Bar dataKey="v" maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {daily.map((x, i) => (
                    <Cell key={x.d} fill={i === daily.length - 1 ? chart.lime : chart.pine} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="col-span-4 max-lg:col-span-full">
          <CardHeader title="طرق الدفع" description="حصة كل وسيلة هذا الشهر" />
          <ul className="mt-4 space-y-3.5 px-5">
            {[
              ["مدى", 54],
              ["آبل باي", 31],
              ["بطاقة ائتمانية", 11],
              ["تحويل بنكي", 4],
            ].map(([m, v]) => (
              <li key={m}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold">{m}</span>
                  <Num className="text-xs font-bold">{v}%</Num>
                </div>
                <Meter value={Number(v)} className="mt-1.5" />
              </li>
            ))}
          </ul>
          <div className="mx-5 mt-5 mb-5 flex items-center gap-3 rounded-xl bg-pine-deep p-3.5 text-snow">
            <span className="grid size-9 place-items-center rounded-lg bg-white/[0.08] text-lime">
              <Landmark className="size-[18px]" />
            </span>
            <div className="flex-1">
              <p className="text-[11px] text-snow/60">التسوية القادمة · غدًا</p>
              <Money value={17860} className="text-[15px] font-bold" unitClass="text-snow/60" />
            </div>
            <Num className="text-xs text-snow/60">•••• 4471</Num>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="آخر العمليات"
          description="روابط وفواتير ونقطة البيع في سجل واحد"
          actions={
            <Button size="sm" variant="ghost">
              كل العمليات
            </Button>
          }
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <TableHead
              cols={["العملية", "العميل", "القناة", "الوسيلة", "المبلغ", "الحالة", "الوقت"]}
            />
            <tbody className="divide-y divide-line">
              {tx.map((r) => (
                <tr key={r.id}>
                  <td className={cn(td, "text-slate")}>
                    <Num>{r.id}</Num>
                  </td>
                  <td className={cn(td, "font-bold")}>{r.name}</td>
                  <td className={td}>{r.via}</td>
                  <td className={cn(td, "text-slate")}>{r.method}</td>
                  <td className={td}>
                    <Money value={r.amount} className="font-bold" />
                  </td>
                  <td className={td}>
                    <Pill tone={txPill[r.s][1]}>{txPill[r.s][0]}</Pill>
                  </td>
                  <td className={cn(td, "text-slate")}>
                    <Num>{r.time}</Num>
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

/* ───────────────────────── Payment link ───────────────────────── */

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="mt-1.5 flex h-11 items-center rounded-xl border border-line-strong bg-surface px-3.5 text-[14px]">
        {children}
      </span>
      {hint ? <span className="mt-1 block text-xs text-slate">{hint}</span> : null}
    </label>
  );
}

function PayLink() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-5 max-lg:grid-cols-1 max-sm:gap-4">
      <Card className="p-6 max-sm:p-4">
        <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1 max-sm:gap-4">
          <Field label="العميل">مؤسسة النور التجارية</Field>
          <Field label="الجوال">
            <Masked tail="891" />
          </Field>
          <Field label="المبلغ" hint="شامل ضريبة القيمة المضافة 15%">
            <Num className="text-[17px] font-bold">1,250.00</Num>
            <span className="ms-auto text-xs font-semibold text-slate">ر.س</span>
          </Field>
          <Field label="الصلاحية">72 ساعة</Field>
        </div>
        <div className="mt-5">
          <Field label="البيان">توريد عود كمبودي — دفعة أولى من طلب الجملة</Field>
        </div>
        <p className="mt-6 text-[13px] font-semibold">وسائل الدفع</p>
        <div className="mt-2 grid grid-cols-3 gap-3 max-sm:grid-cols-2 max-sm:gap-2">
          {["مدى", "آبل باي", "بطاقة ائتمانية"].map((m) => (
            <span
              key={m}
              className="flex h-11 items-center gap-2.5 rounded-xl border border-pine bg-pine-50/60 px-3.5 text-[13px] font-semibold whitespace-nowrap max-sm:px-3 max-sm:last:col-span-2"
            >
              <span className="grid size-4 place-items-center rounded bg-pine text-snow">
                <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
                  <path
                    d="M2.5 6.2 5 8.5l4.5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {m}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-paper px-4 py-3 text-[13px]">
          <Link2 className="size-4 text-pine" />
          <span dir="ltr" className="font-ui text-slate">
            pay.deal.mubasat.net/<span className="text-pine-deep">oud/412</span>
          </span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-xs font-semibold text-pine">
            <Copy className="size-3.5" />
            نسخ
          </span>
        </div>
        <div className="mt-6 flex gap-3 max-sm:gap-2">
          <Button variant="primary" icon={MessageCircle} className="flex-1">
            أرسل الرابط على واتساب
          </Button>
          <Button icon={QrCode}>رمز QR</Button>
        </div>
      </Card>

      <div className="grid place-items-center rounded-2xl bg-pine-50/60 py-8 ring-1 ring-line">
        <div className="w-[280px] rounded-[34px] bg-pine-deep p-2.5 shadow-[0_30px_60px_-30px_rgba(16,38,40,0.5)]">
          <div className="overflow-hidden rounded-[26px] bg-surface">
            <div className="flex items-center justify-center gap-1.5 bg-paper py-2.5 text-[11px] text-slate">
              <Lock className="size-3" />
              <span dir="ltr" className="font-ui">
                pay.deal.mubasat.net
              </span>
            </div>
            <div className="px-5 pt-5 pb-6">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-pine-deep text-[13px] font-bold text-lime">
                  ع
                </span>
                <div>
                  <p className="text-[13px] font-bold">دار العود الفاخر</p>
                  <p className="text-[11px] text-slate">فاتورة 412</p>
                </div>
              </div>
              <p className="mt-6 text-xs text-slate">المبلغ المستحق</p>
              <Money
                value={1250}
                className="mt-1 text-[30px] font-extrabold"
                unitClass="text-[14px]"
              />
              <p className="mt-1 text-xs text-slate">توريد عود كمبودي — دفعة أولى</p>
              <div className="mt-5 space-y-2">
                <span className="flex h-11 items-center justify-center rounded-xl bg-pine-deep text-[14px] font-bold text-snow">
                  الدفع بآبل باي
                </span>
                <span className="flex h-11 items-center justify-center rounded-xl border border-line-strong text-[13px] font-semibold">
                  مدى
                </span>
                <span className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong text-[13px] font-semibold">
                  <CreditCard className="size-4 text-slate" />
                  بطاقة ائتمانية
                </span>
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate">
                <ShieldCheck className="size-3.5 text-pine" />
                دفع آمن عبر ادفع باي
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Invoices ───────────────────────── */

function Bills() {
  const rows: [string, string, number, "paid" | "open" | "late", string, string][] = [
    ["INV-412", "مؤسسة النور", 1250, "paid", "20 سبتمبر", "دُفعت اليوم · مدى"],
    ["INV-408", "أبو فهد العنزي", 320, "open", "25 سبتمبر", "تذكير أُرسل أمس"],
    ["INV-401", "نورة السبيعي", 540, "paid", "18 سبتمبر", "دُفعت أمس · آبل باي"],
    ["INV-398", "روابي للتجارة", 4800, "paid", "15 سبتمبر", "دُفعت 21 سبتمبر"],
    ["INV-391", "مكتب السالم", 1750, "late", "19 سبتمبر", "متأخرة 4 أيام"],
    ["INV-388", "خالد القصّاب", 2100, "paid", "12 سبتمبر", "دُفعت 20 سبتمبر"],
    ["INV-385", "أم ريان", 2620, "open", "30 سبتمبر", "لم تُفتح بعد"],
  ];
  const pill: Record<string, [string, Tone]> = {
    paid: ["مدفوعة", "pine"],
    open: ["مفتوحة", "lime"],
    late: ["متأخرة", "danger"],
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
        <Stat label="صدرت هذا الشهر" value="48" foot={`بقيمة ${fmt(96240)} ر.س`} />
        <Stat
          label="مدفوعة"
          value={<Money value={87460} unitClass="text-[13px]" />}
          delta="91%"
          foot="من القيمة"
        />
        <Stat
          label="مفتوحة"
          value={<Money value={4690} unitClass="text-[13px]" />}
          foot="3 فواتير"
        />
        <Stat
          label="متوسط أيام السداد"
          value="2.4"
          delta="0.8 يوم"
          deltaDown
          deltaSoft
          foot="أسرع من أغسطس"
        />
      </div>
      <Card>
        <CardHeader
          title="كل الفواتير"
          description="متوافقة مع الفوترة الإلكترونية · تُرسل رابطًا للعميل"
          actions={
            <div className="flex gap-1 rounded-xl bg-paper p-1">
              {["الكل", "مفتوحة", "متأخرة", "مدفوعة"].map((r, i) => (
                <span
                  key={r}
                  className={cn(
                    "inline-flex h-6 items-center rounded-lg px-3 text-xs font-semibold",
                    i === 0 ? "bg-surface shadow-sm ring-1 ring-line" : "text-slate",
                  )}
                >
                  {r}
                </span>
              ))}
            </div>
          }
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <TableHead
              cols={["الفاتورة", "العميل", "المبلغ", "تاريخ الاستحقاق", "الحالة", "آخر حركة"]}
            />
            <tbody className="divide-y divide-line">
              {rows.map(([id, n, a, s, due, last]) => (
                <tr key={id}>
                  <td className={cn(td, "text-slate")}>
                    <Num>{id}</Num>
                  </td>
                  <td className={td}>
                    <span className="flex items-center gap-2.5">
                      <Face name={n} className="size-7 text-[11px]" />
                      <span className="font-bold">{n}</span>
                    </span>
                  </td>
                  <td className={td}>
                    <Money value={a} className="font-bold" />
                  </td>
                  <td className={td}>{due}</td>
                  <td className={td}>
                    <Pill tone={pill[s][1]}>{pill[s][0]}</Pill>
                  </td>
                  <td className={cn(td, "text-slate")}>{last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Soft POS ───────────────────────── */

function Pos() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];
  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1 max-sm:gap-4">
      <div className="grid place-items-center rounded-2xl bg-pine-50/60 py-8 ring-1 ring-line">
        <div className="w-[290px] rounded-[34px] bg-pine-deep p-2.5 shadow-[0_30px_60px_-30px_rgba(16,38,40,0.5)]">
          <div className="rounded-[26px] bg-surface px-5 pt-6 pb-5">
            <p className="flex items-center justify-between text-xs text-slate">
              <span>الفرع الرئيسي</span>
              <span className="inline-flex items-center gap-1 font-semibold text-pine">
                <Nfc className="size-3.5" />
                جاهز
              </span>
            </p>
            <p className="mt-6 text-center text-xs text-slate">المبلغ</p>
            <p className="mt-1 text-center">
              <Num className="text-[40px] leading-none font-extrabold">85.00</Num>
              <span className="ms-1.5 text-sm font-semibold text-slate">ر.س</span>
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2" dir="ltr">
              {keys.map((k) => (
                <span
                  key={k}
                  className="grid h-12 place-items-center rounded-xl bg-paper font-ui text-[18px] font-semibold"
                >
                  {k === "del" ? <Delete className="size-5 text-slate" /> : k}
                </span>
              ))}
            </div>
            <span className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-lime text-[14px] font-bold text-pine-deep">
              <Nfc className="size-5" />
              قرّب البطاقة أو الجوال
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5 max-sm:space-y-4">
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1 max-sm:gap-3">
          <Stat
            label="مبيعات اليوم"
            value={<Money value={6240} unitClass="text-[13px]" />}
            delta="8%"
            foot="عن أمس"
          />
          <Stat label="تمريرات" value="41" foot="متوسط 152 ر.س" />
          <Stat label="رسوم العمليات" value="0.8%" foot="مدى · تسوية غدًا" />
        </div>
        <Card>
          <CardHeader title="تمريرات اليوم" description="الفرع الرئيسي · جوال عبدالرحمن" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <TableHead cols={["الوقت", "الوسيلة", "البطاقة", "المبلغ", "الحالة"]} />
              <tbody className="divide-y divide-line">
                {[
                  ["12:14", "مدى", "4471", 85, "paid"],
                  ["11:40", "آبل باي", "9023", 210, "paid"],
                  ["10:02", "بطاقة ائتمانية", "5518", 1250, "paid"],
                  ["9:48", "مدى", "3307", 40, "paid"],
                  ["9:30", "مدى", "7712", 120, "refund"],
                  ["9:11", "آبل باي", "2264", 320, "paid"],
                ].map(([t, m, card, a, s]) => (
                  <tr key={String(t)}>
                    <td className={cn(td, "text-slate")}>
                      <Num>{t}</Num>
                    </td>
                    <td className={td}>{m}</td>
                    <td className={cn(td, "text-slate")}>
                      <Num>•••• {card}</Num>
                    </td>
                    <td className={td}>
                      <Money value={Number(a)} className="font-bold" />
                    </td>
                    <td className={td}>
                      <Pill tone={txPill[s as TxState][1]}>{txPill[s as TxState][0]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
