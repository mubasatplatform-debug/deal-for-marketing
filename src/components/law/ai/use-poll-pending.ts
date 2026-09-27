import { useEffect } from "react";

/** Reload while any row (a draft, a contract review…) is still being written. */
export function usePollPending(rows: readonly { status: string }[] | null, reload: () => Promise<void>, ms = 5000) {
  const pending = rows?.some((d) => d.status === "pending") ?? false;
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => void reload(), ms);
    return () => clearTimeout(t);
  }, [rows, pending, reload, ms]);
}
