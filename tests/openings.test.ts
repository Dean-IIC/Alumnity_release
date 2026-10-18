import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres and the stand-in for Supabase Auth, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "openings-admin@example.com";

let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let openings: typeof import("../lib/server/openings");
let desk: typeof import("../lib/server/desk");
type U = import("../lib/server/auth").User;

let n = 0;
async function member(name: string, extra: { role?: string; branch?: string; email?: string } = {}): Promise<U> {
  n += 1;
  const row = await db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, ?, ?, 'B.Tech', 2012, ?, ?) returning id",
      extra.email ?? `op${n}@example.com`,
      name,
      extra.branch ?? "CSE",
      extra.branch ?? "CSE",
      extra.role ?? "alumnus",
      Date.now() + n
    );
  return (await people.memberById(row!.id))!;
}

const OPENING = { kind: "internship", title: "Firmware intern", company: "Bosch", place: "Bengaluru", branch: "ECE", link: "https://example.com/apply", body: "Embedded C.", canRefer: true, days: "30" };
const NOTE = "ECE 2025, I built a CAN bus logger on an STM32 for my mini project.";

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  openings = await import("../lib/server/openings");
  desk = await import("../lib/server/desk");
});

describe("jobs and referrals", () => {
  it("alumni and staff put openings up; students can't, but can see them", async () => {
    const alum = await member("Ravi Alum");
    const student = await member("Sana Student", { role: "student", branch: "ECE" });
    expect((await openings.createOpening(student, OPENING)).ok).toBe(false);
    const made = await openings.createOpening(alum, OPENING);
    expect(made.ok).toBe(true);
    const seen = await openings.openingsFor(student, { branch: "ECE" });
    expect(seen.open.map((o) => o.title)).toContain("Firmware intern");
    // Another branch doesn't see one meant for ECE, but sees those for any branch.
    const mech = await member("Mo Mech", { role: "student", branch: "MECH" });
    expect((await openings.openingsFor(mech, { branch: "MECH" })).open.some((o) => o.id === made.id)).toBe(false);
    expect((await openings.openingsForHome(student)).some((o) => o.id === made.id)).toBe(true);
  });

  it("checks what's put up: a real link, a known branch, a company", async () => {
    const alum = await member("Kiran Alum");
    expect((await openings.createOpening(alum, { ...OPENING, link: "javascript:alert(1)" })).ok).toBe(false);
    expect((await openings.createOpening(alum, { ...OPENING, branch: "XYZ" })).ok).toBe(false);
    expect((await openings.createOpening(alum, { ...OPENING, company: " " })).ok).toBe(false);
    expect((await openings.createOpening(alum, { ...OPENING, days: "365" })).ok).toBe(false);
  });

  it("a student asks for a referral; only the poster sees who asked; saying yes connects them", async () => {
    const alum = await member("Priya Alum");
    const student = await member("Arjun Student", { role: "student", branch: "ECE" });
    const other = await member("Nosy Alum");
    const { id } = await openings.createOpening(alum, OPENING);
    expect((await openings.requestReferral(student, id!, "please")).ok).toBe(false); // too short to help them decide
    expect((await openings.requestReferral(student, id!, NOTE)).ok).toBe(true);
    expect((await openings.requestReferral(student, id!, NOTE)).ok).toBe(false); // once
    expect((await openings.requestReferral(alum, id!, NOTE)).ok).toBe(false); // not your own

    // The poster is told, and sees the request; someone else sees nothing, not even a count.
    expect(await db.db().one("select 1 from notifications where user_id = ? and kind = 'referral-request'", alum.id)).toBeTruthy();
    expect((await openings.referralRequests(alum, id!)).map((r) => r.note)).toEqual([NOTE]);
    expect(await openings.referralRequests(other, id!)).toEqual([]);
    expect((await openings.openingById(other, id!))!.requests).toBe(0);
    expect((await openings.openingById(alum, id!))!.requests).toBe(1);

    // Not connected yet, so no messages; once the poster says yes, they are, and can talk.
    expect((await social.sendMessage(student, alum.id, "hello")).ok).toBe(false);
    expect((await openings.acceptReferral(other, id!, student.id)).ok).toBe(false);
    expect((await openings.acceptReferral(alum, id!, student.id)).ok).toBe(true);
    expect(await people.relation(student.id, alum.id)).toBe("connected");
    expect((await social.sendMessage(student, alum.id, "Thank you! Here's my CV.")).ok).toBe(true);
    expect((await openings.openingById(student, id!))!.myRequest).toMatchObject({ accepted: true });
    expect(await db.db().one("select 1 from notifications where user_id = ? and kind = 'referral-accepted'", student.id)).toBeTruthy();
  });

  it("no requests once it's closed, or when the poster isn't referring", async () => {
    const alum = await member("Dev Alum");
    const student = await member("Tara Student", { role: "student" });
    const noRefer = await openings.createOpening(alum, { ...OPENING, canRefer: false });
    expect((await openings.requestReferral(student, noRefer.id!, NOTE)).ok).toBe(false);
    const closing = await openings.createOpening(alum, OPENING);
    expect((await openings.closeOpening(student, closing.id!)).ok).toBe(false);
    expect((await openings.closeOpening(alum, closing.id!)).ok).toBe(true);
    expect((await openings.requestReferral(student, closing.id!, NOTE)).ok).toBe(false);
    expect((await openings.openingsFor(student)).open.some((o) => o.id === closing.id)).toBe(false);
  });

  it("someone blocked by the poster doesn't see the opening at all", async () => {
    const alum = await member("Gita Alum");
    const blocked = await member("Blocked Student", { role: "student" });
    const { id } = await openings.createOpening(alum, { ...OPENING, branch: "" });
    expect((await social.block(alum, blocked.id)).ok).toBe(true);
    expect(await openings.openingById(blocked, id!)).toBeNull();
    expect((await openings.openingsFor(blocked)).open.some((o) => o.id === id)).toBe(false);
    expect((await openings.requestReferral(blocked, id!, NOTE)).ok).toBe(false);
  });

  it("can be reported, and the desk takes it down", async () => {
    const alum = await member("Spam Alum");
    const student = await member("Careful Student", { role: "student" });
    const admin = await member("Openings Admin", { email: "openings-admin@example.com" });
    const { id } = await openings.createOpening(alum, { ...OPENING, branch: "" });
    expect((await desk.report(student, "opening", id!, "Asks for a fee to apply.")).ok).toBe(true);
    const open = (await desk.reports(admin, "open")).find((r) => r.kind === "opening");
    expect(open).toBeTruthy();
    expect((await desk.resolveReport(admin, open!.id, "remove")).ok).toBe(true);
    expect((await openings.openingById(student, id!))!.closed).toBe(true);
  });
});
