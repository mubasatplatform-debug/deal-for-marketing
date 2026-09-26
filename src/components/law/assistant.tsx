import { useCallback, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Check, CircleAlert, Loader2, Search, Sparkles, X } from "lucide-react";
import { useLawApp } from "@/components/law/app-context";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { agentTurn, cancelAgentAction, confirmAgentAction } from "@/lib/law/agent/agent";
import type { AgentAction, AgentStep } from "@/lib/law/agent/agent-core";
import { cn } from "@/lib/utils";

/**
 * «مساعد المكتب» — the in-app AI assistant, on assistant-ui (MIT) primitives.
 * The conversation lives here (external-store runtime); each send runs one
 * server-side agent turn. Changes the agent proposes arrive as action cards
 * that only run when this person presses «تأكيد».
 */

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: AgentStep[];
  actions?: AgentAction[];
  error?: boolean;
};

const STATUS_AR: Record<AgentAction["status"], string> = {
  pending: "بانتظار تأكيدك",
  running: "جارٍ التنفيذ",
  done: "تم التنفيذ",
  failed: "تعذّر التنفيذ",
  cancelled: "أُلغي",
};

const SUGGESTIONS = [
  "وش عندي اليوم؟",
  "لخّص لي وضع المكتب المالي هذا الشهر",
  "أي القضايا متأخرة أو بدون جلسة قادمة؟",
  "اكتب مسودة خطاب مطالبة لعميل متأخر في الدفع",
];

let seq = 0;
const newId = () => `m${Date.now().toString(36)}${(seq += 1)}`;

/** What the model sees of past turns: the words plus the fate of each action. */
function historyText(m: UiMessage): string {
  if (!m.actions?.length) return m.text;
  const notes = m.actions.map((a) => `[إجراء: ${a.summary} — الحالة: ${a.status}]`).join("\n");
  return `${m.text}\n${notes}`;
}

export function LawAssistant() {
  const { active } = useLawApp();
  const workspaceId = active.workspace.id;
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [running, setRunning] = useState(false);

  const updateAction = useCallback((next: AgentAction) => {
    setMessages((ms) =>
      ms.map((m) => (m.actions?.some((a) => a.id === next.id) ? { ...m, actions: m.actions.map((a) => (a.id === next.id ? next : a)) } : m)),
    );
  }, []);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const text = message.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      if (!text) return;
      const user: UiMessage = { id: newId(), role: "user", text };
      const next = [...messages, user];
      setMessages(next);
      setRunning(true);
      try {
        const r = await agentTurn({
          data: {
            workspaceId,
            messages: next
              .filter((m) => !m.error)
              .slice(-30)
              .map((m) => ({ role: m.role, content: historyText(m).slice(0, 8000) || "…" })),
          },
        });
        setMessages((ms) => [...ms, { id: newId(), role: "assistant", text: r.reply, steps: r.steps, actions: r.actions }]);
      } catch (err) {
        setMessages((ms) => [...ms, { id: newId(), role: "assistant", text: workspaceErrorMessage(err), error: true }]);
      } finally {
        setRunning(false);
      }
    },
    [messages, workspaceId],
  );

  const convertMessage = useCallback((m: UiMessage): ThreadMessageLike => {
    if (m.role === "user") return { id: m.id, role: "user", content: [{ type: "text", text: m.text }] };
    const parts: ThreadMessageLike["content"] = [
      ...(m.steps?.length
        ? [{ type: "tool-call" as const, toolCallId: `${m.id}-steps`, toolName: "agent_steps", args: {}, result: m.steps }]
        : []),
      { type: "text" as const, text: m.text },
      ...(m.actions ?? []).map((a) => ({
        type: "tool-call" as const,
        toolCallId: a.id,
        toolName: "agent_action",
        args: {},
        result: a,
      })),
    ];
    return { id: m.id, role: "assistant", content: parts, status: { type: "complete", reason: "stop" }, metadata: { custom: { error: Boolean(m.error) } } };
  }, []);

  const runtime = useExternalStoreRuntime({ messages, isRunning: running, onNew, convertMessage });

  const toolUi = useMemo(
    () =>
      function ToolPart(props: ToolCallMessagePartProps) {
        if (props.toolName === "agent_steps") return <Steps steps={(props.result as AgentStep[]) ?? []} />;
        if (props.toolName === "agent_action") {
          return <ActionCard action={props.result as AgentAction} workspaceId={workspaceId} onChange={updateAction} />;
        }
        return null;
      },
    [workspaceId, updateAction],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-[calc(100dvh-9rem)]">
        <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6">
          <ThreadPrimitive.Empty>
            <Welcome name={active.workspace.name} />
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages>
            {({ message }) => (message.role === "user" ? <UserBubble /> : <AssistantBubble tool={toolUi} />)}
          </ThreadPrimitive.Messages>
          <ThreadPrimitive.If running>
            <div className="flex items-center gap-2 text-sm text-slate" role="status">
              <Loader2 className="size-4 animate-spin text-pine" aria-hidden="true" />
              المساعد يعمل على طلبك…
            </div>
          </ThreadPrimitive.If>
        </ThreadPrimitive.Viewport>
        <Composer disabled={running} />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function Welcome({ name }: { name: string }) {
  return (
    <div className="m-auto flex max-w-xl flex-col items-center py-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-pine text-lime">
        <Sparkles className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-display text-2xl text-pine-deep">مساعد {name}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate">
        اسأله عن عملائك وقضاياك وجلساتك، أو اطلب منه إضافة وتعديل البيانات وصياغة المسودات. أي تغيير يقترحه يظهر لك لتؤكده قبل
        التنفيذ.
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <ThreadPrimitive.Suggestion
            key={s}
            prompt={s}
            send
            className="min-h-12 rounded-xl border border-line bg-paper px-4 py-2.5 text-start text-sm font-semibold text-pine-deep transition-colors hover:border-pine/40 hover:bg-pine-50"
          >
            {s}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

function UserBubble() {
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-pine px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-snow">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantBubble({ tool }: { tool: (p: ToolCallMessagePartProps) => React.ReactNode }) {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="w-full max-w-[92%] space-y-3">
        <MessagePrimitive.Parts components={{ Text: MarkdownText, tools: { Override: tool as never } }} />
      </div>
    </MessagePrimitive.Root>
  );
}

/**
 * Model output is untrusted: images are dropped (a prompt-injected image URL
 * would leak data on render) and links open in a new tab without a referrer.
 */
const markdownComponents = {
  img: () => null,
  a: ({ node: _node, ...props }: React.ComponentProps<"a"> & { node?: unknown }) => (
    <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
  ),
};

function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      className="agent-md text-[15px] leading-relaxed text-pine-deep"
    />
  );
}

