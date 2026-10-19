import { beforeAll, describe, expect, it, vi } from "vitest";

/*
 * Security: who may do what is decided on the server, every time, from who's signed in,
 * never from what a page shows or what a form sends. Each test here is an attempt by one
 * member on another's things (their posts, comments, messages, groups, page, stories), or
 * by an ordinary member on the college desk's buttons; each must be refused and change
 * nothing. The server actions are called straight, as a script would, with forged ids.
 */

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "access-admin@example.com";

type U = import("../lib/server/auth").User;
let db: typeof import("../lib/server/db");
let people: typeof import("../lib/server/people");
let social: typeof import("../lib/server/social");
let posts: typeof import("../lib/server/posts");
let groups: typeof import("../lib/server/groups");
let desk: typeof import("../lib/server/desk");
let profile: typeof import("../lib/server/profile");
let asks: typeof import("../lib/server/asks");
let events: typeof import("../lib/server/events");
let stories: typeof import("../lib/server/stories");
let causes: typeof import("../lib/server/causes");
let follows: typeof import("../lib/server/follows");
let announcements: typeof import("../lib/server/announcements");
let staff: typeof import("../lib/server/staff");
let media: typeof import("../lib/server/media");

let n = 0;
async function member(name: string, extra: { role?: string; email?: string; branch?: string; joined?: number } = {}): Promise<U> {
  n += 1;
  const row = await db.db().one<{ id: number }>(
    "insert into users (email, name, branch, branch_name, programme, joined, role, auth_id, created_at) values (?, ?, ?, ?, 'B.Tech', ?, ?, ?::uuid, ?) returning id",
    extra.email ?? `acc${n}@example.com`,
    name,
    extra.branch ?? "CSE",
    extra.branch ?? "CSE",
    extra.joined ?? 2012,
    extra.role ?? "alumnus",
    crypto.randomUUID(),
    Date.now() + n
  );
  return (await people.memberById(row!.id))!;
}

const connect = async (a: U, b: U) => {
  expect((await social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await social.acceptConnection(b, a.id)).ok).toBe(true);
};

let uploads = 0;
async function upload(u: U, kind: "image" | "video" | "html" = "image"): Promise<string> {
  uploads += 1;
  const id = `accessupload${String(uploads).padStart(8, "0")}`;
  await db.db().run("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, ?, 'image/jpeg', 1, 'x/y.jpg', ?)", id, u.id, kind, Date.now());
  return id;
}

/** Makes `u` the one signed in (the stand-in Supabase's current browser), as for a request of theirs. */
async function actAs(u: U) {
  const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
  const authId = (await db.db().one<{ auth_id: string }>("select auth_id from users where id = ?", u.id))!.auth_id;
  auth.accounts.set(u.email, { authId, password: "a long test password", code: null });
  auth.use(`browser-${u.id}`);
  await auth.signInWithPassword(u.email, "a long test password");
}

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  db = await import("../lib/server/db");
  people = await import("../lib/server/people");
  social = await import("../lib/server/social");
  posts = await import("../lib/server/posts");
  groups = await import("../lib/server/groups");
  desk = await import("../lib/server/desk");
  profile = await import("../lib/server/profile");
  asks = await import("../lib/server/asks");
  events = await import("../lib/server/events");
  stories = await import("../lib/server/stories");
  causes = await import("../lib/server/causes");
  follows = await import("../lib/server/follows");
  announcements = await import("../lib/server/announcements");
  staff = await import("../lib/server/staff");
  media = await import("../lib/server/media");
});

