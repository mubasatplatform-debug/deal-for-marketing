import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  KEY_EXPIRY_OPTIONS,
  MAX_ACTIVE_KEYS,
  SCOPES,
  ScopeError,
  grantableScopes,
  normalizeRequestedScopes,
  type Scope,
} from "./scopes";

/**
 * Server functions behind the keys pages (/client/keys, /admin/keys). Every
 * query is scoped to the signed-in user; the team usage view additionally
 * requires the admin rule (`isAdminUser`).
 */

export type ApiKeyRow = {
  id: number;
  name: string;
  prefix: string;
  scopes: Scope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  /** Null: valid until revoked. */
  expires_at: string | null;
  /** Authenticated calls in the last 7 days. */
  calls_7d: number;
};

export type KeysOverview = {
  isAdmin: boolean;
  grantable: Scope[];
  keys: ApiKeyRow[];
};

export type UsageRow = {
  id: number;
  at: string;
  method: string;
  target: string;
  status: number;
  key_id: number;
  key_name: string;
  key_prefix: string;
  owner_email: string | null;
};

export type TeamKeyRow = ApiKeyRow & { owner_email: string | null; owner_name: string | null };

export type TeamUsage = {
  events: UsageRow[];
  keys: TeamKeyRow[];
  totals: { calls_24h: number; errors_24h: number; active_keys: number; keys_used_24h: number };
};

/** Error messages the UI shows verbatim. */
export const KEY_ERRORS = {
  limit: `وصلت للحد الأعلى (${MAX_ACTIVE_KEYS} مفاتيح فعّالة). ألغِ مفتاحًا لا تستخدمه ثم أنشئ الجديد.`,
  notFound: "المفتاح غير موجود.",
  forbidden: "Forbidden",
} as const;

type DbKey = Omit<ApiKeyRow, "created_at" | "last_used_at" | "revoked_at" | "expires_at"> & {
  created_at: string | Date;
  last_used_at: string | Date | null;
  revoked_at: string | Date | null;
  expires_at: string | Date | null;
};

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

function toRow<T extends DbKey>(k: T) {
  return {
    ...k,
    scopes: SCOPES.filter((s) => (k.scopes as string[]).includes(s)),
    created_at: iso(k.created_at) as string,
    last_used_at: iso(k.last_used_at),
    revoked_at: iso(k.revoked_at),
    expires_at: iso(k.expires_at),
  };
}

const isAdmin = (userId: string) =>
  import("./admin.server").then((m) => m.isAdminUser(userId));

export const getKeysOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<KeysOverview> => {
    const sql = await getSql();
    const [admin, rows] = await Promise.all([
      isAdmin(context.userId),
      sql<DbKey>`
        select k.id, k.name, k.prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at, k.expires_at,
               (select count(*)::int from api_audit a
                 where a.key_id = k.id and a.at > now() - interval '7 days') as calls_7d
        from api_keys k
        where k.user_id = ${context.userId}
          and (k.revoked_at is null or k.revoked_at > now() - interval '30 days')
          and (k.expires_at is null or k.expires_at > now() - interval '30 days')
        order by (k.revoked_at is null and (k.expires_at is null or k.expires_at > now())) desc,
                 k.created_at desc
        limit 50
      `,
    ]);
    return { isAdmin: admin, grantable: grantableScopes(admin), keys: rows.map(toRow) };
  });

const EXPIRY_DAYS: number[] = KEY_EXPIRY_OPTIONS.flatMap((o) => (o.days === null ? [] : [o.days]));

const createSchema = z.object({
  name: z.string().trim().min(1, "اكتب اسمًا للمفتاح").max(60, "الاسم أطول من 60 حرفًا"),
  scopes: z.array(z.string().max(64)).min(1, "اختر صلاحية واحدة على الأقل").max(SCOPES.length),
  /** Days until the key stops working; null = until revoked. */
  expiresInDays: z
    .number()
    .int()
    .refine((d) => EXPIRY_DAYS.includes(d), "مدة صلاحية غير مدعومة")
    .nullable()
    .default(null),
});

