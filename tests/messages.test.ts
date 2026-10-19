import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres, set before the modules load.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";

type Mods = {
  db: typeof import("../lib/server/db");
  people: typeof import("../lib/server/people");
  social: typeof import("../lib/server/social");
  stories: typeof import("../lib/server/stories");
  follows: typeof import("../lib/server/follows");
  inbox: typeof import("../lib/server/inbox");
  chat: typeof import("../lib/chat-format");
};
let m: Mods;
type U = import("../lib/server/auth").User;

let n = 0;
/** A member straight into the database. */
async function member(name: string, extra: { branch?: string; joined?: number } = {}): Promise<U> {
  n += 1;
  const row = await m.db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, ?, ?, 'B.Tech', ?, 'alumnus', ?) returning id",
      `dm${n}@example.com`,
      name,
      extra.branch ?? "ECE",
      extra.branch ?? "ECE",
      extra.joined ?? 2000 + n, // a batch of their own, unless one is given
      Date.now() + n
    );
  return (await m.people.memberById(row!.id))!;
}

const connect = async (a: U, b: U) => {
  expect((await m.social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await m.social.acceptConnection(b, a.id)).ok).toBe(true);
};

let uploads = 0;
/** A photo of `u`'s, and a story made of it. */
async function story(u: U, caption = ""): Promise<{ id: number; media: string }> {
  uploads += 1;
  const media = `dmmedia${String(uploads).padStart(8, "0")}`;
  await m.db.db().run("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, 'image', 'image/jpeg', 1, 'x', ?)", media, u.id, Date.now());
  const made = await m.stories.createStory(u, media, caption);
  expect(made.ok).toBe(true);
  return { id: made.id!, media };
}

const messageNotes = async (u: U) => (await m.social.notificationsFor(u.id)).filter((x) => x.kind === "message");

beforeAll(async () => {
  m = {
    db: await import("../lib/server/db"),
    people: await import("../lib/server/people"),
    social: await import("../lib/server/social"),
    stories: await import("../lib/server/stories"),
    follows: await import("../lib/server/follows"),
    inbox: await import("../lib/server/inbox"),
    chat: await import("../lib/chat-format")
  };
});

describe("unread counts that clear", () => {
  it("opening a conversation also reads its 'new message' notification (the bell kept counting it)", async () => {
    const a = await member("Ira Reader");
    const b = await member("Jai Writer");
    await connect(a, b);
    const before = await m.social.unreadNotifications(a.id);
    await m.social.sendMessage(b, a.id, "hello");
    expect(await m.social.unreadNotifications(a.id)).toBe(before + 1);
    expect(await m.social.unreadMessages(a.id)).toBe(1);
    await m.social.thread(a, b.id);
    expect(await m.social.unreadMessages(a.id)).toBe(0);
    expect(await m.social.unreadNotifications(a.id)).toBe(before);
    expect((await messageNotes(a)).every((x) => x.read)).toBe(true);
  });

  it("messages from someone blocked, or suspended, don't hold the Messages badge up forever", async () => {
    const a = await member("Kavya Blocker");
    const b = await member("Lal Blocked");
    const c = await member("Mira Suspended");
    await connect(a, b);
    await connect(a, c);
    await m.social.sendMessage(b, a.id, "one");
    await m.social.sendMessage(c, a.id, "two");
    expect(await m.social.unreadMessages(a.id)).toBe(2);
    await m.social.block(a, b.id);
    await m.db.db().run("update users set suspended_at = ? where id = ?", Date.now(), c.id);
    // Neither conversation can be opened any more, so neither may count.
    expect(await m.social.unreadMessages(a.id)).toBe(0);
    expect((await m.social.pulseFor(a.id)).m).toBe(0);
    expect(await m.social.conversations(a)).toHaveLength(0);
  });

  it("one 'new message' notification while it waits unread, even once the messages were read elsewhere", async () => {
    const a = await member("Nila Busy");
    const b = await member("Om Chatty");
    await connect(a, b);
    await m.social.sendMessage(b, a.id, "first");
    // Read without opening the thread here (another device, an older page).
    await m.db.db().run("update messages set read_at = ? where recipient = ?", Date.now(), a.id);
    await m.social.sendMessage(b, a.id, "second");
    await m.social.sendMessage(b, a.id, "third");
    expect((await messageNotes(a)).filter((x) => !x.read)).toHaveLength(1);
    // Once that's read, the next message tells them again.
    await m.social.thread(a, b.id);
    await m.social.sendMessage(b, a.id, "fourth");
    expect((await messageNotes(a)).filter((x) => !x.read)).toHaveLength(1);
    expect((await messageNotes(a))[0].link).toBe(`/messages/${b.id}`);
  });

  it("the pulse sees a new message and 'Seen', so an open conversation updates without a reload", async () => {
    const a = await member("Pia Open");
    const b = await member("Ravi Other");
    await connect(a, b);
    await m.social.sendMessage(a, b.id, "are you there?");
    const sent = await m.social.pulseFor(a.id, b.id);
    expect(sent.t).toBeGreaterThan(0);
    expect(sent.s).toBe(0); // not read yet
    const theirs = await m.social.thread(b, a.id); // b reads it
    expect(theirs.at(-1)).toMatchObject({ mine: false, body: "are you there?" });
    const seen = await m.social.pulseFor(a.id, b.id);
    expect(seen.s).toBe(sent.t);
    expect((await m.social.thread(a, b.id)).at(-1)?.readAt).not.toBeNull();
    await m.social.sendMessage(b, a.id, "yes!");
    expect((await m.social.pulseFor(a.id, b.id)).t).toBeGreaterThan(sent.t);
    // Without a conversation, only the counts.
    expect(await m.social.pulseFor(a.id)).toMatchObject({ t: 0, s: 0 });
  });

  it("sending tells you why it didn't go", async () => {
    const a = await member("Sana Sender");
    const b = await member("Tara Stranger");
    expect(await m.social.sendMessage(a, b.id, "hi")).toEqual({ ok: false, error: expect.stringContaining("connections") });
    await connect(a, b);
    expect(await m.social.sendMessage(a, b.id, "   ")).toEqual({ ok: false, error: "Write something first." });
    expect(await m.social.sendMessage(a, 99_999_999, "hi")).toEqual({ ok: false, error: expect.stringContaining("isn't here") });
  });
});

