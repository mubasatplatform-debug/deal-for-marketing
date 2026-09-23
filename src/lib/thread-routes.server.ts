import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireUserId } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { readStored } from "@/lib/files/storage.server";
import {
  FILE_KINDS,
  FILE_PROBLEM_TEXT,
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
  checkFile,
  contentDisposition,
  kindFromName,
} from "@/lib/files/validate";
import { RateLimitError, takeHit } from "@/lib/rate-limit.server";
import { MESSAGE_MAX, type PostMessageResult, type Side } from "@/lib/thread";
import {
  QuotaError,
  ThreadAccessError,
  notifyOtherSide,
  postMessage,
  requireThreadAccess,
  usedBytes,
  type NewFile,
} from "@/lib/thread.server";

/**
 * HTTP handlers for thread posts and attachment downloads — **server-only**.
 * Order matters: session and access are checked before a single body byte
 * is read, the body is size-capped while streaming, and every file is
 * validated (name, size, magic bytes) before anything is stored.
 */

/** Multipart framing + the text field on top of the files themselves. */
const BODY_OVERHEAD = 256 * 1024;
const MAX_BODY_BYTES = MAX_FILES_PER_MESSAGE * MAX_FILE_BYTES + BODY_OVERHEAD;

/** Per user: messages per 10 minutes, and messages with files per hour. */
const MESSAGE_LIMIT = { limit: 30, window: 600 };
const UPLOAD_LIMIT = { limit: 20, window: 3600 };

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function reply(status: number, body: PostMessageResult): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const fail = (status: number, error: string, message: string) => reply(status, { ok: false, error, message });

class BodyTooLarge extends Error {}

/** The body, refusing more than `max` bytes (declared or streamed). */
async function readCapped(request: Request, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) throw new BodyTooLarge();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return all;
}

function parseId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && n <= 2_147_483_647 ? n : null;
}

/** Session + same-site checks shared by both handlers; a Response on failure. */
async function caller(): Promise<string | Response> {
  try {
    assertSameSiteRequest();
  } catch {
    return fail(403, "forbidden", "طلب غير مسموح.");
  }
  try {
    return await requireUserId();
  } catch {
    return fail(401, "unauthorized", "سجّل الدخول أولًا.");
  }
}

