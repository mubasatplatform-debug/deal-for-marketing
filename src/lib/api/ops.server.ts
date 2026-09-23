import { z } from "zod";
import { getSql } from "@/lib/db";
import { requestStatus, serviceBySlug, services } from "@/lib/content";
import { normalizePhone } from "@/lib/phone";
import { LEAD_ERRORS, leadSchema } from "@/lib/requests";
import { WRITE_LIMIT, WRITE_WINDOW_SECONDS, takeRateHit, type ApiCaller } from "./auth.server";
import { ApiError, type FieldIssue } from "./errors";

/**
 * The operations behind every REST endpoint and MCP tool — **server-only**.
 * Callers have already authenticated and checked scopes; every per-user query
 * here is still scoped by the caller's `userId`.
 */

// ---------------------------------------------------------------------------
// Shapes

export type ApiService = { slug: string; title: string; description: string };

export type ApiRequest = {
  id: number;
  service: { slug: string; title: string };
  company: string;
  brief: string;
  status: string;
  status_label: string;
  created_at: string;
};

export type ApiAdminRequest = ApiRequest & {
  contact_name: string;
  phone: string;
  account_email: string | null;
  notified_at: string | null;
  /** Normalized lead source (snapchat, google, direct, …); null when unknown. */
  source: string | null;
};

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
};

export const STATUSES = Object.keys(requestStatus) as [string, ...string[]];

type Row = {
  id: number;
  service_slug: string;
  service_title: string;
  company: string;
  brief: string;
  status: string;
  created_at: string | Date;
};

type AdminRow = Row & {
  contact_name: string;
  phone: string;
  account_email: string | null;
  notified_at: string | Date | null;
  source: string | null;
};

const iso = (v: string | Date) => new Date(v).toISOString();

function toApi(r: Row): ApiRequest {
  return {
    id: r.id,
    service: { slug: r.service_slug, title: r.service_title },
    company: r.company,
    brief: r.brief,
    status: r.status,
    status_label: requestStatus[r.status] ?? r.status,
    created_at: iso(r.created_at),
  };
}

function toAdminApi(r: AdminRow): ApiAdminRequest {
  return {
    ...toApi(r),
    contact_name: r.contact_name,
    phone: r.phone,
    account_email: r.account_email,
    notified_at: r.notified_at ? iso(r.notified_at) : null,
    source: r.source,
  };
}

// ---------------------------------------------------------------------------
// Input schemas (shared with MCP tool definitions)

/**
 * The lead's schema minus the form's bot traps: an API key already proves a
 * real account, so the honeypot does not apply (and the form-only `fillMs`
 * timing check lives on the form's own schema, not this one). Everything else —
 * lengths, phone, PDPL consent — validates exactly like `createRequest`.
 */
export const apiRequestSchema = leadSchema.omit({ website: true, source: true });
export type ApiRequestInput = z.input<typeof apiRequestSchema>;

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(STATUSES).optional(),
});
export type ListQuery = z.input<typeof listQuerySchema>;

export const statusChangeSchema = z.object({ status: z.enum(STATUSES) });

export const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

