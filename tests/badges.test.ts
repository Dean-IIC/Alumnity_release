import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let profile: typeof import("../lib/server/profile");
let badgesOf: typeof import("../lib/server/badges").badgesOf;
let n = 0;

async function member(role = "alumnus", sample = 0): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, role, sample, created_at) values (?, ?, ?, ?, ?) returning id",
    `badge${n}@example.com`,
    `Badge Person ${n}`,
    role,
    sample,
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

const keys = async (u: U) => (await badgesOf(u, await profile.profileOf(u.id))).map((b) => b.label);

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  profile = await import("../lib/server/profile");
  ({ badgesOf } = await import("../lib/server/badges"));
});

describe("badges on someone's page", () => {
  it("founding member for the first hundred real members, not after (samples don't count)", async () => {
    const first = await member();
    expect(await keys(first)).toContain("Founding member");
    for (let i = 0; i < 5; i++) await member("alumnus", 1);
    expect(await keys(await member())).toContain("Founding member");
    for (let i = 0; i < 100; i++) await member();
    expect(await keys(await member())).not.toContain("Founding member");
  });

  it("helping juniors, in tiers of one, five and ten answered questions", async () => {
    const senior = await member();
    const junior = await member("student");
    const answer = async () =>
      db.db().run("insert into asks (author, title, body, status, taker, created_at) values (?, 'Q', 'B', 'answered', ?, ?)", junior.id, senior.id, Date.now());
    expect((await keys(senior)).some((k) => k.startsWith("Helped"))).toBe(false);
    await answer();
    expect(await keys(senior)).toContain("Helped a junior");
    for (let i = 0; i < 4; i++) await answer();
    expect(await keys(senior)).toContain("Helped 5 juniors");
    for (let i = 0; i < 5; i++) await answer();
    expect(await keys(senior)).toContain("Helped 10 juniors");
  });

  it("mentor when they say so, and event host once they've put one up", async () => {
    const teacher = await member("faculty");
    await profile.saveProfile(teacher.id, { ...(await profile.profileOf(teacher.id)), happyTo: { mentor: true, refer: false, talk: false } });
    expect(await keys(teacher)).toContain("Mentor");
    expect(await keys(teacher)).not.toContain("Event host");
    await db.db().run("insert into events (organiser, title, body, starts_at, place, created_at) values (?, 'Talk', 'Body', ?, 'Hall', ?)", teacher.id, Date.now() + 86_400_000, Date.now());
    expect(await keys(teacher)).toContain("Event host");
  });
});