describe("someone else's posts and comments", () => {
  it("can't be edited or deleted by anyone but their writer (or the group's admins, in a group)", async () => {
    const writer = await member("Wanda Writer");
    const mallory = await member("Mallory Meddler");
    const { id } = await posts.createPost(writer, "My words", "everyone");
    expect((await posts.editPost(mallory, id!, "Your words now")).ok).toBe(false);
    expect((await posts.removePost(mallory, id!)).ok).toBe(false);
    expect((await posts.addComment(writer, id!, "A comment")).ok).toBe(true);
    const comment = (await posts.postFor(writer, id!))!.comments[0];
    expect((await posts.editComment(mallory, comment.id, "changed")).ok).toBe(false);
    expect((await posts.removeOwnComment(mallory, comment.id)).ok).toBe(false);
    const after = (await posts.postFor(writer, id!))!;
    expect(after.body).toBe("My words");
    expect(after.comments.map((c) => c.body)).toEqual(["A comment"]);
    // An admin of some other group is nobody here.
    const g = await groups.createGroup(mallory, { name: "Mallory's group", about: "", kind: "open" });
    expect(g.ok).toBe(true);
    expect((await posts.removePost(mallory, id!)).ok).toBe(false);
    expect(await posts.postFor(writer, id!)).not.toBeNull();
    // Nor may anyone verify posts for the board but the desk.
    expect((await posts.verifyPost(mallory, id!, true)).ok).toBe(false);
    // Nor pin another's post to their own page.
    expect(await profile.ownPost(id!, mallory.id)).toBeNull();
  });

  it("connections-only and batch posts stay with their audience: no reading, reacting, commenting, reposting or sending", async () => {
    const author = await member("Cara Author", { branch: "ECE", joined: 2015 });
    const friend = await member("Fred Friend", { branch: "MECH", joined: 2001 });
    const batchmate = await member("Bea Batch", { branch: "ECE", joined: 2015 });
    const stranger = await member("Stan Stranger", { branch: "CIVIL", joined: 2009 });
    await connect(author, friend);
    const close = await posts.createPost(author, "For connections only", "connections");
    const batch = await posts.createPost(author, "For my batch", "batch");
    expect(await posts.postFor(friend, close.id!)).not.toBeNull();
    expect(await posts.postFor(batchmate, batch.id!)).not.toBeNull();
    expect(await posts.postFor(batchmate, close.id!)).toBeNull();
    for (const id of [close.id!, batch.id!]) {
      expect(await posts.postFor(stranger, id)).toBeNull();
      expect((await posts.react(stranger, id, "cheer")).ok).toBe(false);
      expect((await posts.addComment(stranger, id, "let me in")).ok).toBe(false);
      expect((await posts.repost(stranger, id)).ok).toBe(false);
      expect((await posts.sendPost(stranger, id, [friend.id])).ok).toBe(false);
      expect((await posts.askForReferral(stranger, id, "I would like to be referred for this role, please.")).ok).toBe(false);
    }
    expect((await posts.feedFor(stranger)).some((p) => p.author.id === author.id)).toBe(false);
    // A friend can't pass it on to someone it isn't for.
    await connect(friend, stranger);
    expect((await posts.sendPost(friend, close.id!, [stranger.id])).ok).toBe(false);
    // Its photos too.
    const photo = await upload(author);
    const withPhoto = await posts.createPost(author, "", "connections", [photo]);
    expect(withPhoto.ok).toBe(true);
    expect(await posts.canSeePostMedia(stranger, photo)).toBe(false);
    expect(await posts.canSeePostMedia(friend, photo)).toBe(true);
  });

  it("nobody posts someone else's upload, or one already on another post", async () => {
    const owner = await member("Olive Owner");
    const thief = await member("Theo Thief");
    const photo = await upload(owner);
    expect((await posts.createPost(thief, "look", "everyone", [photo])).ok).toBe(false);
    expect((await stories.createStory(thief, photo, "")).ok).toBe(false);
    expect((await causes.proposeCause(thief, { title: "A cause with a stolen cover", story: "x".repeat(60), goal: "5000", cover: photo, days: "30" })).ok).toBe(false);
    expect("error" in (await profile.parseProfile({ photo: { id: photo } }, thief.id))).toBe(true);
    expect("error" in (await profile.parseProfile({ cover: photo }, thief.id))).toBe(true);
    // A crop sent for someone else's photo changes nothing of theirs: the page saved is the sender's own.
    await media.removeMedia(thief.id, photo);
    expect(await media.mediaById(photo)).not.toBeNull();
    expect((await posts.createPost(owner, "mine", "everyone", [photo])).ok).toBe(true);
    expect((await posts.createPost(owner, "again", "everyone", [photo])).ok).toBe(false);
  });
});

