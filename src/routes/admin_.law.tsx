import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminForbidden } from "@/components/admin/forbidden";
import { LawConsole } from "@/components/admin/law-console";
import { useSignOut } from "@/components/keys/use-sign-out";
import { authEnabled } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin_/law")({
  head: () => pageHead({ title: "مشتركو مكتب المحامي — الفريق", noindex: true }),
  component: AdminLaw,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function AdminLaw() {
  const { user, isPending } = useCurrentUserState();
  const [forbidden, setForbidden] = useState(false);
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
  const canSignOut = authEnabled && !gateSession;
  const onForbidden = useCallback(() => setForbidden(true), []);
  const signOut = useSignOut();

  useEffect(() => {
    if (!isPending && !user) window.location.replace("/login?redirect=/admin/law");
  }, [isPending, user]);

  if (isPending || !user) return null;

  if (forbidden) {
    return (
      <AdminForbidden
        email={user.primaryEmail}
        signingOut={signOut.signingOut}
        signOutFailed={signOut.signOutFailed}
        onSignOut={canSignOut ? () => signOut.start("/login?redirect=/admin/law", () => {}) : undefined}
      />
    );
  }

  return (
    <LawConsole
      user={{ name: user.displayName?.trim() || user.primaryEmail || "الفريق", email: user.primaryEmail }}
      onSignOut={canSignOut ? () => signOut.start("/") : undefined}
      signingOut={signOut.signingOut}
      onForbidden={onForbidden}
    />
  );
}
