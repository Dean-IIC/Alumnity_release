import { beforeAll, describe, expect, it } from "vitest";

/*
 * Security: what members type never becomes SQL. Every query takes what it's given as
 * values (db.ts numbers the "?" placeholders), so text built to break out of a query
 * ("'; drop table users; --"), LIKE's wildcards (% _ \), unicode, a NUL character and huge
 * strings are all kept, or searched for, as plain text, and nothing breaks.
 */

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "sql-admin@example.com";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let posts: typeof import("../lib/server/posts");
let groups: typeof import("../lib/server/groups");
let desk: typeof import("../lib/server/desk");
let profile: typeof import("../lib/server/profile");
let register: typeof import("../lib/server/register");
let auth: typeof import("../lib/server/auth");

/** Text written to break out of a query, or to make a search match everything. */
const PAYLOADS = [
  "'; drop table users; --",
  "Robert'); DROP TABLE posts;--",
  "' or '1'='1",
  "\" or 1=1 --",
  "1; delete from messages where 1=1",
  "' || (select email from users limit 1) || '",
  "%",
  "_",
  "\\",
  "%_\\%",
  "? ? $1 $2",
  "$$ language plpgsql $$",
  "😀 ñ 中文 עברית ‮ reversed",
  "<script>alert(1)</script>"
];

let n = 0;
async function member(name: string, extra: { role?: string; email?: string } = {}): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, 'CSE', 'CSE', 'B.Tech', 2012, ?, ?) returning id",
    extra.email ?? `sql${n}@example.com`,
    name,
    extra.role ?? "alumnus",
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

/** The administrator (by ALUMNITY_ADMINS), made the first time it's needed. */
async function admin(): Promise<U> {
  const row = await db.db().one<{ id: number }>("select id from users where email = 'sql-admin@example.com'");
  return row ? (await people.memberById(row.id))! : member("Admin Person", { email: "sql-admin@example.com" });
}

const connect = async (a: U, b: U) => {
  expect((await social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await social.acceptConnection(b, a.id)).ok).toBe(true);
};

/** Every table still there, with its rows. */
async function tablesIntact() {
  for (const table of ["users", "posts", "post_comments", "messages", "groups", "profiles", "register", "notifications"]) {
    expect(await db.db().one(`select count(*) as n from ${table}`)).toBeDefined();
  }
  expect((await db.db().one<{ n: number }>("select count(*) as n from users"))!.n).toBeGreaterThan(0);
}

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  posts = await import("../lib/server/posts");
  groups = await import("../lib/server/groups");
  desk = await import("../lib/server/desk");
  profile = await import("../lib/server/profile");
  register = await import("../lib/server/register");
  auth = await import("../lib/server/auth");
  // A made-up line on the register, so its lookups run for real.
  await db.db().run("insert into register (name, usn, branch, branch_name, programme, year) values ('Asha Testcase Rao', '1XX12XX999', 'CSE', 'CSE', 'B.Tech', 2012)");
});

