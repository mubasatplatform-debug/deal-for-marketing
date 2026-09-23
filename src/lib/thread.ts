import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

/**
 * Request thread: the conversation between a request's customer and the
 * team, with attachments. Reads and read markers are server functions here;
 * posting (multipart, with files) is the `/api/requests/$id/messages` route
 * and downloads are `/api/files/$id`. Access rules: `thread.server.ts`.
 */

export type Side = "client" | "team";

/** Longest message text, in characters (matches the DB check). */
export const MESSAGE_MAX = 4000;

export type ThreadFile = { id: string; name: string; mime: string; size: number };

export type ThreadMessage = {
  id: number;
  role: Side;
  body: string;
  created_at: string;
  /** Written by the viewer themself. */
  mine: boolean;
  /** Display name (first name only for team members shown to customers). */
  author: string | null;
  files: ThreadFile[];
};

export type Thread = {
  requestId: number;
  /** Oldest first. */
  messages: ThreadMessage[];
  /** The viewer's side read marker when loaded (messages above it are new). */
  readId: number;
  /** The other side's read marker ("seen" ticks). */
  peerReadId: number;
  /** Bytes already used by this request's attachments. */
  usedBytes: number;
  /** False for an anonymous lead: no customer side in the thread. */
  clientHasAccount: boolean;
};

/** Stable error messages the UI can match. */
export const THREAD_ERRORS = { notFound: "NotFound", forbidden: "Forbidden" } as const;

export type ClientRequestDetail = {
  id: number;
  service_slug: string;
  service_title: string;
  company: string;
  brief: string;
  status: string;
  created_at: string;
};

const idSchema = z.object({ id: z.number().int().positive().max(2_147_483_647) });

async function server() {
  return import("@/lib/thread.server");
}

function rethrow(err: unknown): never {
  if (err instanceof Error && err.name === "ThreadAccessError") throw new Error(err.message);
  throw err;
}

/** One of the caller's own requests with its thread (customer side). */
export const getMyRequestThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ request: ClientRequestDetail; thread: Thread }> => {
    const sql = await getSql();
    const { requireThreadAccess, loadThread } = await server();
    try {
      const req = await requireThreadAccess(sql, data.id, context.userId, "client");
      const [rows, thread] = await Promise.all([
        sql<ClientRequestDetail>`
          select id, service_slug, service_title, company, brief, status, created_at
          from requests where id = ${req.id} and user_id = ${context.userId}
        `,
        loadThread(sql, req, "client", context.userId),
      ]);
      if (!rows[0]) throw new Error(THREAD_ERRORS.notFound);
      return { request: rows[0], thread };
    } catch (err) {
      rethrow(err);
    }
  });

/** A request's thread for the team (/admin drawer). */
export const getTeamThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }): Promise<Thread> => {
    const sql = await getSql();
    const { requireThreadAccess, loadThread } = await server();
    try {
      const req = await requireThreadAccess(sql, data.id, context.userId, "team");
      return await loadThread(sql, req, "team", context.userId);
    } catch (err) {
      rethrow(err);
    }
  });

const readSchema = idSchema.extend({
  side: z.enum(["client", "team"]),
  upTo: z.number().int().min(0).max(2_147_483_647),
});

/** Mark the thread read up to a message id, for the caller's side. */
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => readSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { requireThreadAccess, markRead } = await server();
    try {
      const req = await requireThreadAccess(sql, data.id, context.userId, data.side);
      await markRead(sql, req.id, data.side, data.upTo);
      return { ok: true };
    } catch (err) {
      rethrow(err);
    }
  });

/** What the post route answers. */
export type PostMessageResult =
  | { ok: true; message: ThreadMessage }
  | { ok: false; error: string; message: string };

/**
 * Post a message (and files) with upload progress. Uses XHR because fetch
 * cannot report upload progress. `onProgress` gets 0..1 of bytes sent.
 */
export function postThreadMessage(input: {
  requestId: number;
  side: Side;
  body: string;
  files: File[];
  bearerToken?: string | null;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<PostMessageResult> {
  return new Promise((resolve) => {
    const form = new FormData();
    form.set("body", input.body);
    for (const f of input.files) form.append("files", f, f.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/requests/${input.requestId}/messages?as=${input.side}`);
    xhr.responseType = "json";
    if (input.bearerToken) xhr.setRequestHeader("Authorization", `Bearer ${input.bearerToken}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) input.onProgress?.(e.loaded, e.total);
    };
    const fail = (error: string, message: string) => resolve({ ok: false, error, message });
    xhr.onload = () => {
      const res = xhr.response as PostMessageResult | null;
      if (res && typeof res === "object" && "ok" in res) return resolve(res);
      fail("network", "تعذر إرسال الرسالة. تحقق من الاتصال ثم حاول مرة أخرى.");
    };
    xhr.onerror = () => fail("network", "تعذر إرسال الرسالة. تحقق من الاتصال ثم حاول مرة أخرى.");
    xhr.onabort = () => fail("aborted", "أُلغي الإرسال.");
    input.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** Download / preview URL of an attachment (authorized server-side). */
export function fileUrl(id: string, inline = false): string {
  return `/api/files/${encodeURIComponent(id)}${inline ? "?inline=1" : ""}`;
}
