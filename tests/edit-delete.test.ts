import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";

type Mods = {
  db: typeof import("../lib/server/db");
  people: typeof import("../lib/server/people");
  social: typeof import("../lib/server/social");
  posts: typeof import("../lib/server/posts");
  groups: typeof import("../lib/server/groups");
  inbox: typeof import("../lib/server/inbox");
};
let m: Mods;
type U = import("../lib/server/auth").User;

let n = 0;
/** A member straight into the database. */
async function member(name: string): Promise<U> {
  n += 1;
  const row = await m.db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, 'ECE', 'ECE', 'B.Tech', 2012, 'alumnus', ?) returning id",
      `ed${n}@example.com`,
      name,
      Date.now() + n
    );
  return (await m.people.memberById(row!.id))!;
}

const connect = async (a: U, b: U) => {
  expect((await m.social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await m.social.acceptConnection(b, a.id)).ok).toBe(true);
};

/** Sends a message and gives back its id (the newest from `from` to `to`). */
async function say(from: U, to: U, body: string): Promise<number> {
  expect((await m.social.sendMessage(from, to.id, body)).ok).toBe(true);
  return (await m.db.db().one<{ id: number }>("select max(id) as id from messages where sender = ? and recipient = ?", from.id, to.id))!.id;
}

const bodies = async (me: U, other: U) => (await m.social.thread(me, other.id)).map((x) => x.body);
const mentionsFor = async (u: U) => (await m.social.notificationsFor(u.id)).filter((x) => x.kind === "mention");

beforeAll(async () => {
  m = {
    db: await import("../lib/server/db"),
    people: await import("../lib/server/people"),
    social: await import("../lib/server/social"),
    posts: await import("../lib/server/posts"),
    groups: await import("../lib/server/groups"),
    inbox: await import("../lib/server/inbox")
  };
});

describe("editing a message", () => {
  it("within 15 minutes: both see the new words and 'edited'; after that, it can't be", async () => {
    const a = await member("Asha Editor");
    const b = await member("Bala Reader");
    await connect(a, b);
    const id = await say(a, b, "See you at 5");
    const before = await m.social.pulseFor(b.id, a.id);
    expect((await m.social.editMessage(a, id, "See you at 6")).ok).toBe(true);
    for (const [me, other] of [
      [a, b],
      [b, a]
    ] as const) {
      const [msg] = await m.social.thread(me, other.id);
      expect(msg).toMatchObject({ body: "See you at 6", deletedAt: null });
      expect(msg.editedAt).not.toBeNull();
    }
    // The other's open conversation notices (the pulse's `e`), so it redraws without a reload.
    expect((await m.social.pulseFor(b.id, a.id)).e).toBeGreaterThan(before.e);

    // Sent 16 minutes ago: too late to edit.
    await m.db.db().run("update messages set created_at = ? where id = ?", Date.now() - 16 * 60_000, id);
    expect(await m.social.editMessage(a, id, "See you at 7")).toMatchObject({ ok: false });
    expect(await bodies(b, a)).toEqual(["See you at 6"]);
  });

  it("only its sender may edit it or delete it for everyone; empty or too long is refused or trimmed", async () => {
    const a = await member("Chitra Sender");
    const b = await member("Dev Other");
    await connect(a, b);
    const id = await say(a, b, "mine");
    expect(await m.social.editMessage(b, id, "hijacked")).toMatchObject({ ok: false });
    expect(await m.social.deleteMessageForEveryone(b, id)).toMatchObject({ ok: false });
    expect(await m.social.editMessage(a, id, "   ")).toMatchObject({ ok: false });
    expect((await m.social.editMessage(a, id, "x".repeat(m.social.MESSAGE_LIMIT + 50))).ok).toBe(true);
    expect((await bodies(b, a))[0]).toHaveLength(m.social.MESSAGE_LIMIT);
  });
});

