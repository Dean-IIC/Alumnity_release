import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_SUPER_ADMINS = "super@example.com";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db").db;
let auth: typeof import("../lib/server/auth");
let staff: typeof import("../lib/server/staff");
let fake: import("../lib/server/auth-provider").FakeAuth;
let people: typeof import("../lib/server/people");

beforeAll(async () => {
  db = (await import("../lib/server/db")).db;
  auth = await import("../lib/server/auth");
  staff = await import("../lib/server/staff");
  people = await import("../lib/server/people");
  fake = await (await import("../lib/server/auth-provider")).fakeAuth();
});

async function member(email: string, role: string): Promise<U> {
  const row = await db().one<{ id: number }>("insert into users (email, name, role, created_at) values (?, ?, ?, ?) returning id", email, `Person ${email}`, role, Date.now());
  return (await people.memberById(row!.id))!;
}

async function joinAsStaff(email: string, browser: string) {
  fake.use(browser);
  const start = await staff.startStaffJoin(email, "1");
  if (!start.ok) return start;
  expect((await staff.checkStaffCode(start.ticket, fake.lastCode(email.toLowerCase())!)).ok).toBe(true);
  return staff.completeStaffJoin(start.ticket, "chalk and lanterns 41");
}

describe("staff invitations", () => {
  it("only roles below your own; a coordinator can invite teachers but not administrators", async () => {
    const coordinator = await member("coord@example.com", "coordinator");
    const plain = await member("plain@example.com", "alumnus");
    expect((await staff.inviteStaff(plain, { email: "t1@example.com", name: "Dr. One", role: "faculty", branch: "CSE" }, "https://x")).ok).toBe(false);
    expect((await staff.inviteStaff(coordinator, { email: "t1@example.com", name: "Dr. One", role: "admin", branch: "" }, "https://x")).ok).toBe(false);
    expect((await staff.inviteStaff(coordinator, { email: "t1@example.com", name: "Dr. One", role: "faculty", branch: "CSE" }, "https://x")).ok).toBe(true);
    expect((await staff.inviteStaff(coordinator, { email: "plain@example.com", name: "Plain", role: "faculty", branch: "" }, "https://x")).ok).toBe(false); // already a member
  });

  it("the invited email joins with the invited role and department; nobody else can, and it works once", async () => {
    expect((await joinAsStaff("uninvited@example.com", "u")).ok).toBe(false);
    const joined = await joinAsStaff("T1@example.com", "t1");
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.user).toMatchObject({ email: "t1@example.com", role: "faculty", branch: "CSE", usn: null, joined: null });
    expect((await auth.signedInUser())?.role).toBe("faculty");
    expect((await joinAsStaff("t1@example.com", "again")).ok).toBe(false);
  });

  it("a withdrawn or expired invitation doesn't work", async () => {
    const sup = await member("super@example.com", "alumnus"); // super administrator by config
    await staff.inviteStaff(sup, { email: "t2@example.com", name: "Prof Two", role: "admin", branch: "" }, "https://x");
    await staff.revokeInvite(sup, "t2@example.com");
    expect((await joinAsStaff("t2@example.com", "t2")).ok).toBe(false);
    await staff.inviteStaff(sup, { email: "t3@example.com", name: "Prof Three", role: "coordinator", branch: "" }, "https://x");
    await db().run("update staff_invites set expires_at = 1 where email = 't3@example.com'");
    expect((await joinAsStaff("t3@example.com", "t3")).ok).toBe(false);
  });
});
