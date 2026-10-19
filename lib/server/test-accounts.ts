import { randomBytes } from "node:crypto";
import type { Db } from "./db";

/*
 * Accounts for testing (scripts/make-test-accounts.mjs, docs/fresh-start.md): 3 students,
 * 3 alumni, 3 faculty, 3 college desk administrators and 1 super administrator, each with
 * a strong random password, written to a file outside the repository (never printed).
 *
 * They are ordinary accounts, written as the app's own joining writes them
 * (lib/server/auth.ts completeJoin, lib/server/staff.ts completeStaffJoin): the Auth user,
 * then the users row with its auth_id and role. Not on the register (usn null). Not
 * marked sample: sample members are hidden from People, suggestions, counts and password
 * resets, and testers need to find each other. What marks them is the address
 * (testerNN@<domain>, ".test" by default: a domain that can never receive mail) and the
 * names ("Test Student 1"…).
 *
 * The super administrator isn't a stored role (lib/server/roles.ts): that account is an
 * administrator here, and its email must be added to ALUMNITY_SUPER_ADMINS.
 *
 * Only types are imported from the app, so plain Node can run this from the script.
 */

export type TestKind = "student" | "alumnus" | "faculty" | "desk" | "superadmin";

export type TestAccount = {
  kind: TestKind;
  /** The role stored in users.role. */
  role: "student" | "alumnus" | "faculty" | "admin";
  name: string;
  email: string;
  branch: string | null;
  branchName: string | null;
  programme: string | null;
  joined: number | null;
};

export const DEFAULT_DOMAIN = "alumnity.test";

const BRANCH_NAMES: Record<string, string> = {
  CSE: "Computer Science & Engineering",
  ECE: "Electronics & Communication Engineering",
  ISE: "Information Science & Engineering",
  MECH: "Mechanical Engineering"
};

/**
 * Who they are. Two students share a batch (CSE, 2024), and two alumni (CSE, 2012), so
 * batch pages and "people from your batch" have someone in them; a CSE alumnus is a senior
 * the CSE students can ask. Faculty have a department, no batch; the desk has neither.
 */
const PEOPLE: [TestKind, TestAccount["role"], string, string | null, number | null][] = [
  ["student", "student", "Test Student 1", "CSE", 2024],
  ["student", "student", "Test Student 2", "CSE", 2024],
  ["student", "student", "Test Student 3", "ECE", 2023],
  ["alumnus", "alumnus", "Test Alumnus 1", "CSE", 2012],
  ["alumnus", "alumnus", "Test Alumnus 2", "CSE", 2012],
  ["alumnus", "alumnus", "Test Alumnus 3", "MECH", 2015],
  ["faculty", "faculty", "Test Faculty 1", "CSE", null],
  ["faculty", "faculty", "Test Faculty 2", "ISE", null],
  ["faculty", "faculty", "Test Faculty 3", "ECE", null],
  ["desk", "admin", "Test Desk 1", null, null],
  ["desk", "admin", "Test Desk 2", null, null],
  ["desk", "admin", "Test Desk 3", null, null],
  ["superadmin", "admin", "Test Super Admin", null, null]
];

const cleanDomain = (domain: string) => {
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new Error(`"${domain}" isn't a domain name (e.g. alumnity.test).`);
  return d;
};

/** The 13 accounts: tester01@<domain> … tester13@<domain>. */
export function testAccounts(domain = DEFAULT_DOMAIN): TestAccount[] {
  const d = cleanDomain(domain);
  return PEOPLE.map(([kind, role, name, branch, joined], i) => ({
    kind,
    role,
    name,
    email: `tester${String(i + 1).padStart(2, "0")}@${d}`,
    branch,
    branchName: branch ? BRANCH_NAMES[branch] : null,
    // Students and alumni are B.Tech, as on the register; staff have no programme.
    programme: kind === "student" || kind === "alumnus" ? "B.Tech" : null,
    joined
  }));
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALPHABET = UPPER + LOWER + DIGITS;

/**
 * A strong random password from crypto.randomBytes: four groups of five letters and digits
 * joined by "-" (23 characters, about 117 bits), with upper and lower case and a digit in
 * it, so it passes any Supabase password rule. No look-alikes (0/O, 1/l/I).
 */
export function strongPassword(): string {
  for (;;) {
    const chars: string[] = [];
    while (chars.length < 20) {
      for (const byte of randomBytes(32)) {
        // Unbiased: only bytes below the largest multiple of the alphabet's size.
        if (byte < 256 - (256 % ALPHABET.length) && chars.length < 20) chars.push(ALPHABET[byte % ALPHABET.length]);
      }
    }
    const password = [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)) return password;
  }
}