describe("the inbox", () => {
  it("lists conversations with the last message, unread, and connections to write to", async () => {
    const a = await member("Uma Inbox");
    const b = await member("Vik Friend");
    const c = await member("Wasim Quiet");
    await connect(a, b);
    await connect(a, c);
    await m.social.sendMessage(b, a.id, "lunch tomorrow?");
    const box = await m.inbox.inboxFor(a);
    expect(box.conversations).toEqual([expect.objectContaining({ id: b.id, preview: "lunch tomorrow?", unread: 1, ago: "now" })]);
    expect(box.contacts.map((x) => x.id).sort()).toEqual([b.id, c.id].sort());
    await m.social.sendMessage(a, b.id, "sure");
    expect((await m.inbox.inboxFor(a)).conversations[0].preview).toBe("You: sure");
  });

  it("writes times as chat apps do", () => {
    const now = Date.UTC(2026, 9, 19, 6, 30); // 12:00 noon in India
    expect(m.chat.shortAgo(now - 30_000, now)).toBe("now");
    expect(m.chat.shortAgo(now - 5 * 60_000, now)).toBe("5m");
    expect(m.chat.shortAgo(now - 3 * 3_600_000, now)).toBe("3h");
    expect(m.chat.shortAgo(now - 2 * 86_400_000, now)).toBe("2d");
    expect(m.chat.shortAgo(now - 14 * 86_400_000, now)).toBe("2w");
    expect(m.chat.dayLabel(now - 3_600_000, now)).toBe("Today");
    // 11 pm yesterday in India is still "Yesterday", though it's the same day in UTC.
    expect(m.chat.dayLabel(Date.UTC(2026, 9, 18, 17, 30), now)).toBe("Yesterday");
    expect(m.chat.dayLabel(Date.UTC(2026, 9, 18, 19, 0), now)).toBe("Today");
    expect(m.chat.dayLabel(now - 30 * 86_400_000, now)).toMatch(/2026/);
    expect(m.chat.previewOf({ last: "❤️", mine: false, story: "reaction" })).toBe("Reacted ❤️ to your story");
    expect(m.chat.previewOf({ last: "great  shot", mine: true, story: "reply" })).toBe("You replied to their story: great shot");
  });
});

