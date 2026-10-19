import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// An in-memory Postgres with the real schema, set before the modules load.
process.env.ALUMNITY_DB = "pglite";

type Fresh = typeof import("../lib/server/fresh-start");
let fresh: Fresh;
let db: typeof import("../lib/server/db").db;
let fake: import("../lib/server/auth-provider").FakeAuth;

const now = Date.now();
const rule = { superAdmins: ["boss@college.test"], admins: [] as string[] };
const ids: Record<string, number> = {};
const authOf: Record<string, string> = {};
/** The stand-in for the storage bucket. */
const files = new Set<string>();
/** Auth users whose deletion fails (a leftover, logged). */
const authFailsFor = new Set<string>();

const services = () => ({
  async deleteAuthUser(authId: string) {
    if (authFailsFor.has(authId)) throw new Error("Auth is down");
    await fake.deleteAccount(authId);
  },
  listFiles: async () => [...files],
  removeFiles: async (paths: string[]) => {
    for (const p of paths) files.delete(p);
    return [];
  }
});

async function person(key: string, role: string, extra: { college?: boolean; sample?: boolean; email?: string } = {}) {
  const email = extra.email ?? `${key}@example.com`;
  const authId = randomUUID();
  fake.accounts.set(email, { authId, password: "a long enough password", code: null });
  authOf[key] = authId;
  const row = await db().one<{ id: number }>(
    "insert into users (auth_id, email, name, role, college_account, sample, created_at) values (?::uuid, ?, ?, ?, ?, ?, ?) returning id",
    authId,
    email,
    `Person ${key}`,
    role,
    extra.college ? 1 : 0,
    extra.sample ? 1 : 0,
    now
  );
  ids[key] = row!.id;
  return row!.id;
}

/** Every public table's row count. */
async function counts() {
  const tables = await db().all<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
  const out: Record<string, number> = {};
  for (const { t } of tables) out[t] = (await db().one<{ n: number }>(`select count(*) as n from "${t}"`))!.n;
  return out;
}

const SOCIAL = [
  "posts",
  "post_cheers",
  "post_comments",
  "post_media",
  "post_tags",
  "messages",
  "message_hidden",
  "chat_cleared",
  "stories",
  "story_views",
  "connections",
  "follows",
  "blocks",
  "notifications",
  "asks",
  "ask_routes",
  "ask_messages",
  "groups",
  "group_members",
  "events",
  "rsvps",
  "reports",
  "push_subscriptions",
  "member_prefs",
  "auth_intents",
  "throttle",
  "media",
  "uploads"
];

