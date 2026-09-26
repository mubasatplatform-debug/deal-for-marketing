import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronLeft, Plus, Scale } from "lucide-react";
import { Button, Card, EmptyState, Pill, Select } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { CaseFormDialog } from "@/components/law/case-form";
import { sar, shortDateAr } from "@/components/law/format";
import {
  ErrorCard,
  ListSkeleton,
  Pagination,
  SearchInput,
  StagePill,
  lawyersOf,
  useCan,
  useDebounced,
  useLoad,
  useMembers,
} from "@/components/law/kit";
import { CASE_STAGES, CASE_STAGE_LABELS, CASE_TYPES, CASE_TYPE_LABELS, type CaseStage, type CaseType } from "@/lib/law/options";
import { listCases } from "@/lib/law/practice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/cases/")({
  component: Cases,
});

function Cases() {
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const members = lawyersOf(useMembers());
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<CaseStage | "">("");
  const [caseType, setCaseType] = useState<CaseType | "">("");
  const [lawyerId, setLawyerId] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const dq = useDebounced(q.trim());
  const list = useLoad(
    () =>
      listCases({
        data: {
          workspaceId: active.workspace.id,
          q: dq,
          stage: stage || null,
          caseType: caseType || null,
          lawyerId: lawyerId || null,
          page,
        },
      }),
    [active.workspace.id, dq, stage, caseType, lawyerId, page],
  );
  const data = list.data;
  const total = data ? Object.values(data.stages).reduce((s, n) => s + n, 0) : 0;
  const open = data ? total - (data.stages.closed ?? 0) : 0;
  const filtered = Boolean(dq || stage || caseType || lawyerId);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHead
        title="القضايا"
        subtitle={data ? `${open} مفتوحة من ${total}` : "قضايا المكتب ومراحلها"}
        actions={
          allowed("case.create") ? (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              قضية جديدة
            </Button>
          ) : null
        }
      />

      {data ? (
        <div role="group" aria-label="المراحل" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <StageChip label="الكل" count={total} on={stage === ""} onClick={() => reset(() => setStage(""))} />
          {CASE_STAGES.map((s) => (
            <StageChip
              key={s}
              label={CASE_STAGE_LABELS[s]}
              count={data.stages[s] ?? 0}
              on={stage === s}
              onClick={() => reset(() => setStage(stage === s ? "" : s))}
            />
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          label="بحث في القضايا"
          value={q}
          onChange={(v) => reset(() => setQ(v))}
          placeholder="العنوان، العميل، رقم الملف أو رقم المحكمة"
          className="lg:max-w-md lg:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select aria-label="نوع القضية" value={caseType} onChange={(e) => reset(() => setCaseType(e.target.value as CaseType | ""))} className="sm:w-40">
            <option value="">كل الأنواع</option>
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CASE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select aria-label="المحامي" value={lawyerId} onChange={(e) => reset(() => setLawyerId(e.target.value))} className="sm:w-44">
            <option value="">كل المحامين</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {list.error && !data ? (
        <ErrorCard title="تعذّر تحميل القضايا" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          {!data ? (
            <ListSkeleton />
          ) : data.rows.length === 0 ? (
            <EmptyState
              icon={Scale}
              title={filtered ? "لا قضايا مطابقة" : "لا قضايا بعد"}
              body={filtered ? "غيّر التصفية أو كلمة البحث." : "افتح ملف أول قضية: العميل، المحكمة، المرحلة والمحامين المكلفين."}
              action={
                !filtered && allowed("case.create") ? (
                  <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                    قضية جديدة
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <ul className={cn("divide-y divide-line", list.loading && "opacity-60 transition-opacity")}>
                {data.rows.map((k) => {
                  const due = k.fees_halalas !== null && k.paid_halalas !== null ? k.fees_halalas - k.paid_halalas : null;
                  return (
                    <li key={k.id}>
                      <Link
                        to="/app/cases/$id"
                        params={{ id: k.id }}
                        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper md:items-center md:px-6"
                      >
                        <span className="mt-0.5 w-11 shrink-0 font-ui text-[13px] font-bold text-slate tabular-nums md:mt-0">
                          #{k.ref_no}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold">{k.title}</span>
                            {k.is_demo ? (
                              <Pill tone="lime" dot={false} className="shrink-0 px-2 text-[11px]">
                                تجريبي
                              </Pill>
                            ) : null}
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate">
                            <span>{CASE_TYPE_LABELS[k.case_type]}</span>
                            {k.client_name ? <span className="truncate">{k.client_name}</span> : null}
                            {k.court ? <span className="hidden truncate sm:inline">{k.court}</span> : null}
                            {k.lawyers.length ? (
                              <span className="hidden truncate md:inline">{k.lawyers.map((l) => l.name).join("، ")}</span>
                            ) : null}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
                            <StagePill stage={k.stage} />
                            {k.next_hearing ? (
                              <span className="inline-flex items-center gap-1 text-xs text-slate">
                                <CalendarClock className="size-3.5" aria-hidden="true" />
                                {shortDateAr(k.next_hearing)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="hidden w-36 shrink-0 text-xs text-slate md:block">
                          {k.next_hearing ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarClock className="size-3.5 text-pine" aria-hidden="true" />
                              جلسة {shortDateAr(k.next_hearing)}
                            </span>
                          ) : (
                            <span className="text-slate/60">لا جلسات قادمة</span>
                          )}
                        </div>
                        {due !== null ? (
                          <div className="hidden w-28 shrink-0 text-end text-xs lg:block">
                            {due > 0 ? (
                              <>
                                <span className="font-ui font-bold text-pine-deep tabular-nums">{sar(due, 0)}</span>
                                <span className="text-slate"> ر.س متبقٍ</span>
                              </>
                            ) : k.fees_halalas ? (
                              <span className="font-semibold text-lime-600">مسدّدة</span>
                            ) : (
                              <span className="text-slate/60">—</span>
                            )}
                          </div>
                        ) : null}
                        <div className="hidden w-28 shrink-0 justify-end md:flex">
                          <StagePill stage={k.stage} />
                        </div>
                        <ChevronLeft className="mt-1 size-4 shrink-0 text-slate md:mt-0" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
            </>
          )}
        </Card>
      )}

      {adding ? (
        <CaseFormDialog
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            setAdding(false);
            void navigate({ to: "/app/cases/$id", params: { id } });
          }}
        />
      ) : null}
    </>
  );
}

function StageChip({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors",
        on ? "border-pine bg-pine text-snow" : "border-line bg-surface text-pine-deep hover:bg-paper",
      )}
    >
      {label}
      <span className={cn("font-ui text-[12px] tabular-nums", on ? "text-lime" : "text-slate")}>{count}</span>
    </button>
  );
}
