import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";
import { Button, Card, EmptyState, Segmented } from "@/components/dash/ui";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { ErrorCard, ListSkeleton, useCan, useLoad } from "@/components/law/kit";
import { TaskFormDialog, TaskItem } from "@/components/law/tasks-ui";
import { listTasks } from "@/lib/law/practice";

export const Route = createFileRoute("/app/tasks")({
  component: Tasks,
});

type Scope = "mine" | "today" | "overdue" | "all";

const EMPTY: Record<Scope, string> = {
  mine: "لا مهام مسندة إليك. استمتع بيومك!",
  today: "لا مهام مستحقة اليوم.",
  overdue: "لا مهام متأخرة. عمل رائع.",
  all: "لا مهام في المكتب بعد.",
};

function Tasks() {
  const { active } = useLawApp();
  const allowed = useCan();
  const [scope, setScope] = useState<Scope>("mine");
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const list = useLoad(
    () => listTasks({ data: { workspaceId: active.workspace.id, scope, includeDone: showDone } }),
    [active.workspace.id, scope, showDone],
  );

  return (
    <>
      <PageHead
        title="المهام"
        subtitle="ما على الفريق إنجازه، مرتبطًا بالقضايا أو مستقلًا"
        actions={
          allowed("task.create") ? (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              مهمة جديدة
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="عرض المهام"
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: "مهامي" },
            { value: "today", label: "اليوم" },
            { value: "overdue", label: "متأخرة" },
            { value: "all", label: "كل المكتب" },
          ]}
        />
        <label className="flex min-h-10 items-center gap-2 text-[13px] font-semibold text-slate">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--color-pine)]" />
          إظهار المنجزة
        </label>
      </div>
      {list.error && !list.data ? (
        <ErrorCard title="تعذّر تحميل المهام" message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <Card className="overflow-hidden">
          {!list.data ? (
            <ListSkeleton />
          ) : list.data.length === 0 ? (
            <EmptyState icon={ListChecks} title={EMPTY[scope]} />
          ) : (
            <ul className="divide-y divide-line">
              {list.data.map((t) => (
                <TaskItem key={t.id} task={t} onChanged={() => void list.reload()} />
              ))}
            </ul>
          )}
        </Card>
      )}
      {adding ? (
        <TaskFormDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void list.reload();
          }}
        />
      ) : null}
    </>
  );
}
