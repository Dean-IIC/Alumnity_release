/*
 * The college register: every student who has joined HKBK College of Engineering since
 * 1998 (from the Department of Examination; never committed, never sent to the browser).
 * It lives in the database's `register` table (scripts/import-register.mjs loads it, and
 * lib/server/register.ts reads it). Joining Alumnity means finding your line in it.
 *
 * A match needs two things that agree, USN and name, or name, branch and the year you
 * joined, and the answer is only "that's you" or "not found". USNs are sequential, so a
 * lookup by USN alone would let anyone list every name in the register.
 *
 * These are the rules alone, with no data: the matching, and reading the CSV.
 */

export type RegisterRow = { name: string; usn: string; branch: string; branchName: string; programme: string; year: number };

export type Lookup = { usn?: string; name: string; branch?: string; year?: number };

export type Found = {
  status: "found";
  /** As the register spells it. */
  name: string;
  usn: string;
  branch: string;
  branchName: string;
  programme: string;
  /** The year they joined (the register's years are joining years). */
  joined: number;
  /** Everyone on the register from the same branch, course and year, them included. */
  batchSize: number;
};

export type LookupResult = Found | { status: "not-found" } | { status: "ambiguous" };

/** Reads the register's CSV (name,usn,branch,branch_name,programme,year). */
export function parseRegister(csv: string): RegisterRow[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",");
  const at = (key: string) => head.indexOf(key);
  const [n, u, b, bn, p, y] = ["name", "usn", "branch", "branch_name", "programme", "year"].map(at);
  return lines.slice(1).map((line) => {
    const c = line.split(",");
    const branch = c[b].trim();
    // The register files MBA students under "General / MBA".
    const branchName = branch === "GEN" ? "MBA" : c[bn].trim();
    return { name: c[n].trim(), usn: normaliseUsn(c[u]), branch, branchName, programme: c[p].trim(), year: Number(c[y]) };
  });
}

export const normaliseUsn = (usn: string) => usn.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** A name's words, without initials ("Abdul Nishad A B" → abdul, nishad). */
const words = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** Two words are the same if equal, or (long enough) one slip of the keyboard apart. */
function sameWord(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  // Edit distance ≤ 1.
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Whether a typed name is the register's name. Every typed word must be one of the
 * register's (one extra is allowed: a surname the register doesn't carry), and enough of
 * the register's name must be typed: two of its words, or its only word. So "Abdul Nishad"
 * matches "Abdul Nishad A B" (initials don't count), but neither a long string of common
 * names (which would otherwise read the register out, USN by USN) nor a first name alone
 * (which would hand out a stranger's full name) matches anyone.
 */
export function namesMatch(typed: string, registered: string) {
  const a = words(typed);
  const b = words(registered);
  if (!a.length || !b.length) return false;
  const extra = a.filter((w) => !b.some((v) => sameWord(w, v))).length;
  const covered = b.filter((v) => a.some((w) => sameWord(w, v))).length;
  return extra <= 1 && covered >= Math.min(2, b.length);
}

export function lookup(rows: RegisterRow[], query: Lookup): LookupResult {
  let match: RegisterRow | undefined;
  if (query.usn) {
    const usn = normaliseUsn(query.usn);
    const row = rows.find((r) => r.usn === usn);
    if (row && namesMatch(query.name, row.name)) match = row;
  } else if (query.branch && query.year) {
    const candidates = rows.filter((r) => r.branch === query.branch && r.year === query.year && namesMatch(query.name, r.name));
    if (candidates.length > 1) return { status: "ambiguous" };
    match = candidates[0];
  }
  if (!match) return { status: "not-found" };
  const m = match;
  return {
    status: "found",
    name: m.name,
    usn: m.usn,
    branch: m.branch,
    branchName: m.branchName,
    programme: m.programme,
    joined: m.year,
    batchSize: rows.filter((r) => r.branch === m.branch && r.year === m.year && r.programme === m.programme).length
  };
}

/** What may be said about the register in public: its size, span and branches. */
export function registerFacts(rows: RegisterRow[]) {
  const years = rows.map((r) => r.year);
  const branches = [...new Map(rows.map((r) => [r.branch, r.branchName])).entries()]
    .map(([code, name]) => ({ code, name, count: rows.filter((r) => r.branch === code).length }))
    .sort((a, b) => b.count - a.count);
  return { count: rows.length, from: Math.min(...years), to: Math.max(...years), branches };
}
