import type { Db } from "./db";

/*
 * A clean start for testing (scripts/fresh-start.mjs, docs/fresh-start.md): everything
 * members made goes, and every account but the college's own; what the college keeps
 * (the register, the showcase, settings, the audit log, causes and the money records,
 * staff invitations) stays.
 *
 * Kept accounts: the college's own (users.college_account = 1), administrators (role
 * 'admin'), and anyone named in ALUMNITY_SUPER_ADMINS or ALUMNITY_ADMINS (the config roles
 * of lib/server/auth.ts). Every other account goes: its users row, its profile, its
 * Supabase Auth user. All social data goes from everyone, kept accounts included.
 *
 * Foreign keys aren't listed by hand: they're read from the database (pg_catalog), so a
 * table added later is handled too. A kept table pointing at a removed account (or at a
 * wiped table) has that column set to null; if the column can't be null, nothing at all
 * happens (the whole thing stops before changing anything). Every other table pointing at
 * a removed account loses those rows.
 *
 * The database part is one transaction. Only after it commits are the Auth users and the
 * stored files deleted (one that fails is logged: a harmless leftover).
 *
 * This file only imports types, so the script (plain Node, which strips the types) can
 * load it; the database, Auth and the files are handed in.
 */

/** Tables the college keeps (never emptied; a column pointing at a removed account is set to null). */
export const KEEP_TABLES = ["register", "announcements", "settings", "audit", "donations", "cause_payouts", "causes", "staff_invites"] as const;
/** Whole schemas kept the same way (the register and the showcase are moving here). */
export const KEEP_SCHEMAS = ["records", "site"] as const;

/** Members' social data: emptied completely, for everyone. Tables that don't exist are skipped. */
export const WIPE_TABLES = [
  "posts",
  "post_cheers",
  "post_comments",
  "post_media",
  "post_tags",
  "reposts",
  "messages",
  "message_hidden",
  "chat_cleared",
  "stories",
  "story_views",
  "connections",
  "follows",
  "blocks",
  "notifications",
  "asks",
  "ask_routes",
  "ask_messages",
  "groups",
  "group_members",
  "events",
  "rsvps",
  "openings",
  "referral_requests",
  "reports",
  "push_subscriptions",
  "member_prefs",
  "auth_intents",
  "throttle",
  "media",
  "uploads"
] as const;

/** Who is kept besides the college's accounts and administrators: emails from the server's config. */
export type KeepRule = { superAdmins: string[]; admins: string[] };

/** The emails in a comma-separated setting (ALUMNITY_SUPER_ADMINS, ALUMNITY_ADMINS), as configRole reads them. */
export const emailList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const keepRuleFromEnv = (env: Record<string, string | undefined> = process.env): KeepRule => ({
  superAdmins: emailList(env.ALUMNITY_SUPER_ADMINS),
  admins: emailList(env.ALUMNITY_ADMINS)
});

export type KeptAccount = { id: number; email: string; name: string; role: string; reasons: string[] };
export type RemovedAccount = { id: number; email: string; name: string; role: string; authId: string | null; sample: boolean };

export type Step = {
  kind: "null" | "wipe" | "delete" | "reset" | "accounts";
  /** schema.table */
  table: string;
  column?: string;
  /** In words, for the printout. */
  what: string;
  rows: number;
};

export type FreshStartPlan = {
  kept: KeptAccount[];
  removed: RemovedAccount[];
  /** In the order they'd run. */
  steps: Step[];
  /** Why it would stop without changing anything (empty: it can go ahead). */
  blockers: string[];
  /** Stored files that would be deleted (null: the files couldn't be listed). */
  files: string[] | null;
};

/** Auth and the stored files, handed in (Supabase's, the local ones, or the tests' stand-ins). */
export type FreshStartServices = {
  deleteAuthUser(authId: string): Promise<void>;
  listFiles(): Promise<string[]>;
  /** Deletes these; returns the ones that couldn't be. */
  removeFiles(paths: string[]): Promise<string[]>;
};

