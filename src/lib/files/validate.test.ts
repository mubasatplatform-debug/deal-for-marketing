import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FILE_BYTES,
  MAX_NAME_CHARS,
  checkFile,
  contentDisposition,
  kindFromName,
  matchesMagic,
  sanitizeFileName,
} from "./validate.ts";
import { blobPathFor, storageDriverFor } from "./driver.ts";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13], "IHDR");
const JPG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16], "JFIF");
const GIF = bytes("GIF89a", [1, 0, 1, 0]);
const WEBP = bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ");
const PDF = bytes("%PDF-1.7\n%âãÏÓ");
const EXE = bytes("MZ", [0x90, 0, 3, 0, 0, 0, 4, 0], "This program cannot be run in DOS mode");
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0], "hello.txt");
const DOCX = bytes([0x50, 0x4b, 0x03, 0x04, 20, 0, 6, 0], "[Content_Types].xml", [0, 0], "word/document.xml");
const XLSX = bytes([0x50, 0x4b, 0x03, 0x04, 20, 0, 6, 0], "[Content_Types].xml", [0, 0], "xl/workbook.xml");
const MP4 = bytes([0, 0, 0, 0x20], "ftypisom", [0, 0, 2, 0]);
const MOV = bytes([0, 0, 0, 0x14], "ftypqt  ");
const OLD_MOV = bytes([0, 0, 0, 0x6c], "moov");
const PSD = bytes("8BPS", [0, 1]);
const AI_PS = bytes("%!PS-Adobe-3.0");
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = bytes("<!doctype html><script>alert(1)</script>");

test("magic bytes: each accepted kind matches its own signature", () => {
  assert.equal(matchesMagic("png", PNG), true);
  assert.equal(matchesMagic("jpg", JPG), true);
  assert.equal(matchesMagic("gif", GIF), true);
  assert.equal(matchesMagic("webp", WEBP), true);
  assert.equal(matchesMagic("pdf", PDF), true);
  assert.equal(matchesMagic("zip", ZIP), true);
  assert.equal(matchesMagic("docx", DOCX), true);
  assert.equal(matchesMagic("xlsx", XLSX), true);
  assert.equal(matchesMagic("mp4", MP4), true);
  assert.equal(matchesMagic("mov", MOV), true);
  assert.equal(matchesMagic("mov", OLD_MOV), true);
  assert.equal(matchesMagic("psd", PSD), true);
  assert.equal(matchesMagic("ai", AI_PS), true);
  assert.equal(matchesMagic("ai", PDF), true);
});

test("magic bytes: mismatched content is rejected", () => {
  assert.equal(matchesMagic("png", EXE), false, "an .exe renamed to .png");
  assert.equal(matchesMagic("jpg", PNG), false);
  assert.equal(matchesMagic("pdf", HTML), false);
  assert.equal(matchesMagic("png", SVG), false);
  assert.equal(matchesMagic("webp", bytes("RIFF", [0, 0, 0, 0], "WAVEfmt ")), false, "a WAV is RIFF but not WEBP");
  assert.equal(matchesMagic("docx", ZIP), false, "a plain zip is not a Word file");
  assert.equal(matchesMagic("xlsx", DOCX), false, "a Word file is not a spreadsheet");
  assert.equal(matchesMagic("mp4", PDF), false);
  assert.equal(matchesMagic("png", new Uint8Array()), false, "empty input");
  assert.equal(matchesMagic("png", PNG.slice(0, 4)), false, "truncated signature");
});

test("checkFile: extension picks the type, bytes must agree, browser MIME is irrelevant", () => {
  const ok = checkFile("logo.PNG", PNG);
  assert.deepEqual(ok, { ok: true, name: "logo.PNG", kind: "png", mime: "image/png" });
  assert.deepEqual(checkFile("setup.png", EXE), { ok: false, name: "setup.png", problem: "content" });
  assert.equal(checkFile("brief.pdf", PDF).ok, true);
  assert.equal(checkFile("photo.jpeg", JPG).ok, true);
});

