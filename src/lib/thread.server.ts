import { createHash, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { assertAdmin } from "@/lib/admin";
import { discardStored, storeBytes, type StoredRef } from "@/lib/files/storage.server";
import { MAX_REQUEST_BYTES } from "@/lib/files/validate";
import type { Side, Thread, ThreadFile, ThreadMessage } from "@/lib/thread";

/**
 * Request threads — **server-only**. Every entry point takes the verified
 * caller id and the side they act on, and resolves access here:
 *   - `client`: only the request's owner (`requests.user_id`), never a lead
 *     without an account;
 *   - `team`:   `assertAdmin` (ADMIN_EMAILS).
 * A request the caller may not see is reported exactly like a missing one.
 */

type Sql = Awaited<ReturnType<typeof getSql>>;

export class ThreadAccessError extends Error {
  constructor(readonly status: 403 | 404) {
    super(status === 404 ? "NotFound" : "Forbidden");
    this.name = "ThreadAccessError";
  }
}

export type ThreadRequest = {
  id: number;
  user_id: string | null;
  service_title: string;
  contact_name: string;
  client_email: string | null;
  client_name: string | null;
};

/** The request if `userId` may use its thread as `side`, else throws. */
export async function requireThreadAccess(
  sql: Sql,
  requestId: number,
  userId: string,
  side: Side,
): Promise<ThreadRequest> {
  if (side === "team") {
    try {
      await assertAdmin(userId);
    } catch {
      throw new ThreadAccessError(403);
    }
  }
  const rows = await sql<ThreadRequest>`
    select r.id, r.user_id, r.service_title, r.contact_name,
           u.email as client_email, nullif(u.name, '') as client_name
    from requests r
    left join "user" u on u.id = r.user_id
    where r.id = ${requestId}
  `;
  const req = rows[0];
  if (!req) throw new ThreadAccessError(404);
  if (side === "client" && (!req.user_id || req.user_id !== userId)) throw new ThreadAccessError(404);
  return req;
}

type MessageRow = {
  id: number;
  role: Side;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
};

const firstWord = (s: string | null) => s?.trim().split(/\s+/)[0] || null;

/** Messages oldest → newest (last 300), with file metadata (never bytes). */
export async function loadThread(
  sql: Sql,
  req: ThreadRequest,
  side: Side,
  viewerId: string,
): Promise<Thread> {
  const [messages, files, [marks], [used]] = await Promise.all([
    sql<MessageRow>`
      select * from (
        select m.id, m.role, m.body, m.created_at, m.author_id,
               nullif(u.name, '') as author_name
        from request_messages m
        left join "user" u on u.id = m.author_id
        where m.request_id = ${req.id}
        order by m.id desc
        limit 300
      ) t order by id asc
    `,
    sql<ThreadFile & { message_id: number }>`
      select id::text as id, message_id, name, mime, size
      from request_files where request_id = ${req.id}
      order by created_at, name
    `,
    sql<{ client_read_msg_id: number; team_read_msg_id: number }>`
      select client_read_msg_id, team_read_msg_id from requests where id = ${req.id}
    `,
    sql<{ used: number }>`
      select coalesce(sum(size), 0)::bigint as used from request_files where request_id = ${req.id}
    `,
  ]);
  const byMessage = new Map<number, ThreadFile[]>();
  for (const f of files) {
    const list = byMessage.get(f.message_id) ?? [];
    list.push({ id: f.id, name: f.name, mime: f.mime, size: f.size });
    byMessage.set(f.message_id, list);
  }
  const out: ThreadMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    body: m.body,
    created_at: new Date(m.created_at).toISOString(),
    mine: m.author_id === viewerId && m.role === side,
    // Customers see a team member's first name only — never an email.
    author:
      m.role === "team"
        ? side === "team"
          ? m.author_name
          : firstWord(m.author_name)
        : (m.author_name ?? (req.contact_name || null)),
    files: byMessage.get(m.id) ?? [],
  }));
  return {
    requestId: req.id,
    messages: out,
    readId: side === "client" ? (marks?.client_read_msg_id ?? 0) : (marks?.team_read_msg_id ?? 0),
    peerReadId: side === "client" ? (marks?.team_read_msg_id ?? 0) : (marks?.client_read_msg_id ?? 0),
    usedBytes: used?.used ?? 0,
    clientHasAccount: Boolean(req.user_id),
  };
}

