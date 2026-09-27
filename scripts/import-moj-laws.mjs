#!/usr/bin/env node
/**
 * Import the Ministry of Justice's published legislation (البوابة القانونية,
 * laws.moj.gov.sa) into data/laws/moj-laws.json.gz — run by hand when the
 * library should be refreshed; `scripts/seed-laws.mjs` loads the file into
 * the database on deploy.
 *
 *   node scripts/import-moj-laws.mjs
 *
 * Only public endpoints the portal itself calls are used, one request at a
 * time with a pause, and every record keeps its official link.
 */
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const API = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ar",
  Origin: "https://laws.moj.gov.sa",
  Referer: "https://laws.moj.gov.sa/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, init = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const headers = init.body ? { ...HEADERS, "Content-Type": "application/json" } : HEADERS;
      const res = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      if (raw.startsWith("<")) throw new Error("blocked (HTML answer)");
      const body = JSON.parse(raw);
      if (!body.success) throw new Error(body.message || "failed");
      return body.model;
    } catch (err) {
      if (attempt >= 5) throw err;
      await sleep(5000 * attempt);
    }
  }
}

/** Portal HTML → plain text with line breaks. */
export function htmlToText(html) {
  return String(html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&bull;/g, "•")
    .replace(/&times;/g, "×")
    .replace(/&(zwnj|zwj|rlm|lrm|shy);/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[‎‏‪-‮]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Walk the statute tree: headings give the path, type-1 nodes are articles. */
function articlesOf(nodes, path = [], out = []) {
  for (const n of nodes ?? []) {
    const label = [n.sequence, n.name].filter(Boolean).join(": ").trim();
    if (n.type === 1) {
      const text = htmlToText(n.text);
      if (text && !n.isCancelled) {
        out.push({ seq: (n.sequence || "").trim(), heading: path.filter(Boolean).join(" › "), text });
      }
    }
    if (n.items?.length) articlesOf(n.items, n.type === 1 ? path : [...path, label], out);
  }
  return out;
}

const list = [];
for (let page = 1; ; page += 1) {
  const m = await call("/statute/section-search", {
    method: "POST",
    body: JSON.stringify({ pageNumber: page, pageSize: 50, term: "", LegalStatue: null, classificationId: null, sortingBy: 7, statuteName: "", statuteType: null, type: 1 }),
  });
  list.push(...m.collection);
  if (page >= m.totalPages) break;
  await sleep(800);
}
console.log(`[laws] ${list.length} legislations listed`);

// Resumable: each statute's raw answer is cached (IMPORT_CACHE, default in the OS temp dir).
const cacheDir = process.env.IMPORT_CACHE || `${(await import("node:os")).tmpdir()}/moj-laws-cache`;
await mkdir(cacheDir, { recursive: true });
const laws = [];
const failed = [];
for (const item of list) {
  const cached = `${cacheDir}/${item.serial}.json`;
  let d;
  try {
    d = JSON.parse(await readFile(cached, "utf8"));
  } catch {
    await sleep(2500);
    try {
      d = await call(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(item.serial)}&identityNumber=`, { method: "GET" });
      await writeFile(cached, JSON.stringify(d));
    } catch (err) {
      console.error(`[laws] ${item.statuteName}: ${err.message}`);
      failed.push(item.statuteName);
      continue;
    }
  }
  const articles = articlesOf(d.statuteStructure);
  laws.push({
    serial: d.serial,
    name: d.name.trim(),
    type: d.legalType ?? item.legalType ?? "",
    status: d.legalStatueName ?? "",
    classification: d.classificationName ?? "",
    issued: d.issuanceDate ? String(d.issuanceDate).slice(0, 10) : null,
    tool: d.issuanceDepartmentTool ?? null,
    summary: htmlToText(d.summary ?? ""),
    url: `https://laws.moj.gov.sa/ar/legislation/${d.serial}`,
    boeUrl: d.bureauOfExpertsAtTheCouncilOfMinistersUrl ?? null,
    articles,
  });
  console.log(`[laws] ${d.name} — ${articles.length} مادة (${d.legalStatueName})`);
}

if (failed.length) {
  console.error(`[laws] ${failed.length} not fetched — run again to resume; nothing written.`);
  process.exit(1);
}
const out = { source: "laws.moj.gov.sa", fetchedAt: new Date().toISOString(), laws };
const json = JSON.stringify(out);
await writeFile(new URL("../data/laws/moj-laws.json.gz", import.meta.url), gzipSync(json, { level: 9 }));
console.log(`[laws] wrote ${laws.length} laws, ${laws.reduce((n, l) => n + l.articles.length, 0)} articles, ${(json.length / 1e6).toFixed(1)} MB raw`);
