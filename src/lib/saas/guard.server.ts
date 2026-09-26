import { getRequestUrl, setResponseStatus } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import type { Role } from "./lifecycle";
import { WorkspaceError, resolveMembership, type WorkspaceAccess } from "./tenancy-core";

/**
 * Tenant guard for server functions — **server-only**.
 *
 * EVERY «مكتب المحامي» server function that reads or writes one office's rows
 * starts with `requireWorkspace`, passing the verified `context.userId` from
 * `authMiddleware` and the workspace id the browser is looking at. The id is
 * never trusted: membership and role are checked in the database, and the
 * resulting `WorkspaceAccess` (not the raw id) is what the queries use.
 *
 *   .handler(async ({ context, data }) => {
 *     const access = await requireWorkspace(context.userId, data.workspaceId, "admin", { write: true });
 *     …queries scoped by access.workspace.id…
 *   })
 *
 * A refusal answers 403 (401 is the auth middleware's) with `WS:<code>`.
 */
export async function requireWorkspace(
  userId: string,
  workspaceId: string,
  minRole: Role = "staff",
  opts: { write?: boolean } = {},
): Promise<WorkspaceAccess> {
  return withStatus(async () => {
    const access = await resolveMembership(await getSql(), userId, workspaceId, minRole, opts);
    // Two-step sign-in: this session must have passed its WhatsApp code.
    const { assertSecondFactor } = await import("@/lib/otp/otp.server");
    await assertSecondFactor(userId);
    return access;
  });
}

/** Run `fn`; a `WorkspaceError` sets the HTTP status it carries before rethrowing. */
export async function withStatus<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof WorkspaceError) setResponseStatus(err.status);
    throw err;
  }
}

/** Set the HTTP status of the current server-function response. */
export function setStatus(status: number) {
  setResponseStatus(status);
}

/**
 * Public origin for links we send (invites, payment return URLs): the
 * configured BETTER_AUTH_URL when set (production), else the request's own.
 */
export function publicOrigin(): string {
  const configured = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//.test(configured)) return configured;
  return getRequestUrl().origin;
}
