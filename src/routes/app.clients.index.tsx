import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, ChevronLeft, Plus, UserRound } from "lucide-react";
import { Avatar, Button, Card, EmptyState, Pill, Segmented, Select } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { ClientFormDialog } from "@/components/law/client-form";
import { phoneAr } from "@/components/law/format";
import { ErrorCard, ListSkeleton, Pagination, SearchInput, useCan, useDebounced, useLoad } from "@/components/law/kit";
import { CLIENT_KIND_LABELS, type ClientKind } from "@/lib/law/options";
import { listClients } from "@/lib/law/practice";

export const Route = createFileRoute("/app/clients/")({
  component: Clients,
});

function Clients() {
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | ClientKind>("all");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const dq = useDebounced(q.trim());
  const list = useLoad(
    () =>
      listClients({
        data: { workspaceId: active.workspace.id, q: dq, kind: kind === "all" ? null : kind, tag: tag || null, page },
      }),
    [active.workspace.id, dq, kind, tag, page],
  );
  const data = list.data;
  const filtered = Boolean(dq || kind !== "all" || tag);

  return (
    <>
      <PageHead
        title="العملاء"
        subtitle={data ? `${data.total} ${data.total === 1 ? "عميل" : "عملاء"}${filtered ? " مطابقون" : ""}` : "ملفات عملاء المكتب"}
        actions={
          allowed("client.create") ? (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              عميل جديد
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          label="بحث في العملاء"
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="ابحث بالاسم أو الجوال أو البريد أو رقم الهوية"
          className="lg:max-w-md lg:flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="نوع العميل"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "الكل" },
              { value: "individual", label: "أفراد" },
              { value: "company", label: "منشآت" },
            ]}
          />
          {data && data.tags.length > 0 ? (
            <Select
              aria-label="تصفية حسب الوسم"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">كل الوسوم</option>
              {data.tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      {list.error && !data ? (
        <ErrorCard title="تعذّر تحميل العملاء" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          {!data ? (
            <ListSkeleton />
          ) : data.rows.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={filtered ? "لا عملاء مطابقون" : "لا عملاء بعد"}
              body={filtered ? "جرّب كلمة بحث أخرى أو أزل التصفية." : "أضف أول عميل لتبدأ ملفه: قضاياه ومواعيده ومستنداته في مكان واحد."}
              action={
                !filtered && allowed("client.create") ? (
                  <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                    عميل جديد
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <ul className={list.loading ? "divide-y divide-line opacity-60 transition-opacity" : "divide-y divide-line"}>
                {data.rows.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/app/clients/$id"
                      params={{ id: c.id }}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper md:px-6"
                    >
                      {c.kind === "company" ? (
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine-50 text-pine">
                          <Building2 className="size-4" aria-hidden="true" />
                        </span>
                      ) : (
                        <Avatar name={c.name} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{c.name}</span>
                          <span className="hidden text-xs text-slate sm:inline">{CLIENT_KIND_LABELS[c.kind]}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
                          {c.phone ? (
                            <span dir="ltr" className="font-ui">
                              {phoneAr(c.phone)}
                            </span>
                          ) : null}
                          {c.email ? (
                            <span dir="ltr" className="hidden truncate font-ui md:inline">
                              {c.email}
                            </span>
                          ) : null}
                          {c.tags.slice(0, 3).map((t) => (
                            <span key={t} className="rounded-md bg-paper px-1.5 py-px text-[11px] font-semibold text-pine ring-1 ring-line">
                              {t}
                            </span>
                          ))}
                        </p>
                      </div>
                      {c.open_cases > 0 ? (
                        <Pill tone="pine" className="shrink-0">
                          <span className="font-ui tabular-nums">{c.open_cases}</span> {c.open_cases === 1 ? "قضية" : "قضايا"}
                        </Pill>
                      ) : null}
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
        <ClientFormDialog
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            setAdding(false);
            void navigate({ to: "/app/clients/$id", params: { id } });
          }}
        />
      ) : null}
    </>
  );
}
