import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { INVITE_ROLES, ROLES, ROLE_LABELS, type InviteRole, type Lifecycle, type Role } from "./lifecycle";
import { PLAN_IDS, getPlan, type BillingCycle, type PlanId } from "./plans";
import type {
  InvoiceRow,
  InvitePreview,
  Membership,
  OpenInviteRow,
  SeatUsage,
  TeamMemberRow,
  WorkspaceRow,
} from "./tenancy-core";

/**
 * «مكتب المحامي» server functions. Every function that touches an office's
 * rows takes the office id from the browser AND passes it through
 * `requireWorkspace` (guard.server.ts) with the verified session user before
 * any query — see that file. Server-only modules are imported inside the
 * handlers so they never reach the client bundle.
 */

const guard = () => import("./guard.server");
const core = () => import("./tenancy-core");

const wsId = z.string().uuid();
const TEAM_SIZES = ["1", "2-5", "6-10", "11-25", "26+"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export type AppUserInfo = { id: string; name: string; email: string };

export type ActiveWorkspace = {
  workspace: WorkspaceRow;
  role: Role;
  lifecycle: Lifecycle;
  seats: SeatUsage;
};

export type MembershipSummary = Pick<Membership, "id" | "name" | "role" | "city" | "members"> & {
  status: Lifecycle["status"];
};

export type AppContext = {
  user: AppUserInfo;
  memberships: MembershipSummary[];
  active: ActiveWorkspace | null;
};

async function userInfo(userId: string): Promise<AppUserInfo> {
  const sql = await getSql();
  const [u] = await sql<{ name: string; email: string }>`select name, email from "user" where id = ${userId}`;
  return { id: userId, name: u?.name?.trim() || u?.email || "", email: u?.email ?? "" };
}

/**
 * Bootstrap for /app: who you are, your offices, and the one to open — the
 * requested id (only if you are a member: otherwise 403), else your last
 * office, else the first.
 */
export const getAppContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId.nullish() }).parse(input ?? {}))
  .handler(async ({ context, data }): Promise<AppContext> => {
    const { withStatus } = await guard();
    const { pickActiveWorkspace, seatUsage } = await core();
    // Two-step sign-in comes before anything about the offices.
    const { assertSecondFactor } = await import("@/lib/otp/otp.server");
    await withStatus(() => assertSecondFactor(context.userId));
    const sql = await getSql();
    const [user, picked] = await Promise.all([
      userInfo(context.userId),
      withStatus(() => pickActiveWorkspace(sql, context.userId, data.workspaceId ?? null)),
    ]);
    const memberships = picked.memberships.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      city: m.city,
      members: m.members,
      status: m.lifecycle.status,
    }));
    if (!picked.active) return { user, memberships, active: null };
    const a = picked.active;
    const { role, lifecycle, members: _members, ...workspace } = a;
    void _members;
    return {
      user,
      memberships,
      active: { workspace, role, lifecycle, seats: await seatUsage(sql, a.id, a.plan) },
    };
  });

export const setActiveWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }) => {
    const { withStatus } = await guard();
    const { pickActiveWorkspace } = await core();
    const sql = await getSql();
    await withStatus(() => pickActiveWorkspace(sql, context.userId, data.workspaceId));
    return { ok: true };
  });

const officeFields = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(60),
  crNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)))
    .refine((v) => v === "" || /^[0-9]{10}$/.test(v), "CR")
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  teamSize: z.enum(TEAM_SIZES).nullish(),
});

