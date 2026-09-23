import type { LineMessage } from "@/lib/line";
import { LineAvatar } from "./marks";

const ENTER = "motion-safe:animate-[file-in_0.45s_cubic-bezier(0.16,1,0.3,1)_both]";

export function MessageList({ messages, busy }: { messages: LineMessage[]; busy: boolean }) {
  return (
    <div role="log" aria-live="polite" aria-relevant="additions" aria-label="محادثة خط ديل" className="space-y-5">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <UserMessage key={`u-${i}`} content={m.content} />
        ) : (
          <AssistantMessage key={`a-${i}`} content={m.content} />
        ),
      )}
      {busy ? <Typing /> : null}
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className={`flex max-w-[86%] flex-col items-start me-auto md:max-w-[34rem] ${ENTER}`}>
      <span className="sr-only">أنت:</span>
      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-es-md bg-lime px-4 py-3 text-[0.95rem] leading-relaxed text-pine-deep">
        {content}
      </p>
    </div>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className={`flex max-w-[92%] items-start gap-3 ms-auto md:max-w-[38rem] ${ENTER}`}>
      <div className="min-w-0">
        <p className="mb-1.5 flex items-center justify-end gap-2">
          <span className="text-xs font-bold text-pine">ديل</span>
          <span className="font-ui text-micro font-semibold tracking-[0.18em] text-slate">AI</span>
          <span className="sr-only">:</span>
        </p>
        <p className="whitespace-pre-wrap break-words rounded-2xl rounded-se-md border border-line bg-surface px-4 py-3 text-[0.95rem] leading-relaxed text-pine-deep shadow-[0_1px_2px_rgba(16,38,40,0.05)]">
          {content}
        </p>
      </div>
      <LineAvatar className="mt-6" />
    </div>
  );
}

function Typing() {
  return (
    <div className={`flex items-start gap-3 ms-auto w-fit ${ENTER}`}>
      <div>
        <p className="mb-1.5 text-end text-xs font-bold text-pine">ديل</p>
        <div className="flex h-11 items-center gap-3 rounded-2xl border border-line bg-surface px-4">
          <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
            <span className="line-wait-bar h-2 w-0.5 bg-pine" />
            <span className="line-wait-bar h-4 w-0.5 bg-pine" />
            <span className="line-wait-bar h-3 w-0.5 bg-pine" />
            <span className="line-wait-bar h-1.5 w-0.5 bg-pine" />
          </span>
          <span className="text-xs text-slate">يسمعك ويراجع الملف…</span>
        </div>
      </div>
      <LineAvatar className="mt-6" />
    </div>
  );
}
