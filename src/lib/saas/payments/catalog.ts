import type { ProviderId } from "./types.ts";

/**
 * Client-safe payment metadata (no server-only imports). The billing UI uses
 * this to present the enabled providers; the actual checkout runs server-side.
 */

/** Hosted card gateways, most preferred first. The first enabled one is used. */
const CARD_PROVIDERS: ProviderId[] = ["edfapay", "moyasar"];

/** The enabled card gateway to offer, or null when only bank transfer is on. */
export function cardProvider(enabled: ProviderId[]): ProviderId | null {
  return CARD_PROVIDERS.find((id) => enabled.includes(id)) ?? null;
}

/** Short label for an invoice's provider in the history table. */
export function providerLabel(id: ProviderId): string {
  return id === "manual" ? "تحويل بنكي" : "بطاقة / مدى";
}
