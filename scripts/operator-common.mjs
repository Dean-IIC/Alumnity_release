// Shared by the operator scripts (fresh-start.mjs, make-test-accounts.mjs): which database
// they're about to touch, and refusing the wrong one. Plain Node (24+), no build step: it
// loads the app's .ts files directly (Node strips their types). See docs/fresh-start.md.

import { readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

/** This checkout (the folder with package.json). */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** `--name value` and `--flag` from the command line. */
export function parseArgs(argv, known) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const name = arg.replace(/^--/, "");
    if (!arg.startsWith("--") || !(name in known)) throw new Error(`Unknown option: ${arg}`);
    if (known[name] === "value") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      flags[name] = value;
    } else flags[name] = true;
  }
  return flags;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/** Supabase's project ref, from a database URL (pooler user "postgres.<ref>", or host "db.<ref>.supabase.co"). */
const refOfDatabase = (u) => u.username.match(/^postgres\.([a-z0-9]+)$/i)?.[1] ?? u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? null;
/** …and from the project URL (https://<ref>.supabase.co). */
const refOfProject = (url) => {
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? null;
  } catch {
    return null;
  }
};

/**
 * The database these settings point at, as lib/server/db.ts would choose it (ALUMNITY_DB
 * first, then DATABASE_URL), and whether it's on this computer.
 */
export function databaseTarget(env = process.env) {
  const pg = env.ALUMNITY_DB;
  if (pg === "pglite") throw new Error("ALUMNITY_DB=pglite is an empty database in memory: point it at the local folder (ALUMNITY_DB=pglite:data/pglite).");
  if (pg?.startsWith("pglite:")) return { local: true, describe: `PGlite folder ${resolve(pg.slice("pglite:".length))} (this computer)`, ref: null };
  const url = env.DATABASE_URL;
  if (!url) throw new Error("Neither DATABASE_URL nor ALUMNITY_DB is set: see docs/fresh-start.md.");
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("DATABASE_URL isn't a connection URL (postgres://…).");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const local = LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
  const ref = refOfDatabase(u);
  const db = decodeURIComponent(u.pathname.slice(1)) || "postgres";
  return { local, describe: `${host}:${u.port || 5432}/${db}${ref ? ` (Supabase project ${ref})` : ""}${local ? " (this computer)" : ""}`, ref };
}

/**
 * Refuses a database on this computer without --local, a hosted one with --local, and a
 * DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL from two different Supabase projects.
 */
export function checkTarget(target, local, env = process.env) {
  if (target.local && !local) throw new Error(`The database is on this computer (${target.describe}). Add --local if that's what you mean.`);
  if (!target.local && local) throw new Error(`--local was given, but the database is ${target.describe}. Leave out --local to use it, or point the settings at the local database.`);
  if (!local) {
    const project = refOfProject(env.NEXT_PUBLIC_SUPABASE_URL);
    if (target.ref && project && target.ref !== project) {
      throw new Error(`DATABASE_URL is Supabase project ${target.ref}, but NEXT_PUBLIC_SUPABASE_URL is project ${project}: they must be the same project.`);
    }
  }
}

export const supabaseConfigured = (env = process.env) => Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

/** Where the local uploads are (as lib/server/storage.ts's folder storage). */
export const localUploads = (env = process.env) => env.ALUMNITY_UPLOADS || join(repoRoot, "data", "uploads");

/** Every file under a folder, as paths relative to it ("/"-separated). */
export function filesUnder(folder) {
  const out = [];
  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), path);
      else out.push(path);
    }
  };
  walk(folder, "");
  return out;
}

export function removeUnder(folder, paths) {
  const failed = [];
  for (const p of paths) {
    try {
      rmSync(join(folder, p), { force: true });
    } catch {
      failed.push(p);
    }
  }
  return failed;
}

/** Whether `path` is inside this checkout (where a file of passwords must never go). */
export function insideRepo(path) {
  const rel = relative(repoRoot, resolve(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