/** Makes (or, if it's already there from a half-finished run, finds and re-passwords) the sign-in; returns its Auth user id. */
export type AccountMaker = { create(email: string, password: string): Promise<string> };

const ROLE_LABEL: Record<TestKind, string> = { student: "student", alumnus: "alumnus", faculty: "faculty", desk: "admin (college desk)", superadmin: "super admin" };

/** A line of the accounts file: `role | name | email | password`. */
export const accountLine = (a: TestAccount, password: string) => `${ROLE_LABEL[a.kind]} | ${a.name} | ${a.email} | ${password}`;

export type TestAccountsResult = { made: TestAccount[]; existed: TestAccount[]; failed: { account: TestAccount; error: string }[] };

/**
 * Makes whichever of the 13 don't exist yet (by email: one that does is skipped, "exists").
 * `saveLogin` gets each new account's line as soon as it's made (so a run cut short still
 * has the passwords it made); `log` never sees a password.
 */
export async function makeTestAccounts(
  d: Db,
  maker: AccountMaker,
  opts: { domain?: string; password?: () => string; saveLogin: (line: string) => void; log?: (line: string) => void }
): Promise<TestAccountsResult> {
  const log = opts.log ?? (() => {});
  const result: TestAccountsResult = { made: [], existed: [], failed: [] };
  const accounts = testAccounts(opts.domain);
  // As joining does (catchUpIds in lib/server/db.ts): the id counter past any ids put in by hand.
  await d.run(
    `select setval(pg_get_serial_sequence('users', 'id'), m) from (select max(id) as m from users) as top
     where m > coalesce((select last_value from pg_sequences where schemaname || '.' || sequencename = pg_get_serial_sequence('users', 'id')), 0)`
  );
  for (const a of accounts) {
    if (await d.one("select 1 from users where lower(email) = ?", a.email)) {
      result.existed.push(a);
      log(`exists   ${a.email}  (${a.name})`);
      continue;
    }
    try {
      const password = (opts.password ?? strongPassword)();
      const authId = await maker.create(a.email, password);
      const made = await d.tx(async (t) => {
        // The columns joining writes (completeJoin; completeStaffJoin for staff), nothing else:
        // sample and college_account keep their defaults (0), so testers are found like anyone.
        const row = await t.one<{ id: number }>(
          `insert into users (auth_id, email, name, usn, branch, branch_name, programme, joined, role, created_at)
           values (?::uuid, ?, ?, null, ?, ?, ?, ?, ?, ?) on conflict do nothing returning id`,
          authId,
          a.email,
          a.name,
          a.branch,
          a.branchName,
          a.programme,
          a.joined,
          a.role,
          Date.now()
        );
        // An empty page ('{}' reads as the empty profile: lib/server/profile.ts profileFromData).
        if (row) await t.run("insert into profiles (user_id, data, updated_at) values (?, '{}', ?) on conflict (user_id) do nothing", row.id, Date.now());
        return row;
      });
      if (!made) throw new Error("its sign-in is already tied to another member");
      opts.saveLogin(accountLine(a, password));
      result.made.push(a);
      log(`made     ${a.email}  (${a.name}, ${ROLE_LABEL[a.kind]})`);
    } catch (e) {
      result.failed.push({ account: a, error: (e as Error).message });
      log(`FAILED   ${a.email}: ${(e as Error).message}`);
    }
  }
  return result;
}
