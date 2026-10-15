import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// A throwaway database, set before the modules load. One administrator, by email.
const dir = mkdtempSync(join(tmpdir(), "alumnity-social-"));
process.env.ALUMNITY_DB = join(dir, "test.db");
process.env.ALUMNITY_OUTBOX = join(dir, "outbox");
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
function member(name: string, extra: { role?: string; branch?: string; joined?: number; email?: string } = {}): U {
  n += 1;
  const { lastInsertRowid } = m.db
    .database()
    .prepare("insert into users (email, password_hash, name, branch, branch_name, programme, joined, role, created_at) values (?, 'x', ?, ?, ?, 'B.Tech', ?, ?, ?)")
    .run(extra.email ?? `m${n}@example.com`, name, extra.branch ?? "CSE", extra.branch ?? "CSE", extra.joined ?? 2012, extra.role ?? "alumnus", Date.now() + n);
  return m.people.memberById(Number(lastInsertRowid))!;
}

/** The super administrator (by ALUMNITY_SUPER_ADMINS), created the first time it's needed. */
function superUser(): U {
  const row = m.db.database().prepare("select id from users where email = 'super@example.com'").get() as { id: number } | undefined;
  return row ? m.people.memberById(row.id)! : member("Super Person", { email: "super@example.com" });
}

/** The one administrator (by ALUMNITY_ADMINS), created the first time it's needed. */
function adminUser(): U {
  const row = m.db.database().prepare("select id from users where email = 'admin@example.com'").get() as { id: number } | undefined;
  return row ? m.people.memberById(row.id)! : member("Admin Person", { email: "admin@example.com" });
}

let uploads = 0;
/** An upload of `u`'s, straight into the media table (the rules only read its row). */
function upload(u: U, kind: "image" | "video" | "html" = "image"): string {
  uploads += 1;
  const id = `testmedia${String(uploads).padStart(6, "0")}`;
  m.db.database().prepare("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, ?, 'image/jpeg', 1, 'x', ?)").run(id, u.id, kind, Date.now());
  return id;
}

const mentor = (u: U, skills: string[]) => m.profile.saveProfile(u.id, { ...m.profile.profileOf(u.id), skills, happyTo: { mentor: true, refer: false, talk: false } });

const connect = (a: U, b: U) => {
  expect(m.social.requestConnection(a, b.id, "hi").ok).toBe(true);
  expect(m.social.acceptConnection(b, a.id).ok).toBe(true);
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
  it("a request carries its note, notifies, and accepting connects both ways", () => {
    const a = member("Asha Test");
    const b = member("Bina Test");
    expect(m.social.requestConnection(a, b.id, "  We were in the same lab  ").ok).toBe(true);
    expect(m.social.requestsFor(b).received[0]).toMatchObject({ note: "We were in the same lab" });
    expect(m.social.notificationsFor(b.id)[0].kind).toBe("connect-request");
    expect(m.people.relation(a.id, b.id)).toBe("sent");
    expect(m.social.requestConnection(a, b.id, "again").ok).toBe(false); // already waiting
    expect(m.social.acceptConnection(b, a.id).ok).toBe(true);
    expect(m.people.relation(a.id, b.id)).toBe("connected");
    expect(m.people.relation(b.id, a.id)).toBe("connected");
  });

  it("declining is silent, and only the addressee can accept", () => {
    const a = member("Chetan Test");
    const b = member("Divya Test");
    m.social.requestConnection(a, b.id, "");
    expect(m.social.acceptConnection(a, b.id).ok).toBe(false); // a can't accept their own request
    m.social.declineConnection(b, a.id);
    expect(m.social.notificationsFor(a.id).some((x) => x.kind.startsWith("connect"))).toBe(false);
    expect(m.people.relation(a.id, b.id)).toBe("sent"); // to them it still looks sent…
    expect(m.people.relation(b.id, a.id)).toBe("none"); // …and to b it's gone
    expect(m.social.requestConnection(a, b.id, "please").ok).toBe(false); // so no asking again
    m.social.withdrawRequest(a, b.id);
    const before = m.social.notificationsFor(b.id).filter((x) => x.kind === "connect-request").length;
    expect(m.social.requestConnection(a, b.id, "one more time").ok).toBe(true);
    expect(m.social.notificationsFor(b.id).filter((x) => x.kind === "connect-request")).toHaveLength(before); // not pinged again within a week
  });

  it("caps requests per day", () => {
    const a = member("Spammy Test");
    const others = Array.from({ length: m.social.DAILY_REQUESTS + 1 }, (_, i) => member(`Target ${i} Test`));
    const results = others.map((o) => m.social.requestConnection(a, o.id, "").ok);
    expect(results.filter(Boolean)).toHaveLength(m.social.DAILY_REQUESTS);
    expect(results.at(-1)).toBe(false);
  });

  it("a block ends the connection, and they vanish from each other's search, requests and messages", () => {
    const a = member("Esha Blocker");
    const b = member("Farhan Blocked");
    connect(a, b);
    expect(m.social.block(a, b.id).ok).toBe(true);
    expect(m.people.relation(a.id, b.id)).toBe("blocked");
    expect(m.people.relation(b.id, a.id)).toBe("blocked-by");
    expect(m.people.searchMembers(b, { q: "Esha" })).toHaveLength(0);
    expect(m.people.searchMembers(a, { q: "Farhan" })).toHaveLength(0);
    expect(m.people.pageFor(b, a.id)).toBeNull();
    expect(m.social.requestConnection(b, a.id, "").ok).toBe(false);
    expect(m.social.sendMessage(b, a.id, "hello").ok).toBe(false);
    m.social.unblock(a, b.id);
    expect(m.people.relation(a.id, b.id)).toBe("none"); // unblocking doesn't reconnect
  });
});

