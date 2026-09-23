import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ClipboardList,
  Inbox,
  KeyRound,
  LayoutGrid,
  Plus,
  RotateCw,
  Scale,
  Users,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { DashShell, type NavItem } from "@/components/dash/shell";
import { Button, Card } from "@/components/dash/ui";
import {
  createApiKey,
  getKeysOverview,
  getTeamUsage,
  revokeApiKey,
  type ApiKeyRow,
  type KeysOverview,
  type TeamUsage,
} from "@/lib/api/keys";
import { MAX_ACTIVE_KEYS, isKeyActive, type KeyExpiryDays, type Scope } from "@/lib/api/scopes";
import { cn } from "@/lib/utils";
import { ConnectCard, SafetyCard } from "./connect-card";
import { CreateKeyDialog } from "./create-dialog";
import { KeyList } from "./key-list";
import { ActivityLog, AllKeysTable, TeamKpis } from "./team-usage";

type LoadState = "loading" | "error" | "ready";

/** Own keys: load, create, revoke (with optimistic list updates). */
function useOwnKeys(enabled: boolean) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<KeysOverview | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setState("loading");
    getKeysOverview()
      .then((d) => {
        setData(d);
        setNow(Date.now());
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const create = useCallback(async (name: string, scopes: Scope[], expiresInDays: KeyExpiryDays) => {
    const res = await createApiKey({ data: { name, scopes, expiresInDays } });
    setData((d) => (d ? { ...d, keys: [res.key, ...d.keys] } : d));
    setNow(Date.now());
    return res;
  }, []);

  const revoke = useCallback(async (key: ApiKeyRow) => {
    const { revoked_at } = await revokeApiKey({ data: { id: key.id } });
    setData((d) =>
      d
        ? {
            ...d,
            keys: [
              ...d.keys.filter((k) => isKeyActive(k) && k.id !== key.id),
              { ...key, revoked_at },
              ...d.keys.filter((k) => !isKeyActive(k) && k.id !== key.id),
            ],
          }
        : d,
    );
    setNow(Date.now());
    toast.success(`أُلغي المفتاح «${key.name}»`);
  }, []);

  return { state, data, now, load, create, revoke };
}

const toaster = (
  <Toaster
    dir="rtl"
    position="bottom-left"
    offset={24}
    toastOptions={{
      style: {
        fontFamily: "Cairo, Manrope, sans-serif",
        borderRadius: 14,
        border: "1px solid #e3e6dc",
        color: "#102628",
        boxShadow: "0 12px 32px -12px rgba(16,38,40,0.25)",
      },
    }}
  />
);

type ShellUser = { name: string; email?: string | null };

function NewKeyButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="primary" icon={Plus} onClick={onClick} disabled={disabled}>
      مفتاح جديد
    </Button>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <Card className="px-5 py-10 text-center md:px-8 md:py-14">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <AlertCircle className="size-6" />
        </span>
        <h2 className="mt-4 text-[17px] font-bold text-pine-deep">تعذّر تحميل المفاتيح</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate">
          قد يكون الاتصال ضعيفًا للحظات. مفاتيحك تعمل كما هي ولم يتغير شيء.
        </p>
        <Button icon={RotateCw} onClick={onRetry} className="mt-6">
          إعادة المحاولة
        </Button>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client: /client/keys

export function ClientKeysPage({ user, onSignOut }: { user: ShellUser; onSignOut?: () => void }) {
  const keys = useOwnKeys(true);
  const [creating, setCreating] = useState(false);
  const activeCount = keys.data?.keys.filter((k) => isKeyActive(k)).length ?? 0;
  const atLimit = activeCount >= MAX_ACTIVE_KEYS;

  const nav: NavItem[] = [
    { href: "/client", label: "طلباتي", icon: ClipboardList },
    { href: "/start", label: "طلب جديد", icon: Plus },
    { href: "/client/keys", label: "مفاتيح API", icon: KeyRound, active: true },
    { href: "/developers", label: "دليل المطوّرين", icon: BookOpen },
  ];

  return (
    <DashShell
      area="حساب العميل"
      nav={nav}
      user={user}
      onSignOut={onSignOut}
      title="مفاتيح API"
      subtitle="اربط متجرك وأدوات الأتمتة ومساعدي الذكاء الاصطناعي بحسابك في ديل عبر الـ API أو خادم MCP."
      actions={<NewKeyButton onClick={() => setCreating(true)} disabled={keys.state !== "ready" || atLimit} />}
    >
      {toaster}
      <div className="grid items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {keys.state === "error" ? (
            <LoadError onRetry={keys.load} />
          ) : (
            <KeyList
              keys={keys.data?.keys ?? []}
              loading={keys.state === "loading"}
              now={keys.now}
              onNew={() => setCreating(true)}
              onRevoke={keys.revoke}
            />
          )}
        </div>
        <aside aria-label="الربط والأمان" className="space-y-4 lg:sticky lg:top-24">
          <ConnectCard />
          <SafetyCard />
        </aside>
      </div>
      {creating && keys.data ? (
        <CreateKeyDialog grantable={keys.data.grantable} onCreate={keys.create} onClose={() => setCreating(false)} />
      ) : null}
    </DashShell>
  );
}

