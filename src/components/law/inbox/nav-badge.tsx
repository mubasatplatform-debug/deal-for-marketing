import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { useLawApp } from "@/components/law/app-context";
import { INBOX_CHANGED } from "@/components/law/inbox/inbox-events";
import { inboxCounts } from "@/lib/law/inbox";
import { cn } from "@/lib/utils";

/**
 * The «التواصل» nav icon with its unread badge: conversations waiting on the
 * team with unread messages. Polls every 30s while the tab is visible, and
 * at once when the inbox page announces a change (`INBOX_CHANGED`).
 */

const EVERY_MS = 30_000;

export function InboxNavIcon({ className }: { className?: string }) {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      clearTimeout(timer);
      if (!document.hidden) {
        try {
          const c = await inboxCounts({ data: { workspaceId: wsId } });
          if (alive) setUnread(c.unread);
        } catch {
          /* the badge is a hint; never an error */
        }
      }
      if (alive) timer = setTimeout(load, EVERY_MS);
    };
    void load();
    const onChange = () => void load();
    window.addEventListener(INBOX_CHANGED, onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener(INBOX_CHANGED, onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [wsId]);

  return (
    <span className={cn("relative inline-flex", className)}>
      <MessagesSquare className="size-full" />
      {unread > 0 ? (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -end-2 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 font-ui text-[10px] leading-none font-bold text-pine-deep ring-2 ring-pine-deep"
          >
            {unread > 99 ? "99+" : unread}
          </span>
          <span className="sr-only">({unread} محادثات غير مقروءة)</span>
        </>
      ) : null}
    </span>
  );
}
