import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/cron/reminders — run the automatic reminders once
 * (src/lib/law/reminders.server.ts). For an external scheduler, every ~15
 * minutes: `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET the
 * endpoint is off (503). Answers `{ ok, client24, client1, digests, failed }`.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function authorized(header: string | null, secret: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const given = /^Bearer\s+(.+)$/i.exec(header ?? "")?.[1]?.trim() ?? "";
  // Hash both sides so the comparison is constant-time whatever the lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return given.length > 0 && timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return json({ error: "cron_disabled" }, 503);
  if (!(await authorized(request.headers.get("authorization"), secret))) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    const { runReminders } = await import("@/lib/law/reminders.server");
    const counts = await runReminders();
    console.info(
      `[cron] reminders: client24=${counts.client24} client1=${counts.client1} digests=${counts.digests} failed=${counts.failed}`,
    );
    return json({ ok: true, ...counts });
  } catch (err) {
    console.error("[cron] reminders run failed:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "run_failed" }, 500);
  }
}

export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      ANY: async () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
