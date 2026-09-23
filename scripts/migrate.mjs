#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * Also runs before the server on a standalone host (`npm start`, Render).
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts). A standalone
 * production host is the exception: there the fallback is an in-memory
 * database that loses every lead and session on restart, so exit non-zero.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

// Whitespace-only counts as unset, matching src/lib/db.ts.
const rawDatabaseUrl = process.env.DATABASE_URL;
const databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/**
 * A durable database is mandatory on a standalone deploy (DEAL_STANDALONE=1),
 * or on any production run that is not the Vercel / Grok platform build (the
 * platform injects DATABASE_URL itself; its local/preview builds use PGLite).
 */
const requiresDatabase =
  process.env.DEAL_STANDALONE === "1" ||
  (process.env.NODE_ENV === "production" &&
    process.env.VERCEL !== "1" &&
    !process.env.GROK_PROJECT_ID);

if (!databaseUrl) {
  if (requiresDatabase) {
    console.error(
      "[migrate] DATABASE_URL is not set on a standalone production deploy — refusing to " +
        "start.\n[migrate] Without it the app would fall back to an in-memory PGLite and " +
        "silently lose every lead and session on restart.\n[migrate] Set DATABASE_URL " +
        "(e.g. a Neon or Render Postgres connection string) in the host's environment.",
    );
    process.exit(1);
  }
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
