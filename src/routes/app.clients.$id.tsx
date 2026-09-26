import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  ChevronLeft,
  FilePlus2,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, EmptyState, Pill } from "@/components/dash/ui";
import { useLawApp } from "@/components/law/app-context";
import { AppointmentFormDialog } from "@/components/law/appointment-form";
import { CaseFormDialog } from "@/components/law/case-form";
import { ClientFormDialog } from "@/components/law/client-form";
import { ClientPortalCard } from "@/components/law/client-portal";
import { DocumentRows, UploadDialog } from "@/components/law/documents-ui";
import { dateAr, phoneAr, whenAr } from "@/components/law/format";
import { ConfirmDialog, ErrorCard, InfoRow, ModePill, StagePill, StatusPill, Tabs, useCan, useLoad } from "@/components/law/kit";
import { Timeline } from "@/components/law/timeline";
import { CallButton } from "@/components/law/voice/softphone";
import { CASE_TYPE_LABELS, CLIENT_KIND_LABELS } from "@/lib/law/options";
import { deleteClient, getClient } from "@/lib/law/practice";
import { workspaceErrorMessage } from "@/lib/saas/errors";

export const Route = createFileRoute("/app/clients/$id")({
  component: ClientProfile,
});

type Tab = "cases" | "appointments" | "documents" | "log";