beforeAll(async () => {
  fresh = await import("../lib/server/fresh-start");
  db = (await import("../lib/server/db")).db;
  const { FakeAuth } = await import("../lib/server/auth-provider");
  fake = new FakeAuth();

  // Kept: the college's account, an administrator, a super admin by config. Removed: everyone else.
  const college = await person("college", "alumnus", { college: true });
  const admin = await person("admin", "admin");
  const boss = await person("boss", "alumnus", { email: "boss@college.test" });
  const asha = await person("asha", "alumnus");
  const ravi = await person("ravi", "student");
  const teacher = await person("teacher", "faculty");
  await person("coord", "coordinator");
  await person("sample", "alumnus", { sample: true });

  // The register (as the tests load it), kept untouched.
  await db().run("insert into register (name, usn, branch, branch_name, programme, year) values ('Asha Rao', 'X1', 'CSE', 'Computer Science', 'B.Tech', 2012)");

  // Pages: the admin's has a photo, cover and pinned post (all going); Asha's goes with her.
  await db().run("insert into profiles (user_id, data, updated_at) values (?, ?, ?)", admin, JSON.stringify({ photo: { id: "m1", kind: "image" }, cover: { id: "m2", kind: "image" }, featured: 1, about: "The desk" }), now);
  await db().run("insert into profiles (user_id, data, updated_at) values (?, '{}', ?)", asha, now);
  await db().run("insert into profiles (user_id, data, updated_at) values (?, '{}', ?)", college, now);

  // Uploads, and their files.
  for (const [id, owner] of [["m1", admin], ["m2", admin], ["m3", asha], ["m4", asha]] as const) {
    await db().run("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, 'image', 'image/jpeg', 10, ?, ?)", id, owner, `${owner}/${id}.jpg`, now);
    files.add(`${owner}/${id}.jpg`);
    files.add(`${owner}/${id}.w160.webp`);
  }
  files.add(`pending/${asha}/u1`);
  await db().run("insert into uploads (id, user_id, use, size, created_at) values ('u1', ?, 'post', 10, ?)", asha, now);

  // Social data, from kept and removed accounts alike.
  const p1 = (await db().one<{ id: number }>("insert into posts (author, body, audience, created_at) values (?, 'From the college', 'everyone', ?) returning id", college, now))!.id;
  const p2 = (await db().one<{ id: number }>("insert into posts (author, body, audience, created_at, verified_by) values (?, 'Hello', 'everyone', ?, ?) returning id", asha, now, admin))!.id;
  await db().run("insert into posts (author, body, audience, created_at, repost_of) values (?, '', 'everyone', ?, ?)", ravi, now, p2);
  await db().run("insert into post_cheers (post_id, user_id) values (?, ?), (?, ?)", p1, asha, p2, admin);
  await db().run("insert into post_comments (post_id, author, body, created_at) values (?, ?, 'Nice', ?)", p1, ravi, now);
  await db().run("insert into post_media (post_id, media_id, position) values (?, 'm3', 0)", p2);
  await db().run("insert into post_tags (post_id, tag) values (?, 'job')", p2);
  const s1 = (await db().one<{ id: number }>("insert into stories (author, media_id, created_at, expires_at) values (?, 'm4', ?, ?) returning id", asha, now, now + 1000))!.id;
  await db().run("insert into story_views (story_id, user_id, viewed_at) values (?, ?, ?)", s1, admin, now);
  const m1 = (await db().one<{ id: number }>("insert into messages (sender, recipient, body, created_at, story_id) values (?, ?, 'Hi', ?, ?) returning id", admin, asha, now, s1))!.id;
  await db().run("insert into message_hidden (user_id, message_id, hidden_at) values (?, ?, ?)", asha, m1, now);
  await db().run("insert into chat_cleared (user_id, other_id, before_id, cleared_at) values (?, ?, ?, ?)", admin, asha, m1, now);
  await db().run("insert into connections (requester, addressee, status, created_at) values (?, ?, 'accepted', ?)", asha, admin, now);
  await db().run("insert into follows (follower, followee, created_at) values (?, ?, ?)", ravi, college, now);
  await db().run("insert into blocks (blocker, blocked, created_at) values (?, ?, ?)", boss, ravi, now);
  await db().run("insert into notifications (user_id, actor, kind, text, link, created_at) values (?, ?, 'x', 'x', '/', ?)", admin, asha, now);
  const a1 = (await db().one<{ id: number }>("insert into asks (author, title, body, status, taker, created_at) values (?, 'Q', 'Q?', 'taken', ?, ?) returning id", ravi, asha, now))!.id;
  await db().run("insert into ask_routes (ask_id, user_id, reason) values (?, ?, 'branch')", a1, asha);
  await db().run("insert into ask_messages (ask_id, author, body, created_at) values (?, ?, 'A', ?)", a1, asha, now);
  const g1 = (await db().one<{ id: number }>("insert into groups (name, kind, created_by, created_at) values ('G', 'open', ?, ?) returning id", teacher, now))!.id;
  await db().run("insert into group_members (group_id, user_id, created_at) values (?, ?, ?), (?, ?, ?)", g1, teacher, now, g1, admin, now);
  await db().run("insert into posts (author, body, audience, group_id, created_at) values (?, 'In the group', 'group', ?, ?)", admin, g1, now);
  const e1 = (await db().one<{ id: number }>("insert into events (organiser, title, body, starts_at, place, created_at) values (?, 'E', 'E', ?, 'Hall', ?) returning id", admin, now, now))!.id;
  await db().run("insert into rsvps (event_id, user_id, created_at) values (?, ?, ?)", e1, asha, now);
  await db().run("insert into reports (reporter, subject_kind, subject_id, reason, resolved_by, created_at) values (?, 'post', ?, 'spam', ?, ?)", asha, p1, admin, now);
  await db().run("insert into push_subscriptions (endpoint, user_id, p256dh, auth, created_at) values ('https://push', ?, 'k', 'a', ?)", admin, now);
  await db().run("insert into member_prefs (user_id) values (?), (?)", admin, asha);
  await db().run("insert into auth_intents (ticket, purpose, email, created_at, expires_at) values ('t', 'join', 'x@example.com', ?, ?)", now, now);
  await db().run("insert into throttle (key, at) values ('login:1', ?)", now);

  // The college's records: kept, with any removed account's name taken off them.
  const c1 = (await db().one<{ id: number }>("insert into causes (author, title, story, goal, cover, status, reviewed_by, created_at) values (?, 'Library', 'Books', 1000, 'm3', 'live', ?, ?) returning id", asha, admin, now))!.id;
  await db().run("insert into donations (cause_id, donor, amount, order_id, status, created_at) values (?, ?, 500, 'order_1', 'paid', ?), (?, ?, 200, 'order_2', 'paid', ?)", c1, asha, now, c1, admin, now);
  await db().run("insert into cause_payouts (cause_id, amount, note, paid_by, created_at) values (?, 300, 'Paid', ?, ?)", c1, asha, now);
  await db().run("insert into audit (actor, action, subject, created_at) values (?, 'pause', 'member', ?), (?, 'settings', 'site', ?)", asha, now, admin, now);
  await db().run("insert into settings (key, value, updated_by, updated_at) values ('site', '{}', ?, ?)", ravi, now);
  await db().run("insert into announcements (author, title, body, created_at) values (?, 'Welcome', 'Hi', ?)", teacher, now);
  await db().run("insert into staff_invites (email, name, role, invited_by, created_at, expires_at) values ('t2@college.test', 'T2', 'faculty', ?, ?, ?)", teacher, now, now);
});

