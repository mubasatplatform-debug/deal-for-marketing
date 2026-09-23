import { useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Num, Pill, Skeleton } from "@/components/dash/ui";
import { formatAbsolute, formatRelative } from "@/components/admin/format";
import type { ApiKeyRow } from "@/lib/api/keys";
import { MAX_ACTIVE_KEYS } from "@/lib/api/scopes";
import { cn } from "@/lib/utils";
import { ScopeCode } from "./create-dialog";
import { Dialog } from "./dialog";

export function lastUsedText(iso: string | null, now: number) {
  return iso ? formatRelative(new Date(iso), now) : "لم يُستخدم بعد";
}

/** The owner's keys: prefix, scopes, usage, and a confirmed revoke. */
export function KeyList({
  keys,
  loading,
  now,
  onNew,
  onRevoke,
  title = "مفاتيحك",
}: {
  keys: ApiKeyRow[];
  loading?: boolean;
  now: number;
  onNew: () => void;
  onRevoke: (key: ApiKeyRow) => Promise<void>;
  title?: string;
}) {
  const [confirm, setConfirm] = useState<ApiKeyRow | null>(null);
  const active = keys.filter((k) => !k.revoked_at);
  const atLimit = active.length >= MAX_ACTIVE_KEYS;

  return (
    <Card>
      <CardHeader
        title={title}
        description={
          loading ? (
            <Skeleton className="mt-1 h-4 w-40" />
          ) : (
            <>
              <Num>{active.length}</Num> من <Num>{MAX_ACTIVE_KEYS}</Num> مفاتيح فعّالة
            </>
          )
        }
        actions={
          keys.length ? (
            <Button size="sm" icon={Plus} onClick={onNew} disabled={atLimit} title={atLimit ? "ألغِ مفتاحًا أولًا" : undefined}>
              مفتاح جديد
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="space-y-3 px-5 py-5 md:px-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="لا مفاتيح بعد"
          body="أنشئ مفتاحًا لتربط متجرك أو أداة الأتمتة أو مساعد الذكاء الاصطناعي بحسابك في ديل."
          action={
            <Button variant="primary" icon={Plus} onClick={onNew}>
              أنشئ أول مفتاح
            </Button>
          }
        />
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {keys.map((k) => (
            <KeyItem key={k.id} k={k} now={now} onRevoke={() => setConfirm(k)} />
          ))}
        </ul>
      )}

      {confirm ? (
        <RevokeDialog
          k={confirm}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await onRevoke(confirm);
            setConfirm(null);
          }}
        />
      ) : null}
    </Card>
  );
}

function KeyItem({ k, now, onRevoke }: { k: ApiKeyRow; now: number; onRevoke: () => void }) {
  const revoked = !!k.revoked_at;
  return (
    <li
      className={cn(
        "grid gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:px-6",
        revoked && "bg-paper/60",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm font-bold", revoked ? "text-slate" : "text-pine-deep")}>{k.name}</p>
          {revoked ? (
            <Pill tone="danger" dot={false}>
              ملغى
            </Pill>
          ) : null}
        </div>
        <p className="mt-1">
          <code dir="ltr" className="inline-block font-mono text-xs text-slate">
            <span className={cn(revoked && "line-through")}>{k.prefix}</span>
            <span aria-hidden="true" className="text-slate/50">
              ••••••
            </span>
          </code>
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {k.scopes.map((s) => (
          <ScopeCode key={s} scope={s} className={cn(revoked && "opacity-50")} />
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-1 md:gap-1">
        <div className="flex gap-1.5">
          <dt className="text-slate">آخر استخدام:</dt>
          <dd className="font-semibold text-pine-deep">
            {revoked ? (
              <span title={formatAbsolute(new Date(k.revoked_at!))}>أُلغي {formatRelative(new Date(k.revoked_at!), now)}</span>
            ) : (
              <span title={k.last_used_at ? formatAbsolute(new Date(k.last_used_at)) : undefined}>
                {lastUsedText(k.last_used_at, now)}
              </span>
            )}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-slate">استدعاءات 7 أيام:</dt>
          <dd>
            <Num className="font-semibold text-pine-deep">{k.calls_7d}</Num>
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <p className="text-xs text-slate md:hidden" title={formatAbsolute(new Date(k.created_at))}>
          أُنشئ {formatRelative(new Date(k.created_at), now)}
        </p>
        {revoked ? null : (
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={onRevoke}
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
            aria-label={`إلغاء المفتاح ${k.name}`}
          >
            إلغاء
          </Button>
        )}
      </div>
    </li>
  );
}

function RevokeDialog({
  k,
  onClose,
  onConfirm,
}: {
  k: ApiKeyRow;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      size="sm"
      title={`إلغاء المفتاح «${k.name}»؟`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} data-autofocus>
            تراجع
          </Button>
          <Button
            icon={Trash2}
            disabled={busy}
            className="border-0 bg-red-600 text-white hover:bg-red-700"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
              } catch {
                setError("تعذّر إلغاء المفتاح. حاول مرة أخرى.");
                setBusy(false);
              }
            }}
          >
            {busy ? "جارٍ الإلغاء…" : "إلغاء المفتاح"}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate">
        أي تكامل يستخدم المفتاح <code dir="ltr" className="font-mono text-pine-deep">{k.prefix}…</code> سيتوقف فورًا
        ويتلقى الخطأ <Num>401</Num>. لا يمكن التراجع عن الإلغاء، لكن تقدر تنشئ مفتاحًا جديدًا متى شئت.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
