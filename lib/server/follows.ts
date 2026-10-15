import { database } from "./db";
import type { User } from "./auth";
import { blockedEitherWay, memberById } from "./people";
import { notify, type Result } from "./social";
import { withinLimit } from "./throttle";

/*
 * Following: one way, without asking, like following a senior whose posts you want to
 * see. Connecting is still the two-way, asked-for bond (and the one that opens messages).
 * A block ends following both ways.
 */

const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });

export function follow(me: User, id: number): Result {
  const other = memberById(id);
  if (!other || other.id === me.id) return no("That member isn't here.");
  if (blockedEitherWay(me.id, id)) return no("You can't follow this member.");
  if (!withinLimit(`follow:${me.id}`, 100, DAY)) return no("That's a lot of following today. Try again tomorrow.");
  const { changes } = database().prepare("insert or ignore into follows (follower, followee, created_at) values (?, ?, ?)").run(me.id, id, Date.now());
  // Told the first time only: following, unfollowing and following again doesn't ping them again.
  const told = database().prepare("select 1 from notifications where user_id = ? and actor = ? and kind = 'follow'").get(id, me.id);
  if (changes && !told) notify(id, { actor: me.id, kind: "follow", text: `${me.name} started following you.`, link: `/people/${me.id}` });
  return { ok: true };
}

export function unfollow(me: User, id: number): Result {
  database().prepare("delete from follows where follower = ? and followee = ?").run(me.id, id);
  return { ok: true };
}

export const isFollowing = (followerId: number, followeeId: number) =>
  Boolean(database().prepare("select 1 from follows where follower = ? and followee = ?").get(followerId, followeeId));

/** Who `userId` follows, as a set (for the feed and the stories bar). */
export function followingIds(userId: number): Set<number> {
  return new Set((database().prepare("select followee as id from follows where follower = ?").all(userId) as { id: number }[]).map((r) => r.id));
}

export function followCounts(userId: number): { followers: number; following: number } {
  const db = database();
  return {
    followers: (db.prepare("select count(*) as n from follows join users on users.id = follows.follower where followee = ? and users.suspended_at is null").get(userId) as { n: number }).n,
    following: (db.prepare("select count(*) as n from follows where follower = ?").get(userId) as { n: number }).n
  };
}

/** Called when a block is made: neither follows the other any more. */
export function endFollowing(a: number, b: number) {
  database().prepare("delete from follows where (follower = ? and followee = ?) or (follower = ? and followee = ?)").run(a, b, b, a);
}
