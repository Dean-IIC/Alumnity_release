import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres and the stand-in for Supabase Auth, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";

type U = import("../lib/server/auth").User;
type Mods = {
  db: typeof import("../lib/server/db");
  people: typeof import("../lib/server/people");
  social: typeof import("../lib/server/social");
  follows: typeof import("../lib/server/follows");
  profile: typeof import("../lib/server/profile");
  register: typeof import("../lib/server/register");
  search: typeof import("../lib/server/people-search");
};
let m: Mods;

let n = 0;
/** A member straight into the database. */
async function member(name: string, extra: { branch?: string; joined?: number; usn?: string; collegeAccount?: boolean } = {}): Promise<U> {
  n += 1;
  const row = await m.db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, usn, branch, branch_name, programme, joined, role, college_account, created_at) values (?, ?, ?, ?, ?, 'B.Tech', ?, 'alumnus', ?, ?) returning id",
      `p${n}@example.com`,
      name,
      extra.usn ?? null,
      extra.branch ?? "MECH",
      extra.branch ?? "MECH",
      extra.joined ?? 2005,
      extra.collegeAccount ? 1 : 0,
      Date.now() + n
    );
  return (await m.people.memberById(row!.id))!;
}

const pause = (u: U) => m.db.db().run("update users set suspended_at = ? where id = ?", Date.now(), u.id);

const connect = async (a: U, b: U) => {
  expect((await m.social.requestConnection(a, b.id, "")).ok).toBe(true);
  expect((await m.social.acceptConnection(b, a.id)).ok).toBe(true);
};

const mentor = async (u: U) => await m.profile.saveProfile(u.id, { ...(await m.profile.profileOf(u.id)), happyTo: { mentor: true, refer: false, talk: false } });

beforeAll(async () => {
  m = {
    db: await import("../lib/server/db"),
    people: await import("../lib/server/people"),
    social: await import("../lib/server/social"),
    follows: await import("../lib/server/follows"),
    profile: await import("../lib/server/profile"),
    register: await import("../lib/server/register"),
    search: await import("../lib/server/people-search")
  };
  // A few lines of the college register: people who haven't joined (and one who has, below).
  const lines = [
    ["ZARA QUILLFEATHER", "1HK05ME001", "MECH", 2005],
    ["ZARA QUILLFEATHER KHAN", "1HK06ME002", "MECH", 2006],
    ["YUSUF QUILLFEATHER", "1HK05CV003", "CIVIL", 2005]
  ] as const;
  for (const [name, usn, branch, year] of lines)
    await m.db.db().run("insert into records.register (name, usn, branch, branch_name, programme, year) values (?, ?, ?, ?, 'B.Tech', ?)", name, usn, branch, branch, year);
});

