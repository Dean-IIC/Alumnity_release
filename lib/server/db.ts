import { AsyncLocalStorage } from "node:async_hooks";
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

// ---------- Timing (the health check, app/api/health) ----------

/** A query: when it started (ms from the start of the trace), and how long it took (null: still running). */
export type Timed = { sql: string; at: number; ms: number | null };
const tracing = new AsyncLocalStorage<{ start: number; queries: Timed[] }>();

/** Runs `work`, noting every query it makes: when it started (from the start of `work`) and how long it took. */
export async function traced<T>(work: () => Promise<T>): Promise<{ result: T; ms: number; queries: Timed[] }> {
  const trace = { start: performance.now(), queries: [] as Timed[] };
  const result = await tracing.run(trace, work);
  return { result, ms: Math.round(performance.now() - trace.start), queries: trace.queries };
}

async function timed<T>(text: string, work: () => Promise<T>): Promise<T> {
  const trace = tracing.getStore();
  if (!trace) return work();
  const began = performance.now();
  // Noted as it starts, so one that never comes back still shows.
  const entry: Timed = { sql: text.replace(/\s+/g, " ").trim().slice(0, 90), at: Math.round(began - trace.start), ms: null };
  trace.queries.push(entry);
  try {
    return await work();
  } finally {
    entry.ms = Math.round(performance.now() - began);
  }
}

/** Whether this process has opened its database yet (a fresh serverless instance hasn't). */
export const opened = () => current !== undefined;

/**
 * Undefined means null to the database. A NUL character (\0) can't be kept in Postgres text
 * at all: one typed or pasted into a post, a name or a search used to make the query fail
 * (a server error, not the words saved), so it's dropped here, for every query alike.
 */
const values = (params: unknown[]) => params.map((p) => (p === undefined ? null : typeof p === "string" && p.includes("\0") ? p.replace(/\0/g, "") : p));

// ---------- Postgres (Supabase) ----------

type Sql = postgres.Sql | postgres.ReservedSql;

/** Errors that mean the connection dropped (the pooler restarted, a network blip), not that the query was wrong. */
const DROPPED = new Set(["CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT", "EPIPE"]);
const isRead = (text: string) => /^\s*(select|with)/i.test(text);

const dropped = (error: unknown) => DROPPED.has(String((error as { code?: string } | null)?.code));

/** Exported for the test that guards transactions; `inTx` when `sql` is one already begun. */
export function fromPostgres(sql: Sql, inTx = false): Db {
  // A read whose connection dropped is tried once more on a fresh one; a write never is
  // (it may already have happened).
  const query = (text: string, params: unknown[]) => timed(text, () => attempt(text, params));
  const attempt = async (text: string, params: unknown[]) => {
    const run = () => sql.unsafe(numbered(text), values(params) as postgres.ParameterOrJSON<never>[]);
    try {
      return await run();
    } catch (error) {
      // Nothing inside a transaction is tried again: the transaction went with the connection.
      if (inTx || !isRead(text) || !dropped(error)) throw error;
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
      if (inTx) return work(fromPostgres(sql, true)); // already in one
      // Not sql.begin(): with max_pipeline 0 (below) it never reserves its connection, and
      // postgres.js refuses the BEGIN ("UNSAFE_TRANSACTION"; seen live: every transaction
      // failed, and a teacher's join stopped halfway). A reserved connection, begun and
      // ended by hand, is the same transaction.
      const reserved = await (sql as postgres.Sql).reserve();
      // A connection that dropped part-way is never handed back: the driver has closed it,
      // and back in the pool it would give the next query a dead socket.
      let dead = false;
      try {
        await reserved.unsafe("begin");
        try {
          const result = await work(fromPostgres(reserved, true));
          await reserved.unsafe("commit");
          return result;
        } catch (error) {
          dead = dropped(error);
          if (!dead) await reserved.unsafe("rollback").catch((e: unknown) => void (dead = dropped(e)));
          throw error;
        }
      } catch (error) {
        dead ||= dropped(error);
        throw error;
      } finally {
        if (!dead) reserved.release();
      }
    }
  };
}

