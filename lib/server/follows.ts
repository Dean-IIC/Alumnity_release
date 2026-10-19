import { db } from "./db";
import { toUser, type User } from "./auth";
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

export async function follow(me: User, id: number): Promise<Result> {
  const other = await memberById(id);
  if (!other || other.id === me.id) return no("That member isn't here.");
  if (await blockedEitherWay(me.id, id)) return no("You can't follow this member.");
  if (!(await withinLimit(`follow:${me.id}`, 100, DAY))) return no("That's a lot of following today. Try again tomorrow.");
  const changes = await db().run("insert into follows (follower, followee, created_at) values (?, ?, ?) on conflict do nothing", me.id, id, Date.now());
  // Told the first time only: following, unfollowing and following again doesn't ping them again.
  const told = await db().one("select 1 from notifications where user_id = ? and actor = ? and kind = 'follow'", id, me.id);
  if (changes && !told) await notify(id, { actor: me.id, kind: "follow", text: `${me.name} started following you.`, link: `/people/${me.id}` });
  return { ok: true };
}

export async function unfollow(me: User, id: number): Promise<Result> {
  await db().run("delete from follows where follower = ? and followee = ?", me.id, id);
  return { ok: true };
}

export const isFollowing = async (followerId: number, followeeId: number) =>
  Boolean(await db().one("select 1 from follows where follower = ? and followee = ?", followerId, followeeId));

/** Who `userId` follows, as a set (for the feed and the stories bar). */
export async function followingIds(userId: number): Promise<Set<number>> {
  return new Set((await db().all<{ id: number }>("select followee as id from follows where follower = ?", userId)).map((r) => r.id));
}

/**
 * How many follow `userId`, and how many they follow: the same people followersOf and
 * followingOf list. "Following" used to count paused members too, so the numbers and the
 * lists disagreed.
 */
export async function followCounts(userId: number): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    db().one<{ n: number }>("select count(*) as n from follows join users on users.id = follows.follower where followee = ? and users.suspended_at is null", userId),
    db().one<{ n: number }>("select count(*) as n from follows join users on users.id = follows.followee where follower = ? and users.suspended_at is null", userId)
  ]);
  return { followers: Number(followers!.n), following: Number(following!.n) };
}

/**
 * Who follows `userId` (newest first), active members only. Home's "followers" count used
 * to open your own page, which lists nobody: this is the list it now opens (on Connections).
 */
export async function followersOf(userId: number, limit = 500): Promise<User[]> {
  return (
    await db().all(
      "select users.* from follows join users on users.id = follows.follower where follows.followee = ? and users.suspended_at is null order by follows.created_at desc limit ?",
      userId,
      limit
    )
  ).map(toUser);
}

/** Who `userId` follows (newest first), active members only. */
export async function followingOf(userId: number, limit = 500): Promise<User[]> {
  return (
    await db().all(
      "select users.* from follows join users on users.id = follows.followee where follows.follower = ? and users.suspended_at is null order by follows.created_at desc limit ?",
      userId,
      limit
    )
  ).map(toUser);
}

/** Called when a block is made: neither follows the other any more. */
export async function endFollowing(a: number, b: number) {
  await db().run("delete from follows where (follower = ? and followee = ?) or (follower = ? and followee = ?)", a, b, b, a);
}
