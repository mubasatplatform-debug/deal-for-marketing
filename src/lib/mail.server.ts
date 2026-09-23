/**
 * Transactional mail — **server-only**.
 *
 * Posts to the team's mail relay (`MAIL_RELAY_URL`, bearer `MAIL_RELAY_TOKEN`),
 * which sends from the agency mailbox. The relay only accepts fixed purposes,
 * so this module never sends arbitrary content. Never throws: a failed send is
 * logged, and the caller's flow (e.g. a reset request) still answers the same
 * generic way so it cannot be used to probe which emails have accounts.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  const endpoint = process.env.MAIL_RELAY_URL?.trim();
  const token = process.env.MAIL_RELAY_TOKEN?.trim();
  if (!endpoint || !token) {
    console.warn(
      "[mail] MAIL_RELAY_URL / MAIL_RELAY_TOKEN not set — password reset email not sent",
    );
    return;
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "reset", to: input.to, name: input.name, url: input.url }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[mail] reset email relay answered ${res.status}`);
  } catch (err) {
    console.error("[mail] reset email relay failed:", err);
  }
}