export async function postMessageRoute(request: Request, rawId: string): Promise<Response> {
  const who = await caller();
  if (who instanceof Response) return who;
  const userId = who;

  const requestId = parseId(rawId);
  const as = new URL(request.url).searchParams.get("as");
  if (!requestId) return fail(404, "not_found", "الطلب غير موجود.");
  if (as !== "client" && as !== "team") return fail(400, "bad_request", "طلب غير صالح.");
  const side: Side = as;

  const sql = await getSql();
  let req;
  try {
    req = await requireThreadAccess(sql, requestId, userId, side);
  } catch (err) {
    if (err instanceof ThreadAccessError) {
      return err.status === 403
        ? fail(403, "forbidden", "هذه المحادثة للفريق فقط.")
        : fail(404, "not_found", "الطلب غير موجود.");
    }
    throw err;
  }
  if (!req.user_id) {
    return fail(409, "no_client", "العميل ليس لديه حساب، فلا يمكنه قراءة المحادثة. تواصل معه عبر واتساب.");
  }

  try {
    await takeHit(`thread:msg:${userId}`, MESSAGE_LIMIT.limit, MESSAGE_LIMIT.window);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return fail(429, "rate_limited", "أرسلت رسائل كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.");
    }
    throw err;
  }

  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) {
    return fail(415, "bad_type", "صيغة الإرسال غير مدعومة.");
  }

  // Reject early when the declared size cannot fit this request's quota.
  const used = await usedBytes(sql, req.id);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES - used + BODY_OVERHEAD) {
    return fail(413, "quota", "تجاوزت مرفقات هذا الطلب 100 ميجابايت. احذف أو اضغط الملفات، أو أرسلها برابط.");
  }

  let form: FormData;
  try {
    const bytes = await readCapped(request, MAX_BODY_BYTES);
    form = await new Response(bytes, { headers: { "content-type": type } }).formData();
  } catch (err) {
    if (err instanceof BodyTooLarge) {
      return fail(413, "too_large", "حجم المرفقات أكبر من المسموح (5 ملفات، 10 ميجابايت لكل ملف).");
    }
    return fail(400, "bad_request", "تعذر قراءة الرسالة. حاول مرة أخرى.");
  }

  const rawBody = form.get("body");
  const body = typeof rawBody === "string" ? rawBody.replace(/\r\n/g, "\n").trim() : "";
  const uploads = form.getAll("files").filter((v): v is File => typeof v !== "string");
  if (body.length > MESSAGE_MAX) return fail(422, "too_long", `الرسالة أطول من ${MESSAGE_MAX} حرف.`);
  if (!body && uploads.length === 0) return fail(422, "empty", "اكتب رسالة أو أرفق ملفًا.");
  if (uploads.length > MAX_FILES_PER_MESSAGE) {
    return fail(422, "too_many", `يمكن إرفاق ${MAX_FILES_PER_MESSAGE} ملفات كحد أقصى في الرسالة.`);
  }

  const files: NewFile[] = [];
  for (const up of uploads) {
    if (up.size > MAX_FILE_BYTES) {
      return fail(422, "file_size", `«${up.name}»: ${FILE_PROBLEM_TEXT.size}.`);
    }
    const bytes = new Uint8Array(await up.arrayBuffer());
    const checked = checkFile(up.name, bytes);
    if (!checked.ok) return fail(422, `file_${checked.problem}`, `«${checked.name}»: ${FILE_PROBLEM_TEXT[checked.problem]}.`);
    files.push({ name: checked.name, mime: checked.mime, bytes });
  }
  const total = files.reduce((s, f) => s + f.bytes.byteLength, 0);
  if (used + total > MAX_REQUEST_BYTES) {
    return fail(413, "quota", "تجاوزت مرفقات هذا الطلب 100 ميجابايت. احذف أو اضغط الملفات، أو أرسلها برابط.");
  }
  if (files.length) {
    try {
      await takeHit(`thread:upload:${userId}`, UPLOAD_LIMIT.limit, UPLOAD_LIMIT.window);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return fail(429, "rate_limited", "رفعت ملفات كثيرة خلال ساعة. حاول لاحقًا.");
      }
      throw err;
    }
  }

  try {
    const message = await postMessage(sql, { req, side, authorId: userId, body, files });
    await notifyOtherSide(sql, req, side, { body, files: files.length });
    return reply(201, { ok: true, message });
  } catch (err) {
    if (err instanceof QuotaError) {
      return fail(413, "quota", "تجاوزت مرفقات هذا الطلب 100 ميجابايت.");
    }
    if (err instanceof ThreadAccessError) return fail(404, "not_found", "الطلب غير موجود.");
    console.error(`[thread] posting on request #${req.id} failed:`, err);
    return fail(500, "internal", "تعذر حفظ الرسالة. حاول مرة أخرى.");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function downloadFileRoute(request: Request, rawId: string): Promise<Response> {
  const who = await caller();
  if (who instanceof Response) return plain(who.status, who.status === 401 ? "Unauthorized" : "Forbidden");
  const userId = who;
  if (!UUID.test(rawId)) return plain(404, "Not found");

  const sql = await getSql();
  const [meta] = await sql<{
    id: string;
    request_id: number;
    name: string;
    mime: string;
    size: number;
    storage: "db" | "blob";
    blob_path: string | null;
    owner_id: string | null;
  }>`
    select f.id::text as id, f.request_id, f.name, f.mime, f.size, f.storage, f.blob_path,
           r.user_id as owner_id
    from request_files f join requests r on r.id = f.request_id
    where f.id = ${rawId}::uuid
  `;
  if (!meta) return plain(404, "Not found");
  if (meta.owner_id !== userId) {
    // Not the customer: only the team may read it. Others learn nothing.
    try {
      await requireThreadAccess(sql, meta.request_id, userId, "team");
    } catch {
      return plain(404, "Not found");
    }
  }

  let data: Uint8Array | null = null;
  if (meta.storage === "db") {
    const [row] = await sql<{ data: Uint8Array | null }>`
      select data from request_files where id = ${meta.id}::uuid
    `;
    data = row?.data ?? null;
  }
  const body = await readStored({ storage: meta.storage, data, blob_path: meta.blob_path });
  if (!body) return plain(404, "Not found");

  // Type and disposition come from the validated extension, never the stored
  // browser value; only images and PDFs may render inline.
  const kind = kindFromName(meta.name);
  const info = kind ? FILE_KINDS[kind] : null;
  const wantsInline = new URL(request.url).searchParams.get("inline") === "1";
  const inline = Boolean(wantsInline && info?.inline);
  const headers: Record<string, string> = {
    "Content-Type": info?.mime ?? "application/octet-stream",
    "Content-Disposition": contentDisposition(meta.name, inline),
    "Content-Length": String(meta.size),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=600",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
  // PDFs need the browser's viewer; everything else is inert data.
  if (kind !== "pdf" || !inline) {
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
  }
  const payload: BodyInit = body instanceof Uint8Array ? new Uint8Array(body) : body;
  return new Response(payload, { status: 200, headers });
}