/** How Alumnity talks to Supabase's pooler (exported for the test that guards it). */
export const POSTGRES_OPTIONS = {
  // Supabase's pooler (transaction mode) doesn't keep prepared statements between requests.
  prepare: false,
  // One query at a time on each connection, never several queued behind each other. The
  // pooler (transaction mode) hands its server connection back as each query ends, so a
  // query sent behind another lands on a connection that's already been given away: half
  // of it reaches Postgres, which waits for the rest forever (seen live: Home never
  // finished, a query "active" in Postgres waiting on the client, no locks).
  max_pipeline: 0,
  // Serverless: a few connections per instance, closed when idle.
  max: Number(process.env.DATABASE_POOL || 10),
  // Kept on (the driver's default) for transactions: a connection opened for one
  // (reserve(), in tx below) is only handed over once this first exchange ends. Off, the
  // transaction waits forever (postgres.js 3.4.9; tests/pooler.test.ts).
  fetch_types: true,
  idle_timeout: 20,
  connect_timeout: 10
} as const;

function connectPostgres(url: string): Db {
  const sql = postgres(url, {
    ...POSTGRES_OPTIONS,
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
  const query = <T>(text: string, params: unknown[]) => timed(text, () => pg.query<T>(numbered(text), values(params)));
  return {
    all: async <T>(text: string, ...params: unknown[]) => (await query<T>(text, params)).rows,
    one: async <T>(text: string, ...params: unknown[]) => (await query<T>(text, params)).rows[0],
    run: async (text, ...params) => (await query(text, params)).affectedRows ?? 0,
    exec: async (text) => {
      await pg.exec(text);
    },
    tx: (work) => pg.transaction((inner) => work(fromPglite(inner)))
  };
}

/**
 * The schema, as on Supabase: every migration in filename order (the storage buckets' are
 * Supabase's alone). Each is safe to run again, so a kept folder just gets what's new.
 * The ones that move a table to another schema (the register to `records`, the notices to
 * `site`) drop the empty copy the first migration makes again, and stop rather than lose rows.
 */
export async function runMigrations(pg: { exec(sql: string): Promise<unknown> }) {
  const migrations = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort()) {
    await pg.exec(readFileSync(join(migrations, file), "utf8"));
  }
}

async function connectPglite(folder?: string): Promise<Db> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const pg = new PGlite({
    dataDir: folder || undefined,
    parsers: { [types.INT8]: (v: string) => Number(v), [types.NUMERIC]: (v: string) => Number(v) }
  });
  await runMigrations(pg);
  const local = fromPglite(pg as unknown as PGliteLike);
  if (folder) await loadLocalRegister(local);
  return local;
}

/**
 * Working on this computer: the register (records.register) comes from
 * data/college-records.csv (never committed), the first time the local database starts.
 * On Supabase it's loaded by scripts/import-register.mjs instead.
 */
async function loadLocalRegister(local: Db) {
  if (await local.one("select 1 from records.register limit 1")) return;
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
      `insert into records.register (name, usn, branch, branch_name, programme, year) values ${batch.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
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
    if (local === "pglite" || local?.startsWith("pglite:")) {
      const folder = local.slice("pglite:".length);
      // One PGlite per folder in the whole process. In development a hot reload (and each of
      // Next's server bundles) loads this module afresh: a second PGlite on the same folder
      // corrupted it twice ("could not locate a valid checkpoint record"). Kept on globalThis
      // so they all share the one already open. (In memory, as in the tests: each its own.)
      if (!folder) return connectPglite(folder);
      const shared = globalThis as unknown as { __alumnityPglite?: Map<string, Promise<Db>> };
      shared.__alumnityPglite ??= new Map();
      const open = shared.__alumnityPglite.get(folder) ?? connectPglite(folder);
      shared.__alumnityPglite.set(folder, open);
      return open;
    }
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

/**
 * Moves a table's id counter past the ids already in it, if it has fallen behind. That
 * happens when rows go in with their own ids (an import, a restore): seen live, the counter
 * then handed out ids that were taken, and "insert … on conflict do nothing" quietly made
 * nobody (joining failed with no clash anywhere). Only ever moves the counter forward.
 */
export async function catchUpIds(table: "users"): Promise<void> {
  await db().run(
    `select setval(pg_get_serial_sequence('${table}', 'id'), m) from (select max(id) as m from ${table}) as top
     where m > coalesce((select last_value from pg_sequences where schemaname || '.' || sequencename = pg_get_serial_sequence('${table}', 'id')), 0)`
  );
}