describe("SQL injection", () => {
  it("posts, comments and messages keep every payload as plain text", async () => {
    const a = await member("Ann Writer");
    const b = await member("Ben Reader");
    await connect(a, b);
    for (const text of PAYLOADS) {
      const made = await posts.createPost(a, text, "everyone");
      expect(made.ok).toBe(true);
      expect((await posts.postFor(b, made.id!))?.body).toBe(text.trim());
      expect((await posts.addComment(b, made.id!, text)).ok).toBe(true);
      expect((await social.sendMessage(a, b.id, text)).ok).toBe(true);
    }
    const thread = await social.thread(b, a.id);
    expect(thread.map((m) => m.body)).toEqual(PAYLOADS.map((t) => t.trim()));
    const comments = (await posts.postFor(a, (await posts.feedFor(a, { limit: 1 }))[0].id))!.comments;
    expect(comments[0].body).toBe(PAYLOADS[PAYLOADS.length - 1]);
    await tablesIntact();
  });

  it("a NUL character is dropped rather than failing the query", async () => {
    const a = await member("Nul Writer");
    const made = await posts.createPost(a, "before\u0000after", "everyone");
    expect(made.ok).toBe(true);
    expect((await posts.postFor(a, made.id!))?.body).toBe("beforeafter");
    // And in a search, a lookup and a login.
    await expect(posts.feedFor(a, { q: "be\u0000fore" })).resolves.toBeInstanceOf(Array);
    await expect(people.searchMembers(a, { q: "\u0000" })).resolves.toBeInstanceOf(Array);
    expect((await auth.logIn("x\u0000@example.com", "pass\u0000word", "127.0.0.1")).ok).toBe(false);
  });

  it("a NUL or half an emoji on a member's page can't break the pages that read it for everyone", async () => {
    // Saved as JSON text, "\u0000" or a lone surrogate went in fine, then every query reading
    // pages as jsonb failed: Home and People for anyone who'd see this member, the desk's
    // numbers, and every new Ask (found by the live attack run).
    const odd = await member("Odd Page");
    const student = await member("Asking Student", { role: "student" });
    const desk = await admin();
    const parsed = await profile.parseProfile(
      { title: "x\u0000y", about: "half \ud83d an emoji", skills: ["a\u0000b", "\udc00"], happyTo: { mentor: true }, sections: { projects: [{ title: "p\u0000q", detail: "\ud800" }] } },
      odd.id
    );
    if ("error" in parsed) throw new Error(parsed.error);
    await profile.saveProfile(odd.id, parsed.profile);
    await expect(db.db().all("select data::jsonb from profiles")).resolves.toBeInstanceOf(Array);
    expect((await profile.profileOf(odd.id)).title).toBe("xy");
    await expect(profile.photoIdsOf([odd.id, student.id])).resolves.toBeInstanceOf(Map);
    await expect((await import("../lib/server/desk")).stats(desk)).resolves.not.toBeNull();
    const asks = await import("../lib/server/asks");
    expect((await asks.createAsk(student, { title: "Any tips?", body: "For placements", topics: "" })).ok).toBe(true);
    const home = await import("../lib/server/home");
    expect((await home.mentorsFor(student)).some((m) => m.member.id === odd.id)).toBe(true);
  });

  it("huge text is cut to its limit on the server, whatever the form allowed", async () => {
    const a = await member("Long Writer");
    const b = await member("Long Reader");
    await connect(a, b);
    const huge = "x".repeat(200_000);
    const made = await posts.createPost(a, huge, "everyone");
    expect((await posts.postFor(a, made.id!))?.body.length).toBe(posts.POST_LIMIT);
    await posts.addComment(b, made.id!, huge);
    expect((await posts.postFor(a, made.id!))!.comments[0].body.length).toBe(posts.COMMENT_LIMIT);
    await social.sendMessage(a, b.id, huge);
    expect((await social.thread(b, a.id)).at(-1)!.body.length).toBe(social.MESSAGE_LIMIT);
  });

  it("searches treat %, _ and \\ as letters to drop, never as wildcards, and payloads as words", async () => {
    const a = await member("Search Writer");
    await posts.createPost(a, "abc plain words", "everyone");
    await posts.createPost(a, "a%c with a percent", "everyone");
    // "a_c" as a LIKE pattern would match "abc"; as words it's "ac", which neither has.
    expect((await posts.feedFor(a, { q: "a_c" })).map((p) => p.body)).toEqual([]);
    expect((await posts.feedFor(a, { q: "a\\%c" })).map((p) => p.body)).toEqual([]);
    for (const q of PAYLOADS) {
      await expect(posts.feedFor(a, { q })).resolves.toBeInstanceOf(Array);
      await expect(posts.feedFor(a, { q: `#${q}` })).resolves.toBeInstanceOf(Array);
      await expect(posts.feedFor(a, { tags: [q], authors: [Number.NaN, 1e300] })).resolves.toEqual([]);
      await expect(people.searchMembers(a, { q, branch: q })).resolves.toBeInstanceOf(Array);
      await expect(groups.groupsFor(a, q)).resolves.toBeDefined();
      await expect(register.searchRegister(a, { q, branch: q })).resolves.toBeDefined();
      expect((await register.findInRegister({ name: q, usn: q }))?.status).toBe("not-found");
      expect((await register.findInRegister({ name: q, branch: q, year: 2012 }))?.status).toBe("not-found");
    }
    await tablesIntact();
  });

  it("a member search for '_' or '%' doesn't match everyone", async () => {
    const viewer = await member("Viewer Person");
    await member("Zed Underscore");
    expect(await people.searchMembers(viewer, { q: "_" })).not.toHaveLength(0); // nothing typed that counts: the plain list
    expect(await people.searchMembers(viewer, { q: "zz_qq" })).toHaveLength(0);
    expect(await people.searchMembers(viewer, { q: "%zed%" })).toHaveLength(1);
  });

  it("the desk's searches and a member's page take payloads as text", async () => {
    const boss = await admin();
    for (const q of PAYLOADS) {
      await expect(desk.deskMembers(boss, { q, role: q, branch: q })).resolves.toBeInstanceOf(Array);
      await expect(desk.recentContent(boss, "post", q)).resolves.toBeInstanceOf(Array);
      await expect(desk.auditLog(boss, { q, subject: q })).resolves.toBeInstanceOf(Array);
    }
    const me = await member("Page Person");
    const parsed = await profile.parseProfile({ title: PAYLOADS[0], company: PAYLOADS[1], city: "%", about: PAYLOADS.join(" "), skills: PAYLOADS }, me.id);
    if ("error" in parsed) throw new Error(parsed.error);
    await profile.saveProfile(me.id, parsed.profile);
    const saved = await profile.profileOf(me.id);
    expect(saved.title).toBe(PAYLOADS[0]);
    expect(saved.company).toBe(PAYLOADS[1]);
    expect(saved.skills).toContain("'; drop table users; --");
    await tablesIntact();
  });

  it("logging in, joining and resetting with payloads for an email find nobody", async () => {
    for (const p of PAYLOADS) {
      expect((await auth.logIn(p, p, "10.0.0.1")).ok).toBe(false);
      expect((await auth.startReset(`${p}@example.com`, "10.0.0.2")).ok).toBeTypeOf("boolean");
    }
    await tablesIntact();
  });

  it("question marks inside a value are never taken for placeholders", () => {
    // Only the SQL's own "?" are numbered; values travel separately.
    expect(db.numbered("select '?' as q, ? as v where x = ? and y = \"?\"")).toBe("select '?' as q, $1 as v where x = $2 and y = \"?\"");
  });
});