function Steps({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="ما اطّلع عليه المساعد">
      {steps.map((s, i) => (
        <li
          key={`${s.tool}-${i}`}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
            s.ok ? "bg-paper text-slate ring-1 ring-line" : "bg-red-50 text-red-700 ring-1 ring-red-200",
          )}
        >
          {s.ok ? <Search className="size-3" aria-hidden="true" /> : <CircleAlert className="size-3" aria-hidden="true" />}
          {s.title}
        </li>
      ))}
    </ul>
  );
}

function ActionCard({
  action,
  workspaceId,
  onChange,
}: {
  action: AgentAction;
  workspaceId: string;
  onChange: (a: AgentAction) => void;
}) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy("confirm");
    setErr(null);
    try {
      onChange(await confirmAgentAction({ data: { workspaceId, actionId: action.id } }));
    } catch (e) {
      setErr(workspaceErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function cancel() {
    setBusy("cancel");
    setErr(null);
    try {
      await cancelAgentAction({ data: { workspaceId, actionId: action.id } });
      onChange({ ...action, status: "cancelled" });
    } catch (e) {
      setErr(workspaceErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const pending = action.status === "pending";
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        pending ? "border-lime/60 bg-lime-50" : action.status === "done" ? "border-pine-100 bg-pine-50" : "border-line bg-paper",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate">{action.title}</p>
          <p className="mt-1 text-[15px] font-semibold text-pine-deep">{action.summary}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
            action.status === "done" && "bg-pine text-lime",
            action.status === "failed" && "bg-red-100 text-red-800",
            action.status === "cancelled" && "bg-line text-slate",
            (action.status === "pending" || action.status === "running") && "bg-lime text-ink",
          )}
        >
          {STATUS_AR[action.status]}
        </span>
      </div>
      {action.error ? <p className="mt-2 text-sm text-red-700">{action.error}</p> : null}
      {err ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {err}
        </p>
      ) : null}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-pine px-4 text-sm font-bold text-snow hover:bg-pine-deep disabled:opacity-60"
          >
            {busy === "confirm" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            تأكيد
          </button>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-slate hover:text-pine-deep disabled:opacity-60"
          >
            <X className="size-4" aria-hidden="true" />
            إلغاء
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Composer({ disabled }: { disabled: boolean }) {
  return (
    <ComposerPrimitive.Root className="border-t border-line bg-paper p-3 sm:p-4">
      <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2 focus-within:border-pine">
        <ComposerPrimitive.Input
          rows={1}
          autoFocus
          placeholder="اكتب طلبك للمساعد…"
          aria-label="رسالة للمساعد"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-pine-deep outline-none placeholder:text-slate"
        />
        <ComposerPrimitive.Send
          disabled={disabled}
          aria-label="إرسال"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine text-lime transition-opacity hover:bg-pine-deep disabled:opacity-40"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </ComposerPrimitive.Send>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate">
        قد يخطئ المساعد. راجع أي مسودة قبل استخدامها، ولا يُنفَّذ أي تعديل دون تأكيدك.
      </p>
    </ComposerPrimitive.Root>
  );
}
