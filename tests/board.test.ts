import { beforeAll, describe, expect, it, vi } from "vitest";

// An in-memory Postgres and the stand-in for Supabase Auth, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "board-admin@example.com";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let posts: typeof import("../lib/server/posts");
let tags: typeof import("../lib/tags");
type U = import("../lib/server/auth").User;

let n = 0;
async function member(name: string, extra: { role?: string; email?: string } = {}): Promise<U> {
  n += 1;
  const row = await db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, 'CSE', 'CSE', 'B.Tech', 2012, ?, ?) returning id",
      extra.email ?? `board${n}@example.com`,
      name,
      extra.role ?? "alumnus",
      Date.now() + n
    );
  return (await people.memberById(row!.id))!;
}

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  posts = await import("../lib/server/posts");
  tags = await import("../lib/tags");
});

describe("#tags", () => {
  it("are read from the text: lower-cased, each once, not from inside a word, an address or a heading", () => {
    expect(tags.tagsIn("Hiring! #Job at Bosch, #internship too. #job again")).toEqual(["job", "internship"]);
    expect(tags.tagsIn("see https://example.com/#jobs and a#b and C# and #1")).toEqual([]);
    expect(tags.tagsIn("#a #b2 #c3 #d4 #e5 #f6 #g7").length).toBe(5);
  });

  it("split text for links, keeping everything else as it was", () => {
    expect(tags.tagPieces("New #job: apply")).toEqual([{ text: "New " }, { tag: "job", shown: "#job" }, { text: ": apply" }]);
  });
});

describe("the HKBK board", () => {
  it("files typed and picked tags, and lists a tag's posts only to those who may see them", async () => {
    const alum = await member("Tag Alum");
    const stranger = await member("Stranger Alum");
    const open = await posts.createPost(alum, "Backend roles open at my company. #job", "everyone", [], null, ["referral", "not a tag!"]);
    const close = await posts.createPost(alum, "Only for my connections #job", "connections");
    expect(open.ok && close.ok).toBe(true);
    const mine = (await posts.feedFor(alum, { tag: "job" })).map((p) => p.id);
    expect(mine).toEqual(expect.arrayContaining([open.id, close.id]));
    const seen = await posts.feedFor(stranger, { tag: "job" });
    expect(seen.map((p) => p.id)).toContain(open.id);
    expect(seen.map((p) => p.id)).not.toContain(close.id);
    expect(seen.find((p) => p.id === open.id)!.tags).toEqual(["job", "referral"]);
  });

  it("only the college desk verifies, only posts for everyone, and the writer is told", async () => {
    const alum = await member("Verify Alum");
    const admin = await member("Board Admin", { email: "board-admin@example.com" });
    const { id } = await posts.createPost(alum, "Scholarship for second-years #scholarship", "everyone");
    const { id: batchOnly } = await posts.createPost(alum, "For my batch #notice", "batch");
    expect((await posts.verifyPost(alum, id!, true)).ok).toBe(false);
    expect((await posts.verifyPost(admin, batchOnly!, true)).ok).toBe(false);
    expect((await posts.verifyPost(admin, id!, true)).ok).toBe(true);
    expect((await posts.feedFor(alum, { verified: true })).map((p) => p.id)).toContain(id);
    expect((await posts.feedFor(alum, { verified: true, tag: "job" })).map((p) => p.id)).not.toContain(id);
    expect(await db.db().one("select 1 from notifications where user_id = ? and kind = 'post-verified'", alum.id)).toBeTruthy();
    expect(await db.db().one("select 1 from audit where action = 'verified' and subject = ?", `post ${id}`)).toBeTruthy();
    // Taken back off.
    expect((await posts.verifyPost(admin, id!, false)).ok).toBe(true);
    expect((await posts.feedFor(alum, { verified: true })).map((p) => p.id)).not.toContain(id);
  });

  it("asking for a referral: a connection request with the note, or a message once connected", async () => {
    const alum = await member("Refer Alum");
    const student = await member("Refer Student", { role: "student" });
    const { id } = await posts.createPost(alum, "Firmware internship at my team #internship", "everyone");
    const { id: plain } = await posts.createPost(alum, "Lovely weather today", "everyone");
    const why = "ECE 2025, I built a CAN bus logger on an STM32.";
    expect((await posts.askForReferral(student, plain!, why)).ok).toBe(false); // not a work post
    expect((await posts.askForReferral(student, id!, "please")).ok).toBe(false); // too short to help
    expect((await posts.askForReferral(alum, id!, why)).ok).toBe(false); // their own
    const asked = await posts.askForReferral(student, id!, why);
    expect(asked).toMatchObject({ ok: true, as: "request" });
    const request = await db.db().one<{ note: string }>("select note from connections where requester = ? and addressee = ?", student.id, alum.id);
    expect(request!.note).toContain("#internship");
    expect(request!.note).toContain("CAN bus");
    // They accept; asking again goes to them as a message.
    expect((await social.acceptConnection(alum, student.id)).ok).toBe(true);
    expect(await posts.askForReferral(student, id!, why)).toMatchObject({ ok: true, as: "message" });
    expect(await db.db().one("select 1 from messages where sender = ? and recipient = ? and body like ?", student.id, alum.id, "%CAN bus%")).toBeTruthy();
  });
});