function ClientProfile() {
  const { id } = Route.useParams();
  const { active } = useLawApp();
  const navigate = useNavigate();
  const allowed = useCan();
  const [tab, setTab] = useState<Tab>("cases");
  const [dialog, setDialog] = useState<null | "edit" | "case" | "appointment" | "upload" | "delete">(null);
  const res = useLoad(() => getClient({ data: { workspaceId: active.workspace.id, id } }), [active.workspace.id, id]);
  const p = res.data;

  if (res.error && !p) {
    return (
      <>
        <BackLink />
        <ErrorCard title="تعذّر فتح ملف العميل" message={res.error} onRetry={() => void res.reload()} />
      </>
    );
  }
  if (!p) {
    return (
      <>
        <BackLink />
        <Card className="h-64 animate-pulse bg-pine-50/40">
          <span className="sr-only">جارٍ التحميل…</span>
        </Card>
      </>
    );
  }
  const c = p.client;
  const picked = { id: c.id, name: c.name };
  const wa = c.phone ? c.phone.replace(/^\+/, "") : null;

  return (
    <>
      <BackLink />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Card className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              {c.kind === "company" ? (
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-pine-50 text-pine">
                  <Building2 className="size-6" aria-hidden="true" />
                </span>
              ) : (
                <Avatar name={c.name} className="size-14 text-lg" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl leading-snug font-extrabold break-words">{c.name}</h1>
                <p className="mt-1 text-[13px] text-slate">
                  {CLIENT_KIND_LABELS[c.kind]} · عميل منذ {dateAr(c.created_at)}
                </p>
              </div>
            </div>
            {c.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Pill key={t} tone="pine" dot={false}>
                    {t}
                  </Pill>
                ))}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {c.phone ? (
                <CallButton
                  phone={c.phone}
                  label={c.name}
                  clientId={c.id}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-[13px] font-semibold hover:bg-paper"
                />
              ) : null}
              {wa ? (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-[13px] font-semibold hover:bg-paper"
                >
                  <MessageCircle className="size-4 text-pine" aria-hidden="true" />
                  واتساب
                </a>
              ) : null}
              {c.email ? (
                <a href={`mailto:${c.email}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-[13px] font-semibold hover:bg-paper">
                  <Mail className="size-4 text-pine" aria-hidden="true" />
                  بريد
                </a>
              ) : null}
            </div>
            <dl className="mt-5 divide-y divide-line border-t border-line">
              <InfoRow k="الجوال" v={<span dir="ltr" className="font-ui">{phoneAr(c.phone)}</span>} />
              <InfoRow k="البريد" v={<span dir="ltr" className="font-ui text-[13px]">{c.email ?? "—"}</span>} />
              <InfoRow
                k={c.kind === "company" ? "السجل التجاري" : "الهوية / الإقامة"}
                v={<span className="font-ui">{c.id_number ?? "—"}</span>}
              />
              <InfoRow k="قضايا مفتوحة" v={<span className="font-ui">{c.open_cases}</span>} />
            </dl>
            {c.notes ? (
              <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-pine-deep ring-1 ring-line">
                {c.notes}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {allowed("client.edit") ? (
                <Button icon={Pencil} size="sm" onClick={() => setDialog("edit")}>
                  تعديل
                </Button>
              ) : null}
              {allowed("client.delete") ? (
                <Button icon={Trash2} size="sm" variant="ghost" onClick={() => setDialog("delete")} className="hover:bg-red-50 hover:text-red-700">
                  حذف
                </Button>
              ) : null}
            </div>
          </Card>
          <ClientPortalCard clientId={c.id} clientName={c.name} />
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {allowed("case.create") ? (
              <QuickAction icon={Scale} label="قضية جديدة" onClick={() => setDialog("case")} />
            ) : null}
            {allowed("consult.manage") ? (
              <QuickAction icon={CalendarPlus} label="موعد أو استشارة" onClick={() => setDialog("appointment")} />
            ) : null}
            {allowed("document.upload") ? (
              <QuickAction icon={Upload} label="رفع مستند" onClick={() => setDialog("upload")} />
            ) : null}
          </div>
          <Card className="overflow-hidden">
            <Tabs
              label="ملف العميل"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "cases", label: "القضايا", count: p.cases.length },
                { value: "appointments", label: "المواعيد", count: p.appointments.length },
                { value: "documents", label: "المستندات", count: p.documents.length },
                { value: "log", label: "السجل" },
              ]}
            />
            {tab === "cases" ? (
              p.cases.length === 0 ? (
                <EmptyState icon={Scale} title="لا قضايا لهذا العميل" body="افتح ملف قضية لتتابع مراحلها وجلساتها ومهامها." />
              ) : (
                <ul className="divide-y divide-line">
                  {p.cases.map((k) => (
                    <li key={k.id}>
                      <Link to="/app/cases/$id" params={{ id: k.id }} className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper md:px-6">
                        <span className="w-12 shrink-0 font-ui text-[13px] font-bold text-slate tabular-nums">#{k.ref_no}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{k.title}</p>
                          <p className="text-xs text-slate">{CASE_TYPE_LABELS[k.case_type]}</p>
                        </div>
                        <StagePill stage={k.stage} />
                        <ChevronLeft className="size-4 shrink-0 text-slate" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {tab === "appointments" ? (
              p.appointments.length === 0 ? (
                <EmptyState icon={CalendarPlus} title="لا مواعيد" body="المواعيد والاستشارات مع هذا العميل تظهر هنا." />
              ) : (
                <ul className="divide-y divide-line">
                  {p.appointments.map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/app/consultations/$id"
                        params={{ id: a.id }}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-paper md:px-6"
                      >
                        <div className="min-w-0 flex-1 basis-48">
                          <p className="truncate text-sm font-bold">{a.title || (a.kind === "consultation" ? "استشارة" : "موعد")}</p>
                          <p className="text-xs text-slate">
                            {whenAr(a.starts_at)}
                            {a.lawyer_name ? ` · ${a.lawyer_name}` : ""}
                          </p>
                        </div>
                        {a.kind === "consultation" ? <ModePill mode={a.mode} /> : null}
                        <StatusPill status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {tab === "documents" ? (
              p.documents.length === 0 ? (
                <EmptyState icon={FileText} title="لا مستندات" body="ارفع العقود والوكالات والمذكرات الخاصة بالعميل." />
              ) : (
                <DocumentRows rows={p.documents} onChanged={() => void res.reload()} />
              )
            ) : null}
            {tab === "log" ? (
              <Timeline
                target={{ clientId: c.id }}
                notes={p.notes}
                onChanged={() => void res.reload()}
                extras={[
                  ...p.cases.map((k) => ({ id: `case-${k.id}`, at: k.updated_at, icon: Scale, body: `قضية #${k.ref_no}: ${k.title}` })),
                  ...p.documents.map((d) => ({ id: `doc-${d.id}`, at: d.created_at, icon: FilePlus2, body: `رُفع مستند: ${d.name}` })),
                  ...p.appointments.map((a) => ({
                    id: `ap-${a.id}`,
                    at: a.created_at,
                    icon: CalendarPlus,
                    body: `${a.kind === "consultation" ? "استشارة" : "موعد"} بتاريخ ${whenAr(a.starts_at)}`,
                  })),
                ]}
              />
            ) : null}
          </Card>
        </div>
      </div>

      {dialog === "edit" ? (
        <ClientFormDialog
          client={c}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "case" ? (
        <CaseFormDialog
          presetClient={picked}
          onClose={() => setDialog(null)}
          onSaved={(caseId) => {
            setDialog(null);
            void navigate({ to: "/app/cases/$id", params: { id: caseId } });
          }}
        />
      ) : null}
      {dialog === "appointment" ? (
        <AppointmentFormDialog
          presetClient={picked}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            setTab("appointments");
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "upload" ? (
        <UploadDialog
          presetClient={picked}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setTab("documents");
            void res.reload();
          }}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title="حذف العميل؟"
          body={
            p.cases.length || p.documents.length
              ? "لا يمكن حذف عميل له قضايا أو مستندات. احذفها أو انقلها أولًا."
              : `سيُحذف ملف «${c.name}» وسجل ملاحظاته نهائيًا. تبقى مواعيده السابقة دون ربط بعميل.`
          }
          confirmLabel="حذف نهائيًا"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await deleteClient({ data: { workspaceId: active.workspace.id, id: c.id } });
              toast.success("حُذف العميل");
              void navigate({ to: "/app/clients" });
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
              setDialog(null);
            }
          }}
        />
      ) : null}
    </>
  );
}

function BackLink() {
  return (
    <Link to="/app/clients" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-pine-deep">
      <ArrowRight className="size-4" aria-hidden="true" />
      العملاء
    </Link>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Scale; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-sm font-bold shadow-[0_1px_2px_rgba(16,38,40,0.04)] transition-colors hover:border-pine/30 hover:bg-paper"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-lime-50 text-lime-600">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      {label}
    </button>
  );
}

