import { beforeAll, describe, expect, it, vi } from "vitest";

// An in-memory Postgres and the stand-in for Supabase Auth, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/*
 * Home's filters: by #tag, by who wrote it (alumni, students, faculty, the college), by
 * named people, and by words. They only ever narrow the feed: a post the reader may not see
 * (for someone's connections, someone's batch, a group, a blocked writer) never comes back,
 * however it's filtered.
 */

let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let posts: typeof import("../lib/server/posts");
let groups: typeof import("../lib/server/groups");
let filters: typeof import("../lib/feed-filters");
type U = import("../lib/server/auth").User;

let n = 0;
/** A member straight into the database; each in their own batch unless one is given. */
async function member(name: string, role = "alumnus", { joined, college = false, authId }: { joined?: number; college?: boolean; authId?: string } = {}): Promise<U> {
  n += 1;
  const row = await db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, college_account, auth_id, created_at) values (?, ?, 'CSE', 'CSE', 'B.Tech', ?, ?, ?, ?::uuid, ?) returning id",
      `filter${n}@example.com`,
      name,
      joined ?? 1980 + n,
      role,
      college ? 1 : 0,
      authId ?? null,
      Date.now() + n
    );
  return (await people.memberById(row!.id))!;
}

const connect = async (a: U, b: U) => {
  expect((await social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await social.acceptConnection(b, a.id)).ok).toBe(true);
};

async function post(by: U, body: string, audience = "everyone", picked: string[] = [], groupId: number | null = null): Promise<number> {
  const made = await posts.createPost(by, body, audience, [], groupId, picked);
  expect(made.ok).toBe(true);
  return made.id!;
}

let reader: U;
const ids = new Map<string, number>();
const who = new Map<string, U>();
const authId = crypto.randomUUID();

/** What the reader's Home shows with these filters: the posts' names, as set up below. */
async function shown(opts: Parameters<typeof posts.feedFor>[1] = {}): Promise<string[]> {
  const found = await posts.feedFor(reader, { limit: 50, ...opts });
  const names = new Map([...ids].map(([k, v]) => [v, k]));
  return found.map((p) => names.get(p.id) ?? `post ${p.id}`).sort();
}

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  posts = await import("../lib/server/posts");
  groups = await import("../lib/server/groups");
  filters = await import("../lib/feed-filters");

  reader = await member("Rehan Reader", "alumnus", { joined: 2010, authId });
  const alumna = await member("Aisha Alumna");
  const student = await member("Sana Student", "student");
  const teacher = await member("Farhan Faculty", "faculty");
  const desk = await member("Chitra Coordinator", "coordinator");
  const college = await member("HKBK Alumni Association", "alumnus", { college: true });
  const stranger = await member("Xavier Stranger");
  const batchmate = await member("Bilal Batchmate", "alumnus", { joined: 2010 });
  const friend = await member("Nadia Friend");
  const blocker = await member("Kiran Blocker");
  for (const [k, u] of Object.entries({ alumna, student, teacher, desk, college, stranger, batchmate, friend, blocker })) who.set(k, u);
  await connect(reader, friend);

  ids.set("alumna-job", await post(alumna, "Hiring for a backend role at our Bengaluru office #job"));
  ids.set("student-internship", await post(student, "Looking for an #internship this summer"));
  ids.set("teacher-notice", await post(teacher, "The lab is open on Saturday", "everyone", ["notice"]));
  ids.set("desk-notice", await post(desk, "Convocation date announced", "everyone", ["notice"]));
  ids.set("college-meet", await post(college, "Old portal notice: the alumni meet is back"));
  // Not for the reader: the stranger's connections, the stranger's batch.
  ids.set("stranger-connections", await post(stranger, "Secret #job for my connections only", "connections"));
  ids.set("stranger-batch", await post(stranger, "Secret #job for my batch only", "batch"));
  // For the reader: their batchmate's batch, their friend's connections.
  ids.set("batchmate-batch", await post(batchmate, "A #job for our batch", "batch"));
  ids.set("friend-connections", await post(friend, "A #job for my connections", "connections"));
  // A group's post: never on Home, even for a member of the group.
  const { id: groupId } = await groups.createGroup(alumna, { name: "Backend alumni", about: "", kind: "open" });
  expect((await groups.joinGroup(reader, groupId!)).ok).toBe(true);
  ids.set("group-job", await post(alumna, "Secret #job just for the group", "group", [], groupId!));
  // Someone who has blocked the reader.
  ids.set("blocker-job", await post(blocker, "Secret #job from someone who blocked the reader"));
  expect((await social.block(blocker, reader.id)).ok).toBe(true);
  // The reader's own.
  ids.set("reader-own", await post(reader, "My own #scholarship news"));

  // Signed in as the reader, for the feed's server action.
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  auth.accounts.set(reader.email, { authId, password: "a long test password", code: null });
  auth.use("filter-browser");
  await auth.signInWithPassword(reader.email, "a long test password");
});

