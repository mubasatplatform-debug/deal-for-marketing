/**
 * Attachment rules for request threads — pure (no app aliases, no Node-only
 * APIs), so the browser can pre-check files and node tests can import it
 * directly. The server re-checks everything: the extension picks the type,
 * the file's first bytes must match it, and the browser's MIME is ignored.
 */

/** Files per message. */
export const MAX_FILES_PER_MESSAGE = 5;
/** Bytes per file (10 MB). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Bytes across every file of one request (100 MB). */
export const MAX_REQUEST_BYTES = 100 * 1024 * 1024;
/** Longest stored file name, in characters (extension included). */
export const MAX_NAME_CHARS = 120;

export type FileKind =
  | "jpg"
  | "png"
  | "webp"
  | "gif"
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "zip"
  | "mp4"
  | "mov"
  | "ai"
  | "psd";

type KindInfo = {
  /** The Content-Type we store and serve — never the browser's. */
  mime: string;
  /** Safe to show inline (images, PDF); everything else downloads. */
  inline: boolean;
  image: boolean;
};

export const FILE_KINDS: Record<FileKind, KindInfo> = {
  jpg: { mime: "image/jpeg", inline: true, image: true },
  png: { mime: "image/png", inline: true, image: true },
  webp: { mime: "image/webp", inline: true, image: true },
  gif: { mime: "image/gif", inline: true, image: true },
  pdf: { mime: "application/pdf", inline: true, image: false },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    inline: false,
    image: false,
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    inline: false,
    image: false,
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    inline: false,
    image: false,
  },
  zip: { mime: "application/zip", inline: false, image: false },
  mp4: { mime: "video/mp4", inline: false, image: false },
  mov: { mime: "video/quicktime", inline: false, image: false },
  ai: { mime: "application/postscript", inline: false, image: false },
  psd: { mime: "image/vnd.adobe.photoshop", inline: false, image: false },
};

/** Accepted extensions → kind. SVG and HTML are deliberately absent (script). */
const EXTENSIONS: Record<string, FileKind> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  zip: "zip",
  mp4: "mp4",
  mov: "mov",
  ai: "ai",
  psd: "psd",
};

/** For `<input accept>`: the extensions people can pick. */
export const ACCEPT_ATTR = Object.keys(EXTENSIONS)
  .map((e) => `.${e}`)
  .join(",");

/** Human list for hints ("JPG، PNG، …"). */
export const ALLOWED_LABEL = "صور (JPG، PNG، WEBP، GIF)، PDF، Word، Excel، PowerPoint، ZIP، فيديو MP4/MOV، AI، PSD";

/** Kind by a file name's last extension, or null when not accepted. */
export function kindFromName(name: string): FileKind | null {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  if (!m) return null;
  return EXTENSIONS[m[1].toLowerCase()] ?? null;
}

// Invisible / direction-changing characters that can disguise an extension
// ("invoice\u202Egnp.exe" renders as "invoiceexe.png").
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const RESERVED = /[<>:"/\\|?*]/g;

/**
 * A storable, displayable file name: no directories, control or bidi
 * characters, or characters reserved on common file systems; whitespace
 * collapsed; leading/trailing dots and spaces trimmed; at most
 * `MAX_NAME_CHARS`, keeping the extension. Arabic and other letters stay.
 * Never empty: falls back to `file` (+ the original extension when valid).
 */
export function sanitizeFileName(raw: string): string {
  // Keep only the last path segment (both separators), then clean.
  const base = String(raw ?? "").split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(RESERVED, "_")
    .replace(/\s+/g, " ")
    .trim();
  // A bare extension (".png") names the type, not the file.
  const bare = /^\.+([A-Za-z0-9]{1,8})$/.exec(cleaned);
  let name = bare ? `file.${bare[1]}` : cleaned.replace(/^[\s.]+|[\s.]+$/g, "");
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1] ?? "";
  const stem = ext ? name.slice(0, -(ext.length + 1)).replace(/[\s.]+$/g, "") : name;
  if (!stem) name = ext ? `file.${ext}` : "file";
  else name = ext ? `${stem}.${ext}` : stem;
  const chars = [...name];
  if (chars.length > MAX_NAME_CHARS) {
    const tail = ext ? `.${ext}` : "";
    const keep = MAX_NAME_CHARS - [...tail].length;
    const cut = [...(ext ? name.slice(0, -tail.length) : name)].slice(0, keep).join("").trimEnd();
    name = `${cut}${tail}`;
  }
  return name;
}