test("checkFile: SVG, HTML and executables are not accepted types", () => {
  for (const name of ["icon.svg", "page.html", "page.htm", "run.exe", "script.js", "noext"]) {
    const res = checkFile(name, name.endsWith(".svg") ? SVG : HTML);
    assert.equal(res.ok, false, name);
    assert.equal(!res.ok && res.problem, "type", name);
  }
});

test("checkFile: size limits", () => {
  const empty = checkFile("a.png", new Uint8Array());
  assert.equal(!empty.ok && empty.problem, "empty");
  const big = checkFile("a.png", PNG, MAX_FILE_BYTES + 1);
  assert.equal(!big.ok && big.problem, "size");
  assert.equal(checkFile("a.png", PNG, MAX_FILE_BYTES).ok, true, "exactly 10 MB is allowed");
});

test("sanitizeFileName: strips paths, controls, bidi tricks and reserved characters", () => {
  assert.equal(sanitizeFileName("../../etc/passwd.png"), "passwd.png");
  assert.equal(sanitizeFileName("C:\\Users\\me\\Desktop\\logo.png"), "logo.png");
  assert.equal(sanitizeFileName("in\u0000vo\u0007ice.pdf"), "invoice.pdf");
  // Right-to-left override disguising an extension: removed, so the real
  // extension is visible and checked.
  const spoofed = sanitizeFileName("invoice\u202Egnp.exe");
  assert.equal(spoofed, "invoicegnp.exe");
  assert.equal(kindFromName(spoofed), null);
  assert.equal(sanitizeFileName('a<b>c:"d|e?f*.png'), "a_b_c__d_e_f_.png");
  assert.equal(sanitizeFileName("  report   final .pdf  "), "report final.pdf");
  assert.equal(sanitizeFileName("...hidden.png"), "hidden.png");
});

test("sanitizeFileName: keeps Arabic, never returns empty, caps length with the extension", () => {
  assert.equal(sanitizeFileName("هوية ديل النهائية.pdf"), "هوية ديل النهائية.pdf");
  assert.equal(sanitizeFileName(""), "file");
  assert.equal(sanitizeFileName(".png"), "file.png");
  assert.equal(sanitizeFileName("/////"), "file");
  const long = sanitizeFileName(`${"ش".repeat(300)}.docx`);
  assert.equal([...long].length, MAX_NAME_CHARS);
  assert.ok(long.endsWith(".docx"));
});

test("contentDisposition: ASCII fallback plus the exact UTF-8 name", () => {
  assert.equal(
    contentDisposition("logo.png", false),
    `attachment; filename="logo.png"; filename*=UTF-8''logo.png`,
  );
  const ar = contentDisposition("هوية.pdf", true);
  assert.ok(ar.startsWith('inline; filename="____.pdf"; filename*=UTF-8\'\''));
  assert.ok(ar.endsWith(encodeURIComponent("هوية.pdf")));
  assert.ok(!/[\r\n]/.test(contentDisposition('evil"\r\nSet-Cookie: x.png', false)));
});

test("storage driver: Vercel Blob only with a non-empty BLOB_READ_WRITE_TOKEN", () => {
  assert.equal(storageDriverFor({}), "db");
  assert.equal(storageDriverFor({ BLOB_READ_WRITE_TOKEN: "" }), "db");
  assert.equal(storageDriverFor({ BLOB_READ_WRITE_TOKEN: "   " }), "db");
  assert.equal(storageDriverFor({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc_123" }), "blob");
});

test("blob paths are scoped per request and file, ASCII-only", () => {
  assert.equal(
    blobPathFor(42, "6f1c-uuid", "هوية ديل.pdf"),
    "requests/42/6f1c-uuid/_.pdf",
  );
  assert.equal(blobPathFor(7, "id", "Logo v2.png"), "requests/7/id/Logo_v2.png");
});
