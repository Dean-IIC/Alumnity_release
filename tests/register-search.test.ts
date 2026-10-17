import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let register: typeof import("../lib/server/register");
let people: typeof import("../lib/server/people");
let n = 0;

async function member(usn: string | null): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, usn, branch, joined, role, created_at) values (?, ?, ?, 'CSE', 2012, 'alumnus', ?) returning id",
    `reg${n}@example.com`,
    `Member ${n}`,
    usn,
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

beforeAll(async () => {
  db = await import("../lib/server/db");
  register = await import("../lib/server/register");
  people = await import("../lib/server/people");
  const lines = [
    ["ASHA RAO", "1HK12CS001", "CSE", 2012],
    ["MOHAMMED IMRAN K", "1HK12CS002", "CSE", 2012],
    ["MOHAMMED IMRAN", "1HK14EC010", "ECE", 2014],
    ["PRIYA NAIR", "1HK12CS003", "CSE", 2012],
    ["SIMRAN SULTANA", "1HK12IS004", "ISE", 2012]
  ] as const;
  for (const [name, usn, branch, year] of lines)
    await db.db().run("insert into register (name, usn, branch, branch_name, programme, year) values (?, ?, ?, ?, 'B.Tech', ?)", name, usn, branch, branch, year);
});

describe("a member searching the college register", () => {
  it("finds people who haven't joined by name or USN, with a name, branch and year, never a USN", async () => {
    const me = await member(null);
    const byName = await register.searchRegister(me, { q: "imran" });
    // From the start of a word: "imran" isn't Simran.
    expect(byName.people.map((p) => p.name).sort()).toEqual(["Mohammed Imran", "Mohammed Imran K"]);
    expect(JSON.stringify(byName)).not.toMatch(/1HK/);
    expect((await register.searchRegister(me, { q: "mohammed imran", branch: "ECE" })).people).toEqual([
      { name: "Mohammed Imran", branch: "ECE", branchName: "ECE", programme: "B.Tech", joined: 2014 }
    ]);
    expect((await register.searchRegister(me, { q: "1hk12 cs003" })).people.map((p) => p.name)).toEqual(["Priya Nair"]);
    expect((await register.searchRegister(me, { q: "a" })).people).toEqual([]);
  });

  it("leaves out whoever has joined (they're found as members, with what they chose to show)", async () => {
    const me = await member(null);
    await member("1HK12CS001");
    expect((await register.searchRegister(me, { q: "asha" })).people).toEqual([]);
    expect((await register.searchRegister(me, { q: "1HK12CS001" })).people).toEqual([]);
  });

  it("allows a few searches an hour, not enough to copy the register out", async () => {
    const me = await member(null);
    for (let i = 0; i < register.REGISTER_SEARCHES; i++) expect((await register.searchRegister(me, { q: "priya" })).limited).toBe(false);
    const after = await register.searchRegister(me, { q: "priya" });
    expect(after).toEqual({ people: [], limited: true });
  });
});