export class FreshStartAborted extends Error {
  // (No constructor parameter properties: plain Node can't strip them.)
  readonly blockers: string[];
  constructor(blockers: string[]) {
    super(`Fresh start stopped. Nothing was changed:\n${blockers.map((b) => `  - ${b}`).join("\n")}`);
    this.name = "FreshStartAborted";
    this.blockers = blockers;
  }
}

// ---------- What's in the database ----------

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const qualified = (schema: string, table: string) => `${ident(schema)}.${ident(table)}`;
const label = (schema: string, table: string) => `${schema}.${table}`;

type Fk = {
  schema: string;
  table: string;
  column: string;
  not_null: boolean;
  ref_schema: string;
  ref_table: string;
  ref_column: string;
  columns: number;
};

/**
 * Every foreign key in the database. From pg_catalog rather than information_schema: the
 * latter hides constraints on tables the connecting role doesn't own, and its link from a
 * key to the column it points at is ambiguous across schemas.
 */
async function foreignKeys(d: Db): Promise<Fk[]> {
  return d.all<Fk>(
    `select n.nspname as schema, c.relname as "table", a.attname as "column", a.attnotnull as not_null,
            rn.nspname as ref_schema, rc.relname as ref_table, ra.attname as ref_column,
            array_length(con.conkey, 1) as columns
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_class rc on rc.oid = con.confrelid
       join pg_namespace rn on rn.oid = rc.relnamespace
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
       join pg_attribute ra on ra.attrelid = con.confrelid and ra.attnum = con.confkey[1]
      where con.contype = 'f'
      order by 1, 2, 3`
  );
}

async function tablesIn(d: Db, schemas: readonly string[]): Promise<{ schema: string; table: string }[]> {
  if (!schemas.length) return [];
  return d.all(
    `select table_schema as schema, table_name as "table" from information_schema.tables
      where table_type = 'BASE TABLE' and table_schema in (${schemas.map(() => "?").join(", ")})`,
    ...schemas
  );
}

async function hasColumn(d: Db, schema: string, table: string, column: string) {
  return Boolean(await d.one("select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?", schema, table, column));
}