describe("connections and followers: the counts match the lists", () => {
  it("a paused connection isn't counted, as it isn't listed (Home said 2 connections over a list of 1)", async () => {
    const me = await member("Counted Connector");
    const stays = await member("Stays Connected");
    const paused = await member("Gets Paused");
    await connect(me, stays);
    await connect(paused, me);
    expect(await m.social.connectionCount(me.id)).toBe(2);
    await pause(paused);
    expect((await m.social.connectionsOf(me.id)).map((u) => u.id)).toEqual([stays.id]);
    expect(await m.social.connectionCount(me.id)).toBe(1);
  });

  it("followers and following: counted as listed, paused members left out of both", async () => {
    const me = await member("Follow Counter");
    const fan = await member("Fan One");
    const pausedFan = await member("Fan Paused");
    const senior = await member("Senior Followed");
    const pausedSenior = await member("Senior Paused");
    for (const f of [fan, pausedFan]) expect((await m.follows.follow(f, me.id)).ok).toBe(true);
    for (const s of [senior, pausedSenior]) expect((await m.follows.follow(me, s.id)).ok).toBe(true);
    await pause(pausedFan);
    await pause(pausedSenior);
    const counts = await m.follows.followCounts(me.id);
    const followers = await m.follows.followersOf(me.id);
    const following = await m.follows.followingOf(me.id);
    expect(followers.map((u) => u.id)).toEqual([fan.id]);
    expect(following.map((u) => u.id)).toEqual([senior.id]);
    // "Following" used to count the paused senior too: 2 over a list of 1.
    expect(counts).toEqual({ followers: followers.length, following: following.length });
  });

  it("following isn't connecting: followers never show up among connections, nor raise the count", async () => {
    const me = await member("Only Followed");
    const fan = await member("Just A Fan");
    await m.follows.follow(fan, me.id);
    expect(await m.social.connectionsOf(me.id)).toEqual([]);
    expect(await m.social.connectionCount(me.id)).toBe(0);
    expect(await m.people.relation(me.id, fan.id)).toBe("none");
    // And unfollowing takes them off the list and the count at once.
    await m.follows.unfollow(fan, me.id);
    expect(await m.follows.followersOf(me.id)).toEqual([]);
    expect((await m.follows.followCounts(me.id)).followers).toBe(0);
  });

  it("a declined request stays in the sender's sent list, so they aren't told they were declined", async () => {
    const asker = await member("Hopeful Asker");
    const decliner = await member("Quiet Decliner");
    await m.social.requestConnection(asker, decliner.id, "hello");
    await m.social.declineConnection(decliner, asker.id);
    // To the asker it still looks sent, everywhere: on the decliner's page and in their list.
    expect(await m.people.relation(asker.id, decliner.id)).toBe("sent");
    expect((await m.social.requestsFor(asker)).sent.map((r) => r.member.id)).toEqual([decliner.id]);
    // To the one who declined, it's gone.
    expect((await m.social.requestsFor(decliner)).received).toEqual([]);
    // Withdrawing still works from that list.
    await m.social.withdrawRequest(asker, decliner.id);
    expect((await m.social.requestsFor(asker)).sent).toEqual([]);
  });
});

describe("People: requests first", () => {
  it("shows who asked you, newest first, without paused members; answering takes them off", async () => {
    const me = await member("Request Receiver");
    const first = await member("Asked First");
    const second = await member("Asked Second");
    const paused = await member("Asked Then Paused");
    await m.social.requestConnection(first, me.id, "same lab");
    await m.social.requestConnection(second, me.id, "");
    await m.social.requestConnection(paused, me.id, "");
    await m.db.db().run("update connections set created_at = created_at - 1000 where requester = ?", first.id);
    await pause(paused);
    const waiting = await m.search.waitingForYou(me);
    expect(waiting.requests.map((r) => r.member.id)).toEqual([second.id, first.id]);
    expect(waiting.total).toBe(2);
    expect(waiting.requests[1].note).toBe("same lab");
    // In a search, the one who asked shows "received" (the card's Accept).
    const found = await m.search.findPeople(me, { q: "Asked Second" });
    expect(found.cards).toMatchObject([{ kind: "member", relation: "received" }]);
    expect((await m.social.acceptConnection(me, second.id)).ok).toBe(true);
    await m.social.declineConnection(me, first.id);
    expect((await m.search.waitingForYou(me)).total).toBe(0);
  });

  it("doesn't suggest someone who asked you (they're in the requests), nor anyone you asked or are connected to", async () => {
    const me = await member("Suggest Viewer", { branch: "ECE", joined: 2003 });
    const asked = await member("Batch Asked Me", { branch: "ECE", joined: 2003 });
    const iAsked = await member("Batch I Asked", { branch: "ECE", joined: 2003 });
    const friend = await member("Batch Friend", { branch: "ECE", joined: 2003 });
    const free = await member("Batch Free", { branch: "ECE", joined: 2003 });
    await m.social.requestConnection(asked, me.id, "");
    await m.social.requestConnection(me, iAsked.id, "");
    await connect(me, friend);
    const ids = (await m.search.suggestPeople(me, 50)).map((s) => s.member.id);
    expect(ids).toContain(free.id);
    for (const u of [me, asked, iAsked, friend]) expect(ids).not.toContain(u.id);
  });
});