describe("the fast relation look-up", () => {
  it("answers exactly like relation() in every state", () => {
    const me = member("Nia Viewer");
    const others = {
      none: member("Rel None"),
      sent: member("Rel Sent"),
      received: member("Rel Received"),
      connected: member("Rel Connected"),
      declinedByThem: member("Rel DeclinedByThem"),
      declinedByMe: member("Rel DeclinedByMe"),
      blocked: member("Rel Blocked"),
      blockedBy: member("Rel BlockedBy")
    };
    m.social.requestConnection(me, others.sent.id, "");
    m.social.requestConnection(others.received, me.id, "");
    connect(me, others.connected);
    m.social.requestConnection(me, others.declinedByThem.id, "");
    m.social.declineConnection(others.declinedByThem, me.id);
    m.social.requestConnection(others.declinedByMe, me.id, "");
    m.social.declineConnection(me, others.declinedByMe.id);
    m.social.block(me, others.blocked.id);
    m.social.block(others.blockedBy, me.id);
    const fast = m.people.relationsOf(me.id);
    for (const u of [...Object.values(others), me]) expect(fast(u.id), u.name).toBe(m.people.relation(me.id, u.id));
  });
});

describe("messages", () => {
  it("only between connections; reading the thread marks it read; one notification until read", () => {
    const a = member("Gita Test");
    const b = member("Hari Test");
    expect(m.social.sendMessage(a, b.id, "hi").ok).toBe(false);
    connect(a, b);
    expect(m.social.sendMessage(a, b.id, "   ").ok).toBe(false);
    m.social.sendMessage(a, b.id, "first");
    m.social.sendMessage(a, b.id, "second");
    expect(m.social.notificationsFor(b.id).filter((x) => x.kind === "message")).toHaveLength(1);
    expect(m.social.unreadMessages(b.id)).toBe(2);
    expect(m.social.thread(b, a.id).map((x) => x.body)).toEqual(["first", "second"]);
    expect(m.social.unreadMessages(b.id)).toBe(0);
    expect(m.social.conversations(b)[0]).toMatchObject({ last: "second", unread: 0 });
  });
});

describe("home notes", () => {
  it("each audience sees exactly what it should", () => {
    const author = member("Indu Author", { branch: "ECE", joined: 2015 });
    const batchmate = member("Jai Batchmate", { branch: "ECE", joined: 2015 });
    const friend = member("Kiran Friend", { branch: "ME", joined: 2001 });
    const stranger = member("Lata Stranger", { branch: "CV", joined: 2019 });
    connect(author, friend);
    m.posts.createPost(author, "for everyone", "everyone");
    m.posts.createPost(author, "for my batch", "batch");
    m.posts.createPost(author, "for connections", "connections");
    const sees = (u: U) => m.posts.feedFor(u, { authorId: author.id }).map((p) => p.body).sort();
    expect(sees(author)).toEqual(["for connections", "for everyone", "for my batch"]);
    expect(sees(batchmate)).toEqual(["for everyone", "for my batch"]);
    expect(sees(friend)).toEqual(["for connections", "for everyone", "for my batch"]);
    expect(sees(stranger)).toEqual(["for everyone"]);
  });

  it("no cheering or commenting on a note you can't see; only your own notes can be removed", () => {
    const author = member("Mohan Author", { branch: "ISE", joined: 2010 });
    const stranger = member("Nisha Stranger", { branch: "CV", joined: 2020 });
    m.posts.createPost(author, "connections only", "connections");
    const [post] = m.posts.feedFor(author, { authorId: author.id });
    expect(m.posts.toggleCheer(stranger, post.id).ok).toBe(false);
    expect(m.posts.addComment(stranger, post.id, "hi").ok).toBe(false);
    m.posts.removeOwnPost(stranger, post.id); // not theirs: nothing happens
    expect(m.posts.feedFor(author, { authorId: author.id })).toHaveLength(1);
    m.posts.removeOwnPost(author, post.id);
    expect(m.posts.feedFor(author, { authorId: author.id })).toHaveLength(0);
  });

  it("a blocked member's comments and notifications don't reach you", () => {
    const author = member("Pia Author");
    const pest = member("Quinn Pest");
    m.posts.createPost(author, "public note", "everyone");
    const [post] = m.posts.feedFor(author, { authorId: author.id });
    m.posts.addComment(pest, post.id, "before the block");
    m.social.block(author, pest.id);
    expect(m.posts.feedFor(author, { authorId: author.id })[0].comments).toEqual([]);
    expect(m.posts.addComment(pest, post.id, "after the block").ok).toBe(false); // can't even see it now
    expect(m.social.notificationsFor(author.id).some((x) => x.actor === pest.id)).toBe(false); // the old comment notification is hidden
    m.social.notify(author.id, { actor: pest.id, kind: "test", text: "x", link: "/" });
    expect(m.social.notificationsFor(author.id).some((x) => x.actor === pest.id)).toBe(false);
  });

  it("a member whose batch isn't known can't post to it", () => {
    const db = m.db.database();
    const { lastInsertRowid } = db.prepare("insert into users (email, password_hash, name, role, created_at) values ('nobatch@example.com', 'x', 'Ravi Nobatch', 'faculty', ?)").run(Date.now());
    const faculty = m.people.memberById(Number(lastInsertRowid))!;
    expect(m.posts.createPost(faculty, "hello batch", "batch").ok).toBe(false);
  });

  it("rejects empty notes and unknown audiences", () => {
    const a = member("Om Test");
    expect(m.posts.createPost(a, "   ", "everyone").ok).toBe(false);
    expect(m.posts.createPost(a, "hello", "the whole internet").ok).toBe(false);
  });
});