describe("private messages", () => {
  it("only the two in a conversation read it; only the sender edits or deletes it for everyone", async () => {
    const a = await member("Alia Sender");
    const b = await member("Bo Recipient");
    const eve = await member("Eve Eavesdropper");
    await connect(a, b);
    expect((await social.sendMessage(a, b.id, "Our secret")).ok).toBe(true);
    const [message] = await social.thread(b, a.id);
    // Eve has no conversation with either, so there's nothing for her to open.
    expect(await social.thread(eve, a.id)).toEqual([]);
    expect(await social.thread(eve, b.id)).toEqual([]);
    expect((await social.conversations(eve)).length).toBe(0);
    expect((await social.editMessage(eve, message.id, "forged")).ok).toBe(false);
    expect((await social.editMessage(b, message.id, "forged")).ok).toBe(false); // the recipient isn't the sender
    expect((await social.deleteMessageForEveryone(eve, message.id)).ok).toBe(false);
    expect((await social.deleteMessageForEveryone(b, message.id)).ok).toBe(false);
    expect((await social.deleteMessageForMe(eve, message.id)).ok).toBe(false);
    expect((await desk.report(eve, "message", message.id, "spam")).ok).toBe(false); // not sent to her
    expect((await social.thread(a, b.id))[0]).toMatchObject({ body: "Our secret", deletedAt: null, editedAt: null });
    // Only connections can write at all.
    expect((await social.sendMessage(eve, a.id, "hello")).ok).toBe(false);
  });

  it("blocked members can't reach each other in any way", async () => {
    const a = await member("Ada Blocker");
    const b = await member("Bob Blocked");
    await connect(a, b);
    expect((await social.block(a, b.id)).ok).toBe(true);
    expect((await social.sendMessage(b, a.id, "let me explain")).ok).toBe(false);
    expect((await social.requestConnection(b, a.id, "again?")).ok).toBe(false);
    expect((await follows.follow(b, a.id)).ok).toBe(false);
    expect(await people.pageFor(b, a.id)).toBeNull();
    expect((await people.searchMembers(b, { q: "Ada" })).some((f) => f.member.id === a.id)).toBe(false);
    const post = await posts.createPost(a, "Public post", "everyone");
    expect(await posts.postFor(b, post.id!)).toBeNull();
    expect((await posts.addComment(b, post.id!, "hi")).ok).toBe(false);
    // A mention from the blocked one doesn't reach them, nor does any notification.
    const before = (await social.notificationsFor(a.id)).length;
    await posts.createPost(b, `Hello @[Ada](${a.id})`, "everyone");
    await social.notify(a.id, { actor: b.id, kind: "test", text: "sneaky", link: "/" });
    expect((await social.notificationsFor(a.id)).length).toBe(before);
  });

  it("notifications are each member's own", async () => {
    const a = await member("Nia Notified");
    const b = await member("Nate Nosy");
    await social.notify(a.id, { kind: "test", text: "for Nia", link: "/" });
    await social.markNotificationsRead(b.id);
    expect((await social.notificationsFor(a.id)).find((x) => x.text === "for Nia")?.read).toBe(false);
    expect((await social.notificationsFor(b.id)).some((x) => x.text === "for Nia")).toBe(false);
  });
});