describe("deleting messages", () => {
  it("for everyone: the words are cleared in the database, for both, and the list says 'Message deleted'", async () => {
    const a = await member("Esha Deleter");
    const b = await member("Farid Friend");
    await connect(a, b);
    await say(a, b, "first");
    const id = await say(a, b, "oops, wrong chat");
    expect((await m.social.deleteMessageForEveryone(a, id)).ok).toBe(true);
    const row = await m.db.db().one<{ body: string; deleted_at: number | null }>("select body, deleted_at from messages where id = ?", id);
    expect(row).toMatchObject({ body: "" });
    expect(row!.deleted_at).not.toBeNull();
    for (const [me, other] of [
      [a, b],
      [b, a]
    ] as const) {
      const last = (await m.social.thread(me, other.id)).at(-1)!;
      expect(last).toMatchObject({ id, body: "" });
      expect(last.deletedAt).not.toBeNull();
    }
    expect((await m.inbox.inboxFor(b)).conversations[0].preview).toBe("Message deleted");
    expect((await m.inbox.inboxFor(a)).conversations[0].preview).toBe("You deleted a message");
    // A deleted message can't be edited back.
    expect(await m.social.editMessage(a, id, "back again")).toMatchObject({ ok: false });
  });

  it("for me: hidden only for the one who deleted it (either of the two may)", async () => {
    const a = await member("Gita One");
    const b = await member("Hari Two");
    await connect(a, b);
    const mine = await say(a, b, "keep this");
    const theirs = await say(b, a, "and this");
    expect((await m.social.deleteMessageForMe(a, theirs)).ok).toBe(true);
    expect(await bodies(a, b)).toEqual(["keep this"]);
    expect(await bodies(b, a)).toEqual(["keep this", "and this"]);
    expect((await m.social.deleteMessageForMe(b, mine)).ok).toBe(true);
    expect(await bodies(b, a)).toEqual(["and this"]);
    expect(await bodies(a, b)).toEqual(["keep this"]);
    // The list's last message is the newest one still there for each.
    expect((await m.inbox.inboxFor(a)).conversations[0].preview).toBe("You: keep this");
    // A stranger can't touch the conversation.
    const c = await member("Indu Outsider");
    expect(await m.social.deleteMessageForMe(c, mine)).toMatchObject({ ok: false });
  });

  it("delete chat: gone for me only; a new message brings it back with just the new ones", async () => {
    const a = await member("Jaya Clearer");
    const b = await member("Kiran Keeper");
    await connect(a, b);
    await say(a, b, "old one");
    await say(b, a, "old two");
    expect((await m.social.deleteChat(a, b.id)).ok).toBe(true);
    expect(await bodies(a, b)).toEqual([]);
    expect((await m.inbox.inboxFor(a)).conversations.some((c) => c.id === b.id)).toBe(false);
    expect(await m.social.unreadMessages(a.id)).toBe(0);
    expect(await bodies(b, a)).toEqual(["old one", "old two"]); // they still have it all
    await say(b, a, "new one");
    expect(await bodies(a, b)).toEqual(["new one"]);
    expect((await m.inbox.inboxFor(a)).conversations[0]).toMatchObject({ id: b.id, preview: "new one" });
    // The pulse counts only what's still there, so the open page doesn't keep redrawing.
    const pulse = await m.social.pulseFor(a.id, b.id);
    const thread = await m.social.thread(a, b.id);
    expect(pulse.t).toBe(thread.at(-1)!.id);
  });
});

