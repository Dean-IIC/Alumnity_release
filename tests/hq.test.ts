import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_SUPER_ADMINS = "boss@example.com";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let hq: typeof import("../lib/server/hq");
let auth: typeof import("../lib/server/auth");
let boss: U;
let admin: U;

async function user(email: string, role: string, usn: string | null = null): Promise<U> {
  const row = await db.db().one(
    "insert into users (email, name, usn, branch, joined, role, created_at) values (?, ?, ?, 'CSE', 2012, ?, ?) returning *",
    email,
    email.split("@")[0],
    usn,
    role,
    Date.now()
  );
  return auth.toUser(row!);
}

const lines = async () => db.db().all<{ name: string; usn: string; branch: string; branch_name: string; programme: string; year: number }>("select * from records.register order by usn");

beforeAll(async () => {
  db = await import("../lib/server/db");
  hq = await import("../lib/server/hq");
  auth = await import("../lib/server/auth");
  boss = await user("boss@example.com", "admin");
  admin = await user("plain-admin@example.com", "admin");
  await db.db().run(
    "insert into records.register (name, usn, branch, branch_name, programme, year) values ('ASHA RAO', '1HK12CS001', 'CSE', 'Computer Science & Engineering', 'B.Tech', 2012), ('RAVI K', '1HK13EC002', 'ECE', 'Electronics & Communication', 'B.Tech', 2013)"
  );
});

