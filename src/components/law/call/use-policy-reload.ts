import { useEffect } from "react";
import { policyBlocked } from "./prejoin";

/**
 * Camera / microphone are allowed by the server's Permissions-Policy only on
 * the call pages (/meet/*, /app/*). A page reached by in-app navigation from
 * another section keeps the document it started with, so reload once to pick
 * up the right policy.
 */
export function usePolicyReload(key: string) {
  useEffect(() => {
    if (!policyBlocked()) return;
    const flag = `policy-reload:${key}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [key]);
}
