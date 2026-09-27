import { useEffect } from "react";
import type { DraftRow } from "@/lib/law/ai/drafts-core";

/** Reload while any draft is still being written. */
export function usePollPending(rows: DraftRow[] | null, reload: () => Promise<void>, ms = 5000) {
  const pending = rows?.some((d) => d.status === "pending") ?? false;
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => void reload(), ms);
    return () => clearTimeout(t);
  }, [rows, pending, reload, ms]);
}
