import type { PaymentProvider, VerifyResult } from "./types.ts";

/**
 * Moyasar (card / mada / Apple Pay) — UNTESTED STUB, written from Moyasar's
 * public API shape and never run against a real account. Disabled unless
 * MOYASAR_SECRET_KEY is set. Before going live: create a test account, run a
 * test-mode payment end to end, and confirm every field below against
 * https://docs.moyasar.com (invoices + webhooks).
 *
 * Shape assumed (Moyasar API v1):
 *   - Base URL https://api.moyasar.com/v1, HTTP Basic auth with the secret
 *     key as username and an empty password.
 *   - POST /invoices { amount (halalas, integer), currency "SAR", description,
 *     callback_url, success_url, back_url, metadata } -> { id, status
 *     ("initiated"), url (hosted payment page), amount, currency, ... }.
 *   - GET /invoices/:id -> same object; status "paid" once settled.
 *   - Webhooks POST { type: "payment_paid", secret_token, data: payment } where
 *     the payment carries `invoice_id`. The shared secret is set in the
 *     Moyasar dashboard and here as MOYASAR_WEBHOOK_SECRET; even a valid
 *     webhook is only a hint — we re-fetch the invoice before trusting it.
 *
 * Recurring billing (saved cards) is out of scope: each period is one hosted
 * invoice, and paying extends the office by one period.
 */
const API = "https://api.moyasar.com/v1";

function secretKey(): string | null {
  return process.env.MOYASAR_SECRET_KEY?.trim() || null;
}

function authHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

type MoyasarInvoice = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  url?: string;
  metadata?: Record<string, string> | null;
};

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = secretKey();
  if (!key) throw new Error("Moyasar is not configured");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: authHeader(key),
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Never echo the provider's error body to the payer; log it for the team.
    console.error(`[moyasar] ${method} ${path} answered ${res.status}: ${await res.text().catch(() => "")}`);
    throw new Error("Payment provider error");
  }
  return (await res.json()) as T;
}

export const moyasarProvider: PaymentProvider = {
  id: "moyasar",
  label: "بطاقة مدى / فيزا / Apple Pay",
  enabled: () => secretKey() !== null,
  async checkout({ invoice, workspace, planName, returnUrl, callbackUrl }) {
    const inv = await call<MoyasarInvoice>("POST", "/invoices", {
      amount: invoice.total,
      currency: "SAR",
      description: `اشتراك مكتب المحامي — ${planName} — ${workspace.name} (#${invoice.number})`,
      callback_url: callbackUrl,
      success_url: returnUrl,
      back_url: returnUrl,
      metadata: { invoice_id: invoice.id, workspace_id: workspace.id },
    });
    if (!inv.url) throw new Error("Payment provider error");
    return { kind: "redirect", url: inv.url, providerRef: inv.id };
  },
  async verify(invoice): Promise<VerifyResult> {
    if (!invoice.provider_ref) return "pending";
    const inv = await call<MoyasarInvoice>("GET", `/invoices/${encodeURIComponent(invoice.provider_ref)}`);
    // The amount and currency must match what we asked for, not just "paid".
    if (inv.status === "paid" && inv.amount === invoice.total && inv.currency === "SAR") return "paid";
    if (inv.status === "failed" || inv.status === "canceled" || inv.status === "expired") return "failed";
    return "pending";
  },
};

/** Constant-time check of the webhook's shared secret. */
export function moyasarWebhookSecretOk(received: unknown): boolean {
  const expected = process.env.MOYASAR_WEBHOOK_SECRET?.trim();
  if (!expected || typeof received !== "string") return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
