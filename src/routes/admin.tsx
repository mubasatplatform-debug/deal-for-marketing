import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminForbidden } from "@/components/admin/forbidden";
import { AdminPanel, type AdminPanelState } from "@/components/admin/panel";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  ADMIN_FORBIDDEN,
  listAllRequests,
  updateRequestStatus,
  type AdminRequestRow,
} from "@/lib/admin";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  head: () => pageHead({ title: "لوحة الفريق", noindex: true }),
  component: Admin,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<AdminPanelState | "forbidden">("loading");
  const [rows, setRows] = useState<AdminRequestRow[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  // Nothing to sign out of for the dev user; a gate session signs straight back in.
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  const canSignOut = authEnabled && !gateSession;

  const load = useCallback(() => {
    setState("loading");
    listAllRequests()
      .then((r) => {
        setRows(r);
        setLoadedAt(Date.now());
        setState("ready");
      })
      .catch((err: unknown) =>
        setState(err instanceof Error && err.message === ADMIN_FORBIDDEN ? "forbidden" : "error"),
      );
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) load();
    // Full navigation so /login reads `redirect` from the real URL.
    else if (!isPending) window.location.replace("/login?redirect=/admin");
  }, [userId, isPending, load]);

  const setStatus = useCallback(async (id: number, status: string) => {
    await updateRequestStatus({ data: { id, status } });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  if (isPending || !user) return null;

  const onSignOut = canSignOut ? () => void signOut("/") : undefined;

  if (state === "forbidden") {
    return (
      <AdminForbidden
        email={user.primaryEmail}
        onSignOut={canSignOut ? () => void signOut("/login?redirect=/admin") : undefined}
      />
    );
  }

  return (
    <AdminPanel
      user={{
        name: user.displayName?.trim() || user.primaryEmail || "الفريق",
        email: user.primaryEmail,
      }}
      state={state}
      rows={rows}
      now={loadedAt}
      onRetry={load}
      onStatusChange={setStatus}
      onSignOut={onSignOut}
    />
  );
}