// ---------------------------------------------------------------------------
// Team: /admin/keys

export function AdminKeysPage({
  user,
  onSignOut,
  onForbidden,
}: {
  user: ShellUser;
  onSignOut?: () => void;
  onForbidden: () => void;
}) {
  const keys = useOwnKeys(true);
  const [creating, setCreating] = useState(false);
  const [usage, setUsage] = useState<TeamUsage | null>(null);
  const [usageState, setUsageState] = useState<LoadState>("loading");
  const [usageAt, setUsageAt] = useState(() => Date.now());

  const loadUsage = useCallback(() => {
    setUsageState("loading");
    getTeamUsage()
      .then((u) => {
        setUsage(u);
        setUsageAt(Date.now());
        setUsageState("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "Forbidden") onForbidden();
        else setUsageState("error");
      });
  }, [onForbidden]);

  useEffect(loadUsage, [loadUsage]);

  const refresh = () => {
    keys.load();
    loadUsage();
  };
  const loading = keys.state === "loading" || usageState === "loading";
  const activeCount = keys.data?.keys.filter((k) => isKeyActive(k)).length ?? 0;

  const nav: NavItem[] = [
    { href: "/admin#overview", label: "نظرة عامة", icon: LayoutGrid },
    { href: "/admin#requests", label: "الطلبات", icon: Inbox },
    { href: "/admin#customers", label: "العملاء", icon: Users },
    { href: "/admin/law", label: "مشتركو مكتب المحامي", icon: Scale },
    { href: "/admin/keys", label: "مفاتيح API", icon: KeyRound, active: true },
    { href: "/developers", label: "دليل المطوّرين", icon: BookOpen },
  ];

  return (
    <DashShell
      area="لوحة الفريق"
      nav={nav}
      user={user}
      onSignOut={onSignOut}
      title="مفاتيح API"
      subtitle="مفاتيحك للتكاملات الداخلية، واستخدام الـ API وخادم MCP عبر كل الحسابات."
      actions={
        <>
          <Button
            size="sm"
            icon={RotateCw}
            onClick={refresh}
            disabled={loading}
            className={cn(loading && "[&_svg]:animate-spin")}
          >
            تحديث
          </Button>
          <NewKeyButton
            onClick={() => setCreating(true)}
            disabled={keys.state !== "ready" || activeCount >= MAX_ACTIVE_KEYS}
          />
        </>
      }
    >
      {toaster}
      <div className="space-y-5 md:space-y-6">
        {usageState === "error" ? null : <TeamKpis usage={usage} loading={usageState === "loading"} />}

        <div className="grid items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {keys.state === "error" ? (
              <LoadError onRetry={keys.load} />
            ) : (
              <KeyList
                title="مفاتيحي"
                keys={keys.data?.keys ?? []}
                loading={keys.state === "loading"}
                now={keys.now}
                onNew={() => setCreating(true)}
                onRevoke={async (k) => {
                  await keys.revoke(k);
                  loadUsage();
                }}
              />
            )}
          </div>
          <aside aria-label="الربط" className="space-y-4">
            <ConnectCard />
          </aside>
        </div>

        {usageState === "error" ? (
          <LoadError onRetry={loadUsage} />
        ) : (
          <>
            <ActivityLog usage={usage} loading={usageState === "loading"} now={usageAt} />
            <AllKeysTable usage={usage} loading={usageState === "loading"} now={usageAt} />
          </>
        )}
      </div>
      {creating && keys.data ? (
        <CreateKeyDialog
          grantable={keys.data.grantable}
          onCreate={async (name, scopes, expiresInDays) => {
            const res = await keys.create(name, scopes, expiresInDays);
            loadUsage();
            return res;
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </DashShell>
  );
}
