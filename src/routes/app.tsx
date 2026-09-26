import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Loader2, LockKeyhole, RotateCw } from "lucide-react";
import { Toaster } from "sonner";
import { DealWordmark } from "@/components/logo";
import { Button, Card } from "@/components/dash/ui";
import { buttonClass } from "@/components/dash/button-class";
import { LawAppFrame } from "@/components/law/app-frame";
import { LawAppContext, type LawApp } from "@/components/law/app-context";
import { TwoFactorGate } from "@/components/law/two-factor";
import { takeOtpReturn } from "@/lib/otp/return";
import { useSignOut } from "@/components/keys/use-sign-out";
import { authEnabled } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { workspaceErrorCode } from "@/lib/saas/errors";
import { getAppContext, setActiveWorkspace, type AppContext } from "@/lib/saas/workspace";
import { pageHead } from "@/lib/seo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app")({
  head: () => pageHead({ title: "مكتب المحامي", noindex: true }),
  // `?ws=<id>` opens a specific office — only if you are a member of it.
  validateSearch: (search: Record<string, unknown>): { ws?: string } =>
    typeof search.ws === "string" && UUID.test(search.ws) ? { ws: search.ws } : {},
  component: AppLayout,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "forbidden" }
  | { kind: "otp" }
  | { kind: "ready"; ctx: AppContext };

function AppLayout() {
  const { ws } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<State>({ kind: "loading" });
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
  const canSignOut = authEnabled && !gateSession;
  const signOut = useSignOut();

  const load = useCallback(async () => {
    try {
      const ctx = await getAppContext({ data: { workspaceId: ws ?? null } });
      if (!ctx.active) {
        // Signed in but no office yet: onboarding step 2.
        window.location.replace("/law/signup");
        return;
      }
      setState({ kind: "ready", ctx });
    } catch (err) {
      const code = workspaceErrorCode(err);
      if (err instanceof Error && err.message === "Unauthorized") {
        window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (code === "otp_required") {
        setState({ kind: "otp" });
        return;
      }
      setState(code === "forbidden" ? { kind: "forbidden" } : { kind: "error" });
    }
  }, [ws]);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void load();
    else if (!isPending) {
      window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [userId, isPending, load]);

  const onSwitch = useCallback(async (id: string) => {
    try {
      await setActiveWorkspace({ data: { workspaceId: id } });
    } finally {
      window.location.assign("/app");
    }
  }, []);

  const app = useMemo<LawApp | null>(
    () =>
      state.kind === "ready" && state.ctx.active
        ? { ctx: state.ctx, active: state.ctx.active, reload: load }
        : null,
    [state, load],
  );

  if (state.kind === "otp") {
    return (
      <CenterCard>
        <TwoFactorGate
          onPassed={() => {
            const back = takeOtpReturn();
            if (back) {
              window.location.replace(back);
              return;
            }
            setState({ kind: "loading" });
            void load();
          }}
          onSignOut={canSignOut ? () => signOut.start("/law") : undefined}
        />
      </CenterCard>
    );
  }
  if (state.kind === "forbidden") return <NoAccess />;
  if (state.kind === "error") return <LoadError onRetry={() => void load()} />;
  if (!app) return <Splash />;

  return (
    <LawAppContext.Provider value={app}>
      <LawAppFrame
        ctx={app.ctx}
        active={app.active}
        onSwitch={(id) => void onSwitch(id)}
        onSignOut={canSignOut ? () => signOut.start("/law") : undefined}
        signingOut={signOut.signingOut}
      >
        <Outlet />
      </LawAppFrame>
      <Toaster position="top-center" dir="rtl" richColors closeButton />
    </LawAppContext.Provider>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper" aria-busy="true">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <div className="flex flex-col items-center gap-4 text-pine">
        <DealWordmark className="h-6 w-auto" />
        <Loader2 className="size-5 animate-spin text-slate" aria-hidden="true" />
        <span className="sr-only">جارٍ فتح المكتب…</span>
      </div>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4 py-16 font-dash text-pine-deep">
      <style>{"html,body{background:var(--color-paper)}"}</style>
      <div className="w-full max-w-[440px]">
        <a href="/law" aria-label="مكتب المحامي" className="mx-auto mb-8 flex w-fit text-pine">
          <DealWordmark className="h-7 w-auto" />
        </a>
        <Card className="px-6 py-8 text-center md:px-8">{children}</Card>
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <CenterCard>
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine">
        <LockKeyhole className="size-6" />
      </span>
      <h1 className="mt-5 text-xl font-extrabold">لا تملك صلاحية الوصول لهذا المكتب</h1>
      <p className="mt-2 text-sm leading-6 text-slate">
        الرابط يخص مكتبًا لست عضوًا فيه. إن كنت تنتظر دعوة، اطلب من مدير المكتب إرسالها إلى بريدك.
      </p>
      <a href="/app" className={`${buttonClass("dark")} mt-6 w-full`}>
        الذهاب إلى مكتبي
      </a>
    </CenterCard>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <CenterCard>
      <h1 className="text-xl font-extrabold">تعذّر فتح المكتب</h1>
      <p className="mt-2 text-sm leading-6 text-slate">تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>
      <Button variant="dark" icon={RotateCw} onClick={onRetry} className="mt-6 w-full">
        إعادة المحاولة
      </Button>
    </CenterCard>
  );
}
