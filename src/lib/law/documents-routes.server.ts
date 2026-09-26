import { randomUUID } from "node:crypto";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireUserId } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { discardStored, readStored, storeLawBytes } from "@/lib/files/storage.server";
import { FILE_KINDS, checkFile, contentDisposition, formatBytes, kindFromName } from "@/lib/files/validate";
import { RateLimitError, takeHit } from "@/lib/rate-limit.server";
import { resolveMembership, UUID_RE, WorkspaceError, type SqlTag } from "@/lib/saas/tenancy-core";
import { documentBytesCore, documentMetaCore, insertDocumentCore, resolveTarget } from "./documents-core";
import { LAW_MAX_FILES, LAW_MAX_FILE_BYTES } from "./documents";

/**
 * HTTP handlers for office documents — **server-only**.
 *
 *   POST /api/law/documents?ws=<office id>   multipart: files (1–10), clientId?, caseId?
 *   GET  /api/law/documents/<id>?ws=<office id>[&inline=1]
 *
 * Order: same-site + session, then office membership/role in the database
 * (`resolveMembership`), then the body (size-capped while streaming), then
 * every file is validated (name, size, magic bytes) before anything is
 * stored. The quota is checked under the office lock at insert time.
 * Downloads come back with the validated type, `nosniff`, `attachment`
 * (inline only for images/PDF on request) and a sandboxing CSP.
 */

const BODY_OVERHEAD = 256 * 1024;
const MAX_BODY = LAW_MAX_FILES * LAW_MAX_FILE_BYTES + BODY_OVERHEAD;
const UPLOAD_LIMIT = { limit: 60, window: 3600 };

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export type UploadResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string; message: string };

function reply(status: number, body: UploadResult) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
const fail = (status: number, error: string, message: string) => reply(status, { ok: false, error, message });

function plain(status: number, text: string) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

class BodyTooLarge extends Error {}

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

async function access(request: Request, write: boolean) {
  try {
    assertSameSiteRequest();
  } catch {
    return { error: fail(403, "forbidden", "طلب غير مسموح.") };
  }
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { error: fail(401, "unauthorized", "سجّل الدخول أولًا.") };
  }
  const ws = new URL(request.url).searchParams.get("ws") ?? "";
  const sql = (await getSql()) as unknown as SqlTag;
  try {
    const a = await resolveMembership(sql, userId, ws, "staff", { write });
    const { assertSecondFactor } = await import("@/lib/otp/otp.server");
    await assertSecondFactor(userId);
    return { sql, access: a, userId };
  } catch (err) {
    if (err instanceof WorkspaceError && err.code === "otp_required") {
      return { error: fail(403, "otp_required", "أدخل رمز التحقق المرسل إلى واتساب أولًا.") };
    }
    if (err instanceof WorkspaceError && err.code === "read_only") {
      return { error: fail(403, "read_only", "المكتب للقراءة فقط حاليًا.") };
    }
    return { error: fail(403, "forbidden", "لا تملك صلاحية الوصول إلى هذا المكتب.") };
  }
}

