import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminForbidden } from "@/components/admin/forbidden";
import { AdminKeysPage } from "@/components/keys/keys-page";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin_/keys")({
  head: () => pageHead({ title: "مفاتيح API — الفريق", noindex: true }),
  component: AdminKeys,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function AdminKeys() {
  const { user, isPending } = useCurrentUserState();
  const [forbidden, setForbidden] = useState(false);
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
  const canSignOut = authEnabled && !gateSession;
  const onForbidden = useCallback(() => setForbidden(true), []);

  useEffect(() => {
    // Full navigation so /login reads `redirect` from the real URL.
    if (!isPending && !user) window.location.replace("/login?redirect=/admin/keys");
  }, [isPending, user]);

  if (isPending || !user) return null;

  if (forbidden) {
    return (
      <AdminForbidden
        email={user.primaryEmail}
        onSignOut={canSignOut ? () => void signOut("/login?redirect=/admin/keys") : undefined}
      />
    );
  }

  return (
    <AdminKeysPage
      user={{ name: user.displayName?.trim() || user.primaryEmail || "الفريق", email: user.primaryEmail }}
      onSignOut={canSignOut ? () => void signOut("/") : undefined}
      onForbidden={onForbidden}
    />
  );
}