/** Move `side`'s read marker forward (never back, never past the last message). */
export async function markRead(sql: Sql, requestId: number, side: Side, upTo: number): Promise<void> {
  if (side === "client") {
    await sql`
      update requests set client_read_msg_id = greatest(client_read_msg_id, least(${upTo}::int,
        (select coalesce(max(id), 0) from request_messages where request_id = ${requestId})))
      where id = ${requestId}
    `;
  } else {
    await sql`
      update requests set team_read_msg_id = greatest(team_read_msg_id, least(${upTo}::int,
        (select coalesce(max(id), 0) from request_messages where request_id = ${requestId})))
      where id = ${requestId}
    `;
  }
}

/** Bytes already stored for a request's attachments. */
export async function usedBytes(sql: Sql, requestId: number): Promise<number> {
  const [row] = await sql<{ used: number }>`
    select coalesce(sum(size), 0)::bigint as used from request_files where request_id = ${requestId}
  `;
  return row?.used ?? 0;
}

export type NewFile = { name: string; mime: string; bytes: Uint8Array };

export class QuotaError extends Error {
  constructor() {
    super("Quota");
    this.name = "QuotaError";
  }
}

/**
 * Store a message and its files. The message, every file row and the
 * sender's read marker are one SQL statement (data-modifying CTEs), which
 * also re-checks the per-request byte quota; with the Blob driver the objects
 * are uploaded first and removed again if that statement writes nothing.
 */
export async function postMessage(
  sql: Sql,
  input: { req: ThreadRequest; side: Side; authorId: string; body: string; files: NewFile[] },
): Promise<ThreadMessage> {
  const { req, side, authorId, body, files } = input;
  const total = files.reduce((s, f) => s + f.bytes.byteLength, 0);

  const prepared: (StoredRef & { id: string; name: string; mime: string; size: number; sha256: string })[] = [];
  try {
    for (const f of files) {
      const id = randomUUID();
      const sha256 = createHash("sha256").update(f.bytes).digest("hex");
      const stored = await storeBytes({ requestId: req.id, fileId: id, name: f.name, mime: f.mime, bytes: f.bytes });
      prepared.push({ ...stored, id, name: f.name, mime: f.mime, size: f.bytes.byteLength, sha256 });
    }
  } catch (err) {
    await discardStored(prepared.flatMap((p) => (p.blobPath ? [p.blobPath] : [])));
    throw err;
  }

  const params: unknown[] = [req.id, authorId, side, body, total, MAX_REQUEST_BYTES];
  const values = prepared.map((p) => {
    const at = params.length;
    params.push(p.id, p.name, p.mime, p.size, p.sha256, p.storage, p.data, p.blobPath);
    return `($${at + 1}::uuid, $${at + 2}::text, $${at + 3}::text, $${at + 4}::int, $${at + 5}::text, $${at + 6}::text, $${at + 7}::bytea, $${at + 8}::text)`;
  });
  const readColumn = side === "client" ? "client_read_msg_id" : "team_read_msg_id";
  const text = `
    with req as (
      select id from requests where id = $1 for update
    ),
    quota as (
      select coalesce(sum(size), 0)::bigint as used from request_files where request_id = $1
    ),
    m as (
      insert into request_messages (request_id, author_id, role, body)
      select req.id, $2, $3, $4 from req, quota where quota.used + $5::bigint <= $6::bigint
      returning id, request_id, created_at
    )${
      values.length
        ? `,
    f as (
      insert into request_files (id, request_id, message_id, name, mime, size, sha256, storage, data, blob_path, uploaded_by)
      select v.id, m.request_id, m.id, v.name, v.mime, v.size, v.sha256, v.storage, v.data, v.blob_path, $2
      from m cross join (values ${values.join(", ")}) as v(id, name, mime, size, sha256, storage, data, blob_path)
      returning id
    )`
        : ""
    },
    rd as (
      update requests r set ${readColumn} = greatest(r.${readColumn}, m.id)
      from m where r.id = m.request_id
      returning r.id
    )
    select (select count(*) from req)::int as found,
           (select id from m) as id,
           (select created_at from m) as created_at
  `;
  let row: { found: number; id: number | null; created_at: string | null } | undefined;
  try {
    [row] = await sql.query<{ found: number; id: number | null; created_at: string | null }>(text, params);
  } catch (err) {
    await discardStored(prepared.flatMap((p) => (p.blobPath ? [p.blobPath] : [])));
    throw err;
  }
  if (!row?.id) {
    await discardStored(prepared.flatMap((p) => (p.blobPath ? [p.blobPath] : [])));
    if (!row?.found) throw new ThreadAccessError(404);
    throw new QuotaError();
  }
  return {
    id: row.id,
    role: side,
    body,
    created_at: new Date(row.created_at ?? Date.now()).toISOString(),
    mine: true,
    author: null,
    files: prepared.map((p) => ({ id: p.id, name: p.name, mime: p.mime, size: p.size })),
  };
}