describe("story replies and reactions", () => {
  it("a reply or a reaction goes to the author as a message showing the story, and tells them", async () => {
    const author = await member("Xena Storyteller");
    const friend = await member("Yash Replier");
    await connect(author, friend);
    const s = await story(author, "At the old canteen");

    expect((await m.stories.replyToStory(friend, s.id, { text: "  Miss that place!  " })).ok).toBe(true);
    expect((await m.stories.replyToStory(friend, s.id, { reaction: "❤️" })).ok).toBe(true);

    const rows = await m.db.db().all<{ body: string; story_id: number; reaction: string | null }>(
      "select body, story_id, reaction from messages where sender = ? order by id",
      friend.id
    );
    expect(rows).toEqual([
      { body: "Miss that place!", story_id: s.id, reaction: null },
      { body: "❤️", story_id: s.id, reaction: "❤️" }
    ]);

    // The author sees the story beside each; told once, as for any message.
    const notes = await messageNotes(author);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: "Yash replied to your story.", link: `/messages/${friend.id}` });
    const seenByAuthor = await m.social.thread(author, friend.id);
    expect(seenByAuthor.map((x) => x.story)).toEqual([
      { id: s.id, mediaId: s.media, kind: "image", reaction: null },
      { id: s.id, mediaId: s.media, kind: "image", reaction: "❤️" }
    ]);
    expect((await m.social.conversations(author))[0]).toMatchObject({ story: "reaction", last: "❤️", mine: false });

    // A reaction on its own also says what it was.
    await m.social.thread(author, friend.id);
    await m.stories.replyToStory(friend, s.id, { reaction: "🔥" });
    expect((await messageNotes(author)).find((x) => !x.read)?.text).toBe("Yash reacted 🔥 to your story.");
  });

  it("only to connections, never your own story, only the six reactions, and not once it's gone", async () => {
    const author = await member("Zara Poster");
    const fan = await member("Aman Follower");
    const friend = await member("Bela Friend");
    await m.follows.follow(fan, author.id);
    await connect(author, friend);
    const s = await story(author);

    // A follower sees the story but isn't connected: no reply (messages are between connections).
    expect((await m.stories.storyBar(fan)).some((r) => r.author.id === author.id)).toBe(true);
    expect(await m.stories.replyToStory(fan, s.id, { text: "nice" })).toEqual({ ok: false, error: "Connect with Zara to reply to their story." });
    expect(await m.stories.replyToStory(author, s.id, { reaction: "❤️" })).toEqual({ ok: false, error: "That's your own story." });
    expect((await m.stories.replyToStory(friend, s.id, { reaction: "💩" })).ok).toBe(false);
    expect((await m.stories.replyToStory(friend, s.id, { text: "   " })).ok).toBe(false);
    expect((await m.stories.replyToStory(friend, 99_999_999, { text: "hi" })).ok).toBe(false);
    expect(await m.db.db().one("select 1 from messages where story_id = ?", s.id)).toBeUndefined();

    // Deleted: no more replies, and the reply already sent shows the story as gone.
    expect((await m.stories.replyToStory(friend, s.id, { text: "great" })).ok).toBe(true);
    await m.stories.removeStory(author, s.id);
    expect((await m.stories.replyToStory(friend, s.id, { text: "again" })).ok).toBe(false);
    expect((await m.social.thread(friend, author.id)).at(-1)?.story).toEqual({ id: s.id, mediaId: null, kind: null, reaction: null });
  });

  it("after a day the replier no longer sees the story's picture; its author still does", async () => {
    const author = await member("Chitra Old");
    const friend = await member("Dev Late");
    await connect(author, friend);
    const s = await story(author);
    await m.stories.replyToStory(friend, s.id, { text: "lovely" });
    await m.db.db().run("update stories set expires_at = ? where id = ?", Date.now() - 1000, s.id);
    expect((await m.social.thread(friend, author.id))[0].story?.mediaId).toBeNull();
    expect((await m.social.thread(author, friend.id))[0].story?.mediaId).toBe(s.media);
    expect((await m.stories.replyToStory(friend, s.id, { reaction: "👏" })).ok).toBe(false);
  });

  it("a block stops replies", async () => {
    const author = await member("Esha Blocks");
    const friend = await member("Faiz Blocked");
    await connect(author, friend);
    const s = await story(author);
    await m.social.block(author, friend.id);
    expect((await m.stories.replyToStory(friend, s.id, { text: "hey" })).ok).toBe(false);
  });
});

describe("whose stories show", () => {
  it("batchmates' stories show (they used to need a connection or a follow), strangers' and blocked ones' don't", async () => {
    const author = await member("Gauri Batch", { branch: "CSE", joined: 2014 });
    const mate = await member("Hamza Batch", { branch: "CSE", joined: 2014 });
    const otherYear = await member("Isha Junior", { branch: "CSE", joined: 2015 });
    const otherBranch = await member("Jatin Mech", { branch: "ME", joined: 2014 });
    const s = await story(author, "Reunion planning");

    expect((await m.stories.storyBar(mate)).some((r) => r.author.id === author.id)).toBe(true);
    expect(await m.stories.canSeeStoryMedia(mate, s.media)).toBe(true);
    expect((await m.stories.markSeen(mate, s.id)).ok).toBe(true);
    for (const stranger of [otherYear, otherBranch]) {
      expect((await m.stories.storyBar(stranger)).some((r) => r.author.id === author.id)).toBe(false);
      expect(await m.stories.canSeeStoryMedia(stranger, s.media)).toBe(false);
    }

    await m.social.block(mate, author.id);
    expect((await m.stories.storyBar(mate)).some((r) => r.author.id === author.id)).toBe(false);
    expect(await m.stories.canSeeStoryMedia(mate, s.media)).toBe(false);
  });
});
