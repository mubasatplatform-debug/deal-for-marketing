import { useState } from "react";
import { AlertCircle, ArrowRight, ChevronDown, MessageCircle, RotateCw, SearchX } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DashShell } from "@/components/dash/shell";
import { Button, Card, Num, Skeleton } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { ThreadPanel } from "@/components/thread/thread-panel";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import type { ClientRequestDetail, Thread } from "@/lib/thread";
import { cn } from "@/lib/utils";
import { CLIENT_NAV } from "./nav";
import { formatDate, isoDate } from "./format";
import { ServiceTile } from "./service-icon";
import { Stepper } from "./stepper";
import { StatusPill } from "./status-pill";
import { followUpText, nextStepText, stepIndex, waLink } from "./status";

export type RequestDetailState = "loading" | "error" | "missing" | "ready";

/**
 * One request for its customer: where it stands, and the conversation with
 * the team (messages + files). Presentational; the route loads the data.
 */
export function ClientRequestDetail({
  user,
  state,
  request,
  thread,
  load,
  onRetry,
  onSignOut,
}: {
  user: { name: string; email?: string | null };
  state: RequestDetailState;
  request: ClientRequestDetail | null;
  thread: Thread | null;
  load: () => Promise<Thread>;
  onRetry: () => void;
  onSignOut?: () => void;
}) {
  const nav = CLIENT_NAV.map((n) => ({
    ...n,
    href: n.href.startsWith("#") ? `/client${n.href}` : n.href,
    active: n.href === "#requests",
  }));
  const now = new Date();
  return (
    <DashShell
      area="حساب العميل"
      nav={nav}
      user={user}
      onSignOut={onSignOut}
      title={request ? request.service_title : state === "loading" ? "طلبك" : "الطلب"}
      subtitle={
        request ? (
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <Num>
              <bdi>#{request.id}</bdi>
            </Num>
            <span aria-hidden="true" className="text-line-strong">·</span>
            <time dateTime={isoDate(request.created_at)}>
              أُرسل في <Num>{formatDate(request.created_at, now)}</Num>
            </time>
            {request.company ? (
              <>
                <span aria-hidden="true" className="text-line-strong">·</span>
                <span>{request.company}</span>
              </>
            ) : null}
          </span>
        ) : state === "loading" ? (
          <Skeleton className="mt-1.5 h-4 w-48" />
        ) : undefined
      }
      actions={
        <Link to="/client" className={buttonClass("ghost")}>
          <ArrowRight className="size-4" />
          طلباتي
        </Link>
      }
    >
      <div className="space-y-5 md:space-y-6">
        <VerifyEmailBanner />
        {state === "error" ? (
          <Problem
            icon={AlertCircle}
            title="تعذّر تحميل الطلب"
            body="قد يكون الاتصال ضعيفًا للحظات. طلبك ورسائلك محفوظة لدينا."
            action={
              <Button icon={RotateCw} onClick={onRetry}>
                إعادة المحاولة
              </Button>
            }
          />
        ) : state === "missing" ? (
          <Problem
            icon={SearchX}
            title="لم نجد هذا الطلب في حسابك"
            body="قد يكون الرابط غير صحيح، أو أن الطلب أُرسل من حساب آخر."
            action={
              <Link to="/client" className={buttonClass("primary")}>
                العودة إلى طلباتي
              </Link>
            }
          />
        ) : (
          <div className="grid items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="order-2 min-w-0 lg:order-1">
              <Card className="overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 md:px-6">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-bold text-pine-deep">المحادثة مع فريق ديل</h2>
                    <p className="mt-0.5 text-[12px] text-slate">
                      رسائلك وملفاتك محفوظة مع هذا الطلب، ويراها فريق ديل فقط.
                    </p>
                  </div>
                </header>
                {state === "ready" && request && thread ? (
                  <ThreadPanel
                    side="client"
                    requestId={request.id}
                    initial={thread}
                    load={load}
                    peerName="فريق ديل"
                  />
                ) : (
                  <div className="space-y-4 px-4 py-8 md:px-6" aria-hidden="true">
                    <Skeleton className="h-14 w-2/3 rounded-2xl" />
                    <Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                )}
              </Card>
            </div>

            <aside aria-label="حالة الطلب" className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2">
              {request ? <StatusCard request={request} /> : <Skeleton className="h-48 w-full rounded-2xl" />}
            </aside>
          </div>
        )}
      </div>
    </DashShell>
  );
}

function StatusCard({ request }: { request: ClientRequestDetail }) {
  const [open, setOpen] = useState(false);
  const brief = request.brief.trim();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 md:px-5">
        <ServiceTile slug={request.service_slug} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-pine-deep">{request.service_title}</p>
          <div className="mt-1">
            <StatusPill status={request.status} />
          </div>
        </div>
      </div>
      <div className="px-3 pt-5 pb-4 md:px-4">
        <Stepper current={stepIndex(request.status)} size="sm" />
      </div>
      <p className="border-t border-line bg-paper/60 px-4 py-3 text-[13px] leading-6 text-pine-deep md:px-5">
        {nextStepText(request.status)}
      </p>
      {brief ? (
        <div className="border-t border-line">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-[13px] font-semibold text-pine-deep hover:bg-paper/60 md:px-5"
          >
            تفاصيل الطلب
            <ChevronDown className={cn("size-4 text-slate transition-transform", open && "rotate-180")} />
          </button>
          {open ? (
            <p className="px-4 pb-4 text-[13px] leading-6 whitespace-pre-line text-pine-deep/90 md:px-5">{brief}</p>
          ) : null}
        </div>
      ) : null}
      <div className="border-t border-line px-4 py-3 md:px-5">
        <a
          href={waLink(followUpText(request.id, request.service_title))}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonClass("secondary", "sm"), "w-full")}
        >
          <MessageCircle className="size-3.5" />
          أو تابع على واتساب
        </a>
      </div>
    </Card>
  );
}

function Problem({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof AlertCircle;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div role="alert">
      <Card className="px-5 py-10 text-center md:px-8 md:py-14">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-paper text-pine">
          <Icon className="size-6" />
        </span>
        <h2 className="mt-4 text-[17px] font-bold text-pine-deep">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate">{body}</p>
        <div className="mt-6 flex justify-center">{action}</div>
      </Card>
    </div>
  );
}
