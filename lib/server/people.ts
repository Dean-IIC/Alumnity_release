import { db, type Row } from "./db";
import { toUser, type User } from "./auth";
import { profileFor, profileFromData, profileOf, type Profile } from "./profile";

/*
 * Members and how they stand to each other: connected, asked, blocked. Everything that
 * shows one member to another goes through here, so blocks and "who can see this" hold
 * everywhere.
 */

export type Relation = "self" | "none" | "sent" | "received" | "connected" | "blocked" | "blocked-by";

/** An active member (not paused), or null. */
export async function memberById(id: number): Promise<User | null> {
  if (!Number.isSafeInteger(id)) return null;
  const row = await db().one("select * from users where id = ? and suspended_at is null", id);
  return row ? toUser(row) : null;
}

/** Several members at once (active ones only), by id. */
export async function membersByIds(ids: number[]): Promise<Map<number, User>> {
  const wanted = [...new Set(ids)].filter(Number.isSafeInteger);
  if (!wanted.length) return new Map();
  const rows = await db().all(`select * from users where suspended_at is null and id in (${wanted.map(() => "?").join(",")})`, ...wanted);
  return new Map(rows.map((r) => [Number(r.id), toUser(r)]));
}

export const isSample = async (id: number) => Boolean((await db().one<{ sample: number }>("select sample from users where id = ?", id))?.sample);

export async function relation(viewerId: number, otherId: number): Promise<Relation> {
  if (viewerId === otherId) return "self";
  const [blocks, link] = await Promise.all([
    db().all<{ blocker: number }>("select blocker from blocks where (blocker = ? and blocked = ?) or (blocker = ? and blocked = ?)", viewerId, otherId, otherId, viewerId),
    db().one<{ requester: number; status: string }>(
      "select requester, status from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)",
      viewerId,
      otherId,
      otherId,
      viewerId
    )
  ]);
  if (blocks.some((b) => b.blocker === viewerId)) return "blocked";
  if (blocks.length) return "blocked-by";
  if (!link) return "none";
  // A declined request still looks sent to whoever sent it (they aren't told), so they
  // can't simply ask again; to the one who declined, it's as if there were none.
  if (link.status === "declined") return link.requester === viewerId ? "sent" : "none";
  if (link.status === "accepted") return "connected";
  return link.requester === viewerId ? "sent" : "received";
}

export const connected = async (a: number, b: number) => (await relation(a, b)) === "connected";

/** Everyone `userId` is connected to, as a set: one query, for pages that check many people. */
export async function connectionIds(userId: number): Promise<Set<number>> {
  const rows = await db().all<{ id: number }>(
    "select addressee as id from connections where requester = ? and status = 'accepted' union select requester from connections where addressee = ? and status = 'accepted'",
    userId,
    userId
  );
  return new Set(rows.map((r) => r.id));
}

/**
 * How `viewerId` stands to everyone, read in three queries: for lists (search) that would
 * otherwise ask about each person separately. Gives the same answers as relation().
 */
export async function relationsOf(viewerId: number): Promise<(otherId: number) => Relation> {
  const [iBlockedRows, blockedMeRows, links] = await Promise.all([
    db().all<{ id: number }>("select blocked as id from blocks where blocker = ?", viewerId),
    db().all<{ id: number }>("select blocker as id from blocks where blocked = ?", viewerId),
    db().all<{ requester: number; addressee: number; status: string }>("select requester, addressee, status from connections where requester = ? or addressee = ?", viewerId, viewerId)
  ]);
  const iBlocked = new Set(iBlockedRows.map((r) => r.id));
  const blockedMe = new Set(blockedMeRows.map((r) => r.id));
  const byOther = new Map<number, Relation>();
  for (const l of links) {
    const mine = l.requester === viewerId;
    const other = mine ? l.addressee : l.requester;
    byOther.set(other, l.status === "accepted" ? "connected" : l.status === "pending" ? (mine ? "sent" : "received") : mine ? "sent" : "none");
  }
  return (otherId) => {
    if (otherId === viewerId) return "self";
    if (iBlocked.has(otherId)) return "blocked";
    if (blockedMe.has(otherId)) return "blocked-by";
    return byOther.get(otherId) ?? "none";
  };
}

/** Everyone `userId` has blocked or been blocked by, as a set. */
export async function blockIds(userId: number): Promise<Set<number>> {
  const rows = await db().all<{ id: number }>("select blocked as id from blocks where blocker = ? union select blocker from blocks where blocked = ?", userId, userId);
  return new Set(rows.map((r) => r.id));
}

/** Whether either has blocked the other: then they don't see each other anywhere. */
export async function blockedEitherWay(a: number, b: number): Promise<boolean> {
  return Boolean(await db().one("select 1 from blocks where (blocker = ? and blocked = ?) or (blocker = ? and blocked = ?)", a, b, b, a));
}

