import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { uuid, wsId } from "./schemas";
import type { PortalStatus, PortalView } from "./portal-core";

/**
 * «بوابة العميل» server functions.
 *
 * Office side (session + `run`: membership, role and read-only checked in the
 * database; managing the link and sharing documents needs `client.portal`):
 * link status, create/rotate (the full URL is returned ONCE — only its hash
 * is stored), revoke, and the per-document share toggle.
 *
 * Public side (/portal/<token>, no account): same-site only and rate-limited
 * per visitor (hashed IP), like the meet page (public.ts).
 */

const runner = () => import("./run.server");
const core = () => import("./portal-core");

const byClient = z.object({ workspaceId: wsId, clientId: uuid });

export const getPortalStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byClient.parse(input))
  .handler(async ({ context, data }): Promise<PortalStatus> => {
    const { run } = await runner();
    const { portalStatusCore } = await core();
    return run(context.userId, data.workspaceId, {}, (sql, access) => portalStatusCore(sql, access, data.clientId));
  });

/** Create the client's link, or replace it (the old link stops working). */
export const createPortalLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byClient.parse(input))
  .handler(async ({ context, data }): Promise<{ url: string; status: PortalStatus }> => {
    const { run } = await runner();
    const { newPortalToken, savePortalCore, portalStatusCore } = await core();
    const { publicOrigin } = await import("@/lib/saas/guard.server");
    const { token, tokenHash } = newPortalToken();
    const status = await run(context.userId, data.workspaceId, { write: true }, async (sql, access) => {
      await savePortalCore(sql, access, data.clientId, tokenHash);
      return portalStatusCore(sql, access, data.clientId);
    });
    return { url: `${publicOrigin()}/portal/${token}`, status };
  });

export const revokePortalLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => byClient.parse(input))
  .handler(async ({ context, data }): Promise<PortalStatus> => {
    const { run } = await runner();
    const { revokePortalCore, portalStatusCore } = await core();
    return run(context.userId, data.workspaceId, { write: true }, async (sql, access) => {
      await revokePortalCore(sql, access, data.clientId);
      return portalStatusCore(sql, access, data.clientId);
    });
  });

export const setDocumentShared = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, id: uuid, shared: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { run } = await runner();
    const { setDocumentSharedCore } = await core();
    await run(context.userId, data.workspaceId, { write: true }, (sql, access) =>
      setDocumentSharedCore(sql, access, data.id, data.shared),
    );
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Public page                                                               */
/* ------------------------------------------------------------------------ */

export const PORTAL_BUSY = "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.";

const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

/** The portal page: null for an unknown, rotated or revoked link (or a suspended office). */
export const getPortal = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const r = tokenInput.safeParse(input);
    return r.success ? r.data : { token: "" };
  })
  .handler(async ({ data }): Promise<PortalView | null> => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    assertSameSiteRequest();
    const { takeHit, visitorId, RateLimitError } = await import("@/lib/rate-limit.server");
    try {
      await takeHit(`portal-view:${visitorId()}`, 120, 600);
    } catch (err) {
      if (err instanceof RateLimitError) throw new Error(PORTAL_BUSY);
      throw err;
    }
    if (!data.token) return null;
    const { hashPortalToken, portalViewCore, touchPortalCore } = await core();
    const { meetUrlFor } = await import("./consult.server");
    const { getSql } = await import("@/lib/db");
    const sql = (await getSql()) as never;
    const hash = hashPortalToken(data.token);
    const view = await portalViewCore(sql, hash, { meetUrl: meetUrlFor });
    if (view) await touchPortalCore(sql, hash);
    return view;
  });
