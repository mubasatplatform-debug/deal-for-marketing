import type { InvoiceRow } from "../tenancy-core.ts";

/**
 * Payment providers for «مكتب المحامي» subscriptions — **server-only**.
 *
 * A checkout always starts from a pending `workspace_invoices` row (created by
 * `createInvoiceCore`). A provider either sends the payer somewhere to pay
 * (`redirect`) or tells them how to pay offline (`instructions`). A provider
 * never marks an invoice paid from what the browser says: `verify` asks the
 * provider itself, and only then `markInvoicePaidCore` runs.
 */
export type ProviderId = "manual" | "moyasar" | "edfapay";

export type BankDetails = {
  bankName: string | null;
  beneficiary: string | null;
  iban: string | null;
};

export type CheckoutResult =
  | { kind: "redirect"; url: string; providerRef: string }
  | { kind: "instructions"; bank: BankDetails | null };

export type CheckoutInput = {
  invoice: InvoiceRow;
  workspace: { id: string; name: string };
  planName: string;
  /** Absolute URL the payer returns to after paying. */
  returnUrl: string;
  /** Absolute URL the provider notifies server-to-server (webhook). */
  callbackUrl: string;
};

export type VerifyResult = "paid" | "pending" | "failed";

export interface PaymentProvider {
  id: ProviderId;
  /** Shown on the checkout button. */
  label: string;
  /** Configured and allowed to take payments in this deployment. */
  enabled(): boolean;
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Ask the provider whether the invoice is paid (manual: only the DEAL team decides). */
  verify(invoice: InvoiceRow): Promise<VerifyResult>;
}
