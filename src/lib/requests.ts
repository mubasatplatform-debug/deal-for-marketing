import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { serviceBySlug } from "@/lib/content";

const createSchema = z.object({
  slug: z.string().min(1),
  company: z.string().max(120),
  brief: z.string().min(8).max(2000),
});

export type RequestRow = {
  id: number;
  service_slug: string;
  service_title: string;
  company: string;
  brief: string;
  status: string;
  created_at: string;
};

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<RequestRow>`
      select id, service_slug, service_title, company, brief, status, created_at
      from requests
      where user_id = ${context.userId}
      order by id desc
    `;
  });

export const createRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }) => {
    const service = serviceBySlug(data.slug);
    if (!service) throw new Error("خدمة غير موجودة");
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into requests (user_id, service_slug, service_title, company, brief, status)
      values (
        ${context.userId},
        ${service.slug},
        ${service.title},
        ${data.company.trim()},
        ${data.brief.trim()},
        'new'
      )
      returning id
    `;
    return { id: rows[0]?.id ?? 0 };
  });
