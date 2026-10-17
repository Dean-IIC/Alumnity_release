import type { User } from "./auth";
import { db } from "./db";
import { withinLimit } from "./throttle";
import { lookup, normaliseUsn, type Lookup, type LookupResult, type RegisterRow } from "../register";

/*
 * The college register, in the database (the `register` table, loaded by
 * scripts/import-register.mjs; the CSV itself is never committed). Only the server reads
 * it. To visitors, only these answers leave: "that's you" or "not found", and counts.
 * Signed-in members can also find people on it who haven't joined yet (searchRegister):
 * a name, branch and year, never a USN, a few searches an hour.
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

/** Someone on the register who hasn't joined Alumnity: what a member may see of them. */
export type NotYetJoined = { name: string; branch: string; branchName: string; programme: string; joined: number };

const HOUR = 60 * 60_000;
/** Searches of the register a member may make in an hour: plenty to find people, too few to copy it out. */
export const REGISTER_SEARCHES = 40;

/** "MOHAMMED IMRAN K" → "Mohammed Imran K": the register is in capitals, people aren't. */
export const nameCase = (name: string) => name.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/**
 * People on the register who haven't joined, for a member's search: by name (every word
 * typed must be in it) or by an exact USN, narrowed by branch and joining year. Never a
 * USN back, and never someone who has joined (they're found as members, with what they
 * chose to show). "limited" once the member has searched enough this hour.
 */
export async function searchRegister(
  viewer: User,
  query: { q?: string; branch?: string; year?: number },
  limit = 20
): Promise<{ people: NotYetJoined[]; limited: boolean }> {
  const q = (query.q ?? "").trim();
  const usn = normaliseUsn(q);
  const looksLikeUsn = /^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2,4}[0-9]{2,3}$/.test(usn);
  const words = looksLikeUsn ? [] : q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 2).slice(0, 5);
  if (!looksLikeUsn && !words.length) return { people: [], limited: false };
  if (!(await withinLimit(`register-search:${viewer.id}`, REGISTER_SEARCHES, HOUR))) return { people: [], limited: true };
  const where: string[] = ["register.usn not in (select usn from users where usn is not null)"];
  const params: unknown[] = [];
  if (looksLikeUsn) {
    where.push("register.usn = ?");
    params.push(usn);
  } else
    // Each word from the start of one of the name's words ("imran" finds Imran, not Simran).
    for (const w of words) {
      where.push("(lower(register.name) like ? or lower(register.name) like ?)");
      params.push(`${w}%`, `% ${w}%`);
    }
  if (query.branch) {
    where.push("register.branch = ?");
    params.push(query.branch);
  }
  if (query.year) {
    where.push("register.year = ?");
    params.push(query.year);
  }
  const rows = await db().all<Row>(`select * from register where ${where.join(" and ")} order by register.year desc, register.name limit ?`, ...params, limit);
  return { people: rows.map((r) => ({ name: nameCase(r.name), branch: r.branch, branchName: r.branch_name, programme: r.programme, joined: r.year })), limited: false };
}
