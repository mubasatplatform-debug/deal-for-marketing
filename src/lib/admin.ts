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
 * Staff are the signed-in users whose **Google** account email is listed in
 * `ADMIN_EMAILS` (comma separated). X accounts are never admins: the broker
 * gives them synthetic, unverified emails that anyone could collide with.
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
    where u.id = ${userId} and a."providerId" = 'grok-google'
    limit 1
  `;
  const email = rows[0]?.email?.toLowerCase();
  if (!email || !allowed.includes(email)) throw new Error(ADMIN_FORBIDDEN);
}

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    return sql<AdminRequestRow>`
      select r.id, r.service_slug, r.service_title, r.contact_name, r.phone, r.company, r.brief,
             r.status, r.created_at, r.notified_at, u.email as account_email
      from requests r
      left join "user" u on u.id = r.user_id
      order by r.id desc
      limit 500
    `;
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
