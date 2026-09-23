import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Loader2, Mail, MailCheck, RotateCw, Send, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, EmptyState, Pill, Skeleton } from "@/components/dash/ui";
import { Dialog } from "@/components/keys/dialog";
import { useCopy } from "@/components/keys/use-copy";
import { PageHead } from "@/components/law/app-frame";
import { useLawApp } from "@/components/law/app-context";
import { Field, SelectInput, TextInput } from "@/components/law/fields";
import { dateAr } from "@/components/law/format";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { INVITE_ROLES, ROLES, ROLE_HINTS, ROLE_LABELS, type InviteRole, type Role } from "@/lib/saas/lifecycle";
import {
  changeMemberRole,
  getTeam,
  inviteMember,
  removeMember,
  revokeInvite,
  type TeamView,
} from "@/lib/saas/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/team")({
  component: Team,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Team() {
  const { active } = useLawApp();
  const wsId = active.workspace.id;
  const [team, setTeam] = useState<TeamView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<{ email: string; role: InviteRole } | null>(null);
  const [confirm, setConfirm] = useState<{ userId: string; name: string; self: boolean } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTeam(await getTeam({ data: { workspaceId: wsId } }));
    } catch (err) {
      setError(workspaceErrorMessage(err));
    }
  }, [wsId]);

  useEffect(() => {
    void load();
  }, [load]);

  const manager = active.role === "owner" || active.role === "admin";
  const readOnly = active.lifecycle.readOnly;
  const full = team ? team.seats.used >= team.seats.limit : false;

  async function onRole(userId: string, role: Role) {
    try {
      await changeMemberRole({ data: { workspaceId: wsId, userId, role } });
      toast.success("تم تحديث الصلاحية");
      await load();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
      await load();
    }
  }

  async function onRevoke(inviteId: string) {
    try {
      await revokeInvite({ data: { workspaceId: wsId, inviteId } });
      toast.success("أُلغيت الدعوة");
      await load();
    } catch (err) {
      toast.error(workspaceErrorMessage(err));
    }
  }

  return (
    <>
      <PageHead
        title="الفريق"
        subtitle={
          team
            ? `${team.seats.members} ${team.seats.members === 1 ? "عضو" : "أعضاء"} · ${team.seats.used} من ${team.seats.limit} مقاعد مستخدمة`
            : "أعضاء المكتب وصلاحياتهم"
        }
        actions={
          manager ? (
            <Button
              variant="primary"
              icon={UserPlus}
              disabled={!team || readOnly || full}
              onClick={() => setInviting({ email: "", role: "lawyer" })}
            >
              دعوة عضو
            </Button>
          ) : null
        }
      />

      {error ? (
        <Card>
          <EmptyState
            icon={Users}
            title="تعذّر تحميل الفريق"
            body={error}
            action={
              <Button icon={RotateCw} onClick={() => void load()}>
                إعادة المحاولة
              </Button>
            }
          />
        </Card>
      ) : !team ? (
        <Card className="space-y-4 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader title="الأعضاء" description="من يعمل في المكتب وبأي صلاحية" />
              <ul className="mt-3 divide-y divide-line">
                {team.members.map((m) => {
                  const isMe = m.user_id === team.me;
                  // Only an owner changes owners; admins manage everyone else.
                  const canEdit = manager && !readOnly && (active.role === "owner" || m.role !== "owner");
                  const roleOptions = ROLES.filter((r) => r !== "owner" || active.role === "owner");
                  return (
                    <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-6">
                      <Avatar name={m.name || m.email} />
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="flex items-center gap-2 truncate text-sm font-bold">
                          <span className="truncate">{m.name || m.email}</span>
                          {isMe ? (
                            <Pill tone="pine" dot={false}>
                              أنت
                            </Pill>
                          ) : null}
                        </p>
                        <p className="truncate font-ui text-xs text-slate" dir="ltr" style={{ textAlign: "right" }}>
                          {m.email}
                        </p>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        {canEdit ? (
                          <div className="flex-1 sm:w-40 sm:flex-none">
                            <SelectInput
                              aria-label={`صلاحية ${m.name || m.email}`}
                              value={m.role}
                              onChange={(e) => void onRole(m.user_id, e.target.value as Role)}
                              className="[&_select]:h-10 [&_select]:text-[13px] [&_select]:font-semibold"
                            >
                              {roleOptions.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </SelectInput>
                          </div>
                        ) : (
                          <Pill tone={m.role === "owner" ? "lime" : "neutral"} dot={false} className="h-8 px-3">
                            {ROLE_LABELS[m.role]}
                          </Pill>
                        )}
                        {(canEdit && !isMe) || isMe ? (
                          <button
                            type="button"
                            aria-label={isMe ? "مغادرة المكتب" : `إزالة ${m.name || m.email}`}
                            title={isMe ? "مغادرة المكتب" : "إزالة من المكتب"}
                            onClick={() => setConfirm({ userId: m.user_id, name: m.name || m.email, self: isMe })}
                            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-slate hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {manager ? (
              <Card>
                <CardHeader
                  title="دعوات بانتظار القبول"
                  description="تحجز كل دعوة مقعدًا حتى تُقبل أو تُلغى أو تنتهي بعد ٧ أيام"
                />
                {team.invites.length === 0 ? (
                  <p className="px-5 pt-3 pb-6 text-sm text-slate md:px-6">لا دعوات معلّقة.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {team.invites.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-6">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-slate ring-1 ring-line">
                          <Mail className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate font-ui text-sm font-bold" dir="ltr" style={{ textAlign: "right" }}>
                            {i.email}
                          </p>
                          <p className="text-xs text-slate">
                            {ROLE_LABELS[i.role]} · تنتهي {dateAr(i.expires_at)}
                          </p>
                        </div>
                        {!readOnly ? (
                          <div className="flex gap-2">
                            <Button size="sm" icon={Send} onClick={() => setInviting({ email: i.email, role: i.role })}>
                              إعادة الإرسال
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void onRevoke(i.id)}>
                              إلغاء
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="p-5 md:p-6">
              <p className="text-[13px] font-semibold text-slate">المقاعد</p>
              <p className="mt-2 font-ui text-[28px] leading-none font-bold tabular-nums">
                {team.seats.used}
                <span className="text-lg text-slate"> / {team.seats.limit}</span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-pine-50">
                <div
                  className={cn("h-full rounded-full", full ? "bg-pine" : "bg-lime")}
                  style={{ width: `${Math.min(100, (team.seats.used / team.seats.limit) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-slate">
                {full
                  ? "وصلت إلى حد مقاعد خطتك. رقِّ الخطة لإضافة أعضاء آخرين."
                  : `يمكنك إضافة ${team.seats.limit - team.seats.used} ${team.seats.limit - team.seats.used === 1 ? "عضو" : "أعضاء"} آخرين في خطتك الحالية.`}
              </p>
              {full && manager ? (
                <Link to="/app/billing" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-pine hover:underline">
                  ترقية الخطة
                </Link>
              ) : null}
            </Card>
            <Card className="p-5 md:p-6">
              <p className="text-[15px] font-bold">الصلاحيات</p>
              <dl className="mt-3 space-y-3">
                {ROLES.map((r) => (
                  <div key={r}>
                    <dt className="text-sm font-bold">{ROLE_LABELS[r]}</dt>
                    <dd className="text-[13px] leading-relaxed text-slate">{ROLE_HINTS[r]}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </div>
      )}

      {inviting ? (
        <InviteDialog
          workspaceId={wsId}
          initial={inviting}
          onClose={() => setInviting(null)}
          onSent={() => void load()}
        />
      ) : null}

      {confirm ? (
        <ConfirmRemove
          name={confirm.name}
          self={confirm.self}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await removeMember({ data: { workspaceId: wsId, userId: confirm.userId } });
              if (confirm.self) {
                window.location.assign("/app");
                return;
              }
              toast.success("أُزيل العضو من المكتب");
              setConfirm(null);
              await load();
            } catch (err) {
              toast.error(workspaceErrorMessage(err));
              setConfirm(null);
            }
          }}
        />
      ) : null}
    </>
  );
}

function InviteDialog({
  workspaceId,
  initial,
  onClose,
  onSent,
}: {
  workspaceId: string;
  initial: { email: string; role: InviteRole };
  onClose: () => void;
  onSent: () => void;
}) {
  const uid = useId();
  const [email, setEmail] = useState(initial.email);
  const [role, setRole] = useState<InviteRole>(initial.role);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const { copied, copy } = useCopy();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setErr("اكتب بريدًا صحيحًا، مثال: name@office.sa");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await inviteMember({ data: { workspaceId, email: clean, role } });
      setResult(r);
      onSent();
    } catch (error) {
      setErr(workspaceErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Dialog
        title="الدعوة جاهزة"
        description={
          result.emailed
            ? `أرسلنا رابط الانضمام إلى ${email.trim().toLowerCase()}. يمكنك أيضًا نسخه وإرساله بنفسك.`
            : "لم نتمكن من إرسال البريد الآن. انسخ الرابط وأرسله للعضو عبر واتساب أو البريد."
        }
        onClose={onClose}
        footer={
          <Button variant="dark" onClick={onClose}>
            تم
          </Button>
        }
      >
        <div className="flex items-center gap-2 rounded-xl border border-line bg-paper p-2">
          <code dir="ltr" className="min-w-0 flex-1 truncate px-2 font-ui text-xs text-pine-deep">
            {result.url}
          </code>
          <Button size="sm" variant="primary" icon={copied ? Check : Copy} onClick={() => void copy(result.url)}>
            {copied ? "نُسخ" : "نسخ الرابط"}
          </Button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-slate">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-pine" aria-hidden="true" />
          يصلح الرابط لمرة واحدة خلال ٧ أيام، ويطلب من العضو الدخول بنفس البريد المدعو.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="دعوة عضو إلى المكتب"
      description="يصله رابط انضمام بالبريد، ويدخل بنفس البريد ليقبل الدعوة."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit" form={`${uid}-form`} disabled={busy} icon={busy ? Loader2 : Send}>
            {busy ? "جارٍ الإرسال…" : "إرسال الدعوة"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate className="space-y-5">
        <Field id={`${uid}-email`} label="البريد الإلكتروني" error={err ?? undefined}>
          <TextInput
            id={`${uid}-email`}
            data-autofocus
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@office.sa"
            invalid={Boolean(err)}
            className="text-left font-ui"
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">الصلاحية</legend>
          <div className="grid gap-2">
            {INVITE_ROLES.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  role === r ? "border-pine bg-pine-50/60" : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name={`${uid}-role`}
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-1 size-4 accent-[var(--color-pine)]"
                />
                <span>
                  <span className="block text-sm font-bold">{ROLE_LABELS[r]}</span>
                  <span className="block text-[13px] text-slate">{ROLE_HINTS[r]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function ConfirmRemove({
  name,
  self,
  onClose,
  onConfirm,
}: {
  name: string;
  self: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      size="sm"
      title={self ? "مغادرة المكتب؟" : `إزالة ${name}؟`}
      description={
        self
          ? "ستفقد الوصول إلى هذا المكتب فورًا، ويمكن دعوتك لاحقًا من جديد."
          : "يفقد الوصول إلى المكتب فورًا. لا تُحذف أي بيانات أضافها."
      }
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            تراجع
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onConfirm().finally(() => setBusy(false));
            }}
          >
            {busy ? "جارٍ التنفيذ…" : self ? "مغادرة" : "إزالة"}
          </Button>
        </>
      }
    >
      <span className="sr-only">تأكيد</span>
    </Dialog>
  );
}
