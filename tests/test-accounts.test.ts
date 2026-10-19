import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// An in-memory Postgres with the real schema, set before the modules load.
process.env.ALUMNITY_DB = "pglite";

type Tests = typeof import("../lib/server/test-accounts");
let tests: Tests;
let db: typeof import("../lib/server/db").db;
let fake: import("../lib/server/auth-provider").FakeAuth;

/** Supabase's admin createUser, on the tests' stand-in (an existing sign-in gets the new password, as the script does). */
const maker = () => ({
  async create(email: string, password: string) {
    const account = fake.accounts.get(email);
    if (account) {
      account.password = password;
      return account.authId;
    }
    const authId = randomUUID();
    fake.accounts.set(email, { authId, password, code: null });
    return authId;
  }
});

/** Everything written to the console while `work` runs. */
async function consoleDuring<T>(work: () => Promise<T>): Promise<{ result: T; printed: string }> {
  const printed: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void printed.push(args.map(String).join(" "))));
  try {
    return { result: await work(), printed: printed.join("\n") };
  } finally {
    for (const s of spies) s.mockRestore();
  }
}

beforeAll(async () => {
  tests = await import("../lib/server/test-accounts");
  db = (await import("../lib/server/db")).db;
  const { FakeAuth } = await import("../lib/server/auth-provider");
  fake = new FakeAuth();
});

afterAll(() => vi.restoreAllMocks());

describe("test accounts", () => {
  const saved: string[] = [];
  const logged: string[] = [];

  it("makes 13 accounts with the right roles, each with its own strong password, none of it printed", async () => {
    const { result, printed } = await consoleDuring(() =>
      tests.makeTestAccounts(db(), maker(), { saveLogin: (l) => saved.push(l), log: (l) => (console.log(l), logged.push(l)) })
    );
    expect(result.failed).toEqual([]);
    expect(result.made).toHaveLength(13);

    const rows = await db().all<{ email: string; name: string; role: string; usn: string | null; branch: string | null; joined: number | null; sample: number; college_account: number; auth_id: string }>(
      "select email, name, role, usn, branch, joined, sample, college_account, auth_id::text as auth_id from users order by email"
    );
    expect(rows.map((r) => r.email)).toEqual(Array.from({ length: 13 }, (_, i) => `tester${String(i + 1).padStart(2, "0")}@alumnity.test`));
    const roles = rows.map((r) => r.role);
    expect(roles.filter((r) => r === "student")).toHaveLength(3);
    expect(roles.filter((r) => r === "alumnus")).toHaveLength(3);
    expect(roles.filter((r) => r === "faculty")).toHaveLength(3);
    // 3 desk administrators and the super admin, who is stored as an administrator.
    expect(roles.filter((r) => r === "admin")).toHaveLength(4);
    expect(rows.find((r) => r.email === "tester13@alumnity.test")).toMatchObject({ name: "Test Super Admin", role: "admin" });
    expect(rows.map((r) => r.name)).toContain("Test Alumnus 2");
    expect(rows.map((r) => r.name)).toContain("Test Desk 1");

    for (const r of rows) {
      // Not on the register, findable (not sample, not a college account), signed in through Auth.
      expect(r).toMatchObject({ usn: null, sample: 0, college_account: 0 });
      expect([...fake.accounts.values()].some((a) => a.authId === r.auth_id)).toBe(true);
      if (r.role === "student") expect(r.joined).toBeGreaterThanOrEqual(2022), expect(r.joined).toBeLessThanOrEqual(2025);
      if (r.role === "alumnus") expect(r.joined).toBeGreaterThanOrEqual(2008), expect(r.joined).toBeLessThanOrEqual(2018);
      if (r.role === "student" || r.role === "alumnus") expect(r.branch).toMatch(/^(CSE|ECE|ISE|MECH)$/);
      else expect(r.joined).toBeNull();
    }
    // Each has an (empty) page.
    expect((await db().one<{ n: number }>("select count(*) as n from profiles where data = '{}'"))!.n).toBe(13);

    // The logins file's lines: role | name | email | password; the passwords work and differ.
    expect(saved).toHaveLength(13);
    const passwords = saved.map((line) => {
      const [role, name, email, password] = line.split(" | ");
      expect(role && name && email).toBeTruthy();
      expect(password.length).toBeGreaterThanOrEqual(16);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      return { email, password };
    });
    expect(new Set(passwords.map((p) => p.password)).size).toBe(13);
    for (const { email, password } of passwords) expect(await fake.signInWithPassword(email, password)).not.toBeNull();
    expect(saved[12]).toMatch(/^super admin \| Test Super Admin \| tester13@alumnity\.test \| /);

    // Never on the console, nor in the log.
    for (const { password } of passwords) {
      expect(printed).not.toContain(password);
      expect(logged.join("\n")).not.toContain(password);
    }
  });

  it("run again, it skips every account that's there", async () => {
    const before = saved.length;
    const lines: string[] = [];
    const result = await tests.makeTestAccounts(db(), maker(), { saveLogin: (l) => saved.push(l), log: (l) => lines.push(l) });
    expect(result.made).toEqual([]);
    expect(result.existed).toHaveLength(13);
    expect(saved).toHaveLength(before);
    expect(lines.every((l) => l.startsWith("exists"))).toBe(true);
    expect((await db().one<{ n: number }>("select count(*) as n from users"))!.n).toBe(13);
  });

  it("a half-finished account (sign-in made, member row not) is finished, and another domain is another set", async () => {
    // tester01 at another domain: its sign-in was made by an earlier run that stopped.
    const authId = randomUUID();
    fake.accounts.set("tester01@college.test", { authId, password: "old", code: null });
    const lines: string[] = [];
    const result = await tests.makeTestAccounts(db(), maker(), { domain: "college.test", saveLogin: (l) => lines.push(l) });
    expect(result.made).toHaveLength(13);
    expect((await db().one<{ auth_id: string }>("select auth_id::text as auth_id from users where email = 'tester01@college.test'"))!.auth_id).toBe(authId);
    const password = lines[0].split(" | ")[3];
    expect(await fake.signInWithPassword("tester01@college.test", password)).not.toBeNull();
    expect(() => tests.testAccounts("not a domain")).toThrow();
  });
});
