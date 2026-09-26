/**
 * Documents core — the office's files, linked to a client and/or a case.
 * Bare SQL tag, relative imports (PGLite-testable). Bytes are stored by
 * src/lib/files (Postgres bytea or a private Vercel Blob); this module only
 * handles rows, the quota and authorization.
 */
import { storageQuotaBytes } from "../saas/plans.ts";
import { UUID_RE, WorkspaceError, type SqlTag, type WorkspaceAccess } from "../saas/tenancy-core.ts";
import { assertCase, assertClient, need } from "./practice-core.ts";
import { PAGE_SIZE, likeEscape, plain, plainRows } from "./rows.ts";

export type DocumentRow = {
  id: string;
  name: string;
  mime: string;
  size: number;
  client_id: string | null;
  client_name: string | null;
  case_id: string | null;
  case_title: string | null;
  case_ref: number | null;
  uploaded_by_name: string | null;
  created_at: string;
  /** Visible to the client in their portal (migrations/0015). */
  shared_with_client: boolean;
};

export type Folder = { id: string; name: string; count: number; cases: { id: string; ref_no: number; title: string; count: number }[] };

export type DocumentPage = {
  rows: DocumentRow[];
  total: number;
  page: number;
  pageSize: number;
  usage: { used: number; quota: number };
};

export async function storageUsage(sql: SqlTag, access: WorkspaceAccess) {
  const [r] = await sql<{ used: number }>`
    select coalesce(sum(size), 0)::bigint as used from law_documents where workspace_id = ${access.workspace.id}
  `;
  return { used: Number(r?.used ?? 0), quota: storageQuotaBytes(access.workspace.plan) };
}

export async function listDocumentsCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  f: { q: string; clientId?: string | null; caseId?: string | null; unfiled?: boolean; page: number },
): Promise<DocumentPage> {
  need(access, "document.view");
  const ws = access.workspace.id;
  const q = f.q.trim();
  const like = `%${likeEscape(q)}%`;
  const clientId = f.clientId && UUID_RE.test(f.clientId) ? f.clientId : null;
  const caseId = f.caseId && UUID_RE.test(f.caseId) ? f.caseId : null;
  const offset = (f.page - 1) * PAGE_SIZE;
  const [rows, usage] = await Promise.all([
    sql.query<DocumentRow & { total: number }>(
      `select d.id, d.name, d.mime, d.size, d.client_id, c.name as client_name, d.case_id, k.title as case_title,
              k.ref_no as case_ref, coalesce(nullif(u.name, ''), u.email) as uploaded_by_name, d.created_at,
              d.shared_with_client, count(*) over ()::int as total
       from law_documents d
       left join law_clients c on c.id = d.client_id and c.workspace_id = d.workspace_id
       left join law_cases k on k.id = d.case_id and k.workspace_id = d.workspace_id
       left join "user" u on u.id = d.uploaded_by
       where d.workspace_id = $1
         and ($2 = '' or d.name ilike $3)
         and ($4::uuid is null or d.client_id = $4)
         and ($5::uuid is null or d.case_id = $5)
         and (not $6::boolean or (d.client_id is null and d.case_id is null))
       order by d.created_at desc, d.id
       limit ${PAGE_SIZE} offset $7`,
      [ws, q, like, clientId, caseId, f.unfiled ?? false, offset],
    ),
    storageUsage(sql, access),
  ]);
  return {
    rows: plainRows<DocumentRow & { total?: number }>(rows).map(({ total: _t, ...r }) => r),
    total: Number(rows[0]?.total ?? 0),
    page: f.page,
    pageSize: PAGE_SIZE,
    usage,
  };
}

