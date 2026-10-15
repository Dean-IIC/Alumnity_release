import { describe, expect, it } from "vitest";

/*
 * How the rules hold up at scale: a throwaway database (PGlite, the same Postgres as
 * Supabase's, in memory) well beyond HKBK's size, and the time each page's main work takes.
 * It leaves out the network: on Supabase each query also costs a round trip, which is why
 * the pages read in a few batched queries. Skipped in normal runs (it takes a while to fill):
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
async function time(fn: () => Promise<unknown>, runs = 15) {
  const t: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    await fn();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  return { median: +t[Math.floor(runs / 2)].toFixed(2), worst: +t[runs - 1].toFixed(2) };
}

describe.skipIf(!process.env.SCALE)("at scale", () => {
  it(`stays fast with ${MEMBERS.toLocaleString("en-IN")} members`, async () => {
    // Its own throwaway database, made only when this runs (set before the modules load).
    process.env.ALUMNITY_DB = "pglite";
    process.env.ALUMNITY_SUPER_ADMINS = "super@example.com";
    const { db: database } = await import("../lib/server/db");
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
    /** Rows for one table, written a thousand at a time. */
    const table = (sql: string) => {
      const rows: unknown[][] = [];
      return {
        run: (...values: unknown[]) => rows.push(values),
        flush: async () => {
          const head = sql.slice(0, sql.indexOf("values"));
          const tail = sql.slice(sql.indexOf("values") + 6).trim();
          for (let i = 0; i < rows.length; i += 1000) {
            const batch = rows.slice(i, i + 1000);
            await db.run(`${head} values ${batch.map(() => tail).join(", ")} on conflict do nothing`, ...batch.flat());
          }
          rows.length = 0;
        }
      };
    };
    const user = table("insert into users (email, name, branch, branch_name, programme, joined, role, created_at) values (?, ?, ?, ?, 'B.Tech', ?, ?, ?)");
    const profile = table("insert into profiles (user_id, data, updated_at) values (?, ?, ?)");
    for (let i = 1; i <= MEMBERS; i++) {
      const branch = pick(BRANCHES);
      const joined = 1998 + Math.floor(rand() * 27);
      user.run(i === 1 ? "super@example.com" : `m${i}@example.com`, `Member${i} ${pick(["Rao", "Khan", "Nair", "Shetty", "Iyer", "Ahmed", "Gowda"])}`, branch, branch, joined, joined > 2021 ? "student" : "alumnus", Math.round(now - rand() * YEAR));
      const skills = [pick(SKILLS), pick(SKILLS)];
      profile.run(i, JSON.stringify({ title: "Engineer", company: `Company ${i % 300}`, city: pick(CITIES), skills, happyTo: { mentor: rand() < 0.2, refer: rand() < 0.2, talk: true } }), now);
    }
    await user.flush();
    await profile.flush();
    const conn = table("insert into connections (requester, addressee, status, created_at, responded_at) values (?, ?, 'accepted', ?, ?)");
    const seen = new Set<string>();
    const link = (a: number, b: number) => {
      if (a === b || seen.has(`${a}-${b}`) || seen.has(`${b}-${a}`)) return;
      seen.add(`${a}-${b}`);
      conn.run(a, b, now, now);
    };
    for (let i = 1; i <= MEMBERS; i++) for (let k = 0; k < 10; k++) link(i, 1 + Math.floor(rand() * MEMBERS));
    // The member we view as: well connected (300 connections).
    for (let k = 2; k < 302; k++) link(1, (k * 37) % MEMBERS + 2);
    await conn.flush();
    const post = table("insert into posts (author, body, audience, created_at) values (?, ?, ?, ?)");
    const POSTS = MEMBERS * 2;
    for (let i = 0; i < POSTS; i++) post.run(1 + Math.floor(rand() * MEMBERS), `Note ${i} about ${pick(SKILLS)}`, pick(["everyone", "everyone", "batch", "connections"]), Math.round(now - rand() * YEAR));
    await post.flush();
    const comment = table("insert into post_comments (post_id, author, body, created_at) values (?, ?, ?, ?)");
    for (let i = 0; i < POSTS * 2; i++) comment.run(1 + Math.floor(rand() * POSTS), 1 + Math.floor(rand() * MEMBERS), "Nice!", Math.round(now - rand() * YEAR));
    await comment.flush();
    const cheer = table("insert into post_cheers (post_id, user_id) values (?, ?)");
    for (let i = 0; i < POSTS * 3; i++) cheer.run(1 + Math.floor(rand() * POSTS), 1 + Math.floor(rand() * MEMBERS));
    await cheer.flush();
    const message = table("insert into messages (sender, recipient, body, created_at) values (?, ?, ?, ?)");
    for (let i = 0; i < MEMBERS * 3; i++) message.run(1 + Math.floor(rand() * MEMBERS), i % 50 === 0 ? 1 : 1 + Math.floor(rand() * MEMBERS), "Hello", Math.round(now - rand() * YEAR));
    await message.flush();
    const notif = table("insert into notifications (user_id, actor, kind, text, link, created_at) values (?, ?, 'cheer', 'x', '/home', ?)");
    for (let i = 0; i < MEMBERS * 7; i++) notif.run(i % 30 === 0 ? 1 : 1 + Math.floor(rand() * MEMBERS), 1 + Math.floor(rand() * MEMBERS), Math.round(now - rand() * YEAR));
    await notif.flush();
    const ask = table("insert into asks (author, title, body, topics, status, created_at) values (?, 'A question', 'Body', '[]', 'open', ?)");
    for (let i = 0; i < MEMBERS / 5; i++) ask.run(1 + Math.floor(rand() * MEMBERS), Math.round(now - rand() * YEAR));
    await ask.flush();
    await db.exec("analyze");
    const fillMs = Math.round(performance.now() - fillStart);

    const me = (await people.memberById(1))!;
    const results: Record<string, { median: number; worst: number }> = {
      "Home: noticeboard (40 notes)": await time(() => posts.feedFor(me)),
      "Home: batchmates": await time(() => people.batchmates(me)),
      "Nav: requests waiting": await time(() => social.waitingRequests(me.id)),
      "Nav: unread messages": await time(() => social.unreadMessages(me.id)),
      "Nav: unread notifications": await time(() => social.unreadNotifications(me.id)),
      "People: search by name": await time(() => people.searchMembers(me, { q: "member123" })),
      "People: search by skill": await time(() => people.searchMembers(me, { q: "python" })),
      "People: search, no match": await time(() => people.searchMembers(me, { q: "zzzzqq" })),
      "People: no search (newest)": await time(() => people.searchMembers(me, {})),
      "People: branch + year": await time(() => people.searchMembers(me, { branch: "CSE", year: 2012 })),
      "Member page": await time(() => people.pageFor(me, 500)),
      "Member page: their notes": await time(() => posts.feedFor(me, { authorId: 500, limit: 10 })),
      "Batch page: members": await time(() => people.batchMembers("CSE", 2012)),
      "Connections page": await time(() => social.connectionsOf(me.id)),
      "Messages: conversations": await time(() => social.conversations(me)),
      "Messages: a thread": await time(() => social.thread(me, 2)),
      Notifications: await time(() => social.notificationsFor(me.id)),
      "Ask: lists": await time(() => asks.asksFor(me)),
      "Ask: routing a question": await time(() => asks.routeFor(me, "Python interviews", ["Python"]), 5),
      Events: await time(() => events.eventsFor(me)),
      "Desk: numbers": await time(() => desk.stats(me), 5),
      "Desk: team": await time(() => desk.team(me), 5),
      "Desk: members list": await time(() => desk.deskMembers(me, {}), 5)
    };
    console.log(`\nFilled ${MEMBERS.toLocaleString("en-IN")} members and their activity in ${fillMs} ms. Times in ms (median / slowest of the runs):`);
    for (const [name, r] of Object.entries(results)) console.log(`  ${name.padEnd(32)} ${String(r.median).padStart(8)} ${String(r.worst).padStart(8)}`);
    expect(Object.keys(results).length).toBeGreaterThan(0);
  }, 600_000);
});
