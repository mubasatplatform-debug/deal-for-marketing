import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, FileText, Folder, FolderOpen, HardDrive, Inbox, Layers, Upload } from "lucide-react";
import { Button, Card, EmptyState, Select } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { DocumentRows, UploadDialog } from "@/components/law/documents-ui";
import { ErrorCard, ListSkeleton, Pagination, SearchInput, useCan, useDebounced, useLoad } from "@/components/law/kit";
import { getDocumentFolders, listDocuments } from "@/lib/law/documents";
import { formatBytes } from "@/lib/files/validate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/documents")({
  component: Documents,
});

type Scope =
  | { kind: "all" }
  | { kind: "unfiled" }
  | { kind: "client"; id: string; name: string }
  | { kind: "case"; id: string; name: string; clientName: string };

function Documents() {
  const { active } = useLawApp();
  const allowed = useCan();
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const dq = useDebounced(q.trim());
  const folders = useLoad(() => getDocumentFolders({ data: { workspaceId: active.workspace.id } }), [active.workspace.id]);
  const list = useLoad(
    () =>
      listDocuments({
        data: {
          workspaceId: active.workspace.id,
          q: dq,
          clientId: scope.kind === "client" ? scope.id : null,
          caseId: scope.kind === "case" ? scope.id : null,
          unfiled: scope.kind === "unfiled",
          page,
        },
      }),
    [active.workspace.id, dq, scope, page],
  );
  const data = list.data;
  const f = folders.data;
  const pick = (s: Scope) => {
    setScope(s);
    setPage(1);
  };
  const reloadAll = () => {
    void list.reload();
    void folders.reload();
  };
  const scopeTitle =
    scope.kind === "all"
      ? "كل المستندات"
      : scope.kind === "unfiled"
        ? "غير مصنفة"
        : scope.kind === "client"
          ? scope.name
          : `${scope.clientName} ← ${scope.name}`;
  const usage = data?.usage;
  const pct = usage ? Math.min(100, (usage.used / usage.quota) * 100) : 0;

  return (
    <>
      <PageHead
        title="المستندات"
        subtitle="ملفات المكتب مرتبة حسب العميل والقضية"
        actions={
          allowed("document.upload") ? (
            <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>
              رفع مستندات
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* Phones: a simple folder select. */}
          <div className="lg:hidden">
            <Select
              aria-label="المجلد"
              value={scope.kind === "client" || scope.kind === "case" ? `${scope.kind}:${scope.id}` : scope.kind}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all" || v === "unfiled") return pick({ kind: v });
                const [kind, id] = v.split(":");
                for (const fo of f?.folders ?? []) {
                  if (kind === "client" && fo.id === id) return pick({ kind: "client", id, name: fo.name });
                  const c = fo.cases.find((x) => x.id === id);
                  if (kind === "case" && c) return pick({ kind: "case", id, name: `#${c.ref_no} ${c.title}`, clientName: fo.name || "بدون عميل" });
                }
              }}
              className="w-full"
            >
              <option value="all">كل المستندات ({f?.total ?? 0})</option>
              {f?.unfiled ? <option value="unfiled">غير مصنفة ({f.unfiled})</option> : null}
              {f?.folders.map((fo) => (
                <optgroup key={fo.id} label={fo.name || "قضايا بدون عميل"}>
                  {fo.name ? <option value={`client:${fo.id}`}>{fo.name} — الكل ({fo.count})</option> : null}
                  {fo.cases.map((c) => (
                    <option key={c.id} value={`case:${c.id}`}>
                      #{c.ref_no} {c.title} ({c.count})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <Card className="hidden p-2 lg:block">
            <FolderButton icon={Layers} label="كل المستندات" count={f?.total} on={scope.kind === "all"} onClick={() => pick({ kind: "all" })} />
            {f?.unfiled ? (
              <FolderButton icon={Inbox} label="غير مصنفة" count={f.unfiled} on={scope.kind === "unfiled"} onClick={() => pick({ kind: "unfiled" })} />
            ) : null}
            {f && f.folders.length ? <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate">العملاء</p> : null}
            {f?.folders.map((fo) => {
              const open = openFolders.has(fo.id) || (scope.kind === "case" && fo.cases.some((c) => c.id === scope.id));
              return (
                <div key={fo.id}>
                  <div className="flex items-center">
                    {fo.cases.length ? (
                      <button
                        type="button"
                        aria-label={open ? "طي" : "توسيع"}
                        aria-expanded={open}
                        onClick={() =>
                          setOpenFolders((s) => {
                            const n = new Set(s);
                            if (n.has(fo.id)) n.delete(fo.id);
                            else n.add(fo.id);
                            return n;
                          })
                        }
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-slate hover:bg-paper"
                      >
                        <ChevronDown className={cn("size-4 transition-transform", !open && "rotate-90")} />
                      </button>
                    ) : (
                      <span className="size-8 shrink-0" />
                    )}
                    {fo.name ? (
                      <FolderButton
                        icon={open ? FolderOpen : Folder}
                        label={fo.name}
                        count={fo.count}
                        on={scope.kind === "client" && scope.id === fo.id}
                        onClick={() => pick({ kind: "client", id: fo.id, name: fo.name })}
                      />
                    ) : (
                      <p className="flex h-9 flex-1 items-center px-2 text-[13px] text-slate">قضايا بدون عميل</p>
                    )}
                  </div>
                  {open
                    ? fo.cases.map((c) => (
                        <div key={c.id} className="ps-8">
                          <FolderButton
                            icon={FileText}
                            label={`#${c.ref_no} ${c.title}`}
                            count={c.count}
                            small
                            on={scope.kind === "case" && scope.id === c.id}
                            onClick={() => pick({ kind: "case", id: c.id, name: `#${c.ref_no} ${c.title}`, clientName: fo.name || "بدون عميل" })}
                          />
                        </div>
                      ))
                    : null}
                </div>
              );
            })}
          </Card>

          {usage ? (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold">
                <HardDrive className="size-4 text-pine" aria-hidden="true" />
                مساحة التخزين
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-pine-50" aria-hidden="true">
                <div className={cn("h-full rounded-full", pct > 90 ? "bg-red-500" : "bg-lime")} style={{ width: `${Math.max(pct, usage.used ? 1 : 0)}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate">
                <span className="font-ui">{formatBytes(usage.used)}</span> من <span className="font-ui">{formatBytes(usage.quota)}</span> في خطتك
              </p>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="truncate text-[15px] font-bold">{scopeTitle}</h2>
            <SearchInput
              label="بحث في المستندات"
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="ابحث باسم الملف"
              className="sm:w-72"
            />
          </div>
          {list.error && !data ? (
            <ErrorCard title="تعذّر تحميل المستندات" message={list.error} onRetry={() => void list.reload()} />
          ) : (
            <Card className="overflow-hidden">
              {!data ? (
                <ListSkeleton />
              ) : data.rows.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={dq ? "لا ملفات بهذا الاسم" : "لا مستندات هنا بعد"}
                  body={dq ? undefined : "ارفع العقود والوكالات والمذكرات، واربطها بالعميل أو القضية لتجدها في ملفه."}
                  action={
                    !dq && allowed("document.upload") ? (
                      <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>
                        رفع مستندات
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <>
                  <div className={cn(list.loading && "opacity-60")}>
                    <DocumentRows rows={data.rows} onChanged={reloadAll} showLinks={scope.kind !== "case"} />
                  </div>
                  <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      {uploading ? (
        <UploadDialog
          presetClient={scope.kind === "client" ? { id: scope.id, name: scope.name } : null}
          presetCase={scope.kind === "case" ? { id: scope.id, label: scope.name } : null}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            reloadAll();
          }}
        />
      ) : null}
    </>
  );
}

function FolderButton({
  icon: Icon,
  label,
  count,
  on,
  small,
  onClick,
}: {
  icon: typeof Folder;
  label: string;
  count?: number;
  on: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-start transition-colors",
        small ? "h-8 text-[12.5px]" : "h-9 text-[13px]",
        on ? "bg-pine-50 font-bold text-pine-deep" : "text-pine-deep hover:bg-paper",
      )}
    >
      <Icon className={cn("size-4 shrink-0", on ? "text-pine" : "text-slate")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="font-ui text-[11px] text-slate tabular-nums">{count}</span> : null}
    </button>
  );
}