/** Folder tree: clients with documents, their cases with documents, and the unfiled count. */
export async function foldersCore(sql: SqlTag, access: WorkspaceAccess): Promise<{ folders: Folder[]; unfiled: number; total: number }> {
  need(access, "document.view");
  const ws = access.workspace.id;
  const rows = await sql<{
    client_id: string | null;
    client_name: string | null;
    case_id: string | null;
    case_ref: number | null;
    case_title: string | null;
    n: number;
  }>`
    select coalesce(d.client_id, k.client_id) as client_id, c.name as client_name, d.case_id, k.ref_no as case_ref,
           k.title as case_title, count(*)::int as n
    from law_documents d
    left join law_cases k on k.id = d.case_id and k.workspace_id = d.workspace_id
    left join law_clients c on c.id = coalesce(d.client_id, k.client_id) and c.workspace_id = d.workspace_id
    where d.workspace_id = ${ws}
    group by 1, 2, 3, 4, 5
  `;
  const byClient = new Map<string, Folder>();
  let unfiled = 0;
  let total = 0;
  for (const r of plainRows<(typeof rows)[number]>(rows)) {
    const n = Number(r.n);
    total += n;
    if (!r.client_id) {
      if (!r.case_id) unfiled += n;
      else {
        const key = "__cases__";
        const f = byClient.get(key) ?? { id: key, name: "", count: 0, cases: [] };
        f.count += n;
        f.cases.push({ id: r.case_id, ref_no: Number(r.case_ref), title: r.case_title ?? "", count: n });
        byClient.set(key, f);
      }
      continue;
    }
    const f = byClient.get(r.client_id) ?? { id: r.client_id, name: r.client_name ?? "", count: 0, cases: [] };
    f.count += n;
    if (r.case_id) f.cases.push({ id: r.case_id, ref_no: Number(r.case_ref), title: r.case_title ?? "", count: n });
    byClient.set(r.client_id, f);
  }
  const folders = [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return { folders, unfiled, total };
}

/**
 * Where an upload lands: validates the client/case belong to the office, and
 * derives the client from the case when only the case is given.
 */
export async function resolveTarget(
  sql: SqlTag,
  access: WorkspaceAccess,
  clientId: string | null,
  caseId: string | null,
): Promise<{ clientId: string | null; caseId: string | null }> {
  need(access, "document.upload");
  await assertClient(sql, access, clientId);
  await assertCase(sql, access, caseId);
  if (caseId && !clientId) {
    const [k] = await sql<{ client_id: string | null }>`
      select client_id from law_cases where id = ${caseId} and workspace_id = ${access.workspace.id}
    `;
    return { clientId: k?.client_id ?? null, caseId };
  }
  if (caseId && clientId) {
    const [k] = await sql<{ client_id: string | null }>`
      select client_id from law_cases where id = ${caseId} and workspace_id = ${access.workspace.id}
    `;
    // A case of another client: keep the case, file under its own client.
    if (k?.client_id && k.client_id !== clientId) return { clientId: k.client_id, caseId };
  }
  return { clientId, caseId };
}

export async function insertDocumentCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  d: {
    id: string;
    clientId: string | null;
    caseId: string | null;
    name: string;
    mime: string;
    size: number;
    storage: "db" | "blob";
    data: Uint8Array | null;
    blobPath: string | null;
  },
): Promise<void> {
  need(access, "document.upload");
  const [r] = await sql<{ res: string }>`
    select law_document_insert(${access.workspace.id}::uuid, ${d.id}::uuid, ${d.clientId}::uuid, ${d.caseId}::uuid,
      ${d.name}::text, ${d.mime}::text, ${d.size}::bigint, ${d.storage}::text, ${d.data}::bytea, ${d.blobPath}::text,
      ${access.userId}::text, ${storageQuotaBytes(access.workspace.plan)}::bigint) as res
  `;
  if (r?.res === "quota") throw new WorkspaceError("quota", 413);
  if (r?.res !== "ok") throw new WorkspaceError("forbidden");
}

/** Metadata for a download, only when the document belongs to the office. */
export async function documentMetaCore(sql: SqlTag, access: WorkspaceAccess, id: string) {
  need(access, "document.view");
  if (!UUID_RE.test(id)) return null;
  const [r] = await sql<{ id: string; name: string; mime: string; size: number; storage: "db" | "blob"; blob_path: string | null }>`
    select id, name, mime, size, storage, blob_path from law_documents
    where id = ${id} and workspace_id = ${access.workspace.id}
  `;
  return r ? plain<typeof r>(r) : null;
}

export async function documentBytesCore(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<Uint8Array | null> {
  const [r] = await sql<{ data: Uint8Array | null }>`
    select data from law_documents where id = ${id} and workspace_id = ${access.workspace.id}
  `;
  return r?.data ?? null;
}

export async function deleteDocumentCore(sql: SqlTag, access: WorkspaceAccess, id: string): Promise<string | null> {
  need(access, "document.delete");
  if (!UUID_RE.test(id)) throw new WorkspaceError("not_found", 404);
  const rows = await sql<{ id: string; name: string; blob_path: string | null }>`
    delete from law_documents where id = ${id} and workspace_id = ${access.workspace.id}
    returning id, name, blob_path
  `;
  if (!rows[0]) throw new WorkspaceError("not_found", 404);
  await sql`
    insert into workspace_events (workspace_id, actor_id, kind, detail)
    values (${access.workspace.id}, ${access.userId}, 'doc_deleted', ${JSON.stringify({ id, name: rows[0].name })}::jsonb)
  `;
  return rows[0].blob_path;
}

/** Documents of a client or a case (profile pages), newest first. */
export async function documentsForCore(
  sql: SqlTag,
  access: WorkspaceAccess,
  t: { clientId?: string; caseId?: string },
): Promise<DocumentRow[]> {
  const page = await listDocumentsCore(sql, access, { q: "", clientId: t.clientId, caseId: t.caseId, page: 1 });
  return page.rows;
}