describe("ask a senior", () => {
  it("goes only to seniors who mentor, best fit first, never to the blocked", () => {
    const student = member("Pooja Student", { role: "student", branch: "CSE", joined: 2023 });
    const fit = member("Quasim Fit", { branch: "CSE" });
    const lessFit = member("Rekha Less", { branch: "ME" });
    const notMentoring = member("Suresh Busy", { branch: "CSE" });
    const blocked = member("Tara Blocked", { branch: "CSE" });
    const otherStudent = member("Uma Student", { role: "student" });
    mentor(fit, ["React", "Placements"]);
    mentor(lessFit, ["Welding"]);
    mentor(blocked, ["React"]);
    mentor(otherStudent, ["React"]);
    m.profile.saveProfile(notMentoring.id, { ...m.profile.profileOf(notMentoring.id), skills: ["React"] });
    m.social.block(blocked, student.id);
    const routes = m.asks.routeFor(student, "How do I prepare for React interviews?", ["React"]).map((r) => r.user.id);
    expect(routes[0]).toBe(fit.id);
    expect(routes).toContain(lessFit.id);
    expect(routes).not.toContain(notMentoring.id);
    expect(routes).not.toContain(blocked.id);
    expect(routes).not.toContain(otherStudent.id);
  });

  it("skips mentors with nothing in common when enough others fit", () => {
    const student = member("Dina Student", { role: "student", branch: "EEE", joined: 2024 });
    const a = member("Ehsan Fit", { branch: "EEE" });
    const b = member("Gauri Fit", { branch: "MECH" });
    const unrelated = member("Hamid Unrelated", { branch: "CIVIL" });
    mentor(a, ["Power systems"]);
    mentor(b, ["GATE"]);
    mentor(unrelated, ["Surveying"]);
    const routes = m.asks.routeFor(student, "GATE preparation tips", ["GATE"]).map((r) => r.user.id);
    expect(routes).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(routes).not.toContain(unrelated.id);
  });

  it("one senior takes it; the thread is private to the two; answering puts thanks on their Record", () => {
    const student = member("Varun Student", { role: "student" });
    const senior = member("Wasim Senior");
    const second = member("Yamini Senior");
    const outsider = member("Zara Outsider");
    mentor(senior, ["Careers"]);
    mentor(second, ["Careers"]);
    const { id } = m.asks.createAsk(student, { title: "Careers after CSE?", body: "What should I try first?", topics: "Careers" });
    expect(id).toBeTruthy();
    expect(m.asks.askFor(outsider, id!)).toBeNull(); // not routed to them
    expect(m.asks.takeAsk(student, id!).ok).toBe(false); // students don't take Asks
    expect(m.asks.takeAsk(senior, id!).ok).toBe(true);
    expect(m.asks.takeAsk(second, id!).ok).toBe(false); // already taken
    expect(m.asks.askFor(second, id!)).toBeNull(); // and now private
    expect(m.asks.replyToAsk(second, id!, "me too").ok).toBe(false);
    expect(m.asks.replyToAsk(senior, id!, "Start with internships.").ok).toBe(true);
    expect(m.asks.askThread(student, id!).map((x) => x.body)).toEqual(["Start with internships."]);
    expect(m.asks.askThread(outsider, id!)).toEqual([]);
    expect(m.asks.markAnswered(senior, id!, "self-thanks").ok).toBe(false); // only the asker
    expect(m.asks.markAnswered(student, id!, "Thank you, that helped!").ok).toBe(true);
    expect(m.asks.recordOf(senior.id)).toEqual({ count: 1, thanks: ["Thank you, that helped!"] }); // never the question or who asked
  });

  it("an Ask that fits nobody is open to any senior, but not to students", () => {
    const student = member("Abel Student", { role: "student" });
    const anySenior = member("Bela Senior");
    const otherStudent = member("Cyrus Student", { role: "student" });
    m.db.database().prepare("update profiles set data = json_set(data, '$.happyTo.mentor', json('false'))").run();
    const { id } = m.asks.createAsk(student, { title: "Anything about hostels?", body: "Where to stay", topics: "" });
    expect(m.asks.askFor(anySenior, id!)).not.toBeNull();
    expect(m.asks.askFor(otherStudent, id!)).toBeNull();
  });
});