/** The kept accounts' test, as SQL on `users u` (with its parameters). */
function keepTest(rule: KeepRule): { sql: string; params: string[] } {
  const emails = [...new Set([...rule.superAdmins, ...rule.admins].map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const byEmail = emails.length ? ` or lower(u.email) in (${emails.map(() => "?").join(", ")})` : "";
  return { sql: `(coalesce(u.college_account, 0) = 1 or u.role = 'admin'${byEmail})`, params: emails };
}

type Planned = Step & { sql: string; params: unknown[]; count: { sql: string; params: unknown[] } };

/** Everything that would happen, worked out from the database as it is now (reads only). */
async function work(d: Db, rule: KeepRule): Promise<{ steps: Planned[]; blockers: string[]; kept: KeptAccount[]; removed: RemovedAccount[] }> {
  const users = qualified("public", "users");
  if (!(await d.one("select to_regclass('public.users') as t"))?.t) throw new Error("There's no public.users table here: is this Alumnity's database?");

  const keep = keepTest(rule);
  const doomed = (column = "id") => ({ sql: `select u.${ident(column)} from ${users} u where not ${keep.sql}`, params: keep.params });

  const keptRows = await d.all<{ id: number; email: string; name: string; role: string; college_account: number }>(
    `select u.id, u.email, u.name, u.role, coalesce(u.college_account, 0) as college_account from ${users} u where ${keep.sql} order by u.id`,
    ...keep.params
  );
  const supers = new Set(rule.superAdmins.map((e) => e.toLowerCase()));
  const admins = new Set(rule.admins.map((e) => e.toLowerCase()));
  const kept = keptRows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    name: r.name,
    role: r.role,
    reasons: [
      ...(Number(r.college_account) === 1 ? ["college account"] : []),
      ...(r.role === "admin" ? ["role admin"] : []),
      ...(supers.has(r.email.toLowerCase()) ? ["in ALUMNITY_SUPER_ADMINS"] : []),
      ...(admins.has(r.email.toLowerCase()) ? ["in ALUMNITY_ADMINS"] : [])
    ]
  }));
  const removed = (
    await d.all<{ id: number; email: string; name: string; role: string; auth_id: string | null; sample: number }>(
      `select u.id, u.email, u.name, u.role, u.auth_id::text as auth_id, u.sample from ${users} u where not ${keep.sql} order by u.id`,
      ...keep.params
    )
  ).map((r) => ({ id: Number(r.id), email: r.email, name: r.name, role: r.role, authId: r.auth_id ?? null, sample: Boolean(Number(r.sample)) }));

  // Which tables are which.
  const keptSet = new Set<string>([...KEEP_TABLES.map((t) => label("public", t)), ...(await tablesIn(d, KEEP_SCHEMAS)).map((t) => label(t.schema, t.table))]);
  const present = new Set((await tablesIn(d, ["public"])).map((t) => t.table));
  const wipe: string[] = WIPE_TABLES.filter((t) => present.has(t));
  const wipeSet = new Set(wipe.map((t) => label("public", t)));
  const usersLabel = label("public", "users");

  const fks = await foreignKeys(d);
  const steps: Planned[] = [];
  const blockers: string[] = [];
  const add = (s: Omit<Planned, "rows" | "count"> & { count?: Planned["count"] }) => steps.push({ ...s, rows: 0, count: s.count ?? { sql: "", params: [] } });

  // 1. Kept tables: whatever points at a removed account, or into a wiped table, becomes null.
  for (const fk of fks) {
    const from = label(fk.schema, fk.table);
    const to = label(fk.ref_schema, fk.ref_table);
    if (!keptSet.has(from) || (to !== usersLabel && !wipeSet.has(to))) continue;
    const target = qualified(fk.schema, fk.table);
    const col = ident(fk.column);
    const where =
      to === usersLabel
        ? { sql: `${col} in (${doomed(fk.ref_column).sql})`, params: doomed(fk.ref_column).params }
        : { sql: `${col} is not null`, params: [] as unknown[] };
    const what = to === usersLabel ? `${from}.${fk.column} → null where it named a removed account` : `${from}.${fk.column} → null (it pointed into ${to}, which is emptied)`;
    if (fk.columns > 1) {
      const n = (await d.one<{ n: number }>(`select count(*) as n from ${target} where ${where.sql}`, ...where.params))?.n ?? 0;
      if (n) blockers.push(`${from} has a key of several columns into ${to} (${n} rows). Fix it by hand.`);
      continue;
    }
    if (fk.not_null) {
      const n = (await d.one<{ n: number }>(`select count(*) as n from ${target} where ${where.sql}`, ...where.params))?.n ?? 0;
      if (n) blockers.push(`${from}.${fk.column} can't be null. ${n} of its rows point at ${to === usersLabel ? "accounts that would be removed" : `${to}, which would be emptied`}. Kept rows are never deleted, so nothing was done.`);
      continue;
    }
    add({ kind: "null", table: from, column: fk.column, what, sql: `update ${target} set ${col} = null where ${where.sql}`, params: where.params, count: { sql: `select count(*) as n from ${target} where ${where.sql}`, params: where.params } });
  }

  // 2. The social tables, emptied: each before any table it points at (no ordering by hand).
  const refs = new Map(wipe.map((t) => [t, new Set<string>()]));
  for (const fk of fks) {
    if (fk.schema === "public" && fk.ref_schema === "public" && refs.has(fk.table) && refs.has(fk.ref_table) && fk.table !== fk.ref_table) refs.get(fk.table)!.add(fk.ref_table);
  }
  const left = [...wipe] as string[];
  while (left.length) {
    // One no remaining table points at; on a cycle, the first in the list.
    const i = Math.max(
      0,
      left.findIndex((t) => !left.some((u) => u !== t && refs.get(u)!.has(t)))
    );
    const [t] = left.splice(i, 1);
    const target = qualified("public", t);
    add({ kind: "wipe", table: label("public", t), what: `${label("public", t)}: every row`, sql: `delete from ${target}`, params: [], count: { sql: `select count(*) as n from ${target}`, params: [] } });
  }

  // 3. Every other table: rows pointing at a removed account go (their profiles, and anything added later).
  for (const fk of fks) {
    const from = label(fk.schema, fk.table);
    if (label(fk.ref_schema, fk.ref_table) !== usersLabel || keptSet.has(from) || wipeSet.has(from) || from === usersLabel) continue;
    const target = qualified(fk.schema, fk.table);
    const sql = `${ident(fk.column)} in (${doomed(fk.ref_column).sql})`;
    add({
      kind: "delete",
      table: from,
      column: fk.column,
      what: `${from}: rows whose ${fk.column} is a removed account`,
      sql: `delete from ${target} where ${sql}`,
      params: keep.params,
      count: { sql: `select count(*) as n from ${target} where ${sql}`, params: keep.params }
    });
  }

  // 4. What kept rows say about the uploads, which are all going: kept members' pages lose
  //    their photo, cover and pinned post; causes lose their cover photo.
  if (present.has("profiles")) {
    const target = qualified("public", "profiles");
    const set = `(data::jsonb ->> 'photo') is not null or (data::jsonb ->> 'cover') is not null or (data::jsonb ->> 'featured') is not null`;
    add({
      kind: "reset",
      table: "public.profiles",
      what: "public.profiles of kept accounts: photo, cover and pinned post cleared (uploads and posts are gone)",
      sql: `update ${target} set data = (data::jsonb || '{"photo": null, "cover": null, "featured": null}'::jsonb)::text where ${set}`,
      params: [],
      // Counted for the kept accounts only (the removed ones' pages are deleted in step 3).
      count: { sql: `select count(*) as n from ${target} where (${set}) and user_id not in (${doomed().sql})`, params: keep.params }
    });
  }
  if (present.has("causes") && (await hasColumn(d, "public", "causes", "cover"))) {
    const target = qualified("public", "causes");
    add({ kind: "reset", table: "public.causes", column: "cover", what: "public.causes.cover → null (the photo was a member's upload)", sql: `update ${target} set cover = null where cover is not null`, params: [], count: { sql: `select count(*) as n from ${target} where cover is not null`, params: [] } });
  }

  // 5. The accounts themselves.
  add({
    kind: "accounts",
    table: usersLabel,
    what: "public.users: the removed accounts",
    sql: `delete from ${users} where id in (${doomed().sql})`,
    params: keep.params,
    count: { sql: `select count(*) as n from ${users} u where not ${keep.sql}`, params: keep.params }
  });

  return { steps, blockers, kept, removed };
}