const SECRET = ["stranger-connections", "stranger-batch", "group-job", "blocker-job"];
const neverSecret = (names: string[]) => expect(names.filter((x) => SECRET.includes(x))).toEqual([]);

describe("filtering Home's feed", () => {
  it("unfiltered, it shows only what the reader may see", async () => {
    const all = await shown();
    neverSecret(all);
    expect(all).toEqual(
      ["alumna-job", "batchmate-batch", "college-meet", "desk-notice", "friend-connections", "reader-own", "student-internship", "teacher-notice"].sort()
    );
  });

  it("by #tag: any of them, cleaned, five at most", async () => {
    expect(await shown({ tags: ["job"] })).toEqual(["alumna-job", "batchmate-batch", "friend-connections"]);
    expect(await shown({ tags: ["job", "internship"] })).toEqual(["alumna-job", "batchmate-batch", "friend-connections", "student-internship"]);
    // Picked in the composer counts the same as typed.
    expect(await shown({ tags: ["NOTICE"] })).toEqual(["desk-notice", "teacher-notice"]);
    // Nonsense isn't a tag: it's dropped, not searched for.
    expect(await shown({ tags: ["%", "a"] })).toHaveLength(8);
  });

  it("by who wrote it, the college being its desk and its own account", async () => {
    expect(await shown({ roles: ["student"] })).toEqual(["student-internship"]);
    expect(await shown({ roles: ["faculty"] })).toEqual(["teacher-notice"]);
    expect(await shown({ roles: ["college"] })).toEqual(["college-meet", "desk-notice"]);
    // The college's account isn't one of the alumni, whatever its role says.
    const alumni = await shown({ roles: ["alumnus"] });
    expect(alumni).toEqual(["alumna-job", "batchmate-batch", "friend-connections", "reader-own"]);
    expect(await shown({ roles: ["student", "faculty"] })).toEqual(["student-internship", "teacher-notice"]);
    // A role that isn't one is ignored.
    expect(await shown({ roles: ["superadmin" as never] })).toHaveLength(8);
  });

  it("by named people, ten at most", async () => {
    expect(await shown({ authors: [who.get("alumna")!.id, who.get("student")!.id] })).toEqual(["alumna-job", "student-internship"]);
    expect(await shown({ authors: [who.get("teacher")!.id], tags: ["notice"] })).toEqual(["teacher-notice"]);
    expect(await shown({ authors: [-1, 1.5] })).toEqual([]);
  });

  it("by words, in the text or the #tags", async () => {
    expect(await shown({ q: "hiring" })).toEqual(["alumna-job"]);
    expect(await shown({ q: "BACKEND   hiring" })).toEqual(["alumna-job"]);
    // A #tag in the search means that tag (picked or typed).
    expect(await shown({ q: "#notice" })).toEqual(["desk-notice", "teacher-notice"]);
    // A plain word finds it in the text, or as the start of a tag.
    expect(await shown({ q: "notice" })).toEqual(["college-meet", "desk-notice", "teacher-notice"]);
    expect(await shown({ q: "intern" })).toEqual(["student-internship"]);
    // LIKE's wildcards are only characters.
    expect(await shown({ q: "%" })).toHaveLength(8);
    expect(await shown({ q: "100%_off" })).toEqual([]);
    // With the other filters too.
    expect(await shown({ q: "job", roles: ["alumnus"], tags: ["job"] })).toEqual(["alumna-job", "batchmate-batch", "friend-connections"]);
  });

  it("never brings back a post the reader may not see, however it's filtered", async () => {
    const stranger = who.get("stranger")!;
    const blocker = who.get("blocker")!;
    const alumna = who.get("alumna")!;
    for (const opts of [
      { tags: ["job"] },
      { q: "secret" },
      { q: "#job" },
      { authors: [stranger.id] },
      { authors: [blocker.id], tags: ["job"] },
      { authors: [alumna.id], q: "group" },
      { roles: ["alumnus" as const], q: "secret" },
      { scope: "following" as const, tags: ["job"] }
    ]) {
      neverSecret(await shown(opts));
    }
    expect(await shown({ q: "secret" })).toEqual([]);
    expect(await shown({ authors: [stranger.id] })).toEqual([]);
    // Following: the friend (connected) and the reader, nobody else.
    expect(await shown({ scope: "following", tags: ["job"] })).toEqual(["friend-connections"]);
  });

  it("keeps to the filters as the feed scrolls on", async () => {
    const { olderPostsAction } = await import("../lib/actions/feed");
    const page = await olderPostsAction("all", Date.now() + 1000, "tag=job&role=alumnus");
    expect(Array.isArray(page.posts) && page.posts.length).toBe(3);
    expect(page.next).toBeNull();
    const none = await olderPostsAction("all", Date.now() + 1000, "q=secret");
    expect(Array.isArray(none.posts) && none.posts.length).toBe(0);
  });

  it("offers the tags most used lately, from posts the reader may see only", async () => {
    const top = await posts.popularTags(reader);
    expect(top[0]).toBe("job"); // the alumna's, the batchmate's and the friend's
    expect(top).toEqual(expect.arrayContaining(["notice", "internship", "scholarship"]));
    // Seen by the reader only in posts they can't see: the stranger's, the group's.
    const other = await member("Omar Other");
    await post(who.get("stranger")!, "#hushhush for my connections", "connections");
    await post(other, "#hushhush too", "connections");
    expect(await posts.popularTags(reader)).not.toContain("hushhush");
  });
});