describe("groups", () => {
  it("a private group: nothing inside for outsiders or those still asking; no letting yourself in or promoting yourself", async () => {
    const owner = await member("Gus Owner");
    const outsider = await member("Oscar Outsider");
    const { id } = await groups.createGroup(owner, { name: "Private circle", about: "secret", kind: "private" });
    const inside = await posts.createPost(owner, "Inside the circle", "everyone", [], id!);
    expect(await posts.postFor(outsider, inside.id!)).toBeNull();
    expect(await posts.feedFor(outsider, { groupId: id! })).toEqual([]);
    expect((await groups.groupMembers(outsider, id!)).members).toEqual([]);
    expect((await posts.createPost(outsider, "gatecrash", "everyone", [], id!)).ok).toBe(false);
    expect((await posts.addComment(outsider, inside.id!, "hi")).ok).toBe(false);
    // Asking puts them in as "pending" and a plain member, never more.
    expect((await groups.joinGroup(outsider, id!)).ok).toBe(true);
    expect((await groups.groupFor(outsider, id!))?.my).toEqual({ role: "member", status: "pending" });
    expect(await posts.postFor(outsider, inside.id!)).toBeNull();
    expect((await posts.createPost(outsider, "still outside", "everyone", [], id!)).ok).toBe(false);
    expect((await groups.answerRequest(outsider, id!, outsider.id, true)).ok).toBe(false);
    expect((await groups.setGroupRole(outsider, id!, outsider.id, "admin")).ok).toBe(false);
    expect((await groups.updateGroup(outsider, id!, { name: "Mine now", about: "", kind: "open" })).ok).toBe(false);
    expect((await groups.removeGroup(outsider, id!)).ok).toBe(false);
    expect((await groups.groupFor(owner, id!))).toMatchObject({ name: "Private circle", kind: "private" });
    // A member let in is still not an admin: they can't remove the owner, make admins, or delete others' posts.
    expect((await groups.answerRequest(owner, id!, outsider.id, true)).ok).toBe(true);
    expect((await groups.setGroupRole(outsider, id!, owner.id, "remove")).ok).toBe(false);
    expect((await posts.removePost(outsider, inside.id!)).ok).toBe(false);
    expect(await posts.postFor(owner, inside.id!)).not.toBeNull();
  });
});

describe("the college desk", () => {
  it("refuses every one of its buttons to an ordinary member, and shows them nothing", async () => {
    const plain = await member("Paul Plain");
    const victim = await member("Vic Victim");
    const post = await posts.createPost(victim, "Fine post", "everyone");
    const cause = await causes.proposeCause(victim, { title: "Library books", story: "y".repeat(80), goal: "5000", cover: "", days: "30" });
    const tried = [
      await desk.suspend(plain, victim.id, true),
      await desk.signOutEverywhere(plain, victim.id),
      await desk.setRole(plain, victim.id, "admin"),
      await desk.setRole(plain, plain.id, "admin"),
      await desk.deleteMember(plain, victim.id, victim.name),
      await desk.takeDown(plain, "post", post.id!),
      await desk.restore(plain, "post", post.id!),
      await desk.resolveReport(plain, 1, "remove"),
      await desk.updateSettings(plain, { joiningOpen: false, features: { notes: false, asks: false, events: false, messages: false }, dailyRequests: 1 }),
      await announcements.createAnnouncement(plain, { title: "Fake notice", body: "Send me money", days: 3 }),
      await announcements.removeAnnouncement(plain, 1),
      await causes.reviewCause(plain, cause.id!, true, ""),
      await causes.recordPayout(plain, cause.id!, "100", "mine"),
      await staff.inviteStaff(plain, { email: "friend@example.com", name: "My Friend", role: "admin", branch: "" }, "http://localhost"),
      await staff.revokeInvite(plain, "friend@example.com"),
      await posts.verifyPost(plain, post.id!, true),
      await events.createEvent(plain, { title: "Fake event", body: "", startsAt: "2030-01-01T10:00", endsAt: "", place: "Online", onlineLink: "", capacity: "" })
    ];
    for (const result of tried) expect(result.ok).toBe(false);
    expect(await desk.reports(plain)).toEqual([]);
    expect(await desk.deskMembers(plain, {})).toEqual([]);
    expect(await desk.memberDetail(plain, victim.id)).toBeNull();
    expect(await desk.auditLog(plain)).toEqual([]);
    expect(await desk.auditCsv(plain)).toBeNull();
    expect(await desk.stats(plain)).toBeNull();
    expect(await desk.team(plain)).toEqual([]);
    expect(await desk.recentContent(plain, "post")).toEqual([]);
    expect(await causes.donationsCsv(plain)).toBeNull();
    expect(await staff.invites(plain)).toEqual([]);
    // Nothing changed.
    expect(await people.memberById(victim.id)).toMatchObject({ role: "alumnus" });
    expect(await posts.postFor(victim, post.id!)).not.toBeNull();
    expect((await causes.causeFor(victim, cause.id!))?.status).toBe("pending");
  });

  it("each desk role acts only below itself", async () => {
    const coordinator = await member("Cole Coordinator", { role: "coordinator" });
    const other = await member("Cleo Coordinator", { role: "coordinator" });
    const admin = await member("Ada Admin", { email: "access-admin@example.com" });
    const target = await member("Tom Target");
    expect((await desk.setRole(coordinator, target.id, "coordinator")).ok).toBe(false); // only administrators change roles
    expect((await desk.suspend(coordinator, other.id, true)).ok).toBe(false); // an equal
    expect((await desk.suspend(coordinator, admin.id, true)).ok).toBe(false); // above them
    expect((await desk.setRole(admin, target.id, "admin")).ok).toBe(false); // only super administrators make administrators
    expect((await desk.deleteMember(admin, target.id, target.name)).ok).toBe(false); // super administrators only
    expect((await desk.setRole(admin, target.id, "coordinator")).ok).toBe(true);
  });
});

