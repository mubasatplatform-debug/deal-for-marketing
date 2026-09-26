import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { creditNoteFields, invoiceFields, taxProfileFields } from "./invoices-core";
import type { InvoiceClient, InvoiceDetail, InvoicePage, TaxProfile } from "./invoices-core";
import { uuid, wsId } from "./schemas";

/**
 * Tax invoices (ZATCA phase 1) server functions. Every handler goes through
 * `run` (run.server.ts): membership + role + read-only checked in the
 * database, then invoices-core filters by the verified workspace id and
 * re-checks the action (`invoice.view` / `invoice.issue` / `settings.tax`).
 */

const runner = () => import("./run.server");
const core = () => import("./invoices-core");

async function exec<T>(
  userId: string,
  workspaceId: string,
  write: boolean,
  fn: (sql: import("@/lib/saas/tenancy-core").SqlTag, access: import("@/lib/saas/tenancy-core").WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const { run } = await runner();
  return run(userId, workspaceId, { write }, fn);
}

const ws = z.object({ workspaceId: wsId });

export const getTaxProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<TaxProfile | null> => {
    const { getTaxProfileCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => getTaxProfileCore(sql, access));
  });

export const saveTaxProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => taxProfileFields.extend({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<TaxProfile | null> => {
    const { saveTaxProfileCore } = await core();
    const { workspaceId, ...fields } = data;
    return exec(context.userId, workspaceId, true, (sql, access) => saveTaxProfileCore(sql, access, fields));
  });

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        q: z.string().trim().max(100).default(""),
        clientId: uuid.nullish(),
        page: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<InvoicePage> => {
    const { listInvoicesCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) =>
      listInvoicesCore(sql, access, { q: data.q, clientId: data.clientId, page: data.page }),
    );
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: uuid, workspaceId: wsId.nullish() }).parse(input))
  .handler(async ({ context, data }): Promise<InvoiceDetail & { workspaceId: string }> => {
    const { getInvoiceCore } = await core();
    const { WorkspaceError } = await import("@/lib/saas/tenancy-core");
    const { getSql } = await import("@/lib/db");
    // The print page may open from a bare invoice link: find its office
    // among the caller's memberships, then verify exactly like any request.
    let workspaceId = data.workspaceId ?? null;
    if (!workspaceId) {
      const sql = await getSql();
      const [r] = await sql<{ workspace_id: string }>`
        select i.workspace_id from law_invoices i
        join workspace_members m on m.workspace_id = i.workspace_id and m.user_id = ${context.userId}
        where i.id = ${data.id}
      `;
      if (!r) throw new WorkspaceError("not_found", 404);
      workspaceId = r.workspace_id;
    }
    return exec(context.userId, workspaceId, false, async (sql, access) => ({
      ...(await getInvoiceCore(sql, access, data.id)),
      workspaceId: access.workspace.id,
    }));
  });

export const getInvoiceClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, clientId: uuid }).parse(input))
  .handler(async ({ context, data }): Promise<InvoiceClient> => {
    const { invoiceClientCore } = await core();
    return exec(context.userId, data.workspaceId, false, (sql, access) => invoiceClientCore(sql, access, data.clientId));
  });

export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, invoice: invoiceFields }).parse(input))
  .handler(async ({ context, data }) => {
    const { issueInvoiceCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) => issueInvoiceCore(sql, access, data.invoice));
  });

export const issueCreditNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, note: creditNoteFields }).parse(input))
  .handler(async ({ context, data }) => {
    const { issueCreditNoteCore } = await core();
    return exec(context.userId, data.workspaceId, true, (sql, access) => issueCreditNoteCore(sql, access, data.note));
  });
