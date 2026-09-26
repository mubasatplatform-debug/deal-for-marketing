import { getSql } from "@/lib/db";
import type { SqlTag } from "@/lib/saas/tenancy-core";
import { agentLlm } from "./agent/llm.server";
import { DIAL_TTL_SEC, signDial, verifyEventSignature } from "./voice-sign";
import type { Transcriber } from "./voice-core";

/**
 * «مركز الاتصال» wiring — **server-only**. The `deal-voice` relay (a Supabase
 * edge function holding the Twilio credentials) at VOICE_RELAY_URL, called
 * with `Authorization: Bearer VOICE_RELAY_TOKEN`:
 *
 *   POST /token      {identity}      → {token, ttl, from}  (Twilio Voice access token)
 *   POST /audio      {recordingSid}  → audio/mpeg
 *   POST /transcribe {recordingSid}  → {text}
 *
 * VOICE_SIGNING_SECRET signs dial parameters and verifies the relay's events
 * (voice-sign.ts). Calls are off unless all three are set.
 */

type Config = { url: string; token: string; secret: string };

function config(): Config | null {
  const url = process.env.VOICE_RELAY_URL?.trim().replace(/\/+$/, "");
  const token = process.env.VOICE_RELAY_TOKEN?.trim();
  const secret = process.env.VOICE_SIGNING_SECRET?.trim();
  if (!url || !token || !secret || !/^https:\/\//.test(url)) return null;
  return { url, token, secret };
}

export function voiceConfigured(): boolean {
  return config() !== null;
}

function need(): Config {
  const c = config();
  if (!c) throw new Error("WS:voice_unavailable");
  return c;
}

async function relay(path: string, body: unknown, timeoutMs = 20_000): Promise<Response> {
  const c = need();
  const res = await fetch(`${c.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${c.token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    console.error(`[voice] relay ${path} answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    throw new Error("WS:voice_unavailable");
  }
  return res;
}

/** A relay identity for a member: `u_<id>` with only the characters it allows. */
export function voiceIdentity(userId: string): string {
  const safe = userId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 110);
  return `u_${safe.length >= 1 ? safe : "member"}`;
}

export async function relayToken(userId: string): Promise<{ token: string; ttl: number }> {
  const res = await relay("/token", { identity: voiceIdentity(userId) });
  const body = (await res.json()) as { token?: string; ttl?: number };
  if (!body.token) throw new Error("WS:voice_unavailable");
  return { token: body.token, ttl: Number(body.ttl) || 3600 };
}

/** The recording's audio stream (mp3) from Twilio, through the relay. */
export async function relayAudio(recordingSid: string): Promise<Response> {
  return relay("/audio", { recordingSid }, 30_000);
}

export const relayTranscribe: Transcriber = async (recordingSid) => {
  const res = await relay("/transcribe", { recordingSid }, 120_000);
  const body = (await res.json()) as { text?: string };
  return typeof body.text === "string" ? body.text : "";
};

export function dialSignature(callId: string, to: string, rec: "1" | "0"): { sig: string; exp: string } {
  const exp = Math.floor(Date.now() / 1000) + DIAL_TTL_SEC;
  return { sig: signDial(need().secret, callId, to, rec, exp), exp: String(exp) };
}

export function verifyRelayEvent(timestamp: string | null, signature: string | null, rawBody: string) {
  const c = config();
  if (!c) return { ok: false as const, reason: "missing" as const };
  return verifyEventSignature(c.secret, timestamp, signature, rawBody);
}

/**
 * After a recording lands: transcribe it and write the AI summary, in the
 * background (the webhook has already answered). Skipped when the office's
 * plan has no AI or the model is not configured; failures are logged and the
 * team can retry from «المكالمات».
 */
export function summarizeInBackground(callId: string): void {
  void (async () => {
    try {
      const sql = (await getSql()) as unknown as SqlTag;
      const { callWorkspaceCore, summarizeCallByIdCore } = await import("./voice-core");
      const { planHas } = await import("@/lib/saas/plans");
      const ws = await callWorkspaceCore(sql, callId);
      if (!ws) return;
      const [w] = await sql<{ plan: string }>`select plan from workspaces where id = ${ws}`;
      const llm = agentLlm();
      if (!w || !planHas(w.plan, "aiDrafting") || !llm) return;
      await summarizeCallByIdCore(sql, ws, callId, { llm, transcribe: relayTranscribe });
    } catch (err) {
      console.error("[voice] background summary failed:", err instanceof Error ? err.message : "unknown error");
    }
  })();
}