describe("fixes from the security review", () => {
  it("a block between asker and senior closes their thread to both", () => {
    const student = member("Ira Student", { role: "student" });
    const senior = member("Jas Senior");
    mentor(senior, ["Robotics"]);
    const { id } = m.asks.createAsk(student, { title: "Robotics clubs?", body: "Which one", topics: "Robotics" });
    m.asks.takeAsk(senior, id!);
    m.asks.replyToAsk(senior, id!, "Try the IEEE one.");
    m.social.block(student, senior.id);
    expect(m.asks.askFor(senior, id!)).toBeNull();
    expect(m.asks.askThread(senior, id!)).toEqual([]);
    expect(m.asks.askThread(student, id!)).toEqual([]);
    expect(m.asks.replyToAsk(senior, id!, "still here").ok).toBe(false);
  });

  it("cheering again doesn't ping the author again", () => {
    const author = member("Kavya Author");
    const fan = member("Leo Fan");
    m.posts.createPost(author, "cheer me", "everyone");
    const [post] = m.posts.feedFor(fan, { authorId: author.id });
    for (let i = 0; i < 6; i++) m.posts.toggleCheer(fan, post.id);
    expect(m.social.notificationsFor(author.id).filter((x) => x.kind === "cheer")).toHaveLength(1);
  });

  it("you can't report what you can't see", () => {
    const author = member("Mira Author");
    const stranger = member("Noor Stranger");
    const friend = member("Ojas Friend");
    connect(author, friend);
    m.posts.createPost(author, "connections only", "connections");
    const [post] = m.posts.feedFor(author, { authorId: author.id });
    expect(m.desk.report(stranger, "post", post.id, "x").ok).toBe(false);
    expect(m.desk.report(friend, "post", post.id, "x").ok).toBe(true);
    const { id: askId } = m.asks.createAsk(member("Pia Student", { role: "student" }), { title: "Private", body: "q", topics: "" });
    expect(m.desk.report(member("Raj Student", { role: "student" }), "ask", askId!, "x").ok).toBe(false);
  });

  it("coordinators can't pause other coordinators; administrators can", () => {
    const a = member("Sia Coordinator", { role: "coordinator" });
    const b = member("Tom Coordinator", { role: "coordinator" });
    expect(m.desk.suspend(a, b.id, true).ok).toBe(false);
    const admin = adminUser();
    expect(m.desk.suspend(admin, b.id, true).ok).toBe(true);
    m.desk.suspend(admin, b.id, false);
  });

  it("no messages to a paused member, and an Ask stays readable when its senior is paused", () => {
    const admin = adminUser();
    const student = member("Uday Student", { role: "student" });
    const senior = member("Vani Senior");
    connect(student, senior);
    mentor(senior, ["Chess"]);
    const { id } = m.asks.createAsk(student, { title: "Chess club?", body: "q", topics: "Chess" });
    m.asks.takeAsk(senior, id!);
    m.asks.replyToAsk(senior, id!, "Yes, Fridays.");
    m.desk.suspend(admin, senior.id, true);
    expect(m.social.sendMessage(student, senior.id, "hello").ok).toBe(false);
    expect(m.asks.askFor(student, id!)!.taker?.id).toBe(senior.id);
    expect(m.asks.askThread(student, id!).map((x) => x.body)).toEqual(["Yes, Fridays."]);
    m.desk.suspend(admin, senior.id, false);
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

  it("only faculty, coordinators and administrators put events up", () => {
    expect(m.events.createEvent(member("Dev Alumnus"), input()).ok).toBe(false);
    expect(m.events.createEvent(member("Ela Faculty", { role: "faculty" }), input()).ok).toBe(true);
  });

  it("checks its fields: dates, links, capacity", () => {
    const f = member("Fiza Faculty", { role: "faculty" });
    expect(m.events.createEvent(f, input({ startsAt: "tomorrow" })).ok).toBe(false);
    expect(m.events.createEvent(f, input({ startsAt: "2001-01-01T10:00" })).ok).toBe(false);
    expect(m.events.createEvent(f, input({ endsAt: "2099-11-02T17:00" })).ok).toBe(false);
    expect(m.events.createEvent(f, input({ onlineLink: "javascript:alert(1)" })).ok).toBe(false);
    expect(m.events.createEvent(f, input({ capacity: "-3" })).ok).toBe(false);
  });

  it("cancelling twice tells people once; a lone carriage return can't add calendar lines", () => {
    const f = member("Uma Faculty", { role: "faculty" });
    const { id } = m.events.createEvent(f, input({ title: "Talk\rLOCATION:Somewhere else", capacity: "" }));
    const guest = member("Vik Guest");
    m.events.toggleRsvp(guest, id!);
    m.events.cancelEvent(f, id!);
    m.events.cancelEvent(f, id!);
    expect(m.social.notificationsFor(guest.id).filter((x) => x.kind === "event-cancelled")).toHaveLength(1);
    const ics = m.events.eventIcs(m.events.eventById(f, id!)!, "https://example.com");
    expect(ics.split("\r\n").filter((l) => l.startsWith("LOCATION:"))).toHaveLength(1);
  });

  it("holds its capacity; RSVP toggles; the calendar file can't be broken by its text", () => {
    const f = member("Gopal Faculty", { role: "faculty" });
    const { id } = m.events.createEvent(f, input({ title: "Meet\r\nBEGIN:VEVENT" }));
    const a = member("Hema Test");
    const b = member("Imran Test");
    expect(m.events.toggleRsvp(a, id!).ok).toBe(true);
    expect(m.events.toggleRsvp(b, id!).ok).toBe(false); // full
    expect(m.events.toggleRsvp(a, id!).ok).toBe(true); // a steps back
    expect(m.events.toggleRsvp(b, id!).ok).toBe(true); // room for b
    expect(m.events.attendees(a, id!)).toEqual([]); // only the organiser sees who
    expect(m.events.attendees(f, id!).map((u) => u.id)).toEqual([b.id]);
    const ics = m.events.eventIcs(m.events.eventById(f, id!)!, "https://example.com");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(ics).toContain("SUMMARY:Meet\\nBEGIN:VEVENT");
    expect(ics).toContain("with\\, commas");
    expect(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
  });
});

describe("the college desk", () => {
  it("reports: not your own things, only messages sent to you, and a reason", () => {
    const a = member("Jaya Test");
    const b = member("Kunal Test");
    connect(a, b);
    m.posts.createPost(b, "something rude", "everyone");
    const [post] = m.posts.feedFor(a, { authorId: b.id });
    expect(m.desk.report(b, "post", post.id, "spam").ok).toBe(false); // own
    expect(m.desk.report(a, "post", post.id, "  ").ok).toBe(false); // no reason
    expect(m.desk.report(a, "post", post.id, "rude").ok).toBe(true);
    m.social.sendMessage(b, a.id, "rude message");
    const messageId = (m.db.database().prepare("select id from messages where sender = ?").get(b.id) as { id: number }).id;
    const c = member("Leela Test");
    expect(m.desk.report(c, "message", messageId, "rude").ok).toBe(false); // not sent to c
    expect(m.desk.report(a, "message", messageId, "rude").ok).toBe(true);
    expect(m.desk.report(a, "nonsense", 1, "x").ok).toBe(false);
  });

  it("only coordinators act on reports; removing takes the note down and is audited", () => {
    const reporter = member("Manu Test");
    const author = member("Nalini Test");
    const coordinator = member("Ojas Coordinator", { role: "coordinator" });
    const admin = adminUser();
    m.posts.createPost(author, "take me down", "everyone");
    const [post] = m.posts.feedFor(reporter, { authorId: author.id });
    m.desk.report(reporter, "post", post.id, "spam");
    expect(m.desk.reports(reporter)).toEqual([]); // members see no reports
    const [r] = m.desk.reports(coordinator).filter((x) => x.subjectId === post.id);
    expect(m.desk.resolveReport(reporter, r.id, "remove").ok).toBe(false);
    expect(m.desk.resolveReport(coordinator, r.id, "remove").ok).toBe(true);
    expect(m.posts.feedFor(reporter, { authorId: author.id })).toHaveLength(0);
    expect(m.desk.auditLog(coordinator)).toEqual([]); // the log is for administrators
    expect(m.desk.auditLog(admin)[0]).toMatchObject({ action: "removed", subject: `post ${post.id}`, actor: "Ojas Coordinator" });
  });

  it("pausing signs a member out and hides them; only administrators change roles", async () => {
    const coordinator = member("Pari Coordinator", { role: "coordinator" });
    const admin = adminUser();
    expect(admin.role).toBe("admin");
    const target = member("Rohan Target");
    const viewer = member("Sana Viewer");
    const db = m.db.database();
    db.prepare("insert into sessions (token_hash, user_id, expires_at, created_at) values ('h', ?, ?, ?)").run(target.id, Date.now() + 1e9, Date.now());
    expect(m.desk.suspend(viewer, target.id, true).ok).toBe(false);
    expect(m.desk.suspend(coordinator, target.id, true).ok).toBe(true);
    expect(db.prepare("select count(*) as n from sessions where user_id = ?").get(target.id)).toEqual({ n: 0 });
    expect(m.people.searchMembers(viewer, { q: "Rohan" })).toHaveLength(0);
    expect(m.desk.suspend(coordinator, admin.id, true).ok).toBe(false); // can't pause an admin
    expect(m.desk.setRole(coordinator, viewer.id, "coordinator").ok).toBe(false);
    expect(m.desk.setRole(admin, viewer.id, "admin").ok).toBe(false); // admins come from the env only
    expect(m.desk.setRole(admin, viewer.id, "faculty").ok).toBe(true);
    expect(m.people.memberById(viewer.id)!.role).toBe("faculty");
    expect(m.desk.stats(viewer)).toBeNull();
    expect(m.desk.stats(admin)!.paused).toBeGreaterThan(0);
  });
});

describe("the admin ladder", () => {
  it("roles come from one ladder: each acts only on those below, and gives only roles below", () => {
    const sup = superUser();
    const admin = adminUser();
    expect(sup.role).toBe("superadmin");
    const coordinator = member("Uma Coord", { role: "coordinator" });
    const plain = member("Vimal Plain");
    // Administrators make coordinators, not administrators.
    expect(m.desk.setRole(admin, plain.id, "coordinator").ok).toBe(true);
    expect(m.desk.setRole(admin, plain.id, "admin").ok).toBe(false);
    // Coordinators can't change roles at all.
    expect(m.desk.setRole(coordinator, plain.id, "alumnus").ok).toBe(false);
    // Super administrators make (and unmake) administrators.
    expect(m.desk.setRole(sup, plain.id, "admin").ok).toBe(true);
    const appointed = m.people.memberById(plain.id)!;
    expect(appointed.role).toBe("admin");
    expect(m.desk.setRole(admin, appointed.id, "alumnus").ok).toBe(false); // an admin can't demote a peer
    expect(m.desk.suspend(admin, appointed.id, true).ok).toBe(false); // nor pause one
    expect(m.desk.setRole(sup, appointed.id, "alumnus").ok).toBe(true);
    // Nobody can be made a super administrator from the site, and config roles can't be changed.
    expect(m.desk.setRole(sup, plain.id, "superadmin").ok).toBe(false);
    expect(m.desk.setRole(sup, admin.id, "alumnus").ok).toBe(false);
    expect(m.desk.suspend(sup, admin.id, true).ok).toBe(true); // but a super administrator can pause an admin
    m.desk.suspend(sup, admin.id, false);
    expect(m.desk.suspend(admin, sup.id, true).ok).toBe(false); // nobody pauses a super administrator
    expect(m.desk.setRole(sup, sup.id, "alumnus").ok).toBe(false);
  });

  it("only super administrators change settings, and the rules obey them", async () => {
    const sup = superUser();
    const admin = adminUser();
    const a = member("Wren Test");
    const b = member("Xia Test");
    connect(a, b);
    const off = { ...m.settings.DEFAULT_SETTINGS, joiningOpen: false, features: { notes: false, asks: false, events: false, messages: false }, dailyRequests: 1 };
    expect(m.desk.updateSettings(admin, off).ok).toBe(false);
    expect(m.desk.updateSettings(sup, off).ok).toBe(true);
    expect(m.posts.createPost(a, "hello", "everyone").ok).toBe(false);
    expect(m.social.sendMessage(a, b.id, "hello").ok).toBe(false);
    expect(m.asks.createAsk(a, { title: "t", body: "b", topics: "" }).ok).toBe(false);
    expect(m.events.createEvent(member("Yash Faculty", { role: "faculty" }), { title: "t", body: "", startsAt: "2099-01-01T10:00", endsAt: "", place: "p", onlineLink: "", capacity: "" }).ok).toBe(false);
    expect((await m.auth.startJoin({ name: "Anyone", usn: "1HK00XX000", email: "new@example.com", ip: "9" })).ok).toBe(false);
    const c = member("Zoe Test");
    const d = member("Ada Test");
    const e = member("Ben Test");
    expect(m.social.requestConnection(c, d.id, "").ok).toBe(true);
    expect(m.social.requestConnection(c, e.id, "").ok).toBe(false); // the daily limit is now 1
    expect(m.desk.updateSettings(sup, { ...off, dailyRequests: 0 }).ok).toBe(false); // out of range
    expect(m.desk.updateSettings(sup, m.settings.DEFAULT_SETTINGS).ok).toBe(true);
    expect(m.posts.createPost(a, "hello again", "everyone").ok).toBe(true);
    expect(m.desk.auditLog(sup, { q: "changed settings" }).length).toBeGreaterThanOrEqual(2);
  });

  it("taking something down tells its author; only administrators bring it back", () => {
    const author = member("Cara Author");
    const coordinator = member("Dev Coord", { role: "coordinator" });
    m.posts.createPost(author, "borderline", "everyone");
    const [post] = m.posts.feedFor(author, { authorId: author.id });
    expect(m.desk.takeDown(author, "post", post.id).ok).toBe(false);
    expect(m.desk.takeDown(coordinator, "post", post.id).ok).toBe(true);
    expect(m.social.notificationsFor(author.id)[0].kind).toBe("removed");
    expect(m.desk.restore(coordinator, "post", post.id).ok).toBe(false);
    expect(m.desk.restore(adminUser(), "post", post.id).ok).toBe(true);
    expect(m.posts.feedFor(author, { authorId: author.id })).toHaveLength(1);
  });

  it("deleting a member is for super administrators, with their name typed, and is audited", () => {
    const sup = superUser();
    const target = member("Esha Delete");
    expect(m.desk.deleteMember(adminUser(), target.id, "Esha Delete").ok).toBe(false);
    expect(m.desk.deleteMember(sup, target.id, "esha").ok).toBe(false);
    expect(m.desk.deleteMember(sup, target.id, "Esha Delete").ok).toBe(true);
    expect(m.people.memberById(target.id)).toBeNull();
    expect(m.desk.auditLog(sup, { q: "deleted member" })[0].detail).toBe("Esha Delete");
  });

  it("signing out everywhere ends every session; announcements are the desk's", () => {
    const coordinator = member("Fay Coord", { role: "coordinator" });
    const target = member("Gus Target");
    const db = m.db.database();
    for (const h of ["s1", "s2"]) db.prepare("insert into sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)").run(h, target.id, Date.now() + 1e9, Date.now());
    expect(m.desk.signOutEverywhere(member("Hal Plain"), target.id).ok).toBe(false);
    expect(m.desk.signOutEverywhere(coordinator, target.id).ok).toBe(true);
    expect(db.prepare("select count(*) as n from sessions where user_id = ?").get(target.id)).toEqual({ n: 0 });
    expect(m.announcements.createAnnouncement(target, { title: "Hi", body: "x", days: 3 }).ok).toBe(false);
    expect(m.announcements.createAnnouncement(coordinator, { title: "Alumni Day", body: "14 Dec", days: 3 }).ok).toBe(true);
    expect(m.announcements.activeAnnouncements()[0].title).toBe("Alumni Day");
    expect(m.announcements.activeAnnouncements(Date.now() + 4 * 24 * 60 * 60_000)).toHaveLength(0); // it ends
  });

  it("the audit spreadsheet can't run formulas, and only administrators get it", () => {
    const sup = superUser();
    const evil = member("=HYPERLINK(1)");
    m.desk.suspend(sup, evil.id, true);
    expect(m.desk.auditCsv(member("Ivy Coord", { role: "coordinator" }))).toBeNull();
    const csv = m.desk.auditCsv(sup)!;
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv).not.toMatch(/,"=HYPERLINK/);
  });
});

describe("posts with photos, reactions and mentions", () => {
  it("a post can carry up to four of your own photos, each used once", () => {
    const a = member("Ana Photos");
    const b = member("Bo Other");
    const mine = [upload(a), upload(a, "video")];
    const res = m.posts.createPost(a, "", "everyone", mine);
    expect(res.ok).toBe(true);
    expect(m.posts.postFor(a, res.id!)!.media.map((x) => x.id)).toEqual(mine);
    expect(m.posts.createPost(a, "again", "everyone", [mine[0]]).ok).toBe(false); // already posted
    expect(m.posts.createPost(a, "theirs", "everyone", [upload(b)]).ok).toBe(false); // not yours
    expect(m.posts.createPost(a, "html", "everyone", [upload(a, "html")]).ok).toBe(false);
    expect(m.posts.createPost(a, "five", "everyone", [1, 2, 3, 4, 5].map(() => upload(a))).ok).toBe(false);
    expect(m.posts.createPost(a, "", "everyone").ok).toBe(false); // nothing at all
  });

  it("only those who may see a post may open its photos", () => {
    const author = member("Cy Private");
    const friend = member("Di Friend");
    const stranger = member("Ed Stranger");
    connect(author, friend);
    const photo = upload(author);
    m.posts.createPost(author, "connections only", "connections", [photo]);
    expect(m.posts.canSeePostMedia(friend, photo)).toBe(true);
    expect(m.posts.canSeePostMedia(stranger, photo)).toBe(false);
    expect(m.posts.canSeePostMedia(stranger, upload(author))).toBeNull(); // not on any post
  });

  it("one reaction each: the same again takes it back, another replaces it", () => {
    const author = member("Fe Author");
    const fan = member("Gil Fan");
    const { id } = m.posts.createPost(author, "react to me", "everyone");
    m.posts.react(fan, id!, "proud");
    expect(m.posts.postFor(fan, id!)).toMatchObject({ myReaction: "proud", reactionCount: 1, reactions: { proud: 1 } });
    m.posts.react(fan, id!, "congrats");
    expect(m.posts.postFor(fan, id!)).toMatchObject({ myReaction: "congrats", reactionCount: 1, reactions: { congrats: 1 } });
    m.posts.react(fan, id!, "congrats");
    expect(m.posts.postFor(fan, id!)).toMatchObject({ myReaction: null, reactionCount: 0 });
    expect(m.posts.react(fan, id!, "angry").ok).toBe(false);
    expect(m.social.notificationsFor(author.id).filter((x) => x.kind === "cheer")).toHaveLength(1);
  });

  it("mentions: tidied to the real name, told only if they can see it, never for the blocked", () => {
    const author = member("Hana Writer");
    const friend = member("Ivo Friend");
    const stranger = member("Jo Stranger");
    const blocker = member("Kai Blocker");
    connect(author, friend);
    m.social.block(blocker, author.id);
    const body = `Thanks @[ivo](${friend.id}) and @[Jo](${stranger.id}) and @[Kai](${blocker.id}) and @[Ghost](999999)`;
    const { id } = m.posts.createPost(author, body, "connections");
    const post = m.posts.postFor(author, id!)!;
    expect(post.body).toBe(`Thanks @[Ivo Friend](${friend.id}) and @[Jo Stranger](${stranger.id}) and @Kai and @Ghost`);
    expect(m.social.notificationsFor(friend.id).some((x) => x.kind === "mention")).toBe(true);
    expect(m.social.notificationsFor(stranger.id).some((x) => x.kind === "mention")).toBe(false); // can't see a connections-only post
    expect(m.social.notificationsFor(blocker.id).some((x) => x.kind === "mention")).toBe(false);
  });
});

describe("following", () => {
  it("is one way, tells them once, shows in the Following feed, and a block ends it", () => {
    const fan = member("Lu Fan");
    const senior = member("Mo Senior");
    const other = member("Ny Other");
    expect(m.follows.follow(fan, senior.id).ok).toBe(true);
    m.follows.unfollow(fan, senior.id);
    m.follows.follow(fan, senior.id);
    expect(m.social.notificationsFor(senior.id).filter((x) => x.kind === "follow")).toHaveLength(1);
    expect(m.follows.followCounts(senior.id)).toEqual({ followers: 1, following: 0 });
    expect(m.people.relation(fan.id, senior.id)).toBe("none"); // following isn't connecting
    m.posts.createPost(senior, "from the senior", "everyone");
    m.posts.createPost(other, "from someone else", "everyone");
    const following = m.posts.feedFor(fan, { scope: "following" }).map((p) => p.body);
    expect(following).toContain("from the senior");
    expect(following).not.toContain("from someone else");
    m.social.block(senior, fan.id);
    expect(m.follows.isFollowing(fan.id, senior.id)).toBe(false);
    expect(m.follows.follow(fan, senior.id).ok).toBe(false);
  });
});

describe("stories", () => {
  it("connections and followers see them; others don't; the author sees who looked", () => {
    const author = member("Oz Story");
    const friend = member("Pa Friend");
    const fan = member("Qi Fan");
    const stranger = member("Ro Stranger");
    connect(author, friend);
    m.follows.follow(fan, author.id);
    const photo = upload(author);
    const { id } = m.stories.createStory(author, photo, "At the old canteen");
    expect(m.stories.storyBar(friend).find((r) => r.author.id === author.id)?.allSeen).toBe(false);
    expect(m.stories.storyBar(fan).some((r) => r.author.id === author.id)).toBe(true);
    expect(m.stories.storyBar(stranger).some((r) => r.author.id === author.id)).toBe(false);
    expect(m.stories.markSeen(stranger, id!).ok).toBe(false);
    expect(m.stories.canSeeStoryMedia(stranger, photo)).toBe(false);
    m.stories.markSeen(friend, id!);
    expect(m.stories.storyBar(friend).find((r) => r.author.id === author.id)?.allSeen).toBe(true);
    expect(m.stories.storyViewers(author, id!).map((u) => u.id)).toEqual([friend.id]);
    expect(m.stories.storyViewers(friend, id!)).toEqual([]); // only the author may ask
    expect(m.stories.storyBar(author)[0]).toMatchObject({ mine: true });
  });

  it("go after a day, can't reuse a photo, and only your own uploads", () => {
    const author = member("Sa Story");
    const friend = member("Ti Friend");
    connect(author, friend);
    const photo = upload(author);
    m.stories.createStory(author, photo, "");
    expect(m.stories.createStory(author, photo, "again").ok).toBe(false);
    expect(m.stories.createStory(author, upload(friend), "theirs").ok).toBe(false);
    const tomorrow = Date.now() + m.stories.STORY_LIFE + 1000;
    expect(m.stories.storyBar(friend, tomorrow).some((r) => r.author.id === author.id)).toBe(false);
  });
});
