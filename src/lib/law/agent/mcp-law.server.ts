import { ZodError } from "zod";
import { getSql } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { requireWorkspace } from "@/lib/saas/guard.server";
import { planHas } from "@/lib/saas/plans";
import { WorkspaceError, type SqlTag } from "@/lib/saas/tenancy-core";
import { workspaceErrorMessage } from "@/lib/saas/errors";
import { runLoggedToolCore } from "./agent-core";
import { TOOL_BY_NAME } from "./tools";

/**
 * The «مكتب المحامي» tools over the DEAL MCP server — **server-only**. The
 * API key acts as its owner: every call re-checks office membership, role,
 * read-only state and the plan's AI feature, and every write is logged in the
 * office's AI audit log (source "mcp"). External clients own confirmation.
 */

export type OfficeRef = { office_id: string; name: string; role: string };

export async function officesFor(userId: string): Promise<OfficeRef[]> {
  const sql = (await getSql()) as unknown as SqlTag;
  return sql<OfficeRef>`
    select w.id as office_id, w.name, m.role
    from workspace_members m join workspaces w on w.id = m.workspace_id
    where m.user_id = ${userId}
    order by w.created_at
  `;
}

async function resolveOffice(userId: string, officeId: string | undefined): Promise<string> {
  if (officeId) return officeId;
  const offices = await officesFor(userId);
  if (offices.length === 1) return offices[0].office_id;
  if (!offices.length) throw new ApiError(404, "not_found", "The key's account is not a member of any law office.");
  throw new ApiError(
    400,
    "validation_error",
    `The key's account belongs to ${offices.length} offices; pass office_id. Call law_list_offices to see them.`,
  );
}

function toApiError(err: unknown): unknown {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return new ApiError(400, "validation_error", "Invalid arguments.", {
      details: err.issues.slice(0, 10).map((i) => ({ field: i.path.join(".") || "(root)", message: i.message })),
    });
  }
  if (err instanceof WorkspaceError || (err instanceof Error && err.message.startsWith("WS:"))) {
    const code = err instanceof WorkspaceError ? err.code : err.message.slice(3);
    const status = err instanceof WorkspaceError ? err.status : 400;
    const apiCode = status === 404 ? "not_found" : status === 429 ? "rate_limited" : status === 400 ? "validation_error" : "forbidden";
    return new ApiError(status, apiCode, `${code}: ${workspaceErrorMessage(err)}`);
  }
  return err;
}

/** Run one office tool for the key's owner. */
export async function runLawTool(userId: string, officeId: string | undefined, name: string, args: unknown): Promise<unknown> {
  const t = TOOL_BY_NAME.get(name);
  if (!t) throw new ApiError(404, "not_found", `Unknown tool ${name}.`);
  try {
    const wsId = await resolveOffice(userId, officeId);
    const access = await requireWorkspace(userId, wsId, "staff", { write: t.write });
    if (!planHas(access.workspace.plan, "aiDrafting")) {
      throw new ApiError(403, "forbidden", "AI integrations (MCP) are included in the «احترافي» and «مؤسسي» plans. Upgrade at /app/billing.");
    }
    const sql = (await getSql()) as unknown as SqlTag;
    return await runLoggedToolCore(sql, access, name, args);
  } catch (err) {
    throw toApiError(err);
  }
}
