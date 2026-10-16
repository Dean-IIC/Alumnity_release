import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/*
 * Alumnity's database: Supabase Postgres in production (DATABASE_URL, the pooled
 * connection string), or PGlite, a real Postgres inside the process: in memory for the
 * tests (ALUMNITY_DB=pglite), or kept in a folder for working offline
 * (ALUMNITY_DB=pglite:data/pglite). The schema is supabase/migrations/.
 *
 * Queries are plain SQL with `?` placeholders (numbered for Postgres here). Big integers
 * come back as numbers: ids and millisecond times all fit.
 *
 * Server only: import from route handlers, server actions and server components.
 */

export type Row = Record<string, unknown>;

export type Db = {
  /** Every row. */
  all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]>;
  /** The first row, or undefined. */
  one<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  /** Runs a change; returns how many rows it touched. */
  run(sql: string, ...params: unknown[]): Promise<number>;
  /** Several statements at once (the schema). */
  exec(sql: string): Promise<void>;
  /** All of `work` happens, or none of it. */
  tx<T>(work: (db: Db) => Promise<T>): Promise<T>;
};

/** `?` → `$1, $2…`, leaving question marks inside quoted strings alone. */
export function numbered(sql: string): string {
  let n = 0;
  let out = "";
  let quote: string | null = null;
  for (const ch of sql) {
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === "?") {
      out += `$${++n}`;
    } else out += ch;
  }
  return out;
}

/** Undefined means null to the database. */
const values = (params: unknown[]) => params.map((p) => (p === undefined ? null : p));

// ---------- Postgres (Supabase) ----------

type Sql = postgres.Sql | postgres.TransactionSql;

/** Errors that mean the connection dropped (the pooler restarted, a network blip), not that the query was wrong. */
const DROPPED = new Set(["CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT", "EPIPE"]);
const isRead = (text: string) => /^\s*(select|with)/i.test(text);

function fromPostgres(sql: Sql): Db {
  // A read whose connection dropped is tried once more on a fresh one; a write never is
  // (it may already have happened).
  const query = async (text: string, params: unknown[]) => {
    const run = () => sql.unsafe(numbered(text), values(params) as postgres.ParameterOrJSON<never>[]);
    try {
      return await run();
    } catch (error) {
      if (!isRead(text) || !DROPPED.has(String((error as { code?: string }).code))) throw error;
      return run();
    }
  };
  return {
    all: async <T>(text: string, ...params: unknown[]) => (await query(text, params)) as unknown as T[],
    one: async <T>(text: string, ...params: unknown[]) => ((await query(text, params)) as unknown as T[])[0],
    run: async (text, ...params) => (await query(text, params)).count,
    exec: async (text) => {
      await sql.unsafe(text);
    },
    tx: async (work) => {
      if (!("begin" in sql)) return work(fromPostgres(sql)); // already in one
      return (await (sql as postgres.Sql).begin((inner) => work(fromPostgres(inner)))) as never;
    }
  };
}

function connectPostgres(url: string): Db {
  const sql = postgres(url, {
    // Supabase's pooler (transaction mode) doesn't keep prepared statements between requests.
    prepare: false,
    // Serverless: a few connections per instance, closed when idle.
    max: Number(process.env.DATABASE_POOL || 10),
    idle_timeout: 20,
    connect_timeout: 10,
    types: {
      // int8 and numeric as numbers (counts, sums, ids, millisecond times).
      bigint: { to: 20, from: [20, 1700], serialize: (v: number) => String(v), parse: (v: string) => Number(v) }
    }
  });
  return fromPostgres(sql);
}

// ---------- PGlite (tests) ----------

type PGliteLike = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(work: (tx: PGliteLike) => Promise<T>): Promise<T>;
};

function fromPglite(pg: PGliteLike): Db {
  return {
    all: async <T>(text: string, ...params: unknown[]) => (await pg.query<T>(numbered(text), values(params))).rows,
    one: async <T>(text: string, ...params: unknown[]) => (await pg.query<T>(numbered(text), values(params))).rows[0],
    run: async (text, ...params) => (await pg.query(numbered(text), values(params))).affectedRows ?? 0,
    exec: async (text) => {
      await pg.exec(text);
    },
    tx: (work) => pg.transaction((inner) => work(fromPglite(inner)))
  };
}

async function connectPglite(folder?: string): Promise<Db> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const pg = new PGlite({
    dataDir: folder || undefined,
    parsers: { [types.INT8]: (v: string) => Number(v), [types.NUMERIC]: (v: string) => Number(v) }
  });
  // The schema, as on Supabase: every migration in order (the storage bucket's is
  // Supabase's alone). Each is safe to run again, so a kept folder just gets what's new.
  const migrations = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort()) {
    await pg.exec(readFileSync(join(migrations, file), "utf8"));
  }
  const local = fromPglite(pg as unknown as PGliteLike);
  if (folder) await loadLocalRegister(local);
  return local;
}

/**
 * Working on this computer: the register comes from data/college-records.csv (never
 * committed), the first time the local database starts. On Supabase it's loaded by
 * scripts/import-register.mjs instead.
 */
async function loadLocalRegister(local: Db) {
  if (await local.one("select 1 from register limit 1")) return;
  let csv: string;
  try {
    csv = readFileSync(process.env.ALUMNITY_REGISTER || join(process.cwd(), "data", "college-records.csv"), "utf8");
  } catch {
    return;
  }
  const { parseRegister } = await import("../register");
  const rows = parseRegister(csv);
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await local.run(
      `insert into register (name, usn, branch, branch_name, programme, year) values ${batch.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
      ...batch.flatMap((r) => [r.name, r.usn, r.branch, r.branchName, r.programme, r.year])
    );
  }
}

// ---------- The one connection ----------

let current: Db | undefined;
let pending: Promise<Db> | undefined;

/** The database. Connects on first use. */
export function db(): Db {
  if (current) return current;
  // PGlite starts asynchronously; until it has, every call waits for it.
  const ready = (pending ??= (async () => {
    const local = process.env.ALUMNITY_DB;
    if (local === "pglite" || local?.startsWith("pglite:")) return connectPglite(local.slice("pglite:".length));
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL isn't set: add Supabase's connection string (see docs/deploy.md).");
    return connectPostgres(url);
  })().then((d) => (current = d)));
  const later =
    (key: keyof Db) =>
    (...args: unknown[]) =>
      ready.then((d) => (d[key] as (...a: unknown[]) => unknown)(...args));
  return { all: later("all"), one: later("one"), run: later("run"), exec: later("exec"), tx: later("tx") } as Db;
}

/** For tests: forget the connection, so the next db() starts afresh. */
export function resetDatabase() {
  current = undefined;
  pending = undefined;
}
