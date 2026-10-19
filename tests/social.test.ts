import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres and the stand-in for Supabase Auth, set before the modules load. One administrator, by email.
process.env.ALUMNITY_DB = "pglite";
process.env.ALUMNITY_AUTH = "fake";
process.env.ALUMNITY_STORAGE = "folder";
process.env.ALUMNITY_ADMINS = "admin@example.com";
process.env.ALUMNITY_SUPER_ADMINS = "super@example.com";

type Mods = {
  db: typeof import("../lib/server/db");
  auth: typeof import("../lib/server/auth");
  people: typeof import("../lib/server/people");
  social: typeof import("../lib/server/social");
  posts: typeof import("../lib/server/posts");
  asks: typeof import("../lib/server/asks");
  events: typeof import("../lib/server/events");
  desk: typeof import("../lib/server/desk");
  profile: typeof import("../lib/server/profile");
  settings: typeof import("../lib/server/settings");
  announcements: typeof import("../lib/server/announcements");
  follows: typeof import("../lib/server/follows");
  stories: typeof import("../lib/server/stories");
};
let m: Mods;
type U = import("../lib/server/auth").User;

let n = 0;
/** A member straight into the database (joining itself is tested in auth.test.ts). */
async function member(name: string, extra: { role?: string; branch?: string; joined?: number; email?: string } = {}): Promise<U> {
  n += 1;
  const row = await m.db
    .db()
    .one<{ id: number }>(
      "insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, ?, ?, 'B.Tech', ?, ?, ?) returning id",
      extra.email ?? `m${n}@example.com`,
      name,
      extra.branch ?? "CSE",
      extra.branch ?? "CSE",
      extra.joined ?? 2012,
      extra.role ?? "alumnus",
      Date.now() + n
    );
  return (await m.people.memberById(row!.id))!;
}

/** The super administrator (by ALUMNITY_SUPER_ADMINS), created the first time it's needed. */
async function superUser(): Promise<U> {
  const row = await m.db.db().one<{ id: number }>("select id from users where email = 'super@example.com'");
  return row ? (await m.people.memberById(row.id))! : await member("Super Person", { email: "super@example.com" });
}

/** The one administrator (by ALUMNITY_ADMINS), created the first time it's needed. */
async function adminUser(): Promise<U> {
  const row = await m.db.db().one<{ id: number }>("select id from users where email = 'admin@example.com'");
  return row ? (await m.people.memberById(row.id))! : await member("Admin Person", { email: "admin@example.com" });
}

let uploads = 0;
/** An upload of `u`'s, straight into the media table (the rules only read its row). */
async function upload(u: U, kind: "image" | "video" | "html" = "image"): Promise<string> {
  uploads += 1;
  const id = `testmedia${String(uploads).padStart(6, "0")}`;
  await m.db.db().run("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, ?, 'image/jpeg', 1, 'x', ?)", id, u.id, kind, Date.now());
  return id;
}

const mentor = async (u: U, skills: string[]) =>
  await m.profile.saveProfile(u.id, { ...(await m.profile.profileOf(u.id)), skills, happyTo: { mentor: true, refer: false, talk: false } });

const fake = async () => (await import("../lib/server/auth-provider")).fakeAuth();

/** Signs `u` in on a browser of the stand-in Supabase (an account made for them the first time); returns their auth id. */
async function signIn(u: U, browser = `browser-${u.id}`): Promise<string> {
  const auth = await fake();
  let authId = (await m.db.db().one<{ auth_id: string | null }>("select auth_id from users where id = ?", u.id))?.auth_id;
  if (!authId) {
    authId = crypto.randomUUID();
    await m.db.db().run("update users set auth_id = ?::uuid where id = ?", authId, u.id);
    auth.accounts.set(u.email, { authId, password: "a long test password", code: null });
  }
  auth.use(browser);
  await auth.signInWithPassword(u.email, "a long test password");
  auth.use("main");
  return authId;
}

const connect = async (a: U, b: U) => {
  expect((await m.social.requestConnection(a, b.id, "hi")).ok).toBe(true);
  expect((await m.social.acceptConnection(b, a.id)).ok).toBe(true);
};

beforeAll(async () => {
  m = {
    db: await import("../lib/server/db"),
    auth: await import("../lib/server/auth"),
    people: await import("../lib/server/people"),
    social: await import("../lib/server/social"),
    posts: await import("../lib/server/posts"),
    asks: await import("../lib/server/asks"),
    events: await import("../lib/server/events"),
    desk: await import("../lib/server/desk"),
    profile: await import("../lib/server/profile"),
    settings: await import("../lib/server/settings"),
    announcements: await import("../lib/server/announcements"),
    follows: await import("../lib/server/follows"),
    stories: await import("../lib/server/stories")
  };
});

