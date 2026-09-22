import { DeskFrame } from "@/components/desk-frame";
import { cn } from "@/lib/utils";

const items = [
  { id: "home", label: "غرفة العمليات" },
  { id: "inbox", label: "الوارد" },
  { id: "calls", label: "الكول سنتر" },
  { id: "ai", label: "الذكاء يدير" },
] as const;

export type CrmView = (typeof items)[number]["id"];

export function CrmDesk({ view }: { view: CrmView }) {
  const screens = {
    home: <Home />,
    inbox: <Inbox />,
    calls: <Calls />,
    ai: <AiRun />,
  };
  return (
    <DeskFrame brand="الحل اللحظي" office="CRM · واتساب · كول سنتر" crumb="الذكاء يرد — أنت تعتمد" view={view} items={items}>
      {screens[view]}
    </DeskFrame>
  );
}

function Home() {
  const kpis = [
    ["١٤٢", "محادثة اليوم"],
    ["٣٨", "مكالمة"],
    ["٩١٪", "ردّها الذكاء"],
    ["٧", "تحتاجك الآن"],
  ];
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(([n, l]) => (
          <div key={l} className="border border-ink/10 p-4">
            <p className="font-display text-3xl">{n}</p>
            <p className="mt-1 font-display text-sm text-ink/50">{l}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 font-display text-sm text-ink/40">آخر الحركة</p>
      <div className="mt-3 border border-ink/10">
        {[
          ["أبو فهد", "واتساب", "الطلب وصل؟", "ردّ الذكاء"],
          ["نورة", "مكالمة", "موعد بعد العشاء", "حُوِّل لك"],
          ["مؤسسة النور", "واتساب", "فاتورة ٤١٢", "أُغلق"],
        ].map((r) => (
          <div key={r[0]} className="grid grid-cols-4 border-b border-ink/5 px-4 py-3 font-display text-sm last:border-0">
            {r.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Inbox() {
  return (
    <div className="grid h-full grid-cols-[15rem_1fr] gap-4">
      <ul className="border border-ink/10">
        {[
          ["أبو فهد", "الطلب وصل ولا باقي؟", true],
          ["نورة السبيعي", "أبغى موعد بعد العشاء", false],
          ["مؤسسة النور", "الفاتورة رقم ٤١٢", false],
        ].map(([name, p, on]) => (
          <li key={String(name)} className={cn("border-b border-ink/5 px-4 py-3", on && "bg-lime/25")}>
            <p className="font-display text-sm">{name}</p>
            <p className="text-xs text-ink/45">{p}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col border border-ink/10">
        <div className="border-b border-ink/10 px-4 py-3 font-display text-sm">أبو فهد · واتساب · يرد الذكاء</div>
        <div className="flex-1 space-y-2 p-4">
          <p className="bg-ink/5 px-3 py-2 text-sm">السلام عليكم، الطلب وصل ولا باقي؟</p>
          <p className="mr-10 bg-lime px-3 py-2 text-sm">وعليكم السلام أبو فهد، وصلك اليوم قبل العصر إن شاء الله.</p>
          <p className="bg-ink/5 px-3 py-2 text-sm">تمام، وإذا تأخر؟</p>
          <p className="mr-10 bg-lime px-3 py-2 text-sm">أي تأخير أكلمك قبل ما يوصلك. ارتاح.</p>
        </div>
      </div>
    </div>
  );
}

function Calls() {
  const cols = [
    { name: "وارد", items: ["٠٥٥… نورة", "٠٥٣… مؤسسة النور"] },
    { name: "يرد النظام", items: ["تتبع شحنة", "تأكيد طلب"] },
    { name: "يحتاجك", items: ["شكوى فاتورة"] },
    { name: "أُغلق", items: ["طلب مكتمل", "موعد ثابت"] },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {cols.map((c) => (
        <div key={c.name} className="border border-ink/10 p-3">
          <p className="font-display text-xs text-lime">{c.name}</p>
          {c.items.map((it) => (
            <p key={it} className="mt-2 bg-ink/5 px-2 py-3 font-display text-sm">
              {it}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function AiRun() {
  const rows = [
    ["ردود أُنجزت", "٨٤"],
    ["مكالمات أُغلقت", "٣١"],
    ["حُوِّل لك", "٧"],
    ["متوسط الرد", "٤ ث"],
  ];
  return (
    <div>
      <p className="mb-4 font-display text-sm text-ink/50">الذكاء يدير الخط. أنت لا تدخل إلا إذا احتاجك.</p>
      <div className="grid grid-cols-4 gap-3">
        {rows.map(([k, v]) => (
          <div key={k} className="border border-ink/10 p-5">
            <p className="font-display text-3xl">{v}</p>
            <p className="mt-2 font-display text-sm text-ink/50">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
