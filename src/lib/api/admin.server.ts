import { getSql } from "@/lib/db";

/**
 * Is this user on the DEAL team? — **server-only**.
 *
 * The same rule as `assertAdmin` in `src/lib/admin.ts` (kept in lockstep; that
 * file is the /admin panel's): the account email must be listed in
 * `ADMIN_EMAILS` (comma separated) and the account must come from a Google
 * sign-in or an email/password account. X accounts never qualify — the broker
 * gives them synthetic, unverified emails anyone could collide with.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select u.email from "user" u
    join "account" a on a."userId" = u.id
    where u.id = ${userId}
      -- A password account counts only once its email is proven: otherwise
      -- anyone could register a listed address first and become staff.
      and (a."providerId" = 'grok-google' or (a."providerId" = 'credential' and u."emailVerified" = true))
    limit 1
  `;
  const email = rows[0]?.email?.toLowerCase();
  return !!email && allowed.includes(email);
}
