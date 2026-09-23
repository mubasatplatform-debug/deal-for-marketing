#!/usr/bin/env node
/**
 * Standalone (off-platform) build and start: Render, a VPS, any plain Node host.
 *
 *   node scripts/standalone.mjs build   -> `vite build` with DEAL_STANDALONE=1
 *                                          (nitro `node-server` preset -> .output/)
 *   node scripts/standalone.mjs start   -> migrate, then run .output/server/index.mjs
 *
 * Setting DEAL_STANDALONE here (not with `VAR=1 cmd` in package.json) keeps the
 * scripts working on Windows shells too. The plain `npm run build` without
 * DEAL_STANDALONE builds the Vercel preset (.vercel/output), which `start`
 * cannot run — so `start` checks for the node-server entry and says so.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = join(root, ".output", "server", "index.mjs");

// `npm start` only ever serves the standalone build, so the standalone runtime
// guards (DATABASE_URL required, see scripts/migrate.mjs and src/lib/db.ts)
// apply unless the host explicitly says otherwise.
process.env.DEAL_STANDALONE ??= "1";

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

const command = process.argv[2];

if (command === "build") {
  process.exit(await run([join(root, "scripts", "with-app-env.mjs"), "vite", "build"]));
} else if (command === "start") {
  if (!existsSync(serverEntry)) {
    console.error(
      "[start] .output/server/index.mjs not found — there is no standalone server build.\n" +
        "[start] Run `npm run build:standalone` (or `npm run build` with DEAL_STANDALONE=1) first.\n" +
        "[start] A plain `npm run build` targets the Vercel preset (.vercel/output), which " +
        "`npm start` cannot serve.",
    );
    process.exit(1);
  }
  const migrated = await run([join(root, "scripts", "migrate.mjs")]);
  if (migrated !== 0) process.exit(migrated);
  // Same process as the server, so the host's signals (SIGTERM on redeploy) reach it.
  await import(pathToFileURL(serverEntry).href);
} else {
  console.error("usage: node scripts/standalone.mjs <build|start>");
  process.exit(2);
}