/** Sign-up step 2: create the office (caller becomes owner, 14-day trial). */
export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => officeFields.extend({ acceptTerms: z.literal(true) }).parse(input))
  .handler(async ({ context, data }) => {
    const { withStatus, publicOrigin } = await guard();
    const { createWorkspaceCore } = await core();
    const { randomBytes } = await import("node:crypto");
    const sql = await getSql();
    const slug = `office-${randomBytes(5).toString("hex")}`;
    const { id } = await withStatus(() =>
      createWorkspaceCore(sql, context.userId, {
        name: data.name,
        city: data.city,
        crNumber: data.crNumber ?? null,
        teamSize: data.teamSize ?? null,
        slug,
      }),
    );
    const user = await userInfo(context.userId);
    const { sendTeamAlert } = await import("@/lib/mail.server");
    await sendTeamAlert(
      `مكتب محاماة جديد: ${data.name}`,
      [
        `سجّل مكتب جديد في «مكتب المحامي» وبدأ تجربته المجانية.`,
        `المكتب: ${data.name}`,
        `المدينة: ${data.city}`,
        `السجل التجاري: ${data.crNumber ?? "—"}`,
        `حجم الفريق: ${data.teamSize ?? "—"}`,
        `المالك: ${user.name} <${user.email}>`,
        `لوحة المشتركين: ${publicOrigin()}/admin/law`,
      ].join("\n"),
    );
    return { id };
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => officeFields.extend({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }) => {
    const { requireWorkspace } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin", { write: true });
    const { updateWorkspaceCore } = await core();
    await updateWorkspaceCore(await getSql(), access, {
      name: data.name,
      city: data.city,
      crNumber: data.crNumber ?? null,
      teamSize: data.teamSize ?? null,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Team                                                                      */
/* ------------------------------------------------------------------------ */

export type TeamView = {
  members: TeamMemberRow[];
  invites: OpenInviteRow[];
  seats: SeatUsage;
  me: string;
  myRole: Role;
  readOnly: boolean;
};

export const getTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<TeamView> => {
    const { requireWorkspace } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId);
    const { teamCore } = await core();
    const team = await teamCore(await getSql(), access);
    return { ...team, me: context.userId, myRole: access.role, readOnly: access.lifecycle.readOnly };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        email: z.string().trim().toLowerCase().email().max(254),
        role: z.enum(INVITE_ROLES as [InviteRole, ...InviteRole[]]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireWorkspace, withStatus, publicOrigin } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin", { write: true });
    const { newInviteToken } = await import("./invite-token");
    const { createInviteCore } = await core();
    const { token, hash } = newInviteToken();
    const sql = await getSql();
    await withStatus(() => createInviteCore(sql, access, data.email, data.role, hash));
    const url = `${publicOrigin()}/app/invite/${token}`;
    const inviter = await userInfo(context.userId);
    const { sendWorkspaceInviteEmail } = await import("@/lib/mail.server");
    const emailed = await sendWorkspaceInviteEmail({
      to: data.email,
      workspace: access.workspace.name,
      inviter: inviter.name,
      role: ROLE_LABELS[data.role],
      url,
    });
    // The link is shown once to the inviter to copy; only its hash is stored.
    return { url, emailed };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { requireWorkspace, withStatus } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin", { write: true });
    const { revokeInviteCore } = await core();
    const sql = await getSql();
    await withStatus(() => revokeInviteCore(sql, access, data.inviteId));
    return { ok: true };
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        userId: z.string().min(1).max(128),
        role: z.enum(ROLES as [Role, ...Role[]]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireWorkspace, withStatus } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin", { write: true });
    const { setRoleCore } = await core();
    const sql = await getSql();
    await withStatus(() => setRoleCore(sql, access, data.userId, data.role));
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ workspaceId: wsId, userId: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireWorkspace, withStatus } = await guard();
    // Leaving is allowed even when read-only; removing someone else is a write.
    const self = data.userId === context.userId;
    const access = await requireWorkspace(context.userId, data.workspaceId, self ? "staff" : "admin", {
      write: !self,
    });
    const { removeMemberCore } = await core();
    const sql = await getSql();
    await withStatus(() => removeMemberCore(sql, access, data.userId));
    return { ok: true };
  });

/* ------------------------------------------------------------------------ */
/* Invite links                                                              */
/* ------------------------------------------------------------------------ */

export type InviteLookup = {
  invite: InvitePreview | null;
  /** The signed-in account's email, when someone is signed in. */
  signedInEmail: string | null;
};

const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

/** What /app/invite/$token shows. The unguessable token is the credential. */
export const getInvite = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator((input: unknown) => {
    const r = tokenInput.safeParse(input);
    return r.success ? r.data : { token: "" };
  })
  .handler(async ({ context, data }): Promise<InviteLookup> => {
    const signedInEmail = context.userId ? (await userInfo(context.userId)).email || null : null;
    if (!data.token) return { invite: null, signedInEmail };
    const { hashInviteToken } = await import("./invite-token");
    const { previewInviteCore } = await core();
    const invite = await previewInviteCore(await getSql(), hashInviteToken(data.token));
    return { invite, signedInEmail };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ context, data }) => {
    const { withStatus } = await guard();
    const { hashInviteToken } = await import("./invite-token");
    const { acceptInviteCore } = await core();
    const sql = await getSql();
    const me = await userInfo(context.userId);
    return withStatus(() => acceptInviteCore(sql, context.userId, me.email, hashInviteToken(data.token)));
  });

/* ------------------------------------------------------------------------ */
/* Billing                                                                   */
/* ------------------------------------------------------------------------ */

export type BillingView = {
  plan: PlanId;
  cycle: BillingCycle;
  lifecycle: Lifecycle;
  seats: SeatUsage;
  invoices: InvoiceRow[];
  providers: import("./payments/types").ProviderId[];
  bank: import("./payments/types").BankDetails | null;
};

export const getBilling = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId }).parse(input))
  .handler(async ({ context, data }): Promise<BillingView> => {
    const { requireWorkspace } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin");
    const { listInvoicesCore, seatUsage } = await core();
    const { enabledProviders } = await import("./payments/index");
    const { bankDetails } = await import("./payments/manual");
    const sql = await getSql();
    const [invoices, seats] = await Promise.all([
      listInvoicesCore(sql, access.workspace.id),
      seatUsage(sql, access.workspace.id, access.workspace.plan),
    ]);
    return {
      plan: getPlan(access.workspace.plan).id,
      cycle: access.workspace.billing_cycle,
      lifecycle: access.lifecycle,
      seats,
      invoices,
      providers: enabledProviders(),
      bank: bankDetails(),
    };
  });