describe("Asks, events, stories and causes", () => {
  it("only the asker and the senior on it read the thread or change the question", async () => {
    const student = await member("Sam Student", { role: "student", joined: 2024 });
    const senior = await member("Sia Senior");
    const nosy = await member("Ned Nosy");
    const otherStudent = await member("Stu Student", { role: "student", joined: 2024 });
    const made = await asks.createAsk(student, { title: "How do I prepare for interviews?", body: "Details", topics: "" });
    expect((await asks.takeAsk(otherStudent, made.id!)).ok).toBe(false); // students don't answer
    expect((await asks.takeAsk(senior, made.id!)).ok).toBe(true);
    expect((await asks.replyToAsk(senior, made.id!, "Happy to help")).ok).toBe(true);
    expect(await asks.askFor(nosy, made.id!)).toBeNull();
    expect(await asks.askThread(nosy, made.id!)).toEqual([]);
    expect((await asks.replyToAsk(nosy, made.id!, "me too")).ok).toBe(false);
    expect((await asks.markAnswered(senior, made.id!, "I answered myself")).ok).toBe(false);
    await asks.closeAsk(nosy, made.id!);
    expect((await asks.askFor(student, made.id!))?.status).toBe("taken");
  });

  it("an event is changed only by its organiser (or the desk), and RSVPs are each member's own", async () => {
    const faculty = await member("Fay Faculty", { role: "faculty" });
    const student = await member("Sid Student", { role: "student", joined: 2024 });
    const made = await events.createEvent(faculty, { title: "Alumni meet", body: "", startsAt: "2031-01-01T10:00", endsAt: "", place: "Campus", onlineLink: "", capacity: "1" });
    expect(made.ok).toBe(true);
    expect((await events.cancelEvent(student, made.id!)).ok).toBe(false);
    expect(await events.attendees(student, made.id!)).toEqual([]);
    expect((await events.toggleRsvp(student, made.id!)).ok).toBe(true);
    expect((await events.eventById(faculty, made.id!))).toMatchObject({ going: 1, imGoing: false, cancelled: false });
  });

  it("a story is the author's: no one else deletes it, sees who looked, or sees it outside their circle", async () => {
    const author = await member("Ari Author", { branch: "ISE", joined: 2016 });
    const outsider = await member("Out Sider", { branch: "MECH", joined: 2003 });
    const photo = await upload(author);
    const made = await stories.createStory(author, photo, "Campus today");
    expect(made.ok).toBe(true);
    await stories.removeStory(outsider, made.id!);
    expect((await stories.reelOf(author, author.id))?.stories.length).toBe(1);
    expect(await stories.storyViewers(outsider, made.id!)).toEqual([]);
    expect(await stories.reelOf(outsider, author.id)).toBeNull();
    expect(await stories.canSeeStoryMedia(outsider, photo)).toBe(false);
    expect((await stories.replyToStory(outsider, made.id!, { text: "hi" })).ok).toBe(false);
    expect((await stories.markSeen(outsider, made.id!)).ok).toBe(false);
  });

  it("a cause is closed only by its author or the desk, and a pending one is theirs alone to see", async () => {
    const author = await member("Cat Cause");
    const other = await member("Oli Other");
    const made = await causes.proposeCause(author, { title: "Hostel fees", story: "z".repeat(80), goal: "20000", cover: "", days: "30" });
    expect(await causes.causeFor(other, made.id!)).toBeNull();
    expect((await causes.closeCause(other, made.id!)).ok).toBe(false);
    expect((await causes.startDonation(other, made.id!, { amount: "100", anonymous: false, message: "" })).ok).toBe(false);
    expect((await causes.causeFor(author, made.id!))?.status).toBe("pending");
  });
});

