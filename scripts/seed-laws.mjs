/**
 * Load «مكتبة الأنظمة» (data/laws/moj-laws.json.gz, written by
 * scripts/import-moj-laws.mjs) into law_library_* — on deploy after the
 * migrations (scripts/migrate.mjs) and at dev startup (src/lib/db.ts).
 * Reloads only when the file changed (its hash is kept in law_library_meta),
 * in one transaction, so readers never see a half-loaded library.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const DATA_URL = new URL("../data/laws/moj-laws.json.gz", import.meta.url);
const META_KEY = "moj_laws_sha256";
const BATCH = 150;

/**
 * @typedef {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} Db
 * @typedef {{ seq: string, heading: string, text: string }} Article
 * @typedef {{ serial: string, name: string, type: string, status: string, classification: string, issued: string | null,
 *   tool: string | null, summary: string, url: string, boeUrl: string | null, articles: Article[] }} Law
 */

/** @param {string | URL} [file] */
export async function readLawsFile(file = DATA_URL) {
  const gz = await readFile(file);
  const sha = createHash("sha256").update(gz).digest("hex");
  /** @type {{ laws: Law[] }} */
  const data = JSON.parse(gunzipSync(gz).toString("utf8"));
  return { sha, laws: data.laws };
}

/**
 * @param {Db} db  a single connection (the statements must share a transaction)
 * @param {{ file?: string | URL, log?: (msg: string) => void }} [opts]
 * @returns {Promise<"loaded" | "unchanged" | "missing">}
 */
export async function seedLaws(db, opts = {}) {
  const log = opts.log ?? ((m) => console.log(m));
  let file;
  try {
    file = await readLawsFile(opts.file);
  } catch (err) {
    if (/** @type {{ code?: string }} */ (err).code === "ENOENT") return "missing";
    throw err;
  }
  const cur = await db.query("select value from law_library_meta where key = $1", [META_KEY]);
  if (cur.rows[0]?.value === file.sha) return "unchanged";

  await db.query("begin");
  try {
    await db.query("delete from law_library_laws");
    let articles = 0;
    for (const law of file.laws) {
      await db.query(
        `insert into law_library_laws (serial, name, type, status, classification, issued, tool, summary, url, boe_url, article_count)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [law.serial, law.name, law.type, law.status, law.classification, law.issued, law.tool, law.summary, law.url, law.boeUrl, law.articles.length],
      );
      for (let at = 0; at < law.articles.length; at += BATCH) {
        const chunk = law.articles.slice(at, at + BATCH);
        /** @type {unknown[]} */
        const params = [];
        const rows = chunk.map((a, i) => {
          params.push(law.serial, at + i + 1, a.seq, a.heading, a.text, law.name);
          const b = i * 6;
          return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
        });
        await db.query(`insert into law_library_articles (law_serial, ord, seq, heading, text, law_name) values ${rows.join(", ")}`, params);
      }
      articles += law.articles.length;
    }
    await db.query(
      `insert into law_library_meta (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [META_KEY, file.sha],
    );
    await db.query("commit");
    log(`[laws] library loaded — ${file.laws.length} laws, ${articles} articles`);
    return "loaded";
  } catch (err) {
    await db.query("rollback").catch(() => undefined);
    throw err;
  }
}