describe("HQ, the super administrator's back office", () => {
  it("is for super administrators only: an administrator gets nothing", async () => {
    expect(boss.role).toBe("superadmin");
    expect(await hq.hqRegister(admin, {})).toBeNull();
    expect(await hq.registerCsv(admin)).toBeNull();
    expect(await hq.membersCsv(admin)).toBeNull();
    expect(await hq.hqMembers(admin)).toBeNull();
    expect(await hq.tableSizes(admin)).toBeNull();
    expect((await hq.saveRegisterLine(admin, null, { name: "X", usn: "1HK20CS999", branch: "CSE", year: 2020 })).ok).toBe(false);
    expect((await hq.importRegister(admin, "name,usn,branch,year\nX,1HK20CS999,CSE,2020", true)).ok).toBe(false);
    expect((await hq.startMailout(admin, "Hi", "Hello", { who: "everyone", skipOptedOut: true })).ok).toBe(false);
  });

  it("searches the register by name or USN, with USNs, and who has joined", async () => {
    await user("asha@example.com", "alumnus", "1HK12CS001");
    const byName = await hq.hqRegister(boss, { q: "asha" });
    expect(byName?.rows.map((r) => [r.name, r.usn, r.member != null])).toEqual([["ASHA RAO", "1HK12CS001", true]]);
    expect((await hq.hqRegister(boss, { q: "1hk13" }))?.rows.map((r) => r.name)).toEqual(["RAVI K"]);
    expect((await hq.hqRegister(boss, { branch: "ECE", year: 2013 }))?.total).toBe(1);
  });

  it("adds, edits and deletes a line, refusing a USN that's already there, and logs each", async () => {
    expect(await hq.saveRegisterLine(boss, null, { name: " Priya  Nair ", usn: "1hk-20-cs-050", branch: "cse", year: 2020 })).toEqual({ ok: true });
    const added = (await hq.hqRegister(boss, { q: "priya" }))!.rows[0];
    expect(added).toMatchObject({ name: "Priya Nair", usn: "1HK20CS050", branch: "CSE", branchName: "Computer Science & Engineering", programme: "B.Tech", year: 2020 });
    expect((await hq.saveRegisterLine(boss, null, { name: "Someone", usn: "1HK20CS050", branch: "CSE", year: 2020 })).ok).toBe(false);
    expect((await hq.saveRegisterLine(boss, added.id, { name: "Priya N", usn: "1HK20CS050", branch: "ISE", year: 2021 })).ok).toBe(true);
    expect((await hq.hqRegister(boss, { q: "1HK20CS050" }))!.rows[0]).toMatchObject({ name: "Priya N", branch: "ISE", year: 2021 });
    expect((await hq.saveRegisterLine(boss, null, { name: "Bad", usn: "1HK20CS051", branch: "LAW", year: 2020 })).ok).toBe(false);
    expect((await hq.saveRegisterLine(boss, null, { name: "Bad", usn: "1HK20CS051", branch: "CSE", year: 1800 })).ok).toBe(false);
    expect(await hq.deleteRegisterLine(boss, added.id)).toEqual({ ok: true });
    expect((await hq.hqRegister(boss, { q: "1HK20CS050" }))!.total).toBe(0);
    const log = await db.db().all<{ action: string }>("select action from audit where action like 'hq.register.%' order by id");
    expect(log.map((l) => l.action)).toEqual(["hq.register.add", "hq.register.edit", "hq.register.delete"]);
  });

  it("imports a CSV: checks first, then adds new USNs and updates known ones, never deleting", async () => {
    const csv = [
      "USN,Name,Branch,Programme,Year",
      "1HK12CS001,ASHA RAO,CSE,B.Tech,2012",
      '1HK13EC002,"RAVI KUMAR, K",ECE,B.Tech,2013',
      "1HK22AI007,NEW PERSON,AIML,,2022",
      "1HK22AI007,TWICE,AIML,,2022",
      "BAD,NO USN,CSE,,2022",
      "1HK22CS008,WRONG BRANCH,ART,,2022"
    ].join("\n");
    const before = await lines();
    const check = await hq.importRegister(boss, csv, false);
    expect(check).toMatchObject({ ok: true, report: { added: 1, changed: 1, same: 1, applied: false } });
    if (!check.ok) return;
    expect(check.report.skipped).toHaveLength(3);
    expect(await lines()).toEqual(before);
    await hq.importRegister(boss, csv, true);
    const after = await lines();
    expect(after).toHaveLength(before.length + 1);
    expect(after.find((l) => l.usn === "1HK13EC002")?.name).toBe("RAVI KUMAR, K");
    expect(after.find((l) => l.usn === "1HK22AI007")).toMatchObject({ name: "NEW PERSON", branch: "AIML", programme: "B.Tech", year: 2022 });
    expect((await hq.importRegister(boss, "name,usn\nX,1HK1", true)).ok).toBe(false);
  });

  it("exports the register in the form an import reads back, safe to open in a spreadsheet", async () => {
    const csv = (await hq.registerCsv(boss))!;
    const rows = hq.parseCsv(csv);
    expect(rows[0]).toEqual(["name", "usn", "branch", "branch_name", "programme", "year"]);
    expect(rows.some((r) => r[0] === "RAVI KUMAR, K")).toBe(true);
    expect(hq.csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    const again = await hq.importRegister(boss, csv, false);
    expect(again.ok && again.report.added + again.report.changed).toBe(0);
  });

  it("edits a member's record but not their email, and exports members", async () => {
    const m = await user("edit-me@example.com", "student");
    expect(await hq.saveMemberRecord(boss, m.id, { name: "Edited Name", usn: "1hk24cs160", branch: "CSE", programme: "B.Tech", joined: 2024 })).toEqual({ ok: true });
    expect(await db.db().one("select name, usn, email, joined from users where id = ?", m.id)).toEqual({ name: "Edited Name", usn: "1HK24CS160", email: "edit-me@example.com", joined: 2024 });
    expect((await hq.saveMemberRecord(boss, boss.id, { name: "Boss", usn: "1HK24CS160", branch: "", programme: "", joined: null })).ok).toBe(false);
    expect((await hq.hqMembers(boss, "1hk24cs160"))?.map((x) => x.name)).toEqual(["Edited Name"]);
    expect(await hq.membersCsv(boss)).toContain("edit-me@example.com");
  });

  it("mass email: counts the audience, leaves out those who turned emails off, and sends in batches once each", async () => {
    const off = await user("quiet@example.com", "alumnus");
    await db.db().run("insert into member_prefs (user_id, email_digest) values (?, 0)", off.id);
    const alumni = { who: "alumni" as const, skipOptedOut: true };
    const size = (await hq.audienceSize(boss, alumni))!;
    expect(await hq.audienceSize(boss, { ...alumni, skipOptedOut: false })).toBe(size + 1);
    const started = await hq.startMailout(boss, "Reunion", "Come to the reunion.\n\nSaturday, 10 am.", alumni);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const first = await hq.sendMailoutBatch(boss, started.id, "http://localhost");
    expect(first).toEqual({ ok: true, sent: size, failed: 0, left: 0 });
    // Nobody gets it twice.
    expect(await hq.sendMailoutBatch(boss, started.id, "http://localhost")).toEqual({ ok: true, sent: 0, failed: 0, left: 0 });
    expect((await hq.mailouts(boss))?.[0]).toMatchObject({ subject: "Reunion", total: size, sent: size });
    expect((await hq.startMailout(boss, "", "x", alumni)).ok).toBe(false);
  });

  it("reads an audience safely from what's stored", () => {
    expect(hq.readAudience("not json")).toEqual({ who: "everyone", branch: undefined, year: undefined, skipOptedOut: true });
    expect(hq.readAudience('{"who":"x","branch":"DROP","year":"1"}')).toEqual({ who: "everyone", branch: undefined, year: undefined, skipOptedOut: true });
  });
});
