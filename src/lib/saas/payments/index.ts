import { manualProvider } from "./manual.ts";
import { moyasarProvider } from "./moyasar.ts";
import type { PaymentProvider, ProviderId } from "./types.ts";

export type { BankDetails, CheckoutResult, PaymentProvider, ProviderId } from "./types.ts";

const providers: Record<ProviderId, PaymentProvider> = {
  manual: manualProvider,
  moyasar: moyasarProvider,
};

/** The provider by id — **server-only**. */
export function paymentProvider(id: ProviderId): PaymentProvider {
  return providers[id];
}

/** Providers that can take a payment in this deployment (manual is always on). */
export function enabledProviders(): ProviderId[] {
  return (Object.keys(providers) as ProviderId[]).filter((id) => providers[id].enabled());
}