describe("connections and blocks", () => {
  it("a request carries its note, notifies, and accepting connects both ways", async () => {
    const a = await member("Asha Test");
    const b = await member("Bina Test");
    expect((await m.social.requestConnection(a, b.id, "  We were in the same lab  ")).ok).toBe(true);
    expect((await m.social.requestsFor(b)).received[0]).toMatchObject({ note: "We were in the same lab" });
    expect((await m.social.notificationsFor(b.id))[0].kind).toBe("connect-request");
    expect(await m.people.relation(a.id, b.id)).toBe("sent");
    expect((await m.social.requestConnection(a, b.id, "again")).ok).toBe(false); // already waiting
    expect((await m.social.acceptConnection(b, a.id)).ok).toBe(true);
    expect(await m.people.relation(a.id, b.id)).toBe("connected");
    expect(await m.people.relation(b.id, a.id)).toBe("connected");
  });

  it("declining is silent, and only the addressee can accept", async () => {
    const a = await member("Chetan Test");
    const b = await member("Divya Test");
    await m.social.requestConnection(a, b.id, "");
    expect((await m.social.acceptConnection(a, b.id)).ok).toBe(false); // a can't accept their own request
    await m.social.declineConnection(b, a.id);
    expect((await m.social.notificationsFor(a.id)).some((x) => x.kind.startsWith("connect"))).toBe(false);
    expect(await m.people.relation(a.id, b.id)).toBe("sent"); // to them it still looks sent…
    expect(await m.people.relation(b.id, a.id)).toBe("none"); // …and to b it's gone
    expect((await m.social.requestConnection(a, b.id, "please")).ok).toBe(false); // so no asking again
    await m.social.withdrawRequest(a, b.id);
    const before = (await m.social.notificationsFor(b.id)).filter((x) => x.kind === "connect-request").length;
    expect((await m.social.requestConnection(a, b.id, "one more time")).ok).toBe(true);
    expect((await m.social.notificationsFor(b.id)).filter((x) => x.kind === "connect-request")).toHaveLength(before); // not pinged again within a week
  });

  it("caps requests per day", async () => {
    const a = await member("Spammy Test");
    const results: boolean[] = [];
    for (let i = 0; i <= m.social.DAILY_REQUESTS; i++) results.push((await m.social.requestConnection(a, (await member(`Target ${i} Test`)).id, "")).ok);
    expect(results.filter(Boolean)).toHaveLength(m.social.DAILY_REQUESTS);
    expect(results.at(-1)).toBe(false);
  });

  it("a block ends the connection, and they vanish from each other's search, requests and messages", async () => {
    const a = await member("Esha Blocker");
    const b = await member("Farhan Blocked");
    await connect(a, b);
    expect((await m.social.block(a, b.id)).ok).toBe(true);
    expect(await m.people.relation(a.id, b.id)).toBe("blocked");
    expect(await m.people.relation(b.id, a.id)).toBe("blocked-by");
    expect(await m.people.searchMembers(b, { q: "Esha" })).toHaveLength(0);
    expect(await m.people.searchMembers(a, { q: "Farhan" })).toHaveLength(0);
    expect(await m.people.pageFor(b, a.id)).toBeNull();
    expect((await m.social.requestConnection(b, a.id, "")).ok).toBe(false);
    expect((await m.social.sendMessage(b, a.id, "hello")).ok).toBe(false);
    await m.social.unblock(a, b.id);
    expect(await m.people.relation(a.id, b.id)).toBe("none"); // unblocking doesn't reconnect
  });
});

describe("the fast relation look-up", () => {
  it("answers exactly like relation() in every state", async () => {
    const me = await member("Nia Viewer");
    const others = {
      none: await member("Rel None"),
      sent: await member("Rel Sent"),
      received: await member("Rel Received"),
      connected: await member("Rel Connected"),
      declinedByThem: await member("Rel DeclinedByThem"),
      declinedByMe: await member("Rel DeclinedByMe"),
      blocked: await member("Rel Blocked"),
      blockedBy: await member("Rel BlockedBy")
    };
    await m.social.requestConnection(me, others.sent.id, "");
    await m.social.requestConnection(others.received, me.id, "");
    await connect(me, others.connected);
    await m.social.requestConnection(me, others.declinedByThem.id, "");
    await m.social.declineConnection(others.declinedByThem, me.id);
    await m.social.requestConnection(others.declinedByMe, me.id, "");
    await m.social.declineConnection(me, others.declinedByMe.id);
    await m.social.block(me, others.blocked.id);
    await m.social.block(others.blockedBy, me.id);
    const fast = await m.people.relationsOf(me.id);
    for (const u of [...Object.values(others), me]) expect(fast(u.id), u.name).toBe(await m.people.relation(me.id, u.id));
  });
});

describe("messages", () => {
  it("only between connections; reading the thread marks it read; one notification until read", async () => {
    const a = await member("Gita Test");
    const b = await member("Hari Test");
    expect((await m.social.sendMessage(a, b.id, "hi")).ok).toBe(false);
    await connect(a, b);
    expect((await m.social.sendMessage(a, b.id, "   ")).ok).toBe(false);
    await m.social.sendMessage(a, b.id, "first");
    await m.social.sendMessage(a, b.id, "second");
    expect((await m.social.notificationsFor(b.id)).filter((x) => x.kind === "message")).toHaveLength(1);
    expect(await m.social.unreadMessages(b.id)).toBe(2);
    expect((await m.social.thread(b, a.id)).map((x) => x.body)).toEqual(["first", "second"]);
    expect(await m.social.unreadMessages(b.id)).toBe(0);
    expect((await m.social.conversations(b))[0]).toMatchObject({ last: "second", unread: 0 });
  });
});