describe("People: suggestions when nothing is typed", () => {
  it("your batch first, then mentors from your branch, then your branch, then other mentors; never the blocked, paused or the college's account", async () => {
    const me = await member("Ranked Viewer", { branch: "AIML", joined: 2001 });
    const elsewhere = await member("Ranked Elsewhere", { branch: "CIVIL", joined: 1999 });
    const otherMentor = await member("Ranked Other Mentor", { branch: "CIVIL", joined: 1998 });
    await mentor(otherMentor);
    const branch = await member("Ranked Branch", { branch: "AIML", joined: 1999 });
    const branchMentor = await member("Ranked Branch Mentor", { branch: "AIML", joined: 1998 });
    await mentor(branchMentor);
    const batch = await member("Ranked Batch", { branch: "AIML", joined: 2001 });
    const blocked = await member("Ranked Blocked", { branch: "AIML", joined: 2001 });
    await m.social.block(blocked, me.id);
    const paused = await member("Ranked Paused", { branch: "AIML", joined: 2001 });
    await pause(paused);
    const college = await member("Ranked College Account", { branch: "AIML", joined: 2001, collegeAccount: true });

    const list = await m.search.suggestPeople(me, 200);
    const ids = list.map((s) => s.member.id);
    const at = (u: U) => ids.indexOf(u.id);
    expect(at(batch)).toBeGreaterThanOrEqual(0);
    expect(at(batch)).toBeLessThan(at(branchMentor));
    expect(at(branchMentor)).toBeLessThan(at(branch));
    expect(at(branch)).toBeLessThan(at(otherMentor));
    expect(at(otherMentor)).toBeLessThan(at(elsewhere));
    for (const u of [blocked, paused, college]) expect(ids).not.toContain(u.id);
    expect(list.find((s) => s.member.id === batch.id)?.reason).toBe("From your batch");
    expect(list.find((s) => s.member.id === branchMentor.id)?.reason).toBe("Happy to mentor");
  });
});

describe("People: the register in the same results", () => {
  it("members and people not on Alumnity yet in one list, members first, all counted, never a USN", async () => {
    const me = await member("Register Searcher");
    const joined = await member("Zara Quillfeather Member", { usn: "1HK05ME001" }); // has joined: found as a member
    await m.follows.follow(me, joined.id);
    const found = await m.search.findPeople(me, { q: "quillfeather" });
    expect(found.cards.map((c) => c.kind)).toEqual(["member", "register", "register"]);
    expect(found.cards[0]).toMatchObject({ kind: "member", following: true, relation: "none" });
    expect(found.count).toBe(3); // not "1 found" over three people, nor "0 found" over two
    expect(found.more).toBe(false);
    const registerCards = found.cards.filter((c) => c.kind === "register");
    expect(registerCards.map((c) => c.kind === "register" && c.person.name).sort()).toEqual(["Yusuf Quillfeather", "Zara Quillfeather Khan"]);
    expect(JSON.stringify(registerCards)).not.toMatch(/1HK|usn/i);
  });

  it("with no member matching, the register people are still the results (not '0 found')", async () => {
    const me = await member("Register Only Searcher");
    const found = await m.search.findPeople(me, { q: "yusuf quillfeather" });
    expect(found.count).toBe(1);
    expect(found.cards).toEqual([{ kind: "register", person: { name: "Yusuf Quillfeather", branch: "CIVIL", branchName: "CIVIL", programme: "B.Tech", joined: 2005 } }]);
  });

  it("narrows the register by branch and year; nothing typed or 'happy to' leaves it out", async () => {
    const me = await member("Register Narrower");
    const byBatch = await m.search.findPeople(me, { q: "zara", branch: "MECH", year: 2006 });
    expect(byBatch.cards.map((c) => (c.kind === "register" ? c.person.name : c.member.name))).toEqual(["Zara Quillfeather Khan"]);
    // Only members say they're happy to mentor: the register has nobody to match it.
    expect((await m.search.findPeople(me, { q: "yusuf", help: "mentor" })).cards).toEqual([]);
    // Nothing typed: members only (the register is looked through in its own section, a page at a time).
    expect((await m.search.findPeople(me, { branch: "CIVIL" })).cards.every((c) => c.kind === "member")).toBe(true);
  });

  it("keeps the register's hourly limit: members still found, the register skipped and said so", async () => {
    const me = await member("Register Limit Tester");
    for (let i = 0; i < m.register.REGISTER_SEARCHES; i++) await m.register.searchRegister(me, { q: "zara" });
    const found = await m.search.findPeople(me, { q: "zara" });
    expect(found.registerLimited).toBe(true);
    expect(found.cards.every((c) => c.kind === "member")).toBe(true);
    expect(found.cards.some((c) => c.kind === "member" && c.member.name === "Zara Quillfeather Member")).toBe(true);
  });
});
