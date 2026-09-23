import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientRequestDetail, type RequestDetailState } from "@/components/client/request-detail";
import { useSignOut } from "@/components/keys/use-sign-out";
import { authEnabled } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/seo";
import {
  THREAD_ERRORS,
  getMyRequestThread,
  type ClientRequestDetail as Detail,
  type Thread,
} from "@/lib/thread";

export const Route = createFileRoute("/client_/requests/$id")({
  head: () => pageHead({ title: "تفاصيل الطلب", noindex: true }),
  component: ClientRequestPage,
});

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function ClientRequestPage() {
  const { id: rawId } = Route.useParams();
  const id = /^\d{1,10}$/.test(rawId) ? Number(rawId) : 0;
  const { user, isPending } = useCurrentUserState();
  const gateSession = useSyncExternalStore(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
  const canSignOut = authEnabled && !gateSession;
  const signOut = useSignOut();
  const [state, setState] = useState<RequestDetailState>("loading");
  const [request, setRequest] = useState<Detail | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);

  const fetchAll = useCallback(() => getMyRequestThread({ data: { id } }), [id]);

  const load = useCallback(() => {
    if (!id) {
      setState("missing");
      return;
    }
    setState("loading");
    fetchAll()
      .then((r) => {
        setRequest(r.request);
        setThread(r.thread);
        setState("ready");
      })
      .catch((err: unknown) =>
        setState(err instanceof Error && err.message === THREAD_ERRORS.notFound ? "missing" : "error"),
      );
  }, [id, fetchAll]);

  // Polls refresh the status too, so a status change shows without a reload.
  const loadThread = useCallback(
    () =>
      fetchAll().then((r) => {
        setRequest(r.request);
        return r.thread;
      }),
    [fetchAll],
  );

  const userId = user?.id;
  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  if (!isPending && !user) return <RedirectToSignIn to={`/login?redirect=/client/requests/${id || ""}`} />;

  const name = user?.displayName?.trim() || user?.primaryEmail?.split("@")[0] || "حسابك";
  return (
    <ClientRequestDetail
      user={{ name, email: user?.primaryEmail }}
      state={isPending ? "loading" : state}
      request={request}
      thread={thread}
      load={loadThread}
      onRetry={load}
      onSignOut={canSignOut ? () => signOut.start("/") : undefined}
    />
  );
}
