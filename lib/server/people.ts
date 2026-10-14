import { database } from "./db";
import { toUser, type User } from "./auth";
import { profileFor, profileOf, type Profile } from "./profile";

/*
 * Members and how they stand to each other: connected, asked, blocked. Everything that
 * shows one member to another goes through here, so blocks and "who can see this" hold
 * everywhere.
 */

export type Relation = "self" | "none" | "sent" | "received" | "connected" | "blocked" | "blocked-by";

/** An active member (not paused), or null. */
export function memberById(id: number): User | null {
  const row = database().prepare("select * from users where id = ? and suspended_at is null").get(id) as Record<string, unknown> | undefined;
  return row ? toUser(row) : null;
}

export const isSample = (id: number) =>
  Boolean((database().prepare("select sample from users where id = ?").get(id) as { sample: number } | undefined)?.sample);

export function relation(viewerId: number, otherId: number): Relation {
  if (viewerId === otherId) return "self";
  const db = database();
  if (db.prepare("select 1 from blocks where blocker = ? and blocked = ?").get(viewerId, otherId)) return "blocked";
  if (db.prepare("select 1 from blocks where blocker = ? and blocked = ?").get(otherId, viewerId)) return "blocked-by";
  const link = db
    .prepare("select requester, status from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)")
    .get(viewerId, otherId, otherId, viewerId) as { requester: number; status: string } | undefined;
  if (!link || link.status === "declined") return "none";
  if (link.status === "accepted") return "connected";
  return link.requester === viewerId ? "sent" : "received";
}

export const connected = (a: number, b: number) => relation(a, b) === "connected";

/** Whether either has blocked the other: then they don't see each other anywhere. */
export function blockedEitherWay(a: number, b: number) {
  return Boolean(database().prepare("select 1 from blocks where (blocker = ? and blocked = ?) or (blocker = ? and blocked = ?)").get(a, b, b, a));
}

/** A member's page as `viewer` may see it (null if they mustn't see it at all). */
export function pageFor(viewer: User, ownerId: number): { owner: User; profile: Profile; relation: Relation } | null {
  const owner = memberById(ownerId);
  if (!owner) return null;
  const rel = relation(viewer.id, ownerId);
  if (rel === "blocked-by") return null;
  return { owner, profile: profileFor(viewer, owner, profileOf(owner.id), rel === "connected"), relation: rel };
}

export type SearchQuery = { q?: string; branch?: string; year?: number; help?: "mentor" | "refer" | "talk" };

export type Found = { member: User; profile: Profile; relation: Relation };

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);

/**
 * Members matching a search: every word must appear in their name, or in what the viewer
 * is allowed to see of their page (what they do, where, city, skills). Newest members last.
 */
export function searchMembers(viewer: User, query: SearchQuery, limit = 60): Found[] {
  const rows = database()
    .prepare(
      `select * from users where suspended_at is null and id != ?
       and id not in (select blocked from blocks where blocker = ?) and id not in (select blocker from blocks where blocked = ?)
       ${query.branch ? "and branch = ?" : ""} ${query.year ? "and joined = ?" : ""}
       order by created_at`
    )
    .all(viewer.id, viewer.id, viewer.id, ...(query.branch ? [query.branch] : []), ...(query.year ? [query.year] : [])) as Record<string, unknown>[];
  const terms = words(query.q ?? "");
  const found: Found[] = [];
  for (const row of rows) {
    const member = toUser(row);
    const rel = relation(viewer.id, member.id);
    const profile = profileFor(viewer, member, profileOf(member.id), rel === "connected");
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

/** The viewer's batch on Alumnity (same branch, course and year), them excluded. */
export function batchmates(person: User): User[] {
  if (!person.branch || !person.joined) return [];
  return (
    database()
      .prepare("select * from users where branch = ? and joined = ? and programme is ? and id != ? and suspended_at is null order by name")
      .all(person.branch, person.joined, person.programme, person.id) as Record<string, unknown>[]
  ).map(toUser);
}

/** Everyone on Alumnity from one batch (for its page). */
export function batchMembers(branch: string, joined: number): User[] {
  return (
    database().prepare("select * from users where branch = ? and joined = ? and suspended_at is null order by name").all(branch, joined) as Record<string, unknown>[]
  ).map(toUser);
}
