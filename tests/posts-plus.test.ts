import { beforeAll, describe, expect, it, vi } from "vitest";

// An in-memory Postgres and the stand-in for Supabase Auth, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/*
 * Posts made as usable as LinkedIn's: reposts (plain and with your thoughts) that keep the
 * original's audience, sending a post privately to connections, tagging people, and up to
 * ten photos a post.
 */

let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let posts: typeof import("../lib/server/posts");
let groups: typeof import("../lib/server/groups");
type U = import("../lib/server/auth").User;

let n = 0;
/** A member straight into the database; each in their own batch unless told, so "batch" never joins them by accident. */
async function member(name: string, joined = 1990 + n): Promise<U> {
  n += 1;
  const row = await db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, 'CSE', 'CSE', 'B.Tech', ?, 'alumnus', ?) returning id",
      `plus${n}@example.com`,
      name,
      joined,
      Date.now() + n
    );
  return (await people.memberById(row!.id))!;
}

const connect = async (a: U, b: U) => {
  expect((await social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await social.acceptConnection(b, a.id)).ok).toBe(true);
};

let uploads = 0;
async function upload(u: U): Promise<string> {
  uploads += 1;
  const id = `plusmedia${String(uploads).padStart(6, "0")}`;
  await db.db().run("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, 'image', 'image/jpeg', 1, 'x', ?)", id, u.id, Date.now());
  return id;
}

const notes = async (u: U, kind: string) => (await social.notificationsFor(u.id)).filter((x) => x.kind === kind);

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  posts = await import("../lib/server/posts");
  groups = await import("../lib/server/groups");
});

describe("reposts", () => {
  it("a plain repost and one with your thoughts both carry the original, and its writer is told", async () => {
    const writer = await member("Rita Writer");
    const fan = await member("Faiz Fan");
    const { id } = await posts.createPost(writer, "We're hiring interns this summer", "everyone");

    const plain = await posts.repost(fan, id!);
    expect(plain.ok).toBe(true);
    const shown = (await posts.postFor(fan, plain.id!))!;
    expect(shown.body).toBe("");
    expect(shown.audience).toBe("everyone"); // the same people as the original
    expect(shown.repostOf).toMatchObject({ id, post: { id, body: "We're hiring interns this summer", author: { id: writer.id } } });

    // Twice with nothing new to say is once too many; with words it's fine.
    expect(await posts.repost(fan, id!)).toMatchObject({ ok: false, error: "You've already reposted this." });
    const quote = await posts.repost(fan, id!, "Great place to start, juniors!", "connections");
    expect(quote.ok).toBe(true);
    expect(await posts.postFor(fan, quote.id!)).toMatchObject({ body: "Great place to start, juniors!", audience: "connections", repostOf: { id } });

    // Told of the plain one; not of the one for the fan's connections, which the writer isn't among.
    expect(await notes(writer, "repost")).toHaveLength(1);
    expect((await notes(writer, "repost"))[0]).toMatchObject({ actor: fan.id, text: "Faiz Fan reposted your post.", link: `/notes/${plain.id}` });
    expect((await posts.postFor(writer, id!))!.repostCount).toBe(2);
  });

  it("reposting a plain repost reposts the original (no nesting); a group's post can't be reposted", async () => {
    const writer = await member("Gita Group");
    const first = await member("Hari First");
    const second = await member("Isha Second");
    const { id } = await posts.createPost(writer, "Alumni meet on Saturday", "everyone");
    const { id: plain } = await posts.repost(first, id!);
    const again = await posts.repost(second, plain!);
    expect(again.ok).toBe(true);
    expect((await posts.postFor(second, again.id!))!.repostOf?.id).toBe(id);

    const { id: groupId } = await groups.createGroup(writer, { name: "Reposters club", about: "", kind: "open" });
    const { id: inGroup } = await posts.createPost(writer, "Only for the group", "group", [], groupId!);
    expect(await posts.repost(writer, inGroup!)).toMatchObject({ ok: false });
    expect(await posts.createPost(writer, "", "everyone", [], groupId!, [], id!)).toMatchObject({ ok: false }); // nor into a group
    expect(await posts.createPost(first, "", "everyone", [await upload(first)], null, [], id!)).toMatchObject({ ok: false }); // nor with photos
  });

  it("shows in the feed, keeping the original's audience: who may not see it is told it isn't available", async () => {
    const writer = await member("Jaya Private");
    const friend = await member("Kiran Friend");
    const stranger = await member("Lata Stranger");
    await connect(writer, friend);
    const { id } = await posts.createPost(writer, "Just for my connections", "connections", [await upload(writer)]);
    // The friend reposts it, with words, for everyone.
    const { id: quote } = await posts.repost(friend, id!, "Read this", "everyone");

    const forFriend = (await posts.feedFor(friend)).find((p) => p.id === quote)!;
    expect(forFriend.repostOf?.post).toMatchObject({ id, body: "Just for my connections" });
    expect(forFriend.repostOf?.post?.media).toHaveLength(1);

    const forStranger = (await posts.feedFor(stranger)).find((p) => p.id === quote)!;
    expect(forStranger.body).toBe("Read this"); // the repost is for everyone…
    expect(forStranger.repostOf).toEqual({ id, post: null }); // …the original isn't
    expect(await posts.canSeePostMedia(stranger, forFriend.repostOf!.post!.media[0].id)).toBe(false);
    // And a stranger can't repost what they can't see.
    expect(await posts.repost(stranger, id!)).toMatchObject({ ok: false });

    // Once the original is deleted, nobody sees it inside the repost.
    await posts.removeOwnPost(writer, id!);
    expect((await posts.postFor(friend, quote!))!.repostOf).toEqual({ id, post: null });
  });

  it("a plain repost of a batch post goes to the reposter's own batch, as the original did", async () => {
    const writer = await member("Mala Batch", 2015);
    const mate = await member("Nikhil Mate", 2015);
    const { id } = await posts.createPost(writer, "Batch of 2015: reunion?", "batch");
    const { id: plain } = await posts.repost(mate, id!);
    expect((await posts.postFor(mate, plain!))!.audience).toBe("batch");
  });
});