/** Zod's default message is a JSON dump; the dialog shows the first issue instead. */
function parseCreate(input: unknown) {
  const res = createSchema.safeParse(input);
  if (!res.success) throw new ScopeError(res.error.issues[0]?.message ?? "بيانات غير صالحة.");
  return res.data;
}

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseCreate)
  .handler(async ({ context, data }): Promise<{ key: ApiKeyRow; secret: string }> => {
    const admin = await isAdmin(context.userId);
    const scopes = normalizeRequestedScopes(data.scopes, admin);
    const sql = await getSql();
    const active = await sql<{ n: number }>`
      select count(*)::int as n from api_keys
      where user_id = ${context.userId} and revoked_at is null
        and (expires_at is null or expires_at > now())
    `;
    if ((active[0]?.n ?? 0) >= MAX_ACTIVE_KEYS) throw new Error(KEY_ERRORS.limit);

    const { generateApiKey } = await import("./secret.server");
    // The display prefix is unique; retry the (astronomically unlikely) clash.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { secret, prefix, hash } = generateApiKey();
      const rows = await sql<DbKey>`
        insert into api_keys (user_id, name, prefix, key_hash, scopes, expires_at)
        values (
          ${context.userId}, ${data.name}, ${prefix}, ${hash}, ${scopes},
          case when ${data.expiresInDays}::int is null then null
               else now() + ${data.expiresInDays}::int * interval '1 day' end
        )
        on conflict do nothing
        returning id, name, prefix, scopes, created_at, last_used_at, revoked_at, expires_at, 0 as calls_7d
      `;
      if (rows[0]) return { key: toRow(rows[0]), secret };
    }
    throw new Error("تعذّر إنشاء المفتاح، حاول مرة أخرى.");
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ context, data }): Promise<{ revoked_at: string }> => {
    const sql = await getSql();
    const rows = await sql<{ revoked_at: string | Date }>`
      update api_keys set revoked_at = coalesce(revoked_at, now())
      where id = ${data.id} and user_id = ${context.userId}
      returning revoked_at
    `;
    if (!rows[0]) throw new Error(KEY_ERRORS.notFound);
    return { revoked_at: iso(rows[0].revoked_at) as string };
  });

/** Team only: every key's recent calls, for spotting misuse and broken integrations. */
export const getTeamUsage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TeamUsage> => {
    if (!(await isAdmin(context.userId))) throw new Error(KEY_ERRORS.forbidden);
    const sql = await getSql();
    const [events, keys, totals] = await Promise.all([
      sql<Omit<UsageRow, "at"> & { at: string | Date }>`
        select a.id, a.at, a.method, a.target, a.status, a.key_id,
               k.name as key_name, k.prefix as key_prefix, u.email as owner_email
        from api_audit a
        join api_keys k on k.id = a.key_id
        left join "user" u on u.id = k.user_id
        order by a.at desc, a.id desc
        limit 100
      `,
      sql<DbKey & { owner_email: string | null; owner_name: string | null }>`
        select k.id, k.name, k.prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at, k.expires_at,
               u.email as owner_email, u.name as owner_name,
               (select count(*)::int from api_audit a
                 where a.key_id = k.id and a.at > now() - interval '7 days') as calls_7d
        from api_keys k
        left join "user" u on u.id = k.user_id
        where k.revoked_at is null and (k.expires_at is null or k.expires_at > now())
        order by k.last_used_at desc nulls last, k.created_at desc
        limit 200
      `,
      sql<TeamUsage["totals"]>`
        select
          (select count(*)::int from api_audit where at > now() - interval '24 hours') as calls_24h,
          (select count(*)::int from api_audit where at > now() - interval '24 hours' and status >= 400) as errors_24h,
          (select count(*)::int from api_keys
            where revoked_at is null and (expires_at is null or expires_at > now())) as active_keys,
          (select count(distinct key_id)::int from api_audit where at > now() - interval '24 hours') as keys_used_24h
      `,
    ]);
    return {
      events: events.map((e) => ({ ...e, at: new Date(e.at).toISOString() })),
      keys: keys.map(toRow),
      totals: totals[0] ?? { calls_24h: 0, errors_24h: 0, active_keys: 0, keys_used_24h: 0 },
    };
  });
