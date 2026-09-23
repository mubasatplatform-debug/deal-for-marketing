import { getSql, type Sql } from "@/lib/db";
import { requireWorkspace, withStatus } from "@/lib/saas/guard.server";
import type { Role } from "@/lib/saas/lifecycle";
import type { SqlTag, WorkspaceAccess } from "@/lib/saas/tenancy-core";

/**
 * The one entry point of every practice server function — **server-only**.
 *
 *   run(context.userId, data.workspaceId, { write: true }, (sql, access) => core(sql, access, …))
 *
 * 1. `requireWorkspace` checks membership, minimum role and (for writes) that
 *    the office is not read-only, in the database;
 * 2. the core function receives the verified `WorkspaceAccess` and filters
 *    every query by its workspace id;
 * 3. a `WorkspaceError` from either sets the HTTP status (403/404/409/…)
 *    and reaches the browser as `WS:<code>` (see saas/errors.ts).
 */
export async function run<T>(
  userId: string,
  workspaceId: string,
  opts: { write?: boolean; minRole?: Role },
  fn: (sql: SqlTag, access: WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const access = await requireWorkspace(userId, workspaceId, opts.minRole ?? "staff", { write: opts.write });
  const sql = (await getSql()) as Sql as unknown as SqlTag;
  return withStatus(() => fn(sql, access));
}