/** The site's public origin for links in emails. */
function publicOrigin(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // fall through
    }
  }
  return "https://deal.mubasat.net";
}

function previewOf(body: string, files: number): string {
  const text = body.replace(/\s+/g, " ").trim();
  const clip = text.length > 160 ? `${text.slice(0, 157)}…` : text;
  if (clip) return files ? `${clip} (+ ${files === 1 ? "ملف مرفق" : `${files} ملفات مرفقة`})` : clip;
  return files === 1 ? "أرسل ملفًا مرفقًا" : `أرسل ${files} ملفات مرفقة`;
}

/**
 * Email the other side about a new message, at most once per request per
 * recipient side every 10 minutes. The throttle slot is claimed atomically
 * before sending and released if the relay does not accept the email.
 * Never throws.
 */
export async function notifyOtherSide(
  sql: Sql,
  req: ThreadRequest,
  from: Side,
  message: { body: string; files: number },
): Promise<void> {
  try {
    const { sendThreadNotice } = await import("@/lib/mail.server");
    const origin = publicOrigin();
    const preview = previewOf(message.body, message.files);
    if (from === "client") {
      const claimed = await sql<{ id: number }>`
        update requests set team_notified_at = now()
        where id = ${req.id}
          and (team_notified_at is null or team_notified_at < now() - interval '10 minutes')
        returning id
      `;
      if (!claimed.length) return;
      const ok = await sendThreadNotice({
        to: "team",
        name: req.contact_name || req.client_name || "عميل",
        requestId: req.id,
        service: req.service_title,
        preview,
        url: `${origin}/admin`,
      });
      if (!ok) await sql`update requests set team_notified_at = null where id = ${req.id}`;
    } else {
      if (!req.user_id || !req.client_email) return;
      const claimed = await sql<{ id: number }>`
        update requests set client_notified_at = now()
        where id = ${req.id}
          and (client_notified_at is null or client_notified_at < now() - interval '10 minutes')
        returning id
      `;
      if (!claimed.length) return;
      const ok = await sendThreadNotice({
        to: [req.client_email],
        name: req.client_name || req.contact_name || "",
        requestId: req.id,
        service: req.service_title,
        preview,
        url: `${origin}/client`,
      });
      if (!ok) await sql`update requests set client_notified_at = null where id = ${req.id}`;
    }
  } catch (err) {
    console.error(`[thread] notifying about request #${req.id} failed:`, err);
  }
}
