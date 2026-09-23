/**
 * New-lead notification — **server-only**.
 *
 * Posts to `LEADS_WEBHOOK_URL` when it is set. The body carries a Slack/Discord
 * compatible `text` line plus the structured `lead`, so the same URL works for
 * a Slack or Discord channel, Zapier/Make (→ WhatsApp, email, CRM) or a custom
 * endpoint. `LEADS_WEBHOOK_SECRET`, when set, is sent as a bearer token.
 *
 * Never throws: a failed notification must not lose the lead, which is already
 * stored. Returns whether delivery succeeded so the caller can record it.
 */
export type LeadNotice = {
  id: number;
  service: string;
  name: string;
  phone: string;
  company: string;
  brief: string;
  source: "form" | "line";
};

export async function notifyNewLead(lead: LeadNotice): Promise<boolean> {
  const url = process.env.LEADS_WEBHOOK_URL?.trim();
  if (!url) {
    console.warn(
      `[leads] LEADS_WEBHOOK_URL is not set — lead #${lead.id} stored without notification`,
    );
    return false;
  }
  const secret = process.env.LEADS_WEBHOOK_SECRET?.trim();
  const text =
    `طلب جديد #${lead.id} — ${lead.service}\n` +
    `${lead.name} · ${lead.phone}${lead.company ? ` · ${lead.company}` : ""}\n\n${lead.brief}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ text, content: text, lead }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`[leads] webhook answered ${res.status} for lead #${lead.id}`);
    return res.ok;
  } catch (err) {
    console.error(`[leads] webhook failed for lead #${lead.id}:`, err);
    return false;
  }
}