export type CheckoutResponse =
  | { kind: "redirect"; url: string }
  | { kind: "instructions"; invoice: InvoiceRow; bank: import("./payments/types").BankDetails | null };

/**
 * Start paying for a plan. Deliberately NOT write-gated: a suspended office
 * must be able to pay its way back. Owner/admin only.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: wsId,
        plan: z.enum(PLAN_IDS),
        cycle: z.enum(["monthly", "yearly"]),
        provider: z.enum(["manual", "moyasar", "edfapay"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<CheckoutResponse> => {
    const { requireWorkspace, withStatus, publicOrigin } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin");
    const { paymentProvider } = await import("./payments/index");
    const provider = paymentProvider(data.provider);
    if (!provider.enabled()) throw new Error("Payment method unavailable");
    const { createInvoiceCore, setInvoiceProviderRef } = await core();
    const sql = await getSql();
    const { invoice, reused } = await withStatus(() =>
      createInvoiceCore(sql, access, data.plan, data.cycle, data.provider),
    );
    const plan = getPlan(data.plan);
    const origin = publicOrigin();
    const result = await provider.checkout({
      invoice,
      workspace: { id: access.workspace.id, name: access.workspace.name },
      planName: plan.name,
      returnUrl: `${origin}/app/billing?checkout=${invoice.id}`,
      callbackUrl: `${origin}/api/law/${data.provider}`,
    });
    if (result.kind === "redirect") {
      await setInvoiceProviderRef(sql, invoice.id, result.providerRef);
      return { kind: "redirect", url: result.url };
    }
    if (!reused) {
      const me = await userInfo(context.userId);
      const { sendTeamAlert } = await import("@/lib/mail.server");
      await sendTeamAlert(
        `طلب تفعيل يدوي #${invoice.number} — ${access.workspace.name}`,
        [
          `طلب مكتب «${access.workspace.name}» الاشتراك في خطة ${plan.name} (${data.cycle === "yearly" ? "سنوي" : "شهري"}) بالتحويل البنكي.`,
          `المبلغ: ${(invoice.total / 100).toFixed(2)} ر.س شامل ضريبة القيمة المضافة`,
          `مرجع الطلب: #${invoice.number}`,
          `مقدّم الطلب: ${me.name} <${me.email}>`,
          `بعد وصول التحويل: ${origin}/admin/law`,
        ].join("\n"),
      );
    }
    return { kind: "instructions", invoice, bank: result.bank };
  });

/** Back from the hosted payment page: ask the provider, never the URL. */
export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ workspaceId: wsId, invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { requireWorkspace } = await guard();
    const access = await requireWorkspace(context.userId, data.workspaceId, "admin");
    const { listInvoicesCore, markInvoicePaidCore } = await core();
    const sql = await getSql();
    const invoice = (await listInvoicesCore(sql, access.workspace.id)).find((i) => i.id === data.invoiceId);
    if (!invoice) return { status: "unknown" as const };
    if (invoice.status !== "pending") return { status: invoice.status };
    const { paymentProvider } = await import("./payments/index");
    const provider = paymentProvider(invoice.provider);
    if (!provider.enabled()) return { status: "pending" as const };
    const verdict = await provider.verify(invoice);
    if (verdict === "paid") {
      await markInvoicePaidCore(sql, invoice.id, null);
      return { status: "paid" as const };
    }
    return { status: verdict };
  });