describe("home notes", () => {
  it("each audience sees exactly what it should", async () => {
    const author = await member("Indu Author", { branch: "ECE", joined: 2015 });
    const batchmate = await member("Jai Batchmate", { branch: "ECE", joined: 2015 });
    const friend = await member("Kiran Friend", { branch: "ME", joined: 2001 });
    const stranger = await member("Lata Stranger", { branch: "CV", joined: 2019 });
    await connect(author, friend);
    await m.posts.createPost(author, "for everyone", "everyone");
    await m.posts.createPost(author, "for my batch", "batch");
    await m.posts.createPost(author, "for connections", "connections");
    const sees = async (u: U) => (await m.posts.feedFor(u, { authorId: author.id })).map((p) => p.body).sort();
    expect(await sees(author)).toEqual(["for connections", "for everyone", "for my batch"]);
    expect(await sees(batchmate)).toEqual(["for everyone", "for my batch"]);
    expect(await sees(friend)).toEqual(["for connections", "for everyone", "for my batch"]);
    expect(await sees(stranger)).toEqual(["for everyone"]);
  });

  it("no cheering or commenting on a note you can't see; only your own notes can be removed", async () => {
    const author = await member("Mohan Author", { branch: "ISE", joined: 2010 });
    const stranger = await member("Nisha Stranger", { branch: "CV", joined: 2020 });
    await m.posts.createPost(author, "connections only", "connections");
    const [post] = await m.posts.feedFor(author, { authorId: author.id });
    expect((await m.posts.toggleCheer(stranger, post.id)).ok).toBe(false);
    expect((await m.posts.addComment(stranger, post.id, "hi")).ok).toBe(false);
    await m.posts.removeOwnPost(stranger, post.id); // not theirs: nothing happens
    expect(await m.posts.feedFor(author, { authorId: author.id })).toHaveLength(1);
    await m.posts.removeOwnPost(author, post.id);
    expect(await m.posts.feedFor(author, { authorId: author.id })).toHaveLength(0);
  });

  it("a blocked member's comments and notifications don't reach you", async () => {
    const author = await member("Pia Author");
    const pest = await member("Quinn Pest");
    await m.posts.createPost(author, "public note", "everyone");
    const [post] = await m.posts.feedFor(author, { authorId: author.id });
    await m.posts.addComment(pest, post.id, "before the block");
    await m.social.block(author, pest.id);
    expect((await m.posts.feedFor(author, { authorId: author.id }))[0].comments).toEqual([]);
    expect((await m.posts.addComment(pest, post.id, "after the block")).ok).toBe(false); // can't even see it now
    expect((await m.social.notificationsFor(author.id)).some((x) => x.actor === pest.id)).toBe(false); // the old comment notification is hidden
    await m.social.notify(author.id, { actor: pest.id, kind: "test", text: "x", link: "/" });
    expect((await m.social.notificationsFor(author.id)).some((x) => x.actor === pest.id)).toBe(false);
  });

  it("a member whose batch isn't known can't post to it", async () => {
    const row = await m.db.db().one<{ id: number }>("insert into users (email, name, role, created_at) values ('nobatch@example.com', 'Ravi Nobatch', 'faculty', ?) returning id", Date.now());
    const faculty = (await m.people.memberById(row!.id))!;
    expect((await m.posts.createPost(faculty, "hello batch", "batch")).ok).toBe(false);
  });

  it("rejects empty notes and unknown audiences", async () => {
    const a = await member("Om Test");
    expect((await m.posts.createPost(a, "   ", "everyone")).ok).toBe(false);
    expect((await m.posts.createPost(a, "hello", "the whole internet")).ok).toBe(false);
  });
});

