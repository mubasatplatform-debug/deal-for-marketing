import { createContext, useContext } from "react";
import type { ActiveWorkspace, AppContext } from "@/lib/saas/workspace";

/** What every /app page gets from the layout: the bootstrap plus refresh. */
export type LawApp = {
  ctx: AppContext;
  active: ActiveWorkspace;
  /** Re-fetch the bootstrap (after a settings change, a payment…). */
  reload: () => Promise<void>;
};

export const LawAppContext = createContext<LawApp | null>(null);

export function useLawApp(): LawApp {
  const v = useContext(LawAppContext);
  if (!v) throw new Error("useLawApp outside /app");
  return v;
}