const counted = async (d: Db, steps: Planned[]) => {
  for (const s of steps) s.rows = Number((await d.one<{ n: number }>(s.count.sql, ...s.count.params))?.n ?? 0);
  return steps;
};

const publicStep = ({ kind, table, column, what, rows }: Planned): Step => ({ kind, table, ...(column ? { column } : {}), what, rows });

// ---------- Dry run ----------

/** What a fresh start would do, changing nothing (only reads: the database, and the list of files). */
export async function planFreshStart(d: Db, services: Pick<FreshStartServices, "listFiles"> | null, rule: KeepRule): Promise<FreshStartPlan> {
  const { steps, blockers, kept, removed } = await work(d, rule);
  await counted(d, steps);
  let files: string[] | null = null;
  if (services) {
    try {
      files = await services.listFiles();
    } catch {
      files = null;
    }
  }
  return { kept, removed, steps: steps.map(publicStep), blockers, files };
}

/** The dry run's printout (and the real run's summary): counts, accounts kept and why, accounts removed, files. */
export function describePlan(plan: FreshStartPlan, opts: { listFiles?: boolean } = {}): string[] {
  const out: string[] = [];
  out.push(`Accounts kept (${plan.kept.length}):`);
  for (const k of plan.kept) out.push(`  #${k.id}  ${k.role.padEnd(11)} ${k.email}  (${k.name}): ${k.reasons.join(", ")}`);
  if (!plan.kept.some((k) => k.role === "admin")) out.push("  (None of them is an administrator. Run make-test-accounts after this, or nobody can use the college desk.)");
  const byRole = new Map<string, number>();
  for (const r of plan.removed) byRole.set(r.role, (byRole.get(r.role) ?? 0) + 1);
  out.push("");
  out.push(`Accounts to delete (${plan.removed.length}${plan.removed.length ? `: ${[...byRole].map(([r, n]) => `${n} ${r}`).join(", ")}` : ""}; ${plan.removed.filter((r) => r.authId).length} with an Auth sign-in):`);
  for (const r of plan.removed) out.push(`  #${r.id}  ${r.role.padEnd(11)} ${r.email}${r.sample ? "  (sample)" : ""}${r.authId ? "" : "  (no Auth user)"}`);
  out.push("");
  out.push("Database rows (all in one transaction):");
  for (const s of plan.steps) {
    const verb = s.kind === "null" || s.kind === "reset" ? "change" : "delete";
    out.push(`  ${verb} ${String(s.rows).padStart(7)}  ${s.what}`);
  }
  out.push("");
  if (plan.files === null) out.push("Stored files: couldn't list them (see above). Every file in the bucket would be deleted.");
  else {
    out.push(`Stored files to delete: ${plan.files.length}`);
    if (opts.listFiles) for (const f of plan.files) out.push(`  ${f}`);
    else if (plan.files.length) out.push("  (--list-files to see each path)");
  }
  if (plan.blockers.length) {
    out.push("");
    out.push("IT WOULD STOP AND CHANGE NOTHING:");
    for (const b of plan.blockers) out.push(`  - ${b}`);
  }
  return out;
}

