import { createHmac, timingSafeEqual } from "node:crypto";
import type { InvoiceRow } from "../tenancy-core.ts";
import type { PaymentProvider, VerifyResult } from "./types.ts";

/**
 * EdfaPay hosted checkout (card / mada / Apple Pay) — **server-only**.
 *
 * Written against EdfaPay's documented Payment Gateway API
 * (https://docs.edfapay.com, v2). It needs a MERCHANT-level API key, which is
 * NOT the partner client id/secret: create a merchant in the EdfaPay portal
 * and copy its API token from Settings → API. Disabled unless
 * `EDFAPAY_API_KEY` is set, so the deployment stays on manual/bank transfer
 * until the key is provided. Before going live: run one test payment end to
 * end against the sandbox and confirm the webhook signature.
 *
 * Shape assumed (EdfaPay Payment Gateway v1):
 *   - Base URL https://app-api.edfapay.com/api/v1, header `X-API-KEY`.
 *   - POST /payment-gateway/initiate { orderId, currency "SAR", amount
 *     (decimal), customerDetails, auth "N", successUrl, failureUrl } ->
 *     { code, data: { redirectUrl } }. Send the payer to redirectUrl.
 *   - GET /transactions/filterTransaction?orderId=... ->
 *     { data: { content: [ { orderId, status ("Success"|...), amount } ] } }.
 *   - Webhook POST { orderId, status ("Success"), amount, transactionId, ... },
 *     signed HMAC-SHA256(secret, raw body) in `X-EdfaPay-Signature` when a
 *     webhook secret is configured. Even a valid webhook is only a hint: we
 *     re-fetch the transaction before trusting it.
 */
const API = "https://app-api.edfapay.com/api/v1";

function apiKey(): string | null {
  return process.env.EDFAPAY_API_KEY?.trim() || null;
}

/** EdfaPay wants a decimal amount; our invoice totals are stored in halalas. */
function toDecimal(halalas: number): string {
  return (halalas / 100).toFixed(2);
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("EdfaPay is not configured");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "X-API-KEY": key,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // Never echo the provider's error body to the payer; log it for the team.
    console.error(`[edfapay] ${method} ${path} answered ${res.status}: ${await res.text().catch(() => "")}`);
    throw new Error("Payment provider error");
  }
  return (await res.json()) as T;
}

type InitiateResponse = { code?: number; data?: { redirectUrl?: string } };
type StatusRow = { orderId?: string; status?: string; amount?: string | number };
type StatusResponse = { data?: { content?: StatusRow[] } };

/** Map EdfaPay's transaction status to our verdict, checking the amount too. */
function verdictFor(row: StatusRow | undefined, invoice: InvoiceRow): VerifyResult {
  if (!row) return "pending";
  const status = (row.status ?? "").toLowerCase();
  const amountOk = row.amount === undefined || Number(row.amount) === invoice.total / 100;
  if (status === "success" && amountOk) return "paid";
  if (["declined", "failed", "cancelled", "canceled", "expired", "error"].includes(status)) return "failed";
  return "pending";
}

export const edfapayProvider: PaymentProvider = {
  id: "edfapay",
  label: "مدى، فيزا، ماستركارد، Apple Pay",
  enabled: () => apiKey() !== null,
  async checkout({ invoice, workspace, planName, returnUrl, callbackUrl }) {
    const res = await call<InitiateResponse>("POST", "/payment-gateway/initiate", {
      orderId: invoice.id,
      currency: "SAR",
      amount: Number(toDecimal(invoice.total)),
      description: `اشتراك مكتب المحامي — ${planName} — ${workspace.name} (#${invoice.number})`,
      customerDetails: {
        name: workspace.name,
        email: process.env.EDFAPAY_STATEMENT_EMAIL?.trim() || "billing@mubasat.net",
        phone: process.env.EDFAPAY_STATEMENT_PHONE?.trim() || "+966500000000",
      },
      auth: "N",
      recurringInit: "N",
      successUrl: returnUrl,
      failureUrl: returnUrl,
      // EdfaPay notifies this URL server-to-server; it is the source of truth.
      callbackUrl,
    });
    const url = res.data?.redirectUrl;
    if (!url) throw new Error("Payment provider error");
    // Match the webhook/verify by our own orderId (invoice.id).
    return { kind: "redirect", url, providerRef: invoice.id };
  },
  async verify(invoice): Promise<VerifyResult> {
    const orderId = invoice.provider_ref ?? invoice.id;
    const res = await call<StatusResponse>(
      "GET",
      `/transactions/filterTransaction?orderId=${encodeURIComponent(orderId)}`,
    );
    const rows = res.data?.content ?? [];
    // A settled Success wins over any pending attempt for the same order.
    const paid = rows.find((r) => (r.status ?? "").toLowerCase() === "success");
    return verdictFor(paid ?? rows[0], invoice);
  },
};

/** Validate the webhook HMAC-SHA256 signature over the raw body (constant time). */
export function edfapayWebhookSignatureOk(rawBody: string, signature: string | null): boolean {
  const secret = process.env.EDFAPAY_WEBHOOK_SECRET?.trim();
  // No secret configured on EdfaPay's side means no signature is sent; require
  // one here so an unsigned forgery can never settle an invoice.
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
