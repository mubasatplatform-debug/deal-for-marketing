import { useEffect, useState } from "react";
import { Bot, Check, Copy, History, KeyRound, Plug } from "lucide-react";
import { Card, CardHeader, EmptyState, Pill, type Tone } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { ErrorCard, ListSkeleton, useLoad } from "@/components/law/kit";
import { dateAr } from "@/components/law/format";
import { listAgentActions } from "@/lib/law/agent/agent";
import type { AuditRow } from "@/lib/law/agent/agent-core";

/**
 * Settings → AI: how to plug an external AI client (Claude, Cursor, …) into
 * the office over MCP, and the office's log of every change AI made.
 */

function useOrigin() {
  const [origin, setOrigin] = useState("https://deal.mubasat.net");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold">{label}</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-pine hover:bg-pine-50"
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? "نُسخ" : "نسخ"}
        </button>
      </div>
      <pre dir="ltr" className="overflow-x-auto rounded-xl border border-line bg-paper px-3.5 py-3 font-mono text-[12px] leading-5 text-pine-deep">
        {text}
      </pre>
    </div>
  );
}

export function AiIntegrationsCard() {
  const origin = useOrigin();
  const url = `${origin}/api/mcp`;
  const cursor = JSON.stringify(
    { mcpServers: { "deal-law": { url, headers: { Authorization: "Bearer YOUR_API_KEY" } } } },
    null,
    2,
  );
  const claude = JSON.stringify(
    {
      mcpServers: {
        "deal-law": { command: "npx", args: ["-y", "mcp-remote", url, "--header", "Authorization:Bearer YOUR_API_KEY"] },
      },
    },
    null,
    2,
  );
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Plug className="size-[18px] text-pine" aria-hidden="true" />
            ربط مساعدات الذكاء الاصطناعي (MCP)
          </span>
        }
        description="اربط Claude أو Cursor أو أي مساعد يدعم بروتوكول MCP بمكتبك، فيقرأ ويضيف ويعدّل بياناته بصلاحيات دورك — بدون حذف."
      />
      <div className="space-y-5 px-5 pb-6 md:px-6">
        <ol className="space-y-3 text-sm leading-relaxed">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pine text-xs font-bold text-lime">١</span>
            <span>
              أنشئ مفتاح API من{" "}
              <a href="/client/keys" className="inline-flex items-center gap-1 font-semibold text-pine underline underline-offset-4">
                <KeyRound className="size-3.5" aria-hidden="true" />
                مفاتيح API
              </a>{" "}
              واختر «قراءة بيانات مكتب المحامي»، وأضف «تعديل بيانات مكتب المحامي» إن أردت أن يضيف ويعدّل.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pine text-xs font-bold text-lime">٢</span>
            <span>ضع العنوان والمفتاح في إعدادات المساعد كما في الأمثلة (استبدل <code dir="ltr" className="font-mono text-xs">YOUR_API_KEY</code> بمفتاحك)، ثم أعد تشغيله.</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pine text-xs font-bold text-lime">٣</span>
            <span>اطلب منه مثلًا: «اعرض قضايا هذا الأسبوع» أو «أضف مهمة مراجعة عقد شركة الأفق غدًا». كل تعديل يُسجَّل أدناه.</span>
          </li>
        </ol>
        <CopyBlock label="عنوان خادم MCP" text={url} />
        <CopyBlock label="Cursor · VS Code · Windsurf (mcp.json)" text={cursor} />
        <CopyBlock label="Claude Desktop (claude_desktop_config.json)" text={claude} />
        <p className="rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-slate">
          المفتاح يعمل باسمك وبحدود دورك في المكتب. لا تشاركه، ويمكنك إلغاؤه في أي وقت من صفحة المفاتيح.
        </p>
      </div>
    </Card>
  );
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  done: { label: "نُفّذ", tone: "pine" },
  failed: { label: "فشل", tone: "danger" },
  cancelled: { label: "أُلغي", tone: "neutral" },
  running: { label: "قيد التنفيذ", tone: "lime" },
};

export function AiAuditCard() {
  const { active } = useLawApp();
  const log = useLoad(() => listAgentActions({ data: { workspaceId: active.workspace.id } }), [active.workspace.id]);
  const manager = active.role === "owner" || active.role === "admin";
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <History className="size-[18px] text-pine" aria-hidden="true" />
            سجل عمليات الذكاء الاصطناعي
          </span>
        }
        description={manager ? "كل ما أضافه أو عدّله المساعد أو أي تكامل MCP في المكتب." : "ما أضافه أو عدّله الذكاء الاصطناعي باسمك."}
      />
      <div className="mt-4">
        {log.error && !log.data ? (
          <div className="px-5 pb-5">
            <ErrorCard title="تعذّر تحميل السجل" message={log.error} onRetry={() => void log.reload()} />
          </div>
        ) : !log.data ? (
          <ListSkeleton />
        ) : log.data.length === 0 ? (
          <EmptyState icon={Bot} title="لا عمليات بعد" body="ستظهر هنا كل إضافة أو تعديل ينفّذه المساعد بعد تأكيدك." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-y border-line bg-paper text-start text-[13px] text-slate">
                  <th className="px-5 py-2.5 text-start font-semibold">الوقت</th>
                  <th className="px-3 py-2.5 text-start font-semibold">العملية</th>
                  <th className="px-3 py-2.5 text-start font-semibold">المصدر</th>
                  {manager ? <th className="px-3 py-2.5 text-start font-semibold">بواسطة</th> : null}
                  <th className="px-5 py-2.5 text-start font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {log.data.map((a: AuditRow) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 whitespace-nowrap text-slate">{dateAr(a.created_at)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-pine-deep">{a.summary}</p>
                      {a.error ? <p className="mt-0.5 text-xs text-red-700">{a.error}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-slate">{a.source === "mcp" ? "تكامل MCP" : "مساعد المكتب"}</td>
                    {manager ? <td className="px-3 py-3 text-slate">{a.user_name ?? "—"}</td> : null}
                    <td className="px-5 py-3">
                      <Pill tone={STATUS[a.status]?.tone ?? "neutral"}>{STATUS[a.status]?.label ?? a.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