function startsWith(b: Uint8Array, sig: number[], offset = 0): boolean {
  if (b.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) if (b[offset + i] !== sig[i]) return false;
  return true;
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function hasAscii(b: Uint8Array, needle: string): boolean {
  const n = ascii(needle);
  const last = b.length - n.length;
  outer: for (let i = 0; i <= last; i += 1) {
    for (let j = 0; j < n.length; j += 1) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

const isZip = (b: Uint8Array) =>
  startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]);

/**
 * Office Open XML is a zip whose entry names (stored uncompressed in the local
 * headers and central directory) include `[Content_Types].xml` and the part
 * folder of that format.
 */
function isOoxml(b: Uint8Array, folder: string): boolean {
  return startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && hasAscii(b, "[Content_Types].xml") && hasAscii(b, folder);
}

/** ISO base media (MP4 / QuickTime): a box size, then `ftyp` at offset 4. */
const hasFtyp = (b: Uint8Array) => startsWith(b, ascii("ftyp"), 4);
/** Older QuickTime files may open with another top-level atom. */
const QT_ATOMS = ["moov", "mdat", "wide", "free", "skip", "pnot"];

/** Whether the bytes are really a file of `kind` (magic-byte check). */
export function matchesMagic(kind: FileKind, b: Uint8Array): boolean {
  switch (kind) {
    case "jpg":
      return startsWith(b, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "gif":
      return startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a"));
    case "webp":
      return startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8);
    case "pdf":
      return startsWith(b, ascii("%PDF-"));
    case "zip":
      return isZip(b);
    case "docx":
      return isOoxml(b, "word/");
    case "xlsx":
      return isOoxml(b, "xl/");
    case "pptx":
      return isOoxml(b, "ppt/");
    case "mp4":
      return hasFtyp(b);
    case "mov":
      return hasFtyp(b) || QT_ATOMS.some((a) => startsWith(b, ascii(a), 4));
    case "ai":
      // Modern Illustrator files are PDF-compatible; older ones are PostScript.
      return startsWith(b, ascii("%PDF-")) || startsWith(b, ascii("%!PS-Adobe"));
    case "psd":
      return startsWith(b, ascii("8BPS"));
    default:
      return false;
  }
}

export type FileProblem = "type" | "empty" | "size" | "content";

export const FILE_PROBLEM_TEXT: Record<FileProblem, string> = {
  type: "نوع الملف غير مسموح",
  empty: "الملف فارغ",
  size: "حجم الملف أكبر من 10 ميجابايت",
  content: "محتوى الملف لا يطابق امتداده",
};

export type CheckedFile =
  | { ok: true; name: string; kind: FileKind; mime: string }
  | { ok: false; name: string; problem: FileProblem };

/**
 * Validate one upload: sanitized name → accepted extension → size → magic
 * bytes. `bytes` may be only the head of the file when `size` is given
 * (the browser pre-check); the server always passes the whole file.
 */
export function checkFile(
  rawName: string,
  bytes: Uint8Array,
  size = bytes.byteLength,
  maxBytes = MAX_FILE_BYTES,
): CheckedFile {
  const name = sanitizeFileName(rawName);
  const kind = kindFromName(name);
  if (!kind) return { ok: false, name, problem: "type" };
  if (size <= 0) return { ok: false, name, problem: "empty" };
  if (size > maxBytes) return { ok: false, name, problem: "size" };
  if (!matchesMagic(kind, bytes)) return { ok: false, name, problem: "content" };
  return { ok: true, name, kind, mime: FILE_KINDS[kind].mime };
}

/**
 * `Content-Disposition` for a stored file: an ASCII fallback name plus the
 * exact UTF-8 name (RFC 6266 / 5987), so Arabic names survive.
 */
export function contentDisposition(name: string, inline: boolean): string {
  const clean = sanitizeFileName(name);
  const fallback = clean.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;%]/g, "_") || "file";
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** "2.4 ميجابايت" / "812 كيلوبايت" with Latin digits. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} كيلوبايت`;
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} ميجابايت`;
}