describe("fresh start", () => {
  it("the dry run says who stays and what goes, and changes nothing", async () => {
    const before = await counts();
    const filesBefore = new Set(files);
    const plan = await fresh.planFreshStart(db(), services(), rule);

    expect(plan.blockers).toEqual([]);
    expect(plan.kept.map((k) => [k.email, k.reasons])).toEqual([
      ["college@example.com", ["college account"]],
      ["admin@example.com", ["role admin"]],
      ["boss@college.test", ["in ALUMNITY_SUPER_ADMINS"]]
    ]);
    expect(plan.removed.map((r) => r.email).sort()).toEqual(["asha@example.com", "coord@example.com", "ravi@example.com", "sample@example.com", "teacher@example.com"]);
    const step = (table: string, kind?: string, column?: string) => plan.steps.find((s) => s.table === table && (!kind || s.kind === kind) && (!column || s.column === column));
    expect(step("public.posts", "wipe")?.rows).toBe(4);
    expect(step("public.media", "wipe")?.rows).toBe(4);
    expect(step("public.donations", "null", "donor")?.rows).toBe(1);
    expect(step("public.audit", "null", "actor")?.rows).toBe(1);
    expect(step("public.profiles", "delete")?.rows).toBe(1);
    expect(step("public.profiles", "reset")?.rows).toBe(1);
    expect(step("public.users", "accounts")?.rows).toBe(5);
    // The college's tables are never emptied, and the register is never named.
    for (const kept of ["register", "donations", "audit", "causes", "cause_payouts", "settings", "announcements", "staff_invites"]) {
      expect(plan.steps.some((s) => s.table === `public.${kept}` && (s.kind === "wipe" || s.kind === "delete" || s.kind === "accounts"))).toBe(false);
    }
    expect(plan.files?.length).toBe(files.size);
    const printed = fresh.describePlan(plan).join("\n");
    expect(printed).toContain("Accounts to delete (5");
    expect(printed).toContain("boss@college.test");

    expect(await counts()).toEqual(before);
    expect(files).toEqual(filesBefore);
    expect(fake.accounts.size).toBe(8);
  });

  it("stops before changing anything when a kept table can't let go of a removed account", async () => {
    await db().exec("alter table audit alter column actor set not null");
    try {
      const before = await counts();
      const filesBefore = new Set(files);
      const plan = await fresh.planFreshStart(db(), services(), rule);
      expect(plan.blockers.join(" ")).toMatch(/public\.audit\.actor can't be null/);
      await expect(fresh.runFreshStart(db(), services(), rule)).rejects.toBeInstanceOf(fresh.FreshStartAborted);
      expect(await counts()).toEqual(before);
      expect(files).toEqual(filesBefore);
      expect(fake.accounts.size).toBe(8);
      expect((await db().one<{ n: number }>("select count(*) as n from audit where actor is not null"))!.n).toBe(2);
    } finally {
      await db().exec("alter table audit alter column actor drop not null");
    }
  });

  it("does it: kept accounts and the college's records stay, everything social goes", async () => {
    authFailsFor.add(authOf.coord);
    const lines: string[] = [];
    const done = await fresh.runFreshStart(db(), services(), rule, (l) => lines.push(l));

    // Accounts.
    const left = await db().all<{ email: string }>("select email from users order by id");
    expect(left.map((u) => u.email)).toEqual(["college@example.com", "admin@example.com", "boss@college.test"]);
    expect([...fake.accounts.keys()].sort()).toEqual(["admin@example.com", "boss@college.test", "college@example.com", "coord@example.com"]);
    expect(done.authDeleted).toBe(4);
    expect(done.authFailed).toEqual([authOf.coord]);
    expect(lines.join("\n")).toMatch(/not deleted: Auth is down/);

    // Social data: gone from everyone.
    const after = await counts();
    for (const t of SOCIAL) expect([t, after[t]]).toEqual([t, 0]);
    expect(files.size).toBe(0);
    expect(done.filesDeleted).toBe(9);

    // Kept members' pages stay, without the uploads and post that are gone.
    expect(after.profiles).toBe(2);
    const page = JSON.parse((await db().one<{ data: string }>("select data from profiles where user_id = ?", ids.admin))!.data);
    expect(page).toMatchObject({ photo: null, cover: null, featured: null, about: "The desk" });

    // The college's records: all there, removed accounts' names taken off.
    expect(after.register).toBe(1);
    expect(await db().all("select amount, donor from donations order by order_id")).toEqual([
      { amount: 500, donor: null },
      { amount: 200, donor: ids.admin }
    ]);
    expect(await db().all("select actor from audit order by id")).toEqual([{ actor: null }, { actor: ids.admin }]);
    expect(await db().one("select author, reviewed_by, cover, status from causes")).toEqual({ author: null, reviewed_by: ids.admin, cover: null, status: "live" });
    expect(await db().one("select amount, paid_by from cause_payouts")).toEqual({ amount: 300, paid_by: null });
    expect(await db().one("select key, updated_by from settings")).toEqual({ key: "site", updated_by: null });
    expect(await db().one("select title, author from announcements")).toEqual({ title: "Welcome", author: null });
    expect(await db().one("select email, invited_by from staff_invites")).toEqual({ email: "t2@college.test", invited_by: null });

    // Again: nothing left to do but the kept pages' empty fields, which are already empty.
    const again = await fresh.planFreshStart(db(), services(), rule);
    expect(again.removed).toEqual([]);
    expect(again.steps.every((s) => s.rows === 0)).toBe(true);
  });
});