/** Parse or throw a 422 that names every bad field. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (res.success) return res.data;
  const details: FieldIssue[] = res.error.issues.map((i) => ({
    field: i.path.join(".") || "(body)",
    message: i.message,
  }));
  throw new ApiError(
    422,
    "validation_error",
    `Invalid input: ${details.map((d) => `${d.field} — ${d.message}`).join("; ")}`,
    { details },
  );
}

export function parseId(raw: unknown): number {
  const res = idSchema.safeParse(raw);
  if (!res.success) throw notFound(String(raw));
  return res.data;
}

const notFound = (id: string | number, admin = false) =>
  new ApiError(
    404,
    "not_found",
    admin
      ? `Request #${id} does not exist. List requests with GET /api/v1/admin/requests.`
      : `Request #${id} was not found among this account's requests. List them with GET /api/v1/requests.`,
  );

function page<T>(items: T[], total: number, q: { limit: number; offset: number }): Page<T> {
  const has_more = q.offset + items.length < total;
  return {
    items,
    total,
    limit: q.limit,
    offset: q.offset,
    has_more,
    next_offset: has_more ? q.offset + items.length : null,
  };
}

// ---------------------------------------------------------------------------
// Operations

export function listServices(): ApiService[] {
  return services.map((s) => ({ slug: s.slug, title: s.title, description: s.body }));
}

export async function listOwnRequests(
  caller: ApiCaller,
  query: unknown,
): Promise<Page<ApiRequest>> {
  const q = parseInput(listQuerySchema, query);
  const sql = await getSql();
  const status = q.status ?? null;
  const [rows, count] = await Promise.all([
    sql<Row>`
      select id, service_slug, service_title, company, brief, status, created_at
      from requests
      where user_id = ${caller.userId} and (${status}::text is null or status = ${status})
      order by id desc
      limit ${q.limit} offset ${q.offset}
    `,
    sql<{ n: number }>`
      select count(*)::int as n from requests
      where user_id = ${caller.userId} and (${status}::text is null or status = ${status})
    `,
  ]);
  return page(rows.map(toApi), count[0]?.n ?? 0, q);
}

export async function getOwnRequest(caller: ApiCaller, rawId: unknown): Promise<ApiRequest> {
  const id = parseId(rawId);
  const sql = await getSql();
  const rows = await sql<Row>`
    select id, service_slug, service_title, company, brief, status, created_at
    from requests where id = ${id} and user_id = ${caller.userId}
  `;
  if (!rows[0]) throw notFound(id);
  return toApi(rows[0]);
}

export async function createOwnRequest(caller: ApiCaller, input: unknown): Promise<ApiRequest> {
  const data = parseInput(apiRequestSchema, input);
  const service = serviceBySlug(data.slug);
  if (!service) {
    throw new ApiError(422, "validation_error", `Unknown service "${data.slug}" (${LEAD_ERRORS.service}). List valid slugs with GET /api/v1/services.`, {
      details: [{ field: "slug", message: LEAD_ERRORS.service }],
    });
  }
  const phone = normalizePhone(data.phone);
  if (!phone) {
    throw new ApiError(422, "validation_error", `Invalid phone number (${LEAD_ERRORS.phone}). Use a Saudi mobile such as 0551234567 or +966551234567.`, {
      details: [{ field: "phone", message: LEAD_ERRORS.phone }],
    });
  }
  await takeRateHit(`api-write:${caller.keyId}`, WRITE_LIMIT, WRITE_WINDOW_SECONDS);

  const sql = await getSql();
  const rows = await sql<Row>`
    insert into requests
      (user_id, service_slug, service_title, contact_name, phone, company, brief, status, consent_at)
    values (
      ${caller.userId}, ${service.slug}, ${service.title}, ${data.name}, ${phone},
      ${data.company}, ${data.brief}, 'new', now()
    )
    returning id, service_slug, service_title, company, brief, status, created_at
  `;
  const row = rows[0];

  const { notifyNewLead } = await import("@/lib/notify.server");
  const delivered = await notifyNewLead({
    id: row.id,
    service: service.title,
    name: data.name,
    phone,
    company: data.company,
    brief: data.brief,
    source: "form",
  });
  if (delivered) await sql`update requests set notified_at = now() where id = ${row.id}`;
  return toApi(row);
}

const ADMIN_COLUMNS = `
  r.id, r.service_slug, r.service_title, r.company, r.brief, r.status, r.created_at,
  r.contact_name, r.phone, r.notified_at, u.email as account_email, r.source`;

export async function adminListRequests(query: unknown): Promise<Page<ApiAdminRequest>> {
  const q = parseInput(listQuerySchema, query);
  const sql = await getSql();
  const status = q.status ?? null;
  const [rows, count] = await Promise.all([
    sql.query<AdminRow>(
      `select ${ADMIN_COLUMNS}
       from requests r left join "user" u on u.id = r.user_id
       where ($1::text is null or r.status = $1)
       order by r.id desc limit $2 offset $3`,
      [status, q.limit, q.offset],
    ),
    sql<{ n: number }>`
      select count(*)::int as n from requests where (${status}::text is null or status = ${status})
    `,
  ]);
  return page(rows.map(toAdminApi), count[0]?.n ?? 0, q);
}

export async function adminUpdateStatus(
  caller: ApiCaller,
  rawId: unknown,
  input: unknown,
): Promise<ApiAdminRequest> {
  const id = parseId(rawId);
  const { status } = parseInput(statusChangeSchema, input);
  const sql = await getSql();
  // Logged in the request's activity history as the key owner, via the API.
  const { setStatusLogged } = await import("@/lib/request-workflow.server");
  const res = await setStatusLogged(sql, id, status, caller.userId, "api");
  if (!res.found) throw notFound(id, true);
  const rows = await sql.query<AdminRow>(
    `select ${ADMIN_COLUMNS} from requests r left join "user" u on u.id = r.user_id where r.id = $1`,
    [id],
  );
  return toAdminApi(rows[0]);
}