/** A member's page as `viewer` may see it (null if they mustn't see it at all). */
export async function pageFor(viewer: User, ownerId: number): Promise<{ owner: User; profile: Profile; relation: Relation } | null> {
  const owner = await memberById(ownerId);
  if (!owner) return null;
  const rel = await relation(viewer.id, ownerId);
  if (rel === "blocked-by") return null;
  return { owner, profile: profileFor(viewer, owner, await profileOf(owner.id), rel === "connected"), relation: rel };
}

export type SearchQuery = { q?: string; branch?: string; year?: number; help?: "mentor" | "refer" | "talk" };

export type Found = { member: User; profile: Profile; relation: Relation };

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);

/**
 * Members matching a search: every word must appear in their name, or in what the viewer
 * is allowed to see of their page (what they do, where, city, skills). Newest members first.
 */
/**
 * A person, not an account kept by the college (users.college_account: the "HKBK Alumni
 * Association" that owns the old portal's posts): only people are suggested or found.
 */
const PERSON = "users.college_account = 0";

export async function searchMembers(viewer: User, query: SearchQuery, limit = 60): Promise<Found[]> {
  const terms = words(query.q ?? "").slice(0, 6);
  // A cheap first pass in SQL (each word somewhere in their name or page), then the exact
  // match below, against only what the viewer may see. Bounded, so no search is expensive.
  const like = terms.map(() => "and lower(users.name || ' ' || coalesce(users.branch_name, '') || ' ' || coalesce(profiles.data, '')) like ?").join(" ");
  const [rows, relationTo] = await Promise.all([
    db().all(
      `select users.*, profiles.data as profile_data from users left join profiles on profiles.user_id = users.id
       where users.suspended_at is null and users.id != ? and ${PERSON}
       and users.id not in (select blocked from blocks where blocker = ?) and users.id not in (select blocker from blocks where blocked = ?)
       ${query.branch ? "and users.branch = ?" : ""} ${query.year ? "and users.joined = ?" : ""} ${like}
       order by users.created_at desc limit 400`,
      viewer.id,
      viewer.id,
      viewer.id,
      ...(query.branch ? [query.branch] : []),
      ...(query.year ? [query.year] : []),
      ...terms.map((t) => `%${t.replace(/[%_\\]/g, "")}%`)
    ),
    relationsOf(viewer.id)
  ]);
  const found: Found[] = [];
  for (const row of rows) {
    const member = toUser(row);
    const rel = relationTo(member.id);
    const profile = profileFor(viewer, member, profileFromData((row.profile_data as string) ?? null), rel === "connected");
    if (query.help && !profile.happyTo[query.help]) continue;
    if (terms.length) {
      const hay = words([member.name, member.branchName ?? "", profile.title, profile.company, profile.city, ...profile.skills].join(" "));
      if (!terms.every((t) => hay.some((h) => h.startsWith(t)))) continue;
    }
    found.push({ member, profile, relation: rel });
    if (found.length >= limit) break;
  }
  return found;
}

const users = (rows: Row[]) => rows.map(toUser);

/**
 * People `me` might want to know, for Home: not yet connected (or asked), not blocked
 * either way; those from their branch and year first, then their branch, then everyone,
 * newest members first. Works on a young site, when nobody from their batch has joined.
 */
export async function peopleToMeet(me: User, limit = 4): Promise<User[]> {
  return users(
    await db().all(
      `select * from users
       where id != ? and suspended_at is null and ${PERSON.replace("users.", "")}
       and id not in (select blocked from blocks where blocker = ?) and id not in (select blocker from blocks where blocked = ?)
       and id not in (select addressee from connections where requester = ?) and id not in (select requester from connections where addressee = ?)
       order by (branch is not distinct from ? and joined is not distinct from ?) desc, (branch is not distinct from ?) desc, created_at desc
       limit ?`,
      me.id,
      me.id,
      me.id,
      me.id,
      me.id,
      me.branch,
      me.joined,
      me.branch,
      limit
    )
  );
}

/** How many active members there are (sample members, in development, aren't counted). */
export async function memberCount(): Promise<number> {
  return (await db().one<{ n: number }>("select count(*) as n from users where suspended_at is null and sample = 0"))?.n ?? 0;
}

/** The viewer's batch on Alumnity (same branch, course and year), them excluded. */
export async function batchmates(person: User): Promise<User[]> {
  if (!person.branch || !person.joined) return [];
  return users(
    await db().all(
      "select * from users where branch = ? and joined = ? and programme is not distinct from ? and id != ? and suspended_at is null order by name",
      person.branch,
      person.joined,
      person.programme,
      person.id
    )
  );
}

/** Everyone on Alumnity from one batch (for its page). */
export async function batchMembers(branch: string, joined: number): Promise<User[]> {
  return users(await db().all("select * from users where branch = ? and joined = ? and suspended_at is null order by name", branch, joined));
}
