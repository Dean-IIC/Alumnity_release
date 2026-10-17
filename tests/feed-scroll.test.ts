import { beforeAll, describe, expect, it } from "vitest";

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";

let db: typeof import("../lib/server/db");
let older: typeof import("../lib/actions/feed").olderPostsAction;
let readerId = 0;

beforeAll(async () => {
  db = await import("../lib/server/db");
  ({ olderPostsAction: older } = await import("../lib/actions/feed"));
  const authId = crypto.randomUUID();
  const reader = await db.db().one<{ id: number }>(
    "insert into users (email, name, branch, joined, role, auth_id, created_at) values ('reader@example.com', 'Feed Reader', 'CSE', 2012, 'alumnus', ?::uuid, ?) returning id",
    authId,
    Date.now()
  );
  readerId = reader!.id;
  // Twenty posts for everyone, a minute apart.
  for (let i = 0; i < 20; i++) await db.db().run("insert into posts (author, body, audience, created_at) values (?, ?, 'everyone', ?)", readerId, `Post number ${i}`, Date.now() - i * 60_000);
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  auth.accounts.set("reader@example.com", { authId, password: "a long test password", code: null });
  auth.use("feed-browser");
  await auth.signInWithPassword("reader@example.com", "a long test password");
});

describe("Home's feed, carrying on as you scroll", () => {
  it("brings the next fifteen, then the rest, then says there's no more", async () => {
    const first = await older("all", Date.now() + 1000);
    expect(Array.isArray(first.posts) && first.posts.length).toBe(15);
    expect(first.next).not.toBeNull();
    const second = await older("all", first.next!);
    expect(Array.isArray(second.posts) && second.posts.length).toBe(5);
    expect(second.next).toBeNull();
  });

  it("gives nothing to someone signed out, or for a nonsense cursor", async () => {
    expect((await older("all", -5)).posts).toBeNull();
    const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
    auth.use("nobody-browser");
    expect(await older("all", Date.now())).toEqual({ posts: null, next: null });
    auth.use("feed-browser");
  });

  it("marks a post brought over from the old portal, and nothing else", async () => {
    const { postFor } = await import("../lib/server/posts");
    const { memberById } = await import("../lib/server/people");
    const reader = (await memberById(readerId))!;
    const old = (await db.db().one<{ id: number }>("insert into posts (author, body, audience, from_archive, created_at) values (?, 'A notice from 2019', 'everyone', 1, ?) returning id", readerId, Date.UTC(2019, 5, 1)))!.id;
    expect((await postFor(reader, old))?.archive).toBe(true);
    const fresh = (await db.db().one<{ id: number }>("insert into posts (author, body, audience, created_at) values (?, 'Today', 'everyone', ?) returning id", readerId, Date.now()))!.id;
    expect((await postFor(reader, fresh))?.archive).toBe(false);
  });
});