describe("ask a senior", () => {
  it("goes only to seniors who mentor, best fit first, never to the blocked", async () => {
    const student = await member("Pooja Student", { role: "student", branch: "CSE", joined: 2023 });
    const fit = await member("Quasim Fit", { branch: "CSE" });
    const lessFit = await member("Rekha Less", { branch: "ME" });
    const notMentoring = await member("Suresh Busy", { branch: "CSE" });
    const blocked = await member("Tara Blocked", { branch: "CSE" });
    const otherStudent = await member("Uma Student", { role: "student" });
    await mentor(fit, ["React", "Placements"]);
    await mentor(lessFit, ["Welding"]);
    await mentor(blocked, ["React"]);
    await mentor(otherStudent, ["React"]);
    await m.profile.saveProfile(notMentoring.id, { ...await m.profile.profileOf(notMentoring.id), skills: ["React"] });
    await m.social.block(blocked, student.id);
    const routes = (await m.asks.routeFor(student, "How do I prepare for React interviews?", ["React"])).map((r) => r.user.id);
    expect(routes[0]).toBe(fit.id);
    expect(routes).toContain(lessFit.id);
    expect(routes).not.toContain(notMentoring.id);
    expect(routes).not.toContain(blocked.id);
    expect(routes).not.toContain(otherStudent.id);
  });

  it("skips mentors with nothing in common when enough others fit", async () => {
    const student = await member("Dina Student", { role: "student", branch: "EEE", joined: 2024 });
    const a = await member("Ehsan Fit", { branch: "EEE" });
    const b = await member("Gauri Fit", { branch: "MECH" });
    const unrelated = await member("Hamid Unrelated", { branch: "CIVIL" });
    await mentor(a, ["Power systems"]);
    await mentor(b, ["GATE"]);
    await mentor(unrelated, ["Surveying"]);
    const routes = (await m.asks.routeFor(student, "GATE preparation tips", ["GATE"])).map((r) => r.user.id);
    expect(routes).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(routes).not.toContain(unrelated.id);
  });

  it("one senior takes it; the thread is private to the two; answering puts thanks on their Record", async () => {
    const student = await member("Varun Student", { role: "student" });
    const senior = await member("Wasim Senior");
    const second = await member("Yamini Senior");
    const outsider = await member("Zara Outsider");
    await mentor(senior, ["Careers"]);
    await mentor(second, ["Careers"]);
    const { id } = await m.asks.createAsk(student, { title: "Careers after CSE?", body: "What should I try first?", topics: "Careers" });
    expect(id).toBeTruthy();
    expect(await m.asks.askFor(outsider, id!)).toBeNull(); // not routed to them
    expect((await m.asks.takeAsk(student, id!)).ok).toBe(false); // students don't take Asks
    expect((await m.asks.takeAsk(senior, id!)).ok).toBe(true);
    expect((await m.asks.takeAsk(second, id!)).ok).toBe(false); // already taken
    expect(await m.asks.askFor(second, id!)).toBeNull(); // and now private
    expect((await m.asks.replyToAsk(second, id!, "me too")).ok).toBe(false);
    expect((await m.asks.replyToAsk(senior, id!, "Start with internships.")).ok).toBe(true);
    expect((await m.asks.askThread(student, id!)).map((x) => x.body)).toEqual(["Start with internships."]);
    expect(await m.asks.askThread(outsider, id!)).toEqual([]);
    expect((await m.asks.markAnswered(senior, id!, "self-thanks")).ok).toBe(false); // only the asker
    expect((await m.asks.markAnswered(student, id!, "Thank you, that helped!")).ok).toBe(true);
    expect(await m.asks.recordOf(senior.id)).toEqual({ count: 1, thanks: ["Thank you, that helped!"] }); // never the question or who asked
  });

  it("an Ask that fits nobody is open to any senior, but not to students", async () => {
    const student = await member("Abel Student", { role: "student" });
    const anySenior = await member("Bela Senior");
    const otherStudent = await member("Cyrus Student", { role: "student" });
    await m.db.db().run("update profiles set data = jsonb_set(data::jsonb, '{happyTo,mentor}', 'false')::text");
    const { id } = await m.asks.createAsk(student, { title: "Anything about hostels?", body: "Where to stay", topics: "" });
    expect(await m.asks.askFor(anySenior, id!)).not.toBeNull();
    expect(await m.asks.askFor(otherStudent, id!)).toBeNull();
  });
});

describe("fixes from the security review", () => {
  it("a block between asker and senior closes their thread to both", async () => {
    const student = await member("Ira Student", { role: "student" });
    const senior = await member("Jas Senior");
    await mentor(senior, ["Robotics"]);
    const { id } = await m.asks.createAsk(student, { title: "Robotics clubs?", body: "Which one", topics: "Robotics" });
    await m.asks.takeAsk(senior, id!);
    await m.asks.replyToAsk(senior, id!, "Try the IEEE one.");
    await m.social.block(student, senior.id);
    expect(await m.asks.askFor(senior, id!)).toBeNull();
    expect(await m.asks.askThread(senior, id!)).toEqual([]);
    expect(await m.asks.askThread(student, id!)).toEqual([]);
    expect((await m.asks.replyToAsk(senior, id!, "still here")).ok).toBe(false);
  });

  it("cheering again doesn't ping the author again", async () => {
    const author = await member("Kavya Author");
    const fan = await member("Leo Fan");
    await m.posts.createPost(author, "cheer me", "everyone");
    const [post] = await m.posts.feedFor(fan, { authorId: author.id });
    for (let i = 0; i < 6; i++) await m.posts.toggleCheer(fan, post.id);
    expect((await m.social.notificationsFor(author.id)).filter((x) => x.kind === "cheer")).toHaveLength(1);
  });

  it("you can't report what you can't see", async () => {
    const author = await member("Mira Author");
    const stranger = await member("Noor Stranger");
    const friend = await member("Ojas Friend");
    await connect(author, friend);
    await m.posts.createPost(author, "connections only", "connections");
    const [post] = await m.posts.feedFor(author, { authorId: author.id });
    expect((await m.desk.report(stranger, "post", post.id, "x")).ok).toBe(false);
    expect((await m.desk.report(friend, "post", post.id, "x")).ok).toBe(true);
    const { id: askId } = await m.asks.createAsk(await member("Pia Student", { role: "student" }), { title: "Private", body: "q", topics: "" });
    expect((await m.desk.report(await member("Raj Student", { role: "student" }), "ask", askId!, "x")).ok).toBe(false);
  });

  it("coordinators can't pause other coordinators; administrators can", async () => {
    const a = await member("Sia Coordinator", { role: "coordinator" });
    const b = await member("Tom Coordinator", { role: "coordinator" });
    expect((await m.desk.suspend(a, b.id, true)).ok).toBe(false);
    const admin = await adminUser();
    expect((await m.desk.suspend(admin, b.id, true)).ok).toBe(true);
    await m.desk.suspend(admin, b.id, false);
  });

  it("no messages to a paused member, and an Ask stays readable when its senior is paused", async () => {
    const admin = await adminUser();
    const student = await member("Uday Student", { role: "student" });
    const senior = await member("Vani Senior");
    await connect(student, senior);
    await mentor(senior, ["Chess"]);
    const { id } = await m.asks.createAsk(student, { title: "Chess club?", body: "q", topics: "Chess" });
    await m.asks.takeAsk(senior, id!);
    await m.asks.replyToAsk(senior, id!, "Yes, Fridays.");
    await m.desk.suspend(admin, senior.id, true);
    expect((await m.social.sendMessage(student, senior.id, "hello")).ok).toBe(false);
    expect((await m.asks.askFor(student, id!))!.taker?.id).toBe(senior.id);
    expect((await m.asks.askThread(student, id!)).map((x) => x.body)).toEqual(["Yes, Fridays."]);
    await m.desk.suspend(admin, senior.id, false);
  });
});

