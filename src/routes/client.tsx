import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientDashboard, type DashboardState } from "@/components/client/dashboard";
import { SiteChrome } from "@/components/site-chrome";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyRequests, type RequestRow } from "@/lib/requests";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/client")({
  head: () => pageHead({ title: "مشاريعي", noindex: true }),
  component: ClientHome,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function ClientHome() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [state, setState] = useState<DashboardState>("loading");
  // Same rule as <UserButton />: nothing to sign out of for the dev user, and a
  // gate-materialized session signs straight back in.
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
  const canSignOut = authEnabled && !gateSession;

  const load = useCallback(() => {
    setState("loading");
    listMyRequests()
      .then((r) => {
        setRows(r);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  if (!isPending && !user) return <RedirectToSignIn to="/login?redirect=/client" />;

  return (
    <SiteChrome>
      <ClientDashboard
        user={user}
        rows={rows}
        state={isPending ? "loading" : state}
        onRetry={load}
        onSignOut={canSignOut ? () => signOut("/") : undefined}
      />
    </SiteChrome>
  );
}
