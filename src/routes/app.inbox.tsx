import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Inbox, MessagesSquare, Settings2 } from "lucide-react";
import { Button, Card, EmptyState, Select } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { Dialog } from "@/components/keys/dialog";
import { ErrorCard, ListSkeleton, SearchInput, Tabs, useDebounced, useLoad } from "@/components/law/kit";
import { ConversationList, Details, Thread } from "@/components/law/inbox/inbox-ui";
import { InboxSettingsDialog } from "@/components/law/inbox/inbox-settings";
import { inboxChanged } from "@/components/law/inbox/inbox-events";
import { getInboxSetup, getInboxThread, listInbox, markInboxRead } from "@/lib/law/inbox";
import { CHANNEL_IDS, CHANNEL_LABELS, type ChannelId } from "@/lib/law/inbox-channels";
import type { MessageRow, ThreadView } from "@/lib/law/inbox-core";
import { INBOX_TABS, INBOX_TAB_LABELS, canInbox, type InboxTab } from "@/lib/law/inbox-options";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/inbox")({
  // `?c=<id>` opens a conversation (deep links; list → thread on phones).
  validateSearch: (search: Record<string, unknown>): { c?: string } =>
    typeof search.c === "string" && UUID.test(search.c) ? { c: search.c } : {},
  component: InboxPage,
});

const LIST_EVERY_MS = 15_000;
const THREAD_EVERY_MS = 5_000;