describe("events", () => {
  const input = (over: Partial<Record<string, string>> = {}) => ({
    title: "Reunion 2012",
    body: "Line one\nLine two; with, commas",
    startsAt: "2099-11-02T18:30",
    endsAt: "",
    place: "Seminar hall",
    onlineLink: "",
    capacity: "1",
    ...over
  });

  it("only faculty, coordinators and administrators put events up", async () => {
    expect((await m.events.createEvent(await member("Dev Alumnus"), input())).ok).toBe(false);
    expect((await m.events.createEvent(await member("Ela Faculty", { role: "faculty" }), input())).ok).toBe(true);
  });

  it("checks its fields: dates, links, capacity", async () => {
    const f = await member("Fiza Faculty", { role: "faculty" });
    expect((await m.events.createEvent(f, input({ startsAt: "tomorrow" }))).ok).toBe(false);
    expect((await m.events.createEvent(f, input({ startsAt: "2001-01-01T10:00" }))).ok).toBe(false);
    expect((await m.events.createEvent(f, input({ endsAt: "2099-11-02T17:00" }))).ok).toBe(false);
    expect((await m.events.createEvent(f, input({ onlineLink: "javascript:alert(1)" }))).ok).toBe(false);
    expect((await m.events.createEvent(f, input({ capacity: "-3" }))).ok).toBe(false);
  });

  it("cancelling twice tells people once; a lone carriage return can't add calendar lines", async () => {
    const f = await member("Uma Faculty", { role: "faculty" });
    const { id } = await m.events.createEvent(f, input({ title: "Talk\rLOCATION:Somewhere else", capacity: "" }));
    const guest = await member("Vik Guest");
    await m.events.toggleRsvp(guest, id!);
    await m.events.cancelEvent(f, id!);
    await m.events.cancelEvent(f, id!);
    expect((await m.social.notificationsFor(guest.id)).filter((x) => x.kind === "event-cancelled")).toHaveLength(1);
    const ics = m.events.eventIcs((await m.events.eventById(f, id!))!, "https://example.com");
    expect(ics.split("\r\n").filter((l) => l.startsWith("LOCATION:"))).toHaveLength(1);
  });

  it("holds its capacity; RSVP toggles; the calendar file can't be broken by its text", async () => {
    const f = await member("Gopal Faculty", { role: "faculty" });
    const { id } = await m.events.createEvent(f, input({ title: "Meet\r\nBEGIN:VEVENT" }));
    const a = await member("Hema Test");
    const b = await member("Imran Test");
    expect((await m.events.toggleRsvp(a, id!)).ok).toBe(true);
    expect((await m.events.toggleRsvp(b, id!)).ok).toBe(false); // full
    expect((await m.events.toggleRsvp(a, id!)).ok).toBe(true); // a steps back
    expect((await m.events.toggleRsvp(b, id!)).ok).toBe(true); // room for b
    expect(await m.events.attendees(a, id!)).toEqual([]); // only the organiser sees who
    expect((await m.events.attendees(f, id!)).map((u) => u.id)).toEqual([b.id]);
    const ics = m.events.eventIcs((await m.events.eventById(f, id!))!, "https://example.com");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(ics).toContain("SUMMARY:Meet\\nBEGIN:VEVENT");
    expect(ics).toContain("with\\, commas");
    expect(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
  });
});

describe("the college desk", () => {
  it("reports: not your own things, only messages sent to you, and a reason", async () => {
    const a = await member("Jaya Test");
    const b = await member("Kunal Test");
    await connect(a, b);
    await m.posts.createPost(b, "something rude", "everyone");
    const [post] = await m.posts.feedFor(a, { authorId: b.id });
    expect((await m.desk.report(b, "post", post.id, "spam")).ok).toBe(false); // own
    expect((await m.desk.report(a, "post", post.id, "  ")).ok).toBe(false); // no reason
    expect((await m.desk.report(a, "post", post.id, "rude")).ok).toBe(true);
    await m.social.sendMessage(b, a.id, "rude message");
    const messageId = (await m.db.db().one<{ id: number }>("select id from messages where sender = ?", b.id))!.id;
    const c = await member("Leela Test");
    expect((await m.desk.report(c, "message", messageId, "rude")).ok).toBe(false); // not sent to c
    expect((await m.desk.report(a, "message", messageId, "rude")).ok).toBe(true);
    expect((await m.desk.report(a, "nonsense", 1, "x")).ok).toBe(false);
  });

  it("only coordinators act on reports; removing takes the note down and is audited", async () => {
    const reporter = await member("Manu Test");
    const author = await member("Nalini Test");
    const coordinator = await member("Ojas Coordinator", { role: "coordinator" });
    const admin = await adminUser();
    await m.posts.createPost(author, "take me down", "everyone");
    const [post] = await m.posts.feedFor(reporter, { authorId: author.id });
    await m.desk.report(reporter, "post", post.id, "spam");
    expect(await m.desk.reports(reporter)).toEqual([]); // members see no reports
    const [r] = (await m.desk.reports(coordinator)).filter((x) => x.subjectId === post.id);
    expect((await m.desk.resolveReport(reporter, r.id, "remove")).ok).toBe(false);
    expect((await m.desk.resolveReport(coordinator, r.id, "remove")).ok).toBe(true);
    expect(await m.posts.feedFor(reporter, { authorId: author.id })).toHaveLength(0);
    expect(await m.desk.auditLog(coordinator)).toEqual([]); // the log is for administrators
    expect((await m.desk.auditLog(admin))[0]).toMatchObject({ action: "removed", subject: `post ${post.id}`, actor: "Ojas Coordinator" });
  });

  it("pausing signs a member out and hides them; only administrators change roles", async () => {
    const coordinator = await member("Pari Coordinator", { role: "coordinator" });
    const admin = await adminUser();
    expect(admin.role).toBe("admin");
    const target = await member("Rohan Target");
    const viewer = await member("Sana Viewer");
    const targetAuth = await signIn(target);
    expect((await m.desk.suspend(viewer, target.id, true)).ok).toBe(false);
    expect((await m.desk.suspend(coordinator, target.id, true)).ok).toBe(true);
    expect(await (await fake()).sessionsOf(targetAuth)).toBe(0);
    expect(await m.people.searchMembers(viewer, { q: "Rohan" })).toHaveLength(0);
    expect((await m.desk.suspend(coordinator, admin.id, true)).ok).toBe(false); // can't pause an admin
    expect((await m.desk.setRole(coordinator, viewer.id, "coordinator")).ok).toBe(false);
    expect((await m.desk.setRole(admin, viewer.id, "admin")).ok).toBe(false); // admins come from the env only
    expect((await m.desk.setRole(admin, viewer.id, "faculty")).ok).toBe(true);
    expect((await m.people.memberById(viewer.id))!.role).toBe("faculty");
    expect(await m.desk.stats(viewer)).toBeNull();
    expect((await m.desk.stats(admin))!.paused).toBeGreaterThan(0);
  });
});

describe("the admin ladder", () => {
  it("roles come from one ladder: each acts only on those below, and gives only roles below", async () => {
    const sup = await superUser();
    const admin = await adminUser();
    expect(sup.role).toBe("superadmin");
    const coordinator = await member("Uma Coord", { role: "coordinator" });
    const plain = await member("Vimal Plain");
    // Administrators make coordinators, not administrators.
    expect((await m.desk.setRole(admin, plain.id, "coordinator")).ok).toBe(true);
    expect((await m.desk.setRole(admin, plain.id, "admin")).ok).toBe(false);
    // Coordinators can't change roles at all.
    expect((await m.desk.setRole(coordinator, plain.id, "alumnus")).ok).toBe(false);
    // Super administrators make (and unmake) administrators.
    expect((await m.desk.setRole(sup, plain.id, "admin")).ok).toBe(true);
    const appointed = (await m.people.memberById(plain.id))!;
    expect(appointed.role).toBe("admin");
    expect((await m.desk.setRole(admin, appointed.id, "alumnus")).ok).toBe(false); // an admin can't demote a peer
    expect((await m.desk.suspend(admin, appointed.id, true)).ok).toBe(false); // nor pause one
    expect((await m.desk.setRole(sup, appointed.id, "alumnus")).ok).toBe(true);
    // Nobody can be made a super administrator from the site, and config roles can't be changed.
    expect((await m.desk.setRole(sup, plain.id, "superadmin")).ok).toBe(false);
    expect((await m.desk.setRole(sup, admin.id, "alumnus")).ok).toBe(false);
    expect((await m.desk.suspend(sup, admin.id, true)).ok).toBe(true); // but a super administrator can pause an admin
    await m.desk.suspend(sup, admin.id, false);
    expect((await m.desk.suspend(admin, sup.id, true)).ok).toBe(false); // nobody pauses a super administrator
    expect((await m.desk.setRole(sup, sup.id, "alumnus")).ok).toBe(false);
  });

  it("only super administrators change settings, and the rules obey them", async () => {
    const sup = await superUser();
    const admin = await adminUser();
    const a = await member("Wren Test");
    const b = await member("Xia Test");
    await connect(a, b);
    const off = { ...m.settings.DEFAULT_SETTINGS, joiningOpen: false, features: { notes: false, asks: false, events: false, messages: false }, dailyRequests: 1 };
    expect((await m.desk.updateSettings(admin, off)).ok).toBe(false);
    expect((await m.desk.updateSettings(sup, off)).ok).toBe(true);
    expect((await m.posts.createPost(a, "hello", "everyone")).ok).toBe(false);
    expect((await m.social.sendMessage(a, b.id, "hello")).ok).toBe(false);
    expect((await m.asks.createAsk(a, { title: "t", body: "b", topics: "" })).ok).toBe(false);
    expect((await m.events.createEvent(await member("Yash Faculty", { role: "faculty" }), { title: "t", body: "", startsAt: "2099-01-01T10:00", endsAt: "", place: "p", onlineLink: "", capacity: "" })).ok).toBe(false);
    expect((await m.auth.startJoin({ name: "Anyone", usn: "1HK00XX000", email: "new@example.com", ip: "9" })).ok).toBe(false);
    const c = await member("Zoe Test");
    const d = await member("Ada Test");
    const e = await member("Ben Test");
    expect((await m.social.requestConnection(c, d.id, "")).ok).toBe(true);
    expect((await m.social.requestConnection(c, e.id, "")).ok).toBe(false); // the daily limit is now 1
    expect((await m.desk.updateSettings(sup, { ...off, dailyRequests: 0 })).ok).toBe(false); // out of range
    expect((await m.desk.updateSettings(sup, m.settings.DEFAULT_SETTINGS)).ok).toBe(true);
    expect((await m.posts.createPost(a, "hello again", "everyone")).ok).toBe(true);
    expect((await m.desk.auditLog(sup, { q: "changed settings" })).length).toBeGreaterThanOrEqual(2);
  });

  it("taking something down tells its author; only administrators bring it back", async () => {
    const author = await member("Cara Author");
    const coordinator = await member("Dev Coord", { role: "coordinator" });
    await m.posts.createPost(author, "borderline", "everyone");
    const [post] = await m.posts.feedFor(author, { authorId: author.id });
    expect((await m.desk.takeDown(author, "post", post.id)).ok).toBe(false);
    expect((await m.desk.takeDown(coordinator, "post", post.id)).ok).toBe(true);
    expect((await m.social.notificationsFor(author.id))[0].kind).toBe("removed");
    expect((await m.desk.restore(coordinator, "post", post.id)).ok).toBe(false);
    expect((await m.desk.restore(await adminUser(), "post", post.id)).ok).toBe(true);
    expect(await m.posts.feedFor(author, { authorId: author.id })).toHaveLength(1);
  });

  it("deleting a member is for super administrators, with their name typed, and is audited", async () => {
    const sup = await superUser();
    const target = await member("Esha Delete");
    expect((await m.desk.deleteMember(await adminUser(), target.id, "Esha Delete")).ok).toBe(false);
    expect((await m.desk.deleteMember(sup, target.id, "esha")).ok).toBe(false);
    expect((await m.desk.deleteMember(sup, target.id, "Esha Delete")).ok).toBe(true);
    expect(await m.people.memberById(target.id)).toBeNull();
    expect((await m.desk.auditLog(sup, { q: "deleted member" }))[0].detail).toBe("Esha Delete");
  });

  it("signing out everywhere ends every session; announcements are the desk's", async () => {
    const coordinator = await member("Fay Coord", { role: "coordinator" });
    const target = await member("Gus Target");
    const targetAuth = await signIn(target, "phone");
    await signIn(target, "laptop");
    expect(await (await fake()).sessionsOf(targetAuth)).toBe(2);
    expect((await m.desk.signOutEverywhere(await member("Hal Plain"), target.id)).ok).toBe(false);
    expect((await m.desk.signOutEverywhere(coordinator, target.id)).ok).toBe(true);
    expect(await (await fake()).sessionsOf(targetAuth)).toBe(0);
    expect((await m.announcements.createAnnouncement(target, { title: "Hi", body: "x", days: 3 })).ok).toBe(false);
    expect((await m.announcements.createAnnouncement(coordinator, { title: "Alumni Day", body: "14 Dec", days: 3 })).ok).toBe(true);
    expect((await m.announcements.activeAnnouncements())[0].title).toBe("Alumni Day");
    expect(await m.announcements.activeAnnouncements(Date.now() + 4 * 24 * 60 * 60_000)).toHaveLength(0); // it ends
  });

  it("the audit spreadsheet can't run formulas, and only administrators get it", async () => {
    const sup = await superUser();
    const evil = await member("=HYPERLINK(1)");
    await m.desk.suspend(sup, evil.id, true);
    expect(await m.desk.auditCsv(await member("Ivy Coord", { role: "coordinator" }))).toBeNull();
    const csv = (await m.desk.auditCsv(sup))!;
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv).not.toMatch(/,"=HYPERLINK/);
  });
});

describe("posts with photos, reactions and mentions", () => {
  it("a post can carry up to ten of your own photos, each used once", async () => {
    const a = await member("Ana Photos");
    const b = await member("Bo Other");
    const mine = [await upload(a), await upload(a, "video")];
    const res = await m.posts.createPost(a, "", "everyone", mine);
    expect(res.ok).toBe(true);
    expect((await m.posts.postFor(a, res.id!))!.media.map((x) => x.id)).toEqual(mine);
    expect((await m.posts.createPost(a, "again", "everyone", [mine[0]])).ok).toBe(false); // already posted
    expect((await m.posts.createPost(a, "theirs", "everyone", [await upload(b)])).ok).toBe(false); // not yours
    expect((await m.posts.createPost(a, "html", "everyone", [await upload(a, "html")])).ok).toBe(false);
    expect((await m.posts.createPost(a, "eleven", "everyone", await Promise.all(Array.from({ length: 11 }, () => upload(a))))).ok).toBe(false);
    expect((await m.posts.createPost(a, "", "everyone")).ok).toBe(false); // nothing at all
  });

  it("only those who may see a post may open its photos", async () => {
    const author = await member("Cy Private");
    const friend = await member("Di Friend");
    const stranger = await member("Ed Stranger");
    await connect(author, friend);
    const photo = await upload(author);
    await m.posts.createPost(author, "connections only", "connections", [photo]);
    expect(await m.posts.canSeePostMedia(friend, photo)).toBe(true);
    expect(await m.posts.canSeePostMedia(stranger, photo)).toBe(false);
    expect(await m.posts.canSeePostMedia(stranger, await upload(author))).toBeNull(); // not on any post
  });

  it("one reaction each: the same again takes it back, another replaces it", async () => {
    const author = await member("Fe Author");
    const fan = await member("Gil Fan");
    const { id } = await m.posts.createPost(author, "react to me", "everyone");
    await m.posts.react(fan, id!, "proud");
    expect(await m.posts.postFor(fan, id!)).toMatchObject({ myReaction: "proud", reactionCount: 1, reactions: { proud: 1 } });
    await m.posts.react(fan, id!, "congrats");
    expect(await m.posts.postFor(fan, id!)).toMatchObject({ myReaction: "congrats", reactionCount: 1, reactions: { congrats: 1 } });
    await m.posts.react(fan, id!, "congrats");
    expect(await m.posts.postFor(fan, id!)).toMatchObject({ myReaction: null, reactionCount: 0 });
    expect((await m.posts.react(fan, id!, "angry")).ok).toBe(false);
    expect((await m.social.notificationsFor(author.id)).filter((x) => x.kind === "cheer")).toHaveLength(1);
  });

  it("mentions: tidied to the real name, told only if they can see it, never for the blocked", async () => {
    const author = await member("Hana Writer");
    const friend = await member("Ivo Friend");
    const stranger = await member("Jo Stranger");
    const blocker = await member("Kai Blocker");
    await connect(author, friend);
    await m.social.block(blocker, author.id);
    const body = `Thanks @[ivo](${friend.id}) and @[Jo](${stranger.id}) and @[Kai](${blocker.id}) and @[Ghost](999999)`;
    const { id } = await m.posts.createPost(author, body, "connections");
    const post = (await m.posts.postFor(author, id!))!;
    expect(post.body).toBe(`Thanks @[Ivo Friend](${friend.id}) and @[Jo Stranger](${stranger.id}) and @Kai and @Ghost`);
    expect((await m.social.notificationsFor(friend.id)).some((x) => x.kind === "mention")).toBe(true);
    expect((await m.social.notificationsFor(stranger.id)).some((x) => x.kind === "mention")).toBe(false); // can't see a connections-only post
    expect((await m.social.notificationsFor(blocker.id)).some((x) => x.kind === "mention")).toBe(false);
  });
});

describe("following", () => {
  it("is one way, tells them once, shows in the Following feed, and a block ends it", async () => {
    const fan = await member("Lu Fan");
    const senior = await member("Mo Senior");
    const other = await member("Ny Other");
    expect((await m.follows.follow(fan, senior.id)).ok).toBe(true);
    await m.follows.unfollow(fan, senior.id);
    await m.follows.follow(fan, senior.id);
    expect((await m.social.notificationsFor(senior.id)).filter((x) => x.kind === "follow")).toHaveLength(1);
    expect(await m.follows.followCounts(senior.id)).toEqual({ followers: 1, following: 0 });
    expect(await m.people.relation(fan.id, senior.id)).toBe("none"); // following isn't connecting
    await m.posts.createPost(senior, "from the senior", "everyone");
    await m.posts.createPost(other, "from someone else", "everyone");
    const following = (await m.posts.feedFor(fan, { scope: "following" })).map((p) => p.body);
    expect(following).toContain("from the senior");
    expect(following).not.toContain("from someone else");
    await m.social.block(senior, fan.id);
    expect(await m.follows.isFollowing(fan.id, senior.id)).toBe(false);
    expect((await m.follows.follow(fan, senior.id)).ok).toBe(false);
  });
});

describe("stories", () => {
  it("connections and followers see them; others don't; the author sees who looked", async () => {
    const author = await member("Oz Story");
    const friend = await member("Pa Friend");
    const fan = await member("Qi Fan");
    const stranger = await member("Ro Stranger");
    await connect(author, friend);
    await m.follows.follow(fan, author.id);
    const photo = await upload(author);
    const { id } = await m.stories.createStory(author, photo, "At the old canteen");
    expect((await m.stories.storyBar(friend)).find((r) => r.author.id === author.id)?.allSeen).toBe(false);
    expect((await m.stories.storyBar(fan)).some((r) => r.author.id === author.id)).toBe(true);
    expect((await m.stories.storyBar(stranger)).some((r) => r.author.id === author.id)).toBe(false);
    expect((await m.stories.markSeen(stranger, id!)).ok).toBe(false);
    expect(await m.stories.canSeeStoryMedia(stranger, photo)).toBe(false);
    await m.stories.markSeen(friend, id!);
    expect((await m.stories.storyBar(friend)).find((r) => r.author.id === author.id)?.allSeen).toBe(true);
    expect((await m.stories.storyViewers(author, id!)).map((u) => u.id)).toEqual([friend.id]);
    expect(await m.stories.storyViewers(friend, id!)).toEqual([]); // only the author may ask
    expect((await m.stories.storyBar(author))[0]).toMatchObject({ mine: true });
  });

  it("go after a day, can't reuse a photo, and only your own uploads", async () => {
    const author = await member("Sa Story");
    const friend = await member("Ti Friend");
    await connect(author, friend);
    const photo = await upload(author);
    await m.stories.createStory(author, photo, "");
    expect((await m.stories.createStory(author, photo, "again")).ok).toBe(false);
    expect((await m.stories.createStory(author, await upload(friend), "theirs")).ok).toBe(false);
    const tomorrow = Date.now() + m.stories.STORY_LIFE + 1000;
    expect((await m.stories.storyBar(friend, tomorrow)).some((r) => r.author.id === author.id)).toBe(false);
  });
});
