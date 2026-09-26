import type { InvoiceRow } from "./tenancy-core";

/**
 * A provider confirmed payment on an invoice a later checkout had cancelled.
 * The office was activated from it; tell the team so a duplicate payment (the
 * newer request paid too) can be refunded or credited by hand.
 */
export async function alertLatePayment(invoice: Pick<InvoiceRow, "number" | "workspace_id" | "provider" | "total">) {
  try {
    const { sendTeamAlert } = await import("@/lib/mail.server");
    await sendTeamAlert(
      `دفع متأخر على طلب ملغى #${invoice.number}`,
      [
        `وصل دفع مؤكد من ${invoice.provider} على طلب الدفع #${invoice.number} بعد أن أُلغي بطلب أحدث، وفُعّل الاشتراك منه.`,
        `المبلغ: ${(invoice.total / 100).toFixed(2)} ر.س`,
        `المكتب: ${invoice.workspace_id}`,
        "راجع طلبات المكتب: إن دُفع الطلب الأحدث أيضًا فهناك دفعة مكررة تحتاج استرجاعًا أو احتسابًا.",
      ].join("\n"),
    );
  } catch (err) {
    console.error("[billing] late-payment alert failed:", err);
  }
}
