import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Globe, Plus, Settings2, Video } from "lucide-react";
import { Button, Card, EmptyState, Pill, Segmented, Select } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { AppointmentFormDialog } from "@/components/law/appointment-form";
import { dayAr, shortDateAr, timeAr } from "@/components/law/format";
import {
  ErrorCard,
  ListSkeleton,
  ModePill,
  Pagination,
  SearchInput,
  StatusPill,
  lawyersOf,
  useCan,
  useDebounced,
  useLoad,
  useMembers,
} from "@/components/law/kit";
import { ShareLink } from "@/components/law/share-link";
import { getBookingSettings, listConsultations } from "@/lib/law/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/consultations/")({
  component: Consultations,
});

type View = "upcoming" | "pending" | "past" | "all";

function Consultations() {
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const lawyers = lawyersOf(useMembers());
  const [view, setView] = useState<View>("upcoming");
  const [q, setQ] = useState("");
  const [lawyerId, setLawyerId] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const dq = useDebounced(q.trim());
  const list = useLoad(
    () =>
      listConsultations({
        data: { workspaceId: active.workspace.id, view, q: dq, lawyerId: lawyerId || null, page },
      }),
    [active.workspace.id, view, dq, lawyerId, page],
  );
  const booking = useLoad(() => getBookingSettings({ data: { workspaceId: active.workspace.id } }), [active.workspace.id]);
  const data = list.data;
  const b = booking.data;

  return (
    <>
      <PageHead
        title="الاستشارات"
        subtitle="بالفيديو أو الهاتف أو حضوريًا — من الحجز حتى ملاحظاتك بعد المكالمة"
        actions={
          allowed("consult.manage") ? (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              استشارة جديدة
            </Button>
          ) : null
        }
      />

      {b ? (
        <Card className="mb-4 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-2xl",
                b.settings.bookingEnabled ? "bg-lime text-pine-deep" : "bg-paper text-slate ring-1 ring-line",
              )}
            >
              <Globe className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                صفحة الحجز الإلكتروني
                {b.settings.bookingEnabled ? <Pill tone="lime">مفعّلة</Pill> : <Pill tone="neutral">متوقفة</Pill>}
              </p>
              <p className="mt-0.5 text-[13px] text-slate">
                {b.settings.bookingEnabled
                  ? "شاركها مع عملائك: يختارون نوع الاستشارة والوقت المتاح، وتصلك الطلبات هنا لتأكيدها."
                  : "فعّلها ليحجز العملاء استشاراتهم بأنفسهم من الأوقات المتاحة فعلًا."}
              </p>
              {b.settings.bookingEnabled ? (
                <ShareLink
                  className="mt-3"
                  url={b.bookingUrl}
                  label="رابط صفحة الحجز"
                  message={`احجز استشارتك مع ${active.workspace.name}:`}
                />
              ) : null}
            </div>
            {b.canEdit ? (
              <Link to="/app/settings" hash="booking" className={cn(buttonClass(b.settings.bookingEnabled ? "secondary" : "dark"), "shrink-0")}>
                <Settings2 className="size-4" aria-hidden="true" />
                {b.settings.bookingEnabled ? "إعدادات الحجز" : "تفعيل الحجز"}
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label="عرض"
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(1);
          }}
          options={[
            { value: "upcoming", label: "القادمة" },
            { value: "pending", label: "بانتظار التأكيد", count: data?.pending },
            { value: "past", label: "السابقة" },
            { value: "all", label: "الكل" },
          ]}
        />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
          <SearchInput
            label="بحث في الاستشارات"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="العميل أو الموضوع"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select
            aria-label="المحامي"
            value={lawyerId}
            onChange={(e) => {
              setLawyerId(e.target.value);
              setPage(1);
            }}
            className="sm:w-44"
          >
            <option value="">كل المحامين</option>
            {lawyers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {list.error && !data ? (
        <ErrorCard title="تعذّر تحميل الاستشارات" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          {!data ? (
            <ListSkeleton />
          ) : data.rows.length === 0 ? (
            <EmptyState
              icon={Video}
              title={view === "pending" ? "لا طلبات بانتظار التأكيد" : view === "past" ? "لا استشارات سابقة" : "لا استشارات قادمة"}
              body={view === "upcoming" ? "أضف استشارة، أو شارك صفحة الحجز ليحجز العملاء بأنفسهم." : undefined}
            />
          ) : (
            <>
              <ul className={cn("divide-y divide-line", list.loading && "opacity-60")}>
                {data.rows.map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/app/consultations/$id"
                      params={{ id: a.id }}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper md:gap-4 md:px-6"
                    >
                      <div className="w-14 shrink-0 rounded-xl bg-paper py-1.5 text-center ring-1 ring-line">
                        <p className="text-[10.5px] text-slate">{shortDateAr(a.starts_at)}</p>
                        <p className="font-ui text-[13px] font-bold tabular-nums">{timeAr(a.starts_at).replace(/\s?[صم]$/, "")}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{a.client_name ?? a.lead_name ?? "—"}</span>
                          {!a.client_id && a.lead_name ? (
                            <span className="hidden shrink-0 rounded-md bg-lime-50 px-1.5 text-[11px] font-semibold text-lime-600 ring-1 ring-lime/40 sm:inline">
                              عميل جديد
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate">
                          {a.title}
                          <span className="hidden sm:inline">
                            {" · "}
                            {dayAr(a.starts_at)}
                            {a.lawyer_name ? ` · ${a.lawyer_name}` : ""}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <ModePill mode={a.mode} />
                        <StatusPill status={a.status} />
                      </div>
                      <ChevronLeft className="size-4 shrink-0 text-slate" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
            </>
          )}
        </Card>
      )}

      {adding ? (
        <AppointmentFormDialog
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            setAdding(false);
            void navigate({ to: "/app/consultations/$id", params: { id } });
          }}
        />
      ) : null}
    </>
  );
}
