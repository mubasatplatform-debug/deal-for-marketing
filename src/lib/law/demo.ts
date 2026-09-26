import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { wsId } from "./schemas";
import type { ClearResult, OnboardingState, SeedResult } from "./demo-core";

/**
 * Sample data and the onboarding checklist (demo-core.ts). Seeding and
 * clearing are for office managers (owner/admin) and need a writable office;
 * the checklist is readable by any member. Every handler goes through `run`
 * (run.server.ts): membership + role + read-only checked in the database.
 */

const runner = () => import("./run.server");
const core = () => import("./demo-core");
const ws = z.object({ workspaceId: wsId });

export const getOnboarding = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<OnboardingState> => {
    const { run } = await runner();
    const { onboardingCore } = await core();
    return run(context.userId, data.workspaceId, { minRole: "staff" }, (sql, access) => onboardingCore(sql, access));
  });

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<SeedResult> => {
    const { run } = await runner();
    const { seedDemoCore } = await core();
    return run(context.userId, data.workspaceId, { minRole: "admin", write: true }, (sql, access) =>
      seedDemoCore(sql, access),
    );
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ws.parse(input))
  .handler(async ({ context, data }): Promise<ClearResult> => {
    const { run } = await runner();
    const { clearDemoCore } = await core();
    return run(context.userId, data.workspaceId, { minRole: "admin", write: true }, (sql, access) =>
      clearDemoCore(sql, access),
    );
  });