describe("filters in the address", () => {
  it("are read, cleaned and capped", () => {
    const f = filters.readFeedFilters({ tag: "Job,#internship,bad tag,a,x1,x2,x3,x4", role: ["alumnus,college", "admin"], from: "12,34,abc,-3,12", q: "  hiring   now  " });
    expect(f).toEqual({ tags: ["job", "internship", "x1", "x2", "x3"], roles: ["alumnus", "college"], authors: [12, 34], q: "hiring now" });
    expect(filters.readFeedFilters({ from: Array.from({ length: 20 }, (_, i) => String(i + 1)).join(",") }).authors).toHaveLength(10);
    expect(filters.readFeedFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
    expect(filters.readFeedFilters(new URLSearchParams("tag=job&tag=event&role=student"))).toMatchObject({ tags: ["job", "event"], roles: ["student"] });
  });

  it("are written back the same way, and survive the trip", () => {
    const f = { tags: ["job"], roles: ["alumnus" as const], authors: [12, 34], q: "hiring now" };
    expect(filters.feedHref(f)).toBe("/home?tag=job&role=alumnus&from=12,34&q=hiring+now");
    expect(filters.feedHref(f, { view: "following", before: 99 })).toBe("/home?view=following&tag=job&role=alumnus&from=12,34&q=hiring+now&before=99");
    expect(filters.feedHref(filters.NO_FILTERS)).toBe("/home");
    expect(filters.readFeedFilters(new URLSearchParams(filters.filterQuery(f)))).toEqual(f);
    expect(filters.tagHref("job")).toBe("/home?tag=job#feed");
  });
});
