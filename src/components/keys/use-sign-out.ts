import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth/client";

/**
 * Sign-out for the keys pages. Success navigates away; a failure (network,
 * server) re-enables the control and says so, so it can be retried — the
 * same contract as /admin.
 */
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const busy = useRef(false);

  const start = useCallback((to: string, onFail?: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setSigningOut(true);
    setSignOutFailed(false);
    signOut(to).catch(() => {
      busy.current = false;
      setSigningOut(false);
      setSignOutFailed(true);
      if (onFail) onFail();
      else toast.error("تعذّر تسجيل الخروج", { description: "تحقق من الاتصال ثم حاول مرة أخرى." });
    });
  }, []);

  return { signingOut, signOutFailed, start };
}
