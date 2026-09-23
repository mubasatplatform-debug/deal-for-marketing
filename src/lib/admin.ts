import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requestStatus } from "@/lib/content";

export type AdminRequestRow = {
  id: number;
  service_slug: string;
  service_title: string;
  contact_name: string;
  phone: string;
  company: string;
  brief: string;
  status: string;
  created_at: string;
  notified_at: string | null;
  account_email: string | null;
};

export const ADMIN_FORBIDDEN = "Forbidden";

/**
 * Staff are the signed-in users whose account email is listed in
 * `ADMIN_EMAILS` (comma separated), through a **Google** sign-in or an
 * email/password account (off-platform deploys; the owner's account is
 * created at deploy time so nobody else can register that email first).
 * X accounts are never admins: the broker gives them synthetic, unverified
 * emails that anyone could collide with.
 */
async function assertAdmin(userId: string): Promise<void> {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) throw new Error(ADMIN_FORBIDDEN);
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select u.email from "user" u
    join "account" a on a."userId" = u.id
    where u.id = ${userId} and a."providerId" in ('grok-google', 'credential')
    limit 1
  `;
  const email = rows[0]?.email?.toLowerCase();
  if (!email || !allowed.includes(email)) throw new Error(ADMIN_FORBIDDEN);
}

/** The dashboard table loads at most this many requests (most recent first). */
export const ADMIN_LIST_LIMIT = 500;

/**
 * Whole-table figures computed in SQL, so KPIs and charts stay complete when
 * the row list is capped at `ADMIN_LIST_LIMIT`. Days are Riyadh calendar days.
 */
export type AdminTotals = {
  total: number;
  byStatus: Record<string, number>;
  unnotified: number;
  thisWeek: number;
  lastWeek: number;
  byService: { title: string; count: number }[];
  /** Last 30 days, oldest first, zero-filled; `day` is 'YYYY-MM-DD'. */
  daily: { day: string; count: number }[];
};

export type AdminRequestList = { rows: AdminRequestRow[]; totals: AdminTotals };

type Sql = Awaited<ReturnType<typeof getSql>>;

function selectRequests(sql: Sql, limit: number | null) {
  return sql<AdminRequestRow>`
    select r.id, r.service_slug, r.service_title, r.contact_name, r.phone, r.company, r.brief,
           r.status, r.created_at, r.notified_at, u.email as account_email
    from requests r
    left join "user" u on u.id = r.user_id
    order by r.id desc
    limit ${limit}
  `;
}

async function requestTotals(sql: Sql): Promise<AdminTotals> {
  const [[head], statuses, services, daily] = await Promise.all([
    sql<{ total: number; unnotified: number; this_week: number; last_week: number }>`
      select count(*)::int as total,
             count(*) filter (where notified_at is null)::int as unnotified,
             count(*) filter (where created_at >= now() - interval '7 days')::int as this_week,
             count(*) filter (where created_at >= now() - interval '14 days'
                                and created_at < now() - interval '7 days')::int as last_week
      from requests
    `,
    sql<{ status: string; count: number }>`
      select status, count(*)::int as count from requests group by status
    `,
    sql<{ title: string; count: number }>`
      select service_title as title, count(*)::int as count
      from requests group by service_title order by count desc, service_title
    `,
    sql<{ day: string; count: number }>`
      with days as (
        select generate_series(
          (now() at time zone 'Asia/Riyadh')::date - 29,
          (now() at time zone 'Asia/Riyadh')::date,
          interval '1 day'
        )::date as day
      )
      select d.day, count(r.id)::int as count
      from days d
      left join requests r
        on r.created_at >= now() - interval '31 days'
       and (r.created_at at time zone 'Asia/Riyadh')::date = d.day
      group by d.day
      order by d.day
    `,
  ]);
  return {
    total: head?.total ?? 0,
    byStatus: Object.fromEntries(statuses.map((s) => [s.status, s.count])),
    unnotified: head?.unnotified ?? 0,
    thisWeek: head?.this_week ?? 0,
    lastWeek: head?.last_week ?? 0,
    byService: services,
    daily,
  };
}

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminRequestList> => {
    await assertAdmin(context.userId);
    const { pruneExpiredRequests } = await import("@/lib/retention.server");
    await pruneExpiredRequests();
    const sql = await getSql();
    const [rows, totals] = await Promise.all([
      selectRequests(sql, ADMIN_LIST_LIMIT),
      requestTotals(sql),
    ]);
    return { rows, totals };
  });

/** Every request, uncapped — for a complete CSV export. */
export const exportAllRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return selectRequests(await getSql(), null);
  });

const statusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(Object.keys(requestStatus) as [string, ...string[]]),
});

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`update requests set status = ${data.status} where id = ${data.id}`;
    return { ok: true };
  });
