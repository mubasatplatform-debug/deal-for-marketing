import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/dash/ui";
import {
  DEFAULT_KEY_EXPIRY_DAYS,
  KEY_EXPIRY_OPTIONS,
  SCOPE_INFO,
  type KeyExpiryDays,
  type Scope,
} from "@/lib/api/scopes";
import type { ApiKeyRow } from "@/lib/api/keys";
import { cn } from "@/lib/utils";
import { Dialog } from "./dialog";
import { useCopy } from "./use-copy";

type Created = { key: ApiKeyRow; secret: string };
type OnCreate = (name: string, scopes: Scope[], expiresInDays: KeyExpiryDays) => Promise<Created>;

const DEFAULT_SCOPES: Scope[] = ["services:read", "requests:read"];

/**
 * Two steps in one modal: name + scopes, then the one-time reveal of the
 * secret. The reveal step can only be left through its button, so a stray
 * Esc or backdrop click never loses a key that was not copied.
 */
export function CreateKeyDialog({
  grantable,
  onCreate,
  onClose,
}: {
  grantable: Scope[];
  onCreate: OnCreate;
  onClose: () => void;
}) {
  const [created, setCreated] = useState<Created | null>(null);
  if (created) return <RevealStep created={created} onClose={onClose} />;
  return <FormStep grantable={grantable} onCreate={onCreate} onCreated={setCreated} onClose={onClose} />;
}

