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
/** RFC 2606 / 6761 names: mail there always bounces (test accounts). */
const RESERVED_DOMAIN = /@(?:[^@]+\.)?(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;

async function postRelay(body: Record<string, unknown>, what: string): Promise<boolean> {
  // Subjects are headers: never let a line break from user data through.
  if (typeof body.subject === "string") body = { ...body, subject: body.subject.replace(/[\r\n]+/g, " ").trim() };
  if (typeof body.to === "string" && RESERVED_DOMAIN.test(body.to.trim())) return false;
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

/* ------------------------------------------------------------------------ */
/* Automatic reminders (src/lib/law/reminders.server.ts)                     */
/* ------------------------------------------------------------------------ */

const AR_LOCALE = "ar-SA-u-ca-gregory-nu-latn";
const RIYADH_TZ = "Asia/Riyadh";

/** "الخميس، 1 أكتوبر 2026" in Riyadh. */
function dayLabelAr(iso: string): string {
  return new Date(iso).toLocaleDateString(AR_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: RIYADH_TZ,
  });
}

/** "10:30 ص" in Riyadh. */
function timeLabelAr(iso: string): string {
  return new Date(iso).toLocaleTimeString(AR_LOCALE, { hour: "numeric", minute: "2-digit", timeZone: RIYADH_TZ });
}

const REMINDER_MODE_AR = { video: "مكالمة فيديو", in_office: "حضوري في المكتب", phone: "مكالمة هاتفية" } as const;

/** Plain lines as a small RTL HTML body (escaped; https links clickable). */
function rtlHtml(lines: string[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = lines
    .map((l) =>
      l === ""
        ? "<br>"
        : `<p style="margin:0 0 6px">${esc(l).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`,
    )
    .join("");
  return `<div dir="rtl" lang="ar" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;text-align:right">${body}</div>`;
}

/**
 * Automatic client reminder, 24 hours or 1 hour before a confirmed
 * appointment. Rides the relay's existing `consult` action (kind 'reminder',
 * audience 'client') with extra fields a relay may use instead of its own
 * template:
 *
 *   { …consult fields…, "window": "24h" | "1h",
 *     "subject": "<Arabic subject>", "text": "<plain text>", "html": "<RTL html>" }
 *
 * `url` is the client's /meet/<token> page (the join link for a video call),
 * or '' when the appointment has no link. Never throws.
 */
export function sendClientReminderEmail(input: {
  to: string;
  window: "24h" | "1h";
  office: string;
  lawyer: string;
  when: string;
  mode: "video" | "in_office" | "phone";
  url: string | null;
}): Promise<boolean> {
  const soon = input.window === "1h" ? "بعد ساعة تقريبًا" : "غدًا";
  const subject = `تذكير بموعدك ${soon} — ${input.office}`;
  const lines = [
    "مرحبًا،",
    `نذكّرك بموعدك مع ${input.office} ${soon}.`,
    "",
    `الموعد: ${dayLabelAr(input.when)}، الساعة ${timeLabelAr(input.when)} بتوقيت الرياض`,
    `النوع: ${REMINDER_MODE_AR[input.mode]}`,
    ...(input.lawyer ? [`المحامي: ${input.lawyer}`] : []),
    ...(input.url
      ? input.mode === "video"
        ? [`رابط الدخول للمكالمة: ${input.url}`, "يُفتح الدخول قبل الموعد بعشر دقائق."]
        : [`تفاصيل الموعد: ${input.url}`]
      : []),
    "",
    "إن تعذّر عليك الحضور فتواصل مع المكتب لتغيير الموعد.",
  ];
  return postRelay(
    {
      action: "consult",
      to: input.to,
      kind: "reminder",
      audience: "client",
      office: input.office,
      lawyer: input.lawyer,
      when: input.when,
      mode: input.mode,
      url: input.url ?? "",
      window: input.window,
      subject,
      text: lines.join("\n"),
      html: rtlHtml(lines),
    },
    `client reminder (${input.window}) email`,
  );
}

export type DigestMail = {
  hearings: { startsAt: string; caseTitle: string; caseRef: number; court: string; room: string }[];
  appointments: {
    startsAt: string;
    kind: "appointment" | "consultation";
    mode: "video" | "in_office" | "phone";
    status: "pending" | "confirmed";
    title: string;
  }[];
  tasks: { title: string; dueOn: string; overdue: boolean; caseTitle: string | null }[];
  totals: { hearings: number; appointments: number; tasks: number };
};

/**
 * The lawyer's morning digest. Relay contract (action 'digest'):
 *
 *   {
 *     "action":  "digest",
 *     "to":      "<member email>",
 *     "name":    "<member display name>",
 *     "office":  "<office name>",
 *     "date":    "YYYY-MM-DD (Riyadh)",
 *     "counts":  { "hearings": n, "appointments": n, "tasks": n },
 *     "url":     "https://<origin>/app",
 *     "subject": "<Arabic subject>", "text": "<plain text>", "html": "<RTL html>"
 *   }
 *
 * The relay sends `subject` with `html` (or `text`) to `to`. Never throws.
 */
export function sendLawyerDigestEmail(
  input: DigestMail & { to: string; name: string; office: string; date: string; url: string },
): Promise<boolean> {
  // Noon UTC of the date is the same calendar day in Riyadh.
  const dayOf = (ymd: string) => dayLabelAr(`${ymd}T12:00:00.000Z`);
  const more = (shown: number, total: number) => (total > shown ? [`… و${total - shown} غيرها في التطبيق`] : []);
  const lines: string[] = [
    input.name ? `صباح الخير ${input.name}،` : "صباح الخير،",
    `هذا ملخص يومك في ${input.office} — ${dayOf(input.date)}.`,
  ];
  if (input.hearings.length) {
    lines.push("", `الجلسات (${input.totals.hearings}):`);
    for (const h of input.hearings) {
      const where = [h.court, h.room ? `قاعة ${h.room}` : ""].filter(Boolean).join("، ");
      lines.push(`- ${timeLabelAr(h.startsAt)}: ${h.caseTitle} (ملف ${h.caseRef})${where ? ` — ${where}` : ""}`);
    }
    lines.push(...more(input.hearings.length, input.totals.hearings));
  }
  if (input.appointments.length) {
    lines.push("", `المواعيد (${input.totals.appointments}):`);
    for (const a of input.appointments) {
      const label = a.kind === "consultation" ? "استشارة" : "موعد";
      const pending = a.status === "pending" ? " — بانتظار التأكيد" : "";
      lines.push(
        `- ${timeLabelAr(a.startsAt)}: ${label}${a.title ? ` ${a.title}` : ""} (${REMINDER_MODE_AR[a.mode]})${pending}`,
      );
    }
    lines.push(...more(input.appointments.length, input.totals.appointments));
  }
  if (input.tasks.length) {
    lines.push("", `المهام المستحقة (${input.totals.tasks}):`);
    for (const t of input.tasks) {
      const due = t.overdue ? `متأخرة، كانت مستحقة ${dayOf(t.dueOn)}` : "مستحقة اليوم";
      lines.push(`- ${t.title}${t.caseTitle ? ` (${t.caseTitle})` : ""} — ${due}`);
    }
    lines.push(...more(input.tasks.length, input.totals.tasks));
  }
  lines.push("", `افتح المكتب: ${input.url}`, "", "يستطيع مالك المكتب أو مديره إيقاف هذا الملخص من الإعدادات.");
  return postRelay(
    {
      action: "digest",
      to: input.to,
      name: input.name,
      office: input.office,
      date: input.date,
      counts: input.totals,
      url: input.url,
      subject: `ملخص يومك — ${input.office}`,
      text: lines.join("\n"),
      html: rtlHtml(lines),
    },
    "lawyer digest email",
  );
}
