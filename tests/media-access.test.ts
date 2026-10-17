import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres, the stand-in for Supabase Auth, and uploads in a scratch folder.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_UPLOADS = mkdtempSync(join(tmpdir(), "alumnity-media-"));

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let GET: typeof import("../app/media/[id]/route").GET;
let n = 0;

async function member(name: string, role = "alumnus"): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, branch, joined, role, auth_id, created_at) values (?, ?, 'CSE', 2012, ?, ?::uuid, ?) returning id",
    `media${n}@example.com`,
    name,
    role,
    crypto.randomUUID(),
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

/** A real (tiny) photo of `u`'s, on disk and in the media table. */
async function photo(u: U): Promise<string> {
  n += 1;
  const id = `accessmedia${String(n).padStart(6, "0")}`;
  mkdirSync(join(process.env.ALUMNITY_UPLOADS!, "t"), { recursive: true });
  writeFileSync(join(process.env.ALUMNITY_UPLOADS!, "t", `${id}.jpg`), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  await db.db().run("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, 'image', 'image/jpeg', 4, ?, ?)", id, u.id, `t/${id}.jpg`, Date.now());
  return id;
}

/** What `viewer` gets for /media/<id>. */
async function fetchAs(viewer: U, id: string) {
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  const authId = (await db.db().one<{ auth_id: string }>("select auth_id from users where id = ?", viewer.id))!.auth_id;
  auth.accounts.set(viewer.email, { authId, password: "a long test password", code: null });
  auth.use(`browser-${viewer.id}`);
  await auth.signInWithPassword(viewer.email, "a long test password");
  const response = await GET(new Request(`http://localhost/media/${id}`), { params: Promise.resolve({ id }) });
  auth.use("main");
  return response.status;
}

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  ({ GET } = await import("../app/media/[id]/route"));
});

describe("someone's photo, cover or cause cover", () => {
  it("is for members, but not for someone blocked either way, nor once its owner is suspended", async () => {
    const owner = await member("Owner Person");
    const other = await member("Other Person");
    const blocker = await member("Blocking Person");
    const desk = await member("Desk Person", "admin");
    const id = await photo(owner);
    expect(await fetchAs(other, id)).toBe(200);

    expect((await social.block(owner, blocker.id)).ok).toBe(true);
    expect(await fetchAs(blocker, id)).toBe(404);
    expect(await fetchAs(other, id)).toBe(200);

    await db.db().run("update users set suspended_at = ? where id = ?", Date.now(), owner.id);
    expect(await fetchAs(other, id)).toBe(404);
    // The desk still sees it (it reviews reports about suspended members).
    expect(await fetchAs(desk, id)).toBe(200);
  });

  it("a cause's cover only once the desk has put the cause up", async () => {
    const author = await member("Cause Author");
    const reader = await member("Cause Reader");
    const cover = await photo(author);
    const cause = await db.db().one<{ id: number }>(
      "insert into causes (author, title, story, goal, cover, status, created_at) values (?, 'Fees', 'A story', 100000, ?, 'pending', ?) returning id",
      author.id,
      cover,
      Date.now()
    );
    expect(await fetchAs(reader, cover)).toBe(404);
    expect(await fetchAs(author, cover)).toBe(200);
    await db.db().run("update causes set status = 'live' where id = ?", cause!.id);
    expect(await fetchAs(reader, cover)).toBe(200);
  });
});
