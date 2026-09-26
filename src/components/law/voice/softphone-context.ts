import { createContext, useContext } from "react";
import type { VoiceSetup } from "@/lib/law/voice";

/** What to call: a Saudi number, how to show it, and what it belongs to. */
export type CallTarget = {
  to: string;
  label: string;
  clientId?: string | null;
  conversationId?: string | null;
};

export type SoftphoneApi = {
  setup: VoiceSetup | null;
  /** Calls from the browser are available for this member now. */
  ready: boolean;
  /** A call is in progress (only one at a time). */
  busy: boolean;
  call: (target: CallTarget) => void;
  reloadSetup: () => Promise<void>;
};

export const SoftphoneContext = createContext<SoftphoneApi | null>(null);

/** The softphone mounted once in the app layout (`SoftphoneProvider`). */
export function useSoftphone(): SoftphoneApi {
  const v = useContext(SoftphoneContext);
  if (!v) throw new Error("useSoftphone outside SoftphoneProvider");
  return v;
}

/** Fired when a call ends (the calls page reloads its list). */
export const CALLS_CHANGED = "law-calls-changed";
