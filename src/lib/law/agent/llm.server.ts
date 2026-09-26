import type { Llm, LlmResult } from "./agent-core";

/**
 * The model behind «مساعد المكتب» — **server-only**. An OpenAI-compatible
 * chat-completions endpoint with tool calling: DEAL's `deal-law-agent` relay
 * (provider keys stay in Supabase Vault) via LAW_AGENT_URL + LAW_AGENT_TOKEN.
 * Returns null when not configured, so the assistant reports "unavailable"
 * instead of failing.
 */
export function agentLlm(): Llm | null {
  const base = process.env.LAW_AGENT_URL?.trim();
  const token = process.env.LAW_AGENT_TOKEN?.trim();
  if (!base || !token) return null;
  const url = `${base.replace(/\/+$/, "")}/chat/completions`;
  return async (messages, opts): Promise<LlmResult> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      // A plain completion (no tools, e.g. the inbox) omits tool_choice: providers reject it without tools.
      body: JSON.stringify({
        messages,
        ...(opts.tools.length ? { tools: opts.tools, tool_choice: opts.toolChoice } : {}),
        temperature: 0.2,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) {
      console.error(`[law-agent] relay answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      throw new Error("WS:ai_unavailable");
    }
    const body = (await res.json()) as { choices?: { message?: LlmResult }[] };
    const msg = body.choices?.[0]?.message;
    if (!msg) throw new Error("WS:ai_unavailable");
    return { content: msg.content ?? null, tool_calls: msg.tool_calls };
  };
}
