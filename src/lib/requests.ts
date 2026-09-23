import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { serviceBySlug } from "@/lib/content";
import { normalizePhone } from "@/lib/phone";

/** Milliseconds a human needs at minimum to fill the form. */
const MIN_FILL_MS = 2500;

export const leadSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(24),
  company: z.string().trim().max(120),
  brief: z.string().trim().min(8).max(2000),
  consent: z.literal(true),
  /** Honeypot: hidden from people, filled by naive bots. */
  website: z.string().max(200).optional(),
  source: z.enum(["form", "line"]).default("form"),
});

/** What the public form submits: the lead plus how long it took to fill. */
const leadFormSchema = leadSchema.extend({
  /** Milliseconds from form mount to submit, from the browser's monotonic clock. */
  fillMs: z.number().int().min(0),
});

export type LeadInput = z.input<typeof leadFormSchema>;

export type RequestRow = {
  id: number;
  service_slug: string;
  service_title: string;
  company: string;
  brief: string;
  status: string;
  created_at: string;
};

/** Error messages the form shows verbatim; anything else gets a generic line. */
export const LEAD_ERRORS = {
  phone: "رقم الجوال غير صحيح",
  service: "خدمة غير موجودة",
  busy: "وصلنا عدد كبير من الطلبات منك، حاول بعد ساعة أو اتصل بنا مباشرة.",
  tooFast: "أُرسل النموذج أسرع من المعتاد. راجع بياناتك ثم أرسل الطلب مرة أخرى.",
} as const;

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

/**
 * Public, insert-only lead intake. Signed-in visitors get the row linked to
 * their account (so it shows in /client); guests are identified by the phone
 * they give. Never returns other rows.
 */
export const createRequest = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: unknown) => leadFormSchema.parse(input))
  .handler(async ({ context, data }) => {
    // Only bots fill the hidden honeypot: fake success, so they learn nothing;
    // no row is written.
    if (data.website) return { id: 0 };
    // Instant submits are likely bots, but autofill can be fast too: refuse
    // with a real message so a person can simply send again.
    if (data.fillMs < MIN_FILL_MS) throw new Error(LEAD_ERRORS.tooFast);

    const service = serviceBySlug(data.slug);
    if (!service) throw new Error(LEAD_ERRORS.service);
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error(LEAD_ERRORS.phone);

    const { visitorId, takeHit, RateLimitError } = await import("@/lib/rate-limit.server");
    try {
      await takeHit(`lead:${visitorId()}`, 5, 3600);
    } catch (err) {
      if (err instanceof RateLimitError) throw new Error(LEAD_ERRORS.busy);
      throw err;
    }

    // Retention (privacy policy): drop requests past two years, at most daily.
    const { pruneExpiredRequests } = await import("@/lib/retention.server");
    await pruneExpiredRequests();

    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into requests
        (user_id, service_slug, service_title, contact_name, phone, company, brief, status, consent_at)
      values (
        ${context.userId},
        ${service.slug},
        ${service.title},
        ${data.name},
        ${phone},
        ${data.company},
        ${data.brief},
        'new',
        now()
      )
      returning id
    `;
    const id = rows[0]?.id ?? 0;

    const { notifyNewLead } = await import("@/lib/notify.server");
    const delivered = await notifyNewLead({
      id,
      service: service.title,
      name: data.name,
      phone,
      company: data.company,
      brief: data.brief,
      source: data.source,
    });
    if (delivered) await sql`update requests set notified_at = now() where id = ${id}`;
    return { id };
  });
