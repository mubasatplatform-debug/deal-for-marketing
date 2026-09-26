import { getSql } from "@/lib/db";
import { invoiceSettleable, markInvoicePaidCore, type InvoiceRow } from "./tenancy-core";
import { alertLatePayment } from "./late-payment.server";
import { edfapayProvider, edfapayWebhookSignatureOk } from "./payments/edfapay";

/**
 * POST /api/law/edfapay — EdfaPay payment webhook. The body is only a hint:
 * after the HMAC-SHA256 signature checks out, we look up OUR invoice by the
 * orderId we set at checkout (the invoice id) and ask EdfaPay's API whether it
 * is paid, for the amount we asked. Always answers quickly with a bare status;
 * never reveals why it refused.
 */
export async function handleEdfapayWebhook(request: Request): Promise<Response> {
  if (!edfapayProvider.enabled()) return new Response(null, { status: 404 });

  // Read the raw body once — the signature is computed over these exact bytes.
  const raw = await request.text();
  const signature = request.headers.get("x-edfapay-signature");
  if (!edfapayWebhookSignatureOk(raw, signature)) return new Response(null, { status: 401 });

  let body: { orderId?: unknown; status?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return new Response(null, { status: 400 });
  }
  const orderId = body.orderId;
  if (typeof orderId !== "string" || orderId.length > 100) return new Response(null, { status: 204 });

  const sql = await getSql();
  const [invoice] = await sql<InvoiceRow>`
    select id, number, workspace_id, plan, cycle, subtotal, vat, total, currency, provider,
           provider_ref, status, created_at, paid_at
    from workspace_invoices
    where provider = 'edfapay' and provider_ref = ${orderId}
  `;
  if (!invoice || !invoiceSettleable(invoice)) return new Response(null, { status: 204 });

  try {
    if ((await edfapayProvider.verify(invoice)) === "paid") {
      const res = await markInvoicePaidCore(sql, invoice.id, null, { providerVerified: true });
      if (res && invoice.status === "cancelled") await alertLatePayment(invoice);
    }
  } catch (err) {
    console.error("[edfapay] webhook verification failed:", err);
    // Let EdfaPay retry later.
    return new Response(null, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
