import { getSql } from "@/lib/db";
import { markInvoicePaidCore, type InvoiceRow } from "./tenancy-core";
import { moyasarProvider, moyasarWebhookSecretOk } from "./payments/moyasar";

/**
 * POST /api/law/moyasar — Moyasar payment webhook. UNTESTED (see
 * payments/moyasar.ts). The body is only a hint: after the shared secret
 * checks out, we look up OUR invoice by the Moyasar invoice id we stored at
 * checkout and ask Moyasar's API whether it is paid, for the amount we asked.
 * Always answers quickly with a bare status; never reveals why it refused.
 */
export async function handleMoyasarWebhook(request: Request): Promise<Response> {
  if (!moyasarProvider.enabled()) return new Response(null, { status: 404 });
  let body: { type?: unknown; secret_token?: unknown; data?: { invoice_id?: unknown } };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!moyasarWebhookSecretOk(body.secret_token)) return new Response(null, { status: 401 });
  const ref = body.data?.invoice_id;
  if (body.type !== "payment_paid" || typeof ref !== "string" || ref.length > 100) {
    return new Response(null, { status: 204 });
  }
  const sql = await getSql();
  const [invoice] = await sql<InvoiceRow>`
    select id, number, workspace_id, plan, cycle, subtotal, vat, total, currency, provider,
           provider_ref, status, created_at, paid_at
    from workspace_invoices
    where provider = 'moyasar' and provider_ref = ${ref}
  `;
  if (!invoice || invoice.status !== "pending") return new Response(null, { status: 204 });
  try {
    if ((await moyasarProvider.verify(invoice)) === "paid") await markInvoicePaidCore(sql, invoice.id, null);
  } catch (err) {
    console.error("[moyasar] webhook verification failed:", err);
    // Let Moyasar retry later.
    return new Response(null, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