describe("the server actions, called straight with forged ids", () => {
  it("act only as whoever is signed in, on what's theirs", async () => {
    const owner = await member("Owen Owner");
    const attacker = await member("Ava Attacker");
    const friend = await member("Fran Friend");
    await connect(owner, friend);
    const post = await posts.createPost(owner, "Owner's post", "connections");
    await social.sendMessage(owner, friend.id, "Private words");
    const [message] = await social.thread(owner, friend.id);
    const content = await import("../lib/actions/content");
    const messages = await import("../lib/actions/messages");
    const deskActions = await import("../lib/actions/desk");
    const causeActions = await import("../lib/actions/causes");

    // Nobody signed in: every action says so.
    const auth = await (await import("../lib/server/auth-provider")).fakeAuth();
    auth.use("nobody");
    expect((await content.editPostNow(post.id!, "x"))?.ok).toBe(false);
    expect((await messages.sendMessageNow(friend.id, "x"))?.ok).toBe(false);

    await actAs(attacker);
    expect((await content.editPostNow(post.id!, "pwned"))?.ok).toBe(false);
    expect((await content.removePostNow(post.id!))?.ok).toBe(false);
    expect((await content.removePostAction(null, form({ id: String(post.id) })))?.ok).toBe(false);
    expect((await content.commentAction(null, form({ id: String(post.id), body: "hi" })))?.ok).toBe(false);
    expect((await content.reactNow(post.id!, "cheer"))?.ok).toBe(false);
    expect((await content.repostNow(post.id!))?.ok).toBe(false);
    expect((await content.sendPostAction(post.id!, [friend.id], ""))?.ok).toBe(false);
    expect((await messages.editMessageNow(message.id, "pwned"))?.ok).toBe(false);
    expect((await messages.deleteMessageNow(message.id, true))?.ok).toBe(false);
    expect((await messages.sendMessageNow(owner.id, "let me in"))?.ok).toBe(false);
    expect((await deskActions.pauseAction(null, form({ id: String(owner.id), paused: "1" })))?.ok).toBe(false);
    expect((await deskActions.roleAction(null, form({ id: String(attacker.id), role: "admin" })))?.ok).toBe(false);
    expect((await deskActions.takeDownAction(null, form({ id: String(post.id), kind: "post" })))?.ok).toBe(false);
    expect((await causeActions.confirmDonationNow("order_x", "pay_x", "stand-in"))?.ok).toBe(false);
    // Types a page would never send.
    expect((await content.editPostNow(String(post.id) as unknown as number, "x"))?.ok).toBe(false);
    expect((await messages.deleteMessageNow({ id: message.id } as unknown as number, true))?.ok).toBe(false);
    expect((await content.sendPostAction(post.id!, "1,2" as unknown as number[], ""))?.ok).toBe(false);
    auth.use("main");

    expect((await posts.postFor(owner, post.id!))?.body).toBe("Owner's post");
    expect((await social.thread(friend, owner.id))[0]).toMatchObject({ body: "Private words", deletedAt: null });
    expect(await people.memberById(owner.id)).not.toBeNull();
    expect((await people.memberById(attacker.id))?.role).toBe("alumnus");
  });
});
