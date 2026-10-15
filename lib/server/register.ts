import { db } from "./db";
import { lookup, normaliseUsn, type Lookup, type LookupResult, type RegisterRow } from "../register";

/*
 * The college register, in the database (the `register` table, loaded by
 * scripts/import-register.mjs; the CSV itself is never committed). Only the server reads
 * it, and only these answers leave: "that's you" or "not found", and counts.
 */

type Row = { name: string; usn: string; branch: string; branch_name: string; programme: string; year: number };
const toRow = (r: Row): RegisterRow => ({ name: r.name, usn: r.usn, branch: r.branch, branchName: r.branch_name, programme: r.programme, year: r.year });

/** Whether the register has been loaded at all. */
export async function registerLoaded(): Promise<boolean> {
  return Boolean(await db().one("select 1 from register limit 1"));
}

/** How many on the register in one batch (branch, course, joining year): a count, never names. */
export async function batchCount(branch: string, year: number, programme = "B.Tech"): Promise<number> {
  return (await db().one<{ n: number }>("select count(*) as n from register where branch = ? and year = ? and programme = ?", branch, year, programme))?.n ?? 0;
}

/** How many on the register in someone's batch, them included. */
export async function batchSizeOf(usn: string): Promise<number | undefined> {
  const me = await db().one<Row>("select * from register where usn = ? limit 1", normaliseUsn(usn));
  return me ? batchCount(me.branch, me.year, me.programme) : undefined;
}

/**
 * Finds someone's line: by USN and name, or by name, branch and year (see lib/register.ts
 * for how names are matched). Only the few candidate lines are read, never the register.
 */
export async function findInRegister(query: Lookup): Promise<LookupResult | null> {
  if (!(await registerLoaded())) return null;
  const rows = query.usn
    ? await db().all<Row>("select * from register where usn = ?", normaliseUsn(query.usn))
    : query.branch && query.year
      ? await db().all<Row>("select * from register where branch = ? and year = ? limit 5000", query.branch, query.year)
      : [];
  const result = lookup(rows.map(toRow), query);
  if (result.status !== "found") return result;
  return { ...result, batchSize: await batchCount(result.branch, result.joined, result.programme) };
}

export type RegisterFacts = { count: number; from: number; to: number; branches: { code: string; name: string; count: number }[] };

let facts: { at: number; value: RegisterFacts | null } | undefined;

/** What may be said about the register in public: its size, span and branches (kept ten minutes). */
export async function registerFacts(): Promise<RegisterFacts | null> {
  if (facts && Date.now() - facts.at < 10 * 60_000) return facts.value;
  const [total, branches] = await Promise.all([
    db().one<{ n: number; from: number | null; to: number | null }>('select count(*) as n, min(year) as "from", max(year) as "to" from register'),
    db().all<{ code: string; name: string; count: number }>("select branch as code, min(branch_name) as name, count(*) as count from register group by branch order by count(*) desc")
  ]);
  const value = total && total.n ? { count: total.n, from: total.from!, to: total.to!, branches } : null;
  facts = { at: Date.now(), value };
  return value;
}
