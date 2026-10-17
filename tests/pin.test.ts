import { beforeAll, describe, expect, it, vi } from "vitest";

// Outside a request there's no page cache to refresh: what the action saves is what's tested.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";

let db: typeof import("../lib/server/db");
let profile: typeof import("../lib/server/profile");
let pin: typeof import("../lib/actions/content").pinPostAction;
let me = 0;
let mine = 0;
let theirs = 0;

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  db = await import("../lib/server/db");
  profile = await import("../lib/server/profile");
  ({ pinPostAction: pin } = await import("../lib/actions/content"));
  const authId = crypto.randomUUID();
  me = (await db.db().one<{ id: number }>("insert into users (email, name, role, auth_id, created_at) values ('pinner@example.com', 'Pin Person', 'alumnus', ?::uuid, ?) returning id", authId, Date.now()))!.id;
  const other = (await db.db().one<{ id: number }>("insert into users (email, name, role, created_at) values ('other@example.com', 'Other Person', 'alumnus', ?) returning id", Date.now()))!.id;
  mine = (await db.db().one<{ id: number }>("insert into posts (author, body, audience, created_at) values (?, 'Mine', 'everyone', ?) returning id", me, Date.now()))!.id;
  theirs = (await db.db().one<{ id: number }>("insert into posts (author, body, audience, created_at) values (?, 'Theirs', 'everyone', ?) returning id", other, Date.now()))!.id;
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  auth.accounts.set("pinner@example.com", { authId, password: "a long test password", code: null });
  auth.use("pin-browser");
  await auth.signInWithPassword("pinner@example.com", "a long test password");
});

describe("pinning a post to the top of your page", () => {
  it("pins your own post, and unpins it", async () => {
    expect((await pin(null, form({ id: String(mine) })))?.ok).toBe(true);
    expect((await profile.profileOf(me)).featured).toBe(mine);
    expect((await pin(null, form({ id: String(mine), unpin: "1" })))?.ok).toBe(true);
    expect((await profile.profileOf(me)).featured).toBeNull();
  });

  it("won't pin someone else's post, nor keep one through the edit form", async () => {
    expect((await pin(null, form({ id: String(theirs) })))?.ok).toBe(false);
    const parsed = await profile.parseProfile({ featured: theirs }, me);
    expect("profile" in parsed && parsed.profile.featured).toBeNull();
    const own = await profile.parseProfile({ featured: mine }, me);
    expect("profile" in own && own.profile.featured).toBe(mine);
  });
});