/** Run `fn` every `ms` while the tab is visible (and at once when it becomes visible). */
function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      if (!document.hidden) ref.current();
    }, ms);
    const onVisible = () => {
      if (!document.hidden) ref.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

function mergeMessages(cur: MessageRow[], next: MessageRow[]): MessageRow[] {
  if (!next.length) return cur;
  const byId = new Map(cur.map((m) => [m.id, m]));
  for (const m of next) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** The open conversation: first page, then polling for new messages every 5s. */
function useThread(wsId: string, id: string | null) {
  const [view, setView] = useState<ThreadView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const cur = useRef<ThreadView | null>(null);
  cur.current = view;
  const seq = useRef(0);

  useEffect(() => {
    const n = (seq.current += 1);
    setView(null);
    setError(null);
    if (!id) return;
    getInboxThread({ data: { workspaceId: wsId, id } })
      .then((v) => n === seq.current && setView(v))
      .catch((err) => n === seq.current && setError(workspaceErrorMessage(err)));
  }, [wsId, id]);

  const refresh = useCallback(async () => {
    const v = cur.current;
    if (!id || !v || v.conversation.id !== id) return;
    const n = seq.current;
    const since = v.messages[v.messages.length - 1]?.created_at ?? v.conversation.created_at;
    try {
      const next = await getInboxThread({ data: { workspaceId: wsId, id, since } });
      if (n !== seq.current) return;
      setView((prev) =>
        prev && prev.conversation.id === id
          ? { ...next, messages: mergeMessages(prev.messages, next.messages), hasMore: prev.hasMore }
          : prev,
      );
    } catch {
      /* the next tick retries */
    }
  }, [wsId, id]);

  const older = useCallback(async () => {
    const v = cur.current;
    if (!id || !v?.messages.length) return;
    setLoadingOlder(true);
    try {
      const page = await getInboxThread({ data: { workspaceId: wsId, id, before: v.messages[0].created_at } });
      setView((prev) =>
        prev && prev.conversation.id === id
          ? { ...prev, messages: mergeMessages(page.messages, prev.messages), hasMore: page.hasMore }
          : prev,
      );
    } catch (err) {
      setError(workspaceErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }, [wsId, id]);

  useVisibleInterval(() => void refresh(), THREAD_EVERY_MS, Boolean(id));
  return { view, error, refresh, older, loadingOlder };
}

function InboxPage() {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const readOnly = active.lifecycle.readOnly;
  const { c: selected } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/inbox" });
  const [tab, setTab] = useState<InboxTab>("all");
  const [channel, setChannel] = useState<ChannelId | "">("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const setup = useLoad(() => getInboxSetup({ data: { workspaceId: wsId } }), [wsId]);
  const list = useLoad(
    () => listInbox({ data: { workspaceId: wsId, tab, channel: channel || null, q: dq } }),
    [wsId, tab, channel, dq],
  );
  useVisibleInterval(() => void list.reload(), LIST_EVERY_MS);
  const thread = useThread(wsId, selected ?? null);

  // Reading a conversation clears its unread count (and the nav badge).
  const unread = thread.view?.conversation.unread_count ?? 0;
  const openId = thread.view?.conversation.id;
  useEffect(() => {
    if (!openId || unread === 0 || document.hidden) return;
    markInboxRead({ data: { workspaceId: wsId, id: openId } })
      .then(() => {
        inboxChanged();
        void list.reload();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, unread, wsId]);

  const select = (id: string | null) => {
    setDetailsOpen(false);
    void navigate({ search: id ? { c: id } : {} });
  };
  const changed = () => {
    void thread.refresh();
    void list.reload();
  };

  const counts = list.data?.counts;
  const rows = list.data?.rows ?? [];
  const filtered = Boolean(dq || channel);
  const canManage = canInbox(active.role, "settings");
  const webchatOn = setup.data?.settings.webchatEnabled ?? true;

  return (
    <>
      <PageHead
        title="مركز التواصل"
        subtitle="رسائل العملاء من كل القنوات في صندوق واحد، مع مساعد ذكي يلخّص ويقترح"
        actions={
          <Button icon={Settings2} onClick={() => setSettingsOpen(true)} disabled={!setup.data}>
            إعدادات التواصل
          </Button>
        }
      />

      {!webchatOn && setup.data && (counts?.all ?? 0) + (counts?.closed ?? 0) > 0 ? (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-lime-50 px-4 py-3 text-[13px] text-pine-deep ring-1 ring-lime/40">
          الدردشة المباشرة متوقفة حاليًا على صفحة الحجز؛ لا تصل محادثات جديدة من الزوار.
          {canManage ? (
            <button type="button" onClick={() => setSettingsOpen(true)} className="font-bold text-pine underline underline-offset-2">
              تفعيلها
            </button>
          ) : null}
        </p>
      ) : null}

      {list.error && !list.data ? (
        <ErrorCard title="تعذّر تحميل المحادثات" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid h-[calc(100dvh-12.5rem)] min-h-[520px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px]">
            {/* List */}
            <aside
              aria-label="قائمة المحادثات"
              className={cn("min-h-0 flex-col border-line lg:flex lg:border-e", selected ? "hidden" : "flex")}
            >
              <Tabs
                label="تصفية المحادثات"
                value={tab}
                onChange={setTab}
                tabs={INBOX_TABS.map((t) => ({ value: t, label: INBOX_TAB_LABELS[t], count: counts?.[t] }))}
              />
              <div className="flex gap-2 border-b border-line p-3">
                <SearchInput value={q} onChange={setQ} placeholder="ابحث بالاسم أو الجوال…" label="بحث في المحادثات" className="min-w-0 flex-1" />
                <Select
                  aria-label="القناة"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ChannelId | "")}
                  className="w-28 shrink-0"
                >
                  <option value="">كل القنوات</option>
                  {CHANNEL_IDS.map((id) => (
                    <option key={id} value={id}>
                      {CHANNEL_LABELS[id]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!list.data ? (
                  <ListSkeleton rows={6} />
                ) : rows.length ? (
                  <ConversationList rows={rows} selectedId={selected ?? null} onSelect={(id) => select(id)} />
                ) : filtered ? (
                  <EmptyState icon={Inbox} title="لا نتائج مطابقة" body="جرّب كلمة بحث أخرى أو قناة أخرى." />
                ) : tab !== "all" ? (
                  <EmptyState icon={Inbox} title={tab === "closed" ? "لا محادثات مغلقة" : tab === "mine" ? "لا محادثات مسندة إليك" : "كل المحادثات مسندة"} />
                ) : (
                  <FirstRun webchatOn={webchatOn} canManage={canManage} bookingUrl={setup.data?.bookingUrl ?? null} onSettings={() => setSettingsOpen(true)} />
                )}
              </div>
            </aside>

            {/* Thread */}
            <section aria-label="المحادثة" className={cn("min-h-0 flex-col bg-surface lg:flex", selected ? "flex" : "hidden")}>
              {!selected ? (
                <div className="grid flex-1 place-items-center bg-paper">
                  <EmptyState icon={MessagesSquare} title="اختر محادثة" body="اختر محادثة من القائمة لقراءتها والرد عليها." />
                </div>
              ) : thread.error && !thread.view ? (
                <div className="grid flex-1 place-items-center">
                  <EmptyState
                    icon={MessagesSquare}
                    title="تعذّر فتح المحادثة"
                    body={thread.error}
                    action={<Button onClick={() => select(null)}>العودة إلى القائمة</Button>}
                  />
                </div>
              ) : !thread.view ? (
                <ListSkeleton rows={4} />
              ) : (
                <Thread
                  view={thread.view}
                  setup={setup.data}
                  readOnly={readOnly}
                  loadingOlder={thread.loadingOlder}
                  onOlder={() => void thread.older()}
                  onBack={() => select(null)}
                  onDetails={() => setDetailsOpen(true)}
                  onChanged={changed}
                />
              )}
            </section>

            {/* Details */}
            <aside aria-label="تفاصيل المحادثة" className="hidden min-h-0 overflow-y-auto border-s border-line bg-surface xl:block">
              {thread.view && selected ? (
                <Details view={thread.view} setup={setup.data} readOnly={readOnly} onChanged={changed} />
              ) : (
                <p className="p-6 text-center text-[13px] text-slate">تظهر هنا بيانات جهة الاتصال وملف العميل والمسؤول.</p>
              )}
            </aside>
          </div>
        </Card>
      )}

      {detailsOpen && thread.view ? (
        <Dialog title="تفاصيل المحادثة" onClose={() => setDetailsOpen(false)}>
          <div className="-mx-6 -my-4">
            <Details view={thread.view} setup={setup.data} readOnly={readOnly} onChanged={changed} />
          </div>
        </Dialog>
      ) : null}

      {settingsOpen && setup.data ? (
        <InboxSettingsDialog
          setup={setup.data}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => void setup.reload()}
        />
      ) : null}
    </>
  );
}

function FirstRun({
  webchatOn,
  canManage,
  bookingUrl,
  onSettings,
}: {
  webchatOn: boolean;
  canManage: boolean;
  bookingUrl: string | null;
  onSettings: () => void;
}) {
  if (!webchatOn) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="لا محادثات بعد"
        body={
          canManage
            ? "فعّل الدردشة المباشرة ليظهر زر «تحدّث معنا» على صفحة الحجز الخاصة بمكتبك، وتصلك رسائل الزوار هنا مع مساعد آلي يرد أولًا إن شئت."
            : "الدردشة المباشرة غير مفعّلة. اطلب من مالك المكتب أو مديره تفعيلها من إعدادات التواصل."
        }
        action={
          canManage ? (
            <Button variant="primary" icon={Settings2} onClick={onSettings}>
              تفعيل الدردشة المباشرة
            </Button>
          ) : null
        }
      />
    );
  }
  return (
    <EmptyState
      icon={MessagesSquare}
      title="لا محادثات بعد"
      body="الدردشة المباشرة مفعّلة على صفحة الحجز. شارك الرابط مع عملائك، وستظهر رسائلهم هنا فور وصولها."
      action={
        bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-pine-deep hover:bg-paper"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            فتح صفحة الحجز
          </a>
        ) : null
      }
    />
  );
}
