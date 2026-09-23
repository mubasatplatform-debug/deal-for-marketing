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

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  const endpoint = process.env.MAIL_RELAY_URL?.trim();
  const token = process.env.MAIL_RELAY_TOKEN?.trim();
  if (!endpoint || !token) {
    console.warn(
      "[mail] MAIL_RELAY_URL / MAIL_RELAY_TOKEN not set — verification email not sent",
    );
    return;
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "verify", to: input.to, name: input.name, url: input.url }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[mail] verification email relay answered ${res.status}`);
  } catch (err) {
    console.error("[mail] verification email relay failed:", err);
  }
}

export type ThreadNotice = {
  /** `'team'`: the relay's fixed owner inbox; otherwise one customer email. */
  to: string[] | "team";
  /** The customer's name (for the team) or the greeting name (for a customer). */
  name: string;
  requestId: number;
  service: string;
  /** Short plain-text excerpt of the new message. */
  preview: string;
  /** Where to read it: https://<origin>/client or /admin. */
  url: string;
};

/**
 * "New message on your request" email through the relay's `message` action.
 * Body: `{ action: 'message', to, name, requestId, service, preview, url }`,
 * where `to` is the string `'team'` or a single customer email. Never throws;
 * returns whether the relay accepted it.
 */
export async function sendThreadNotice(input: ThreadNotice): Promise<boolean> {
  const endpoint = process.env.MAIL_RELAY_URL?.trim();
  const token = process.env.MAIL_RELAY_TOKEN?.trim();
  if (!endpoint || !token) {
    console.warn(
      `[mail] MAIL_RELAY_URL / MAIL_RELAY_TOKEN not set — thread notice for request #${input.requestId} not sent`,
    );
    return false;
  }
  const to = input.to === "team" ? "team" : input.to[0];
  if (!to) return false;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: "message",
        to,
        name: input.name,
        requestId: input.requestId,
        service: input.service,
        preview: input.preview,
        url: input.url,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[mail] thread notice relay answered ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("[mail] thread notice relay failed:", err);
    return false;
  }
}

/**
 * POST one fixed-purpose message to the relay. Never throws; returns whether
 * the relay accepted it.
 */
async function postRelay(body: Record<string, unknown>, what: string): Promise<boolean> {
  const endpoint = process.env.MAIL_RELAY_URL?.trim();
  const token = process.env.MAIL_RELAY_TOKEN?.trim();
  if (!endpoint || !token) {
    console.warn(`[mail] MAIL_RELAY_URL / MAIL_RELAY_TOKEN not set — ${what} not sent`);
    return false;
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[mail] ${what}: relay answered ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(`[mail] ${what}: relay failed:`, err);
    return false;
  }
}

/**
 * «مكتب المحامي» team invite. Relay contract (action 'invite'):
 *
 *   { "action": "invite", "to": "<invitee email>", "workspace": "<office name>",
 *     "inviter": "<inviter display name>", "role": "<Arabic role label, e.g. محامٍ>",
 *     "url": "https://<origin>/app/invite/<token>" }
 *
 * The URL carries the one-time token; the link is also shown to the inviter
 * to copy, so a failed send never blocks the invite. Never throws.
 */
export function sendWorkspaceInviteEmail(input: {
  to: string;
  workspace: string;
  inviter: string;
  role: string;
  url: string;
}): Promise<boolean> {
  return postRelay(
    {
      action: "invite",
      to: input.to,
      workspace: input.workspace,
      inviter: input.inviter,
      role: input.role,
      url: input.url,
    },
    "workspace invite email",
  );
}

/**
 * Internal alert to the DEAL owner inbox (the relay picks the recipient).
 * Relay contract (action 'alert'): { "action": "alert", "subject": "…", "text": "…" }.
 * Used for "new office signed up" and "manual payment requested". Never throws.
 */
export function sendTeamAlert(subject: string, text: string): Promise<boolean> {
  return postRelay({ action: "alert", subject, text }, "team alert");
}

export type ConsultMailKind = "requested" | "confirmed" | "cancelled" | "reminder";

/**
 * «مكتب المحامي» consultation notice. Relay contract (action 'consult'):
 *
 *   {
 *     "action":   "consult",
 *     "to":       "<one email address>",
 *     "kind":     "requested" | "confirmed" | "cancelled" | "reminder",
 *     "audience": "client" | "office",
 *     "office":   "<office name>",
 *     "lawyer":   "<lawyer display name, or '' when not assigned>",
 *     "when":     "<ISO 8601 UTC start, e.g. 2026-10-01T07:30:00.000Z — show in Asia/Riyadh>",
 *     "mode":     "video" | "in_office" | "phone",
 *     "url":      "https://<origin>/…"
 *   }
 *
 * `url` by audience/kind:
 *   client  requested  -> /meet/<token>   (status page; the same link becomes the call once confirmed)
 *   client  confirmed  -> /meet/<token>   (join link; the button opens 10 min before)
 *   client  reminder   -> /meet/<token>
 *   client  cancelled  -> /o/<slug>/book  (book another time)
 *   office  requested  -> /app/consultations/<id>  (a new online booking to confirm; sent to
 *                         the office owners/admins and the assigned lawyer, one email each)
 *
 * The relay should ignore fields it does not know. Never throws; callers
 * never let a failed send block the booking or the status change.
 */
export function sendConsultEmail(input: {
  to: string;
  kind: ConsultMailKind;
  audience: "client" | "office";
  office: string;
  lawyer: string;
  when: string;
  mode: "video" | "in_office" | "phone";
  url: string;
}): Promise<boolean> {
  return postRelay(
    {
      action: "consult",
      to: input.to,
      kind: input.kind,
      audience: input.audience,
      office: input.office,
      lawyer: input.lawyer,
      when: input.when,
      mode: input.mode,
      url: input.url,
    },
    `consult ${input.kind} email`,
  );
}
