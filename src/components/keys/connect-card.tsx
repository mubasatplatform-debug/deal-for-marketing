import { useSyncExternalStore } from "react";
import { BookOpen, Check, Copy, Lock, RefreshCcw, ShieldCheck } from "lucide-react";
import { Card } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useCopy } from "./use-copy";

const noop = () => () => {};
/** The origin this app is served from; the canonical site URL during SSR. */
function useOrigin() {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => SITE_URL,
  );
}

/** Where to point an integration: REST base URL, MCP URL, the docs. */
export function ConnectCard() {
  const origin = useOrigin();
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 md:px-6">
        <h2 className="text-[15px] font-bold text-pine-deep">عناوين الربط</h2>
        <p className="mt-0.5 text-[13px] text-slate">أرسل المفتاح في ترويسة Authorization مع كل طلب.</p>
      </div>
      <div className="space-y-3 px-5 py-4 md:px-6">
        <Endpoint label="REST API" value={`${origin}/api/v1`} />
        <Endpoint label="خادم MCP" value={`${origin}/api/mcp`} />
      </div>
      <div className="border-t border-line bg-paper/50 px-5 py-4 md:px-6">
        <a href="/developers" className={cn(buttonClass("dark"), "w-full")}>
          <BookOpen className="size-4" />
          دليل المطوّرين
        </a>
      </div>
    </Card>
  );
}

function Endpoint({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy();
  return (
    <div>
      <p className="text-xs font-semibold text-slate">{label}</p>
      <div className="mt-1 flex items-center gap-1 rounded-xl border border-line bg-paper ps-3">
        <code dir="ltr" className="min-w-0 flex-1 truncate py-2 font-mono text-[12.5px] text-pine-deep">
          {value}
        </code>
        <button
          type="button"
          onClick={() => copy(value)}
          aria-label={`نسخ عنوان ${label}`}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-slate transition-colors hover:bg-surface hover:text-pine-deep focus-visible:outline-2 focus-visible:outline-pine"
        >
          {copied ? <Check className="size-4 text-lime-600" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** Three habits that keep a key safe. */
export function SafetyCard() {
  const tips = [
    { icon: Lock, text: "ضع المفتاح في خادمك أو في متغيرات البيئة، لا في كود الواجهة ولا في مستودع عام." },
    { icon: ShieldCheck, text: "مفتاح لكل تكامل، وبأقل صلاحيات يحتاجها. هكذا تلغي واحدًا دون أن يتوقف الباقي." },
    { icon: RefreshCcw, text: "إذا شككت أن مفتاحًا تسرّب، ألغِه فورًا وأنشئ بديلًا. الإلغاء يسري في اللحظة نفسها." },
  ];
  return (
    <Card className="px-5 py-5 md:px-6">
      <h2 className="text-[15px] font-bold text-pine-deep">حافظ على مفاتيحك</h2>
      <ul className="mt-3 space-y-3">
        {tips.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-[13px] leading-relaxed text-slate">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-pine-50 text-pine">
              <Icon className="size-3.5" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </Card>
  );
}
