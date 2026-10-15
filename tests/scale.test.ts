import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * How the rules hold up at scale: a throwaway database well beyond HKBK's size, and the
 * time each page's main work takes. Skipped in normal runs (it takes a while to fill):
 *   SCALE=1 npx vitest run tests/scale.test.ts
 */


const MEMBERS = Number(process.env.SCALE_MEMBERS || 15_000);
const BRANCHES = ["CSE", "ECE", "MECH", "ISE", "EEE", "CIVIL", "AIML"];
const SKILLS = ["Python", "Java", "React", "Data", "VLSI", "Design", "Careers", "Interviews", "Higher studies", "Cloud", "CAD", "Embedded", "GATE", "MBA"];
const CITIES = ["Bengaluru", "Pune", "Hyderabad", "Chennai", "Mumbai", "Dubai", "London", "Toronto"];

/** A small, repeatable pseudo-random sequence, so every run fills the same database. */
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

/** Median and slowest of `runs` calls, in milliseconds. */
function time(fn: () => unknown, runs = 15) {
  const t: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  return { median: +t[Math.floor(runs / 2)].toFixed(2), worst: +t[runs - 1].toFixed(2) };
}

describe.skipIf(!process.env.SCALE)("at scale", () => {
  it(`stays fast with ${MEMBERS.toLocaleString("en-IN")} members`, async () => {
    // Its own throwaway database, made only when this runs (set before the modules load).
    process.env.ALUMNITY_DB = join(mkdtempSync(join(tmpdir(), "alumnity-scale-")), "scale.db");
    process.env.ALUMNITY_SUPER_ADMINS = "super@example.com";
    const { database } = await import("../lib/server/db");
    const people = await import("../lib/server/people");
    const posts = await import("../lib/server/posts");
    const social = await import("../lib/server/social");
    const asks = await import("../lib/server/asks");
    const desk = await import("../lib/server/desk");
    const events = await import("../lib/server/events");
    const db = database();
    const now = Date.now();
    const YEAR = 365 * 24 * 3_600_000;

    const fillStart = performance.now();
    db.exec("begin");
    const user = db.prepare("insert into users (email, password_hash, name, branch, branch_name, programme, joined, role, created_at) values (?, 'x', ?, ?, ?, 'B.Tech', ?, ?, ?)");
    const profile = db.prepare("insert into profiles (user_id, data, updated_at) values (?, ?, ?)");
    for (let i = 1; i <= MEMBERS; i++) {
      const branch = pick(BRANCHES);
      const joined = 1998 + Math.floor(rand() * 27);
      user.run(i === 1 ? "super@example.com" : `m${i}@example.com`, `Member${i} ${pick(["Rao", "Khan", "Nair", "Shetty", "Iyer", "Ahmed", "Gowda"])}`, branch, branch, joined, joined > 2021 ? "student" : "alumnus", now - rand() * YEAR);
      const skills = [pick(SKILLS), pick(SKILLS)];
      profile.run(i, JSON.stringify({ title: "Engineer", company: `Company ${i % 300}`, city: pick(CITIES), skills, happyTo: { mentor: rand() < 0.2, refer: rand() < 0.2, talk: true } }), now);
    }
    const conn = db.prepare("insert or ignore into connections (requester, addressee, status, created_at, responded_at) values (?, ?, 'accepted', ?, ?)");
    for (let i = 1; i <= MEMBERS; i++) for (let k = 0; k < 10; k++) conn.run(i, 1 + Math.floor(rand() * MEMBERS), now, now);
    // The member we view as: well connected (300 connections).
    for (let k = 2; k < 302; k++) conn.run(1, k * 37 % MEMBERS + 2, now, now);
    const post = db.prepare("insert into posts (author, body, audience, created_at) values (?, ?, ?, ?)");
    const POSTS = MEMBERS * 2;
    for (let i = 0; i < POSTS; i++) post.run(1 + Math.floor(rand() * MEMBERS), `Note ${i} about ${pick(SKILLS)}`, pick(["everyone", "everyone", "batch", "connections"]), now - rand() * YEAR);
    const comment = db.prepare("insert into post_comments (post_id, author, body, created_at) values (?, ?, ?, ?)");
    for (let i = 0; i < POSTS * 2; i++) comment.run(1 + Math.floor(rand() * POSTS), 1 + Math.floor(rand() * MEMBERS), "Nice!", now - rand() * YEAR);
    const cheer = db.prepare("insert or ignore into post_cheers (post_id, user_id) values (?, ?)");
    for (let i = 0; i < POSTS * 3; i++) cheer.run(1 + Math.floor(rand() * POSTS), 1 + Math.floor(rand() * MEMBERS));
    const message = db.prepare("insert into messages (sender, recipient, body, created_at) values (?, ?, ?, ?)");
    for (let i = 0; i < MEMBERS * 3; i++) message.run(1 + Math.floor(rand() * MEMBERS), i % 50 === 0 ? 1 : 1 + Math.floor(rand() * MEMBERS), "Hello", now - rand() * YEAR);
    const notif = db.prepare("insert into notifications (user_id, actor, kind, text, link, created_at) values (?, ?, 'cheer', 'x', '/home', ?)");
    for (let i = 0; i < MEMBERS * 7; i++) notif.run(i % 30 === 0 ? 1 : 1 + Math.floor(rand() * MEMBERS), 1 + Math.floor(rand() * MEMBERS), now - rand() * YEAR);
    const ask = db.prepare("insert into asks (author, title, body, topics, status, created_at) values (?, 'A question', 'Body', '[]', 'open', ?)");
    for (let i = 0; i < MEMBERS / 5; i++) ask.run(1 + Math.floor(rand() * MEMBERS), now - rand() * YEAR);
    db.exec("commit");
    const fillMs = Math.round(performance.now() - fillStart);

    const me = people.memberById(1)!;
    const results: Record<string, { median: number; worst: number }> = {
      "Home: noticeboard (40 notes)": time(() => posts.feedFor(me)),
      "Home: batchmates": time(() => people.batchmates(me)),
      "Nav: requests waiting": time(() => social.waitingRequests(me.id)),
      "Nav: unread messages": time(() => social.unreadMessages(me.id)),
      "Nav: unread notifications": time(() => social.unreadNotifications(me.id)),
      "People: search by name": time(() => people.searchMembers(me, { q: "member123" })),
      "People: search by skill": time(() => people.searchMembers(me, { q: "python" })),
      "People: search, no match": time(() => people.searchMembers(me, { q: "zzzzqq" })),
      "People: no search (newest)": time(() => people.searchMembers(me, {})),
      "People: branch + year": time(() => people.searchMembers(me, { branch: "CSE", year: 2012 })),
      "Member page": time(() => people.pageFor(me, 500)),
      "Member page: their notes": time(() => posts.feedFor(me, { authorId: 500, limit: 10 })),
      "Batch page: members": time(() => people.batchMembers("CSE", 2012)),
      "Connections page": time(() => social.connectionsOf(me.id)),
      "Messages: conversations": time(() => social.conversations(me)),
      "Messages: a thread": time(() => social.thread(me, 2)),
      Notifications: time(() => social.notificationsFor(me.id)),
      "Ask: lists": time(() => asks.asksFor(me)),
      "Ask: routing a question": time(() => asks.routeFor(me, "Python interviews", ["Python"]), 5),
      Events: time(() => events.eventsFor(me)),
      "Desk: numbers": time(() => desk.stats(me), 5),
      "Desk: team": time(() => desk.team(me), 5),
      "Desk: members list": time(() => desk.deskMembers(me, {}), 5)
    };
    if (process.env.SCALE_PLANS) {
      const plan = (sql: string, ...a: unknown[]) =>
        console.log(sql.slice(0, 70), "\n   ", (db.prepare(`explain query plan ${sql}`).all(...(a as never[])) as { detail: string }[]).map((r) => r.detail).join(" | "));
      plan("select count(*) as n from messages where recipient = ? and read_at is null", 1);
      plan("select count(*) as n from notifications where user_id = ? and read_at is null and (actor is null or (actor not in (select blocked from blocks where blocker = notifications.user_id) and actor not in (select blocker from blocks where blocked = notifications.user_id)))", 1);
      plan("select users.* from users left join profiles on profiles.user_id = users.id where users.suspended_at is null and users.id != ? and lower(users.name || ' ' || coalesce(profiles.data, '')) like ? order by users.created_at limit 400", 1, "%x%");
    }
    console.log(`\nFilled ${MEMBERS.toLocaleString("en-IN")} members and their activity in ${fillMs} ms. Times in ms (median / slowest of the runs):`);
    for (const [name, r] of Object.entries(results)) console.log(`  ${name.padEnd(32)} ${String(r.median).padStart(8)} ${String(r.worst).padStart(8)}`);
    expect(Object.keys(results).length).toBeGreaterThan(0);
  }, 600_000);
});