function FormStep({
  grantable,
  onCreate,
  onCreated,
  onClose,
}: {
  grantable: Scope[];
  onCreate: OnCreate;
  onCreated: (c: Created) => void;
  onClose: () => void;
}) {
  const formId = useId();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<Scope>>(
    () => new Set(DEFAULT_SCOPES.filter((s) => grantable.includes(s))),
  );
  const [expiry, setExpiry] = useState<KeyExpiryDays>(DEFAULT_KEY_EXPIRY_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = SCOPE_INFO.filter((s) => grantable.includes(s.scope));
  const client = available.filter((s) => !s.admin);
  const team = available.filter((s) => s.admin);

  const toggle = (s: Scope) =>
    setScopes((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("اكتب اسمًا يذكّرك أين تستخدم المفتاح.");
    if (scopes.size === 0) return setError("اختر صلاحية واحدة على الأقل.");
    setBusy(true);
    setError(null);
    try {
      onCreated(await onCreate(name.trim(), [...scopes], expiry));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "تعذّر إنشاء المفتاح. حاول مرة أخرى.");
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="مفتاح API جديد"
      description="أعطِ المفتاح أقل صلاحيات يحتاجها تكاملك. تقدر تلغيه في أي وقت."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={busy}>
            {busy ? "جارٍ الإنشاء…" : "إنشاء المفتاح"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor={`${formId}-name`} className="text-[13px] font-bold">
            اسم المفتاح
          </label>
          <input
            id={`${formId}-name`}
            data-autofocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: متجر سلة، Zapier، Claude"
            className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-pine-deep placeholder:text-slate/60 focus:border-pine focus:ring-2 focus:ring-pine/15 focus:outline-none"
          />
        </div>

        <ScopeGroup title="الصلاحيات" items={client} selected={scopes} onToggle={toggle} />
        {team.length ? (
          <ScopeGroup
            title="صلاحيات فريق ديل"
            hint="تعمل فقط ما دام حسابك ضمن الفريق."
            items={team}
            selected={scopes}
            onToggle={toggle}
          />
        ) : null}

        <fieldset>
          <legend className="text-[13px] font-bold">
            مدة الصلاحية
            <span className="ms-2 text-xs font-normal text-slate">بعدها يتوقف المفتاح تلقائيًا.</span>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KEY_EXPIRY_OPTIONS.map((o) => {
              const on = expiry === o.days;
              return (
                <label
                  key={String(o.days)}
                  className={cn(
                    "flex h-10 cursor-pointer items-center justify-center rounded-xl border px-2 text-[13px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine/30",
                    on ? "border-pine bg-pine text-white" : "border-line text-pine-deep hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name={`${formId}-expiry`}
                    checked={on}
                    onChange={() => setExpiry(o.days)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function ScopeGroup({
  title,
  hint,
  items,
  selected,
  onToggle,
}: {
  title: string;
  hint?: string;
  items: typeof SCOPE_INFO;
  selected: Set<Scope>;
  onToggle: (s: Scope) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[13px] font-bold">
        {title}
        {hint ? <span className="ms-2 text-xs font-normal text-slate">{hint}</span> : null}
      </legend>
      <div className="mt-2 space-y-2">
        {items.map((s) => {
          const on = selected.has(s.scope);
          return (
            <label
              key={s.scope}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                on ? "border-pine/40 bg-pine-50/60" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(s.scope)}
                className="mt-0.5 size-[18px] shrink-0 accent-pine"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-pine-deep">{s.label}</span>
                  <ScopeCode scope={s.scope} />
                  {s.write ? (
                    <span className="text-[11px] font-semibold text-lime-600">يعدّل بيانات</span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-slate">{s.body}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ScopeCode({ scope, className }: { scope: string; className?: string }) {
  return (
    <code
      dir="ltr"
      className={cn(
        "inline-block rounded-md bg-paper px-1.5 py-px font-mono text-[11px] leading-5 text-pine ring-1 ring-line ring-inset",
        scope.startsWith("admin:") && "bg-pine text-lime ring-pine",
        className,
      )}
    >
      {scope}
    </code>
  );
}

function RevealStep({ created, onClose }: { created: Created; onClose: () => void }) {
  const { copied, copy } = useCopy();
  const [saved, setSaved] = useState(false);
  const { secret, key } = created;
  const copySecret = async () => {
    if (await copy(secret)) setSaved(true);
  };
  return (
    <Dialog
      title="انسخ مفتاحك الآن"
      description={
        <>
          المفتاح <strong className="text-pine-deep">«{key.name}»</strong> جاهز بالصلاحيات التي اخترتها.
        </>
      }
      onClose={onClose}
      locked
      footer={
        <Button variant={saved ? "primary" : "secondary"} onClick={onClose}>
          {saved ? "نسختُه، إغلاق" : "إغلاق"}
        </Button>
      }
    >
      <div className="flex items-start gap-2.5 rounded-xl bg-lime-50 px-3.5 py-3 text-[13px] leading-relaxed text-pine-deep ring-1 ring-lime/40 ring-inset">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-lime-600" />
        <p>
          <strong>هذه المرة الوحيدة التي يظهر فيها المفتاح كاملًا.</strong> لا نحفظ منه إلا بصمة مشفّرة، فإن ضاع
          ألغِه وأنشئ غيره. عامله ككلمة مرور: لا تضعه في كود الواجهة ولا ترسله في محادثة.
        </p>
      </div>

      <div className="mt-4">
        <p className="text-[13px] font-bold">المفتاح</p>
        <div className="mt-1.5 flex items-stretch gap-2">
          <output
            dir="ltr"
            aria-label="مفتاح API"
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 font-mono text-[13px] leading-6 break-all text-pine-deep select-all"
          >
            {secret}
          </output>
          <Button
            variant={copied ? "secondary" : "primary"}
            icon={copied ? Check : Copy}
            onClick={copySecret}
            className="h-auto shrink-0"
            data-autofocus
          >
            {copied ? "نُسخ" : "نسخ"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-slate">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-pine" />
        <p>
          أرسله في ترويسة <code dir="ltr" className="font-mono text-pine-deep">Authorization: Bearer …</code> مع كل
          طلب إلى الـ API أو خادم MCP. الشرح الكامل في{" "}
          <a href="/developers" target="_blank" rel="noreferrer" className="font-semibold text-pine underline underline-offset-2">
            دليل المطوّرين
          </a>
          .
        </p>
      </div>
    </Dialog>
  );
}