// ---------- The real thing ----------

export type FreshStartResult = {
  plan: FreshStartPlan;
  authDeleted: number;
  authFailed: string[];
  filesDeleted: number;
  filesFailed: string[];
};

/**
 * Does it: the database in one transaction (worked out afresh inside it, so it acts on the
 * database as it is at that moment; any blocker stops it before a single change), then,
 * once that has committed, the Auth users and the stored files.
 */
export async function runFreshStart(d: Db, services: FreshStartServices, rule: KeepRule, log: (line: string) => void = () => {}): Promise<FreshStartResult> {
  const { steps, kept, removed } = await d.tx(async (t) => {
    const done = await work(t, rule);
    if (done.blockers.length) throw new FreshStartAborted(done.blockers);
    for (const s of done.steps) s.rows = await t.run(s.sql, ...s.params);
    return done;
  });
  log(`Database: committed (${removed.length} accounts deleted, ${kept.length} kept).`);

  const authFailed: string[] = [];
  let authDeleted = 0;
  for (const r of removed) {
    if (!r.authId) continue;
    try {
      await services.deleteAuthUser(r.authId);
      authDeleted++;
    } catch (e) {
      authFailed.push(r.authId);
      log(`  Auth user ${r.authId} (${r.email}) not deleted: ${(e as Error).message}`);
    }
  }
  log(`Auth users deleted: ${authDeleted}${authFailed.length ? `, ${authFailed.length} failed (left behind, but harmless: no member row points at them)` : ""}.`);

  let files: string[] = [];
  const filesFailed: string[] = [];
  try {
    files = await services.listFiles();
  } catch (e) {
    log(`Stored files couldn't be listed: ${(e as Error).message}. Delete them from the bucket by hand.`);
  }
  for (let i = 0; i < files.length; i += 100) {
    const batch = files.slice(i, i + 100);
    try {
      filesFailed.push(...(await services.removeFiles(batch)));
    } catch (e) {
      filesFailed.push(...batch);
      log(`  ${batch.length} files not deleted: ${(e as Error).message}`);
    }
  }
  log(`Stored files deleted: ${files.length - filesFailed.length}${filesFailed.length ? `, ${filesFailed.length} failed (left behind, but harmless: nothing points at them)` : ""}.`);

  return { plan: { kept, removed, steps: steps.map(publicStep), blockers: [], files }, authDeleted, authFailed, filesDeleted: files.length - filesFailed.length, filesFailed };
}