describe("editing and deleting posts and comments", () => {
  it("a post's edit re-tags it and tells only the newly mentioned, once", async () => {
    const writer = await member("Lata Writer");
    const ravi = await member("Ravi Mentioned");
    const sunil = await member("Sunil Later");
    const made = await m.posts.createPost(writer, `We're hiring #job, ask @[Ravi Mentioned](${ravi.id})`, "everyone", [], null, ["notice"]);
    expect(made.ok).toBe(true);
    expect(await mentionsFor(ravi)).toHaveLength(1);

    const edit = await m.posts.editPost(writer, made.id!, `Now an #internship. @[Ravi Mentioned](${ravi.id}) and @[Sunil Later](${sunil.id}) know more`);
    expect(edit.ok).toBe(true);
    const post = (await m.posts.postFor(writer, made.id!))!;
    expect(post.body).toContain("Now an #internship");
    expect(post.editedAt).not.toBeNull();
    // #job came from the old words and went with them; #notice was picked in the composer and stays.
    expect([...post.tags].sort()).toEqual(["internship", "notice"]);
    expect(post.audience).toBe("everyone");
    expect(await mentionsFor(ravi)).toHaveLength(1); // not told again
    expect(await mentionsFor(sunil)).toHaveLength(1); // newly mentioned: told

    // Editing again with the same people mentions nobody new.
    expect((await m.posts.editPost(writer, made.id!, `Still an #internship. @[Sunil Later](${sunil.id})`)).ok).toBe(true);
    expect(await mentionsFor(sunil)).toHaveLength(1);
  });

  it("only a post's writer edits it; nobody else deletes it, except its group's admins", async () => {
    const owner = await member("Mala Owner");
    const admin = await member("Nina Admin");
    const writer = await member("Om Writer");
    const other = await member("Pia Member");
    const { id: group } = await m.groups.createGroup(owner, { name: "Edit and delete club", about: "", kind: "open" });
    for (const u of [admin, writer, other]) expect((await m.groups.joinGroup(u, group!)).ok).toBe(true);
    expect((await m.groups.setGroupRole(owner, group!, admin.id, "admin")).ok).toBe(true);

    const one = await m.posts.createPost(writer, "first group post", "group", [], group!);
    const two = await m.posts.createPost(writer, "second group post", "group", [], group!);
    expect(await m.posts.editPost(other, one.id!, "not yours")).toMatchObject({ ok: false });
    expect(await m.posts.editPost(admin, one.id!, "not yours either")).toMatchObject({ ok: false });
    expect(await m.posts.removePost(other, one.id!)).toMatchObject({ ok: false });
    expect((await m.posts.feedFor(owner, { groupId: group! })).map((p) => p.body)).toEqual(["second group post", "first group post"]);

    expect((await m.posts.removePost(admin, one.id!)).ok).toBe(true); // an admin keeps the group in order
    expect((await m.posts.removePost(owner, two.id!)).ok).toBe(true); // and so does the owner
    expect(await m.posts.feedFor(owner, { groupId: group! })).toHaveLength(0);

    // Outside a group, only the writer deletes.
    const home = await m.posts.createPost(writer, "on Home", "everyone");
    expect(await m.posts.removePost(admin, home.id!)).toMatchObject({ ok: false });
    expect((await m.posts.removePost(writer, home.id!)).ok).toBe(true);
    expect(await m.posts.postFor(writer, home.id!)).toBeNull();
  });

  it("comments: the writer edits ('edited') and deletes theirs; nobody else can", async () => {
    const writer = await member("Quinn Poster");
    const commenter = await member("Rhea Commenter");
    const made = await m.posts.createPost(writer, "What do you think?", "everyone");
    expect((await m.posts.addComment(commenter, made.id!, "Looks good")).ok).toBe(true);
    const [c] = (await m.posts.postFor(writer, made.id!))!.comments;
    expect(c.editedAt).toBeNull();

    expect(await m.posts.editComment(writer, c.id, "putting words in your mouth")).toMatchObject({ ok: false });
    expect(await m.posts.removeOwnComment(writer, c.id)).toMatchObject({ ok: false });
    expect((await m.posts.editComment(commenter, c.id, "Looks great")).ok).toBe(true);
    const [edited] = (await m.posts.postFor(writer, made.id!))!.comments;
    expect(edited.body).toBe("Looks great");
    expect(edited.editedAt).not.toBeNull();

    expect((await m.posts.removeOwnComment(commenter, c.id)).ok).toBe(true);
    expect((await m.posts.postFor(writer, made.id!))!.comments).toHaveLength(0);
  });
});