export async function uploadDocumentsRoute(request: Request): Promise<Response> {
  const ctx = await access(request, true);
  if ("error" in ctx) return ctx.error as Response;
  const { sql, access: a, userId } = ctx;

  try {
    await takeHit(`law-upload:${userId}`, UPLOAD_LIMIT.limit, UPLOAD_LIMIT.window);
  } catch (err) {
    if (err instanceof RateLimitError) return fail(429, "rate_limited", "رفعت ملفات كثيرة خلال ساعة. حاول لاحقًا.");
    throw err;
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) return fail(415, "bad_type", "صيغة الإرسال غير مدعومة.");

  let form: FormData;
  try {
    const bytes = await readCapped(request, MAX_BODY);
    form = await new Response(bytes, { headers: { "content-type": type } }).formData();
  } catch (err) {
    if (err instanceof BodyTooLarge) {
      return fail(413, "too_large", `الحد ${LAW_MAX_FILES} ملفات في المرة، و${formatBytes(LAW_MAX_FILE_BYTES)} لكل ملف.`);
    }
    return fail(400, "bad_request", "تعذّر قراءة الملفات. حاول مرة أخرى.");
  }
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && UUID_RE.test(v) ? v : null;
  };
  const uploads = form.getAll("files").filter((v): v is File => typeof v !== "string");
  if (uploads.length === 0) return fail(422, "empty", "اختر ملفًا واحدًا على الأقل.");
  if (uploads.length > LAW_MAX_FILES) return fail(422, "too_many", `يمكن رفع ${LAW_MAX_FILES} ملفات كحد أقصى في المرة.`);

  let target: { clientId: string | null; caseId: string | null };
  try {
    target = await resolveTarget(sql, a, str("clientId"), str("caseId"));
  } catch (err) {
    if (err instanceof WorkspaceError && err.code === "role") return fail(403, "role", "لا تملك صلاحية رفع المستندات.");
    return fail(404, "not_found", "العميل أو القضية غير موجودة.");
  }

  const files: { name: string; mime: string; bytes: Uint8Array }[] = [];
  for (const up of uploads) {
    if (up.size > LAW_MAX_FILE_BYTES) {
      return fail(422, "file_size", `«${up.name}»: الحجم أكبر من ${formatBytes(LAW_MAX_FILE_BYTES)}.`);
    }
    const bytes = new Uint8Array(await up.arrayBuffer());
    const checked = checkFile(up.name, bytes, bytes.byteLength, LAW_MAX_FILE_BYTES);
    if (!checked.ok) {
      const why = {
        type: "نوع الملف غير مسموح",
        empty: "الملف فارغ",
        size: `الحجم أكبر من ${formatBytes(LAW_MAX_FILE_BYTES)}`,
        content: "محتوى الملف لا يطابق امتداده",
      }[checked.problem];
      return fail(422, `file_${checked.problem}`, `«${checked.name}»: ${why}.`);
    }
    files.push({ name: checked.name, mime: checked.mime, bytes });
  }

  const ids: string[] = [];
  for (const f of files) {
    const id = randomUUID();
    const stored = await storeLawBytes({ workspaceId: a.workspace.id, fileId: id, name: f.name, mime: f.mime, bytes: f.bytes });
    try {
      await insertDocumentCore(sql, a, {
        id,
        clientId: target.clientId,
        caseId: target.caseId,
        name: f.name,
        mime: f.mime,
        size: f.bytes.byteLength,
        storage: stored.storage,
        data: stored.data,
        blobPath: stored.blobPath,
      });
      ids.push(id);
    } catch (err) {
      if (stored.blobPath) await discardStored([stored.blobPath]);
      if (err instanceof WorkspaceError && err.code === "quota") {
        return reply(413, {
          ok: false,
          error: "quota",
          message: ids.length
            ? `رُفع ${ids.length} من ${files.length} ثم امتلأت مساحة التخزين في خطتك.`
            : "امتلأت مساحة التخزين في خطتك. احذف ملفات قديمة أو رقِّ الخطة.",
        });
      }
      console.error("[law] storing a document failed:", err);
      return fail(500, "internal", "تعذّر حفظ الملف. حاول مرة أخرى.");
    }
  }
  return reply(201, { ok: true, ids });
}

export async function downloadDocumentRoute(request: Request, rawId: string): Promise<Response> {
  const ctx = await access(request, false);
  if ("error" in ctx) {
    const status = (ctx.error as Response).status;
    return plain(status, status === 401 ? "Unauthorized" : "Forbidden");
  }
  const { sql, access: a } = ctx;
  let meta: Awaited<ReturnType<typeof documentMetaCore>>;
  try {
    meta = await documentMetaCore(sql, a, rawId);
  } catch {
    return plain(403, "Forbidden");
  }
  if (!meta) return plain(404, "Not found");
  const data = meta.storage === "db" ? await documentBytesCore(sql, a, meta.id) : null;
  const body = await readStored({ storage: meta.storage, data, blob_path: meta.blob_path });
  if (!body) return plain(404, "Not found");

  // Type and disposition come from the validated extension, never the stored
  // browser value; only images and PDFs may render inline, on request.
  const kind = kindFromName(meta.name);
  const info = kind ? FILE_KINDS[kind] : null;
  const inline = new URL(request.url).searchParams.get("inline") === "1" && Boolean(info?.inline);
  const headers: Record<string, string> = {
    "Content-Type": info?.mime ?? "application/octet-stream",
    "Content-Disposition": contentDisposition(meta.name, inline),
    "Content-Length": String(meta.size),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
  if (kind !== "pdf" || !inline) {
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
  }
  const payload: BodyInit = body instanceof Uint8Array ? new Uint8Array(body) : body;
  return new Response(payload, { status: 200, headers });
}
