import { useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientKeysPage } from "@/components/keys/keys-page";
import { useSignOut } from "@/components/keys/use-sign-out";
import { authEnabled } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/client_/keys")({
  head: () => pageHead({ title: "مفاتيح API", noindex: true }),
  component: ClientKeys,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function ClientKeys() {
  const { user, isPending } = useCurrentUserState();
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
  const canSignOut = authEnabled && !gateSession;
  const signOut = useSignOut();

  if (isPending) return null;
  if (!user) return <RedirectToSignIn to="/login?redirect=/client/keys" />;

  const name = user.displayName?.trim() || user.primaryEmail?.split("@")[0] || "حسابك";
  return (
    <ClientKeysPage
      user={{ name, email: user.primaryEmail }}
      onSignOut={canSignOut ? () => signOut.start("/") : undefined}
    />
  );
}