describe("sending a post privately", () => {
  it("goes to connections as a message with the post's link and the note", async () => {
    const me = await member("Om Sender");
    const pal = await member("Pia Pal");
    const { id } = await posts.createPost(me, "A good read for seniors", "everyone");
    await connect(me, pal);
    const sent = await posts.sendPost(me, id!, [pal.id], "  Thought of you  ");
    expect(sent).toEqual({ ok: true, sent: 1 });
    const last = (await social.thread(pal, me.id)).at(-1)!;
    expect(last.body).toBe(`Thought of you\n\nA post by Om Sender: /notes/${id}`);
    expect((await notes(pal, "message")).length).toBe(1);
  });

  it("only to connections who may see the post: anyone else stops the whole send, before anything goes", async () => {
    const me = await member("Quinn Sender");
    const pal = await member("Ravi Pal");
    const notPal = await member("Sara Unknown");
    await connect(me, pal);
    const { id } = await posts.createPost(me, "Open to all", "everyone");

    expect(await posts.sendPost(me, id!, [notPal.id])).toMatchObject({ ok: false });
    expect(await social.thread(notPal, me.id)).toHaveLength(0);
    // One who isn't a connection among them: nothing goes, not even to the connection.
    expect(await posts.sendPost(me, id!, [pal.id, notPal.id])).toMatchObject({ ok: false });
    expect(await social.thread(pal, me.id)).toHaveLength(0);

    // A post the connection may not see (for its writer's connections only) isn't sent to them.
    const writer = await member("Tara Writer");
    await connect(writer, me);
    const { id: closed } = await posts.createPost(writer, "Connections only", "connections");
    expect(await posts.sendPost(me, closed!, [pal.id])).toMatchObject({ ok: false, error: "Ravi Pal can't see this post, so you can't send it to them." });

    // Nobody, too many, or a post you can't see yourself.
    expect(await posts.sendPost(me, id!, [])).toMatchObject({ ok: false });
    expect(await posts.sendPost(me, id!, Array.from({ length: posts.SEND_LIMIT + 1 }, (_, i) => pal.id + 1000 + i))).toMatchObject({ ok: false });
    const { id: hidden } = await posts.createPost(pal, "Ravi's connections only", "connections");
    expect(await posts.sendPost(notPal, hidden!, [pal.id])).toMatchObject({ ok: false, error: "This post is no longer available." });
  });
});

describe("tagging people", () => {
  it("each person tagged who may see the post is told; one who may not isn't", async () => {
    const me = await member("Uma Tagger");
    const pal = await member("Vik Tagged");
    const outsider = await member("Wes Outsider");
    await connect(me, pal);
    // As "Tag people" writes them: @[Name](id), the same as typing @.
    const open = await posts.createPost(me, `Congratulations @[${pal.name}](${pal.id}) on the award!`, "everyone");
    expect((await notes(pal, "mention"))[0]).toMatchObject({ actor: me.id, link: `/notes/${open.id}` });

    await posts.createPost(me, `Only my connections, with @[${outsider.name}](${outsider.id})`, "connections");
    expect(await notes(outsider, "mention")).toHaveLength(0);

    // Tagging in a repost's words tells them too (and the original's writer once, as a mention).
    const { id: theirs } = await posts.createPost(pal, "My first post", "everyone");
    await posts.repost(me, theirs!, `Welcome @[${pal.name}](${pal.id})`, "everyone");
    expect(await notes(pal, "mention")).toHaveLength(2);
    expect(await notes(pal, "repost")).toHaveLength(0);
  });
});

describe("photos on a post", () => {
  it("up to ten; the eleventh is refused", async () => {
    const me = await member("Xena Photos");
    expect(posts.MEDIA_LIMIT).toBe(10);
    const ten = await Promise.all(Array.from({ length: 10 }, () => upload(me)));
    const made = await posts.createPost(me, "Reunion album", "everyone", ten);
    expect(made.ok).toBe(true);
    expect((await posts.postFor(me, made.id!))!.media.map((m) => m.id)).toEqual(ten); // in the order chosen
    const eleven = await Promise.all(Array.from({ length: 11 }, () => upload(me)));
    expect(await posts.createPost(me, "Too many", "everyone", eleven)).toMatchObject({ ok: false, error: "A post can have up to 10 photos or videos." });
  });
});
