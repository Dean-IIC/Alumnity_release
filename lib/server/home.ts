import { db } from "./db";
import { toUser, type User } from "./auth";
import { blockIds, connectionIds } from "./people";
import { profileFor, profileFromData, type Profile } from "./profile";

/*
 * What each person's Home leads with (components/home/role-focus.tsx): seniors who mentor
 * (for students), students looking for help (for alumni and teachers), a department in
 * numbers (for teachers). Every person shown is only shown as the viewer may see them.
 */

const WEEK = 7 * 24 * 60 * 60_000;

type Seen = { member: User; profile: Profile };

/** Read people with their pages in one query, and keep only what `viewer` may see of each. */
async function seenAs(viewer: User, sql: string, ...params: unknown[]): Promise<Seen[]> {
  const [rows, blocked, connections] = await Promise.all([db().all(sql, ...params), blockIds(viewer.id), connectionIds(viewer.id)]);
  return rows.flatMap((r) => {
    const member = toUser(r);
    if (blocked.has(member.id)) return [];
    return [{ member, profile: profileFor(viewer, member, profileFromData((r.profile_data as string) ?? null), connections.has(member.id)) }];
  });
}

/** Alumni and teachers who said they're happy to mentor: the viewer's branch first. */
export async function mentorsFor(viewer: User, limit = 4): Promise<Seen[]> {
  const found = await seenAs(
    viewer,
    `select users.*, profiles.data as profile_data from users join profiles on profiles.user_id = users.id
     where users.id != ? and users.suspended_at is null and users.role != 'student'
       and (profiles.data::jsonb -> 'happyTo' ->> 'mentor') = 'true'
     order by (users.branch is not distinct from ?) desc, users.created_at desc limit 40`,
    viewer.id,
    viewer.branch
  );
  // Only those whose "happy to" the viewer may actually see.
  return found.filter((f) => f.profile.happyTo.mentor).slice(0, limit);
}

/** Students who said they're looking for a mentor, an internship or a referral: the viewer's branch first. */
export async function studentsSeeking(viewer: User, limit = 4): Promise<Seen[]> {
  const found = await seenAs(
    viewer,
    `select users.*, profiles.data as profile_data from users join profiles on profiles.user_id = users.id
     where users.id != ? and users.suspended_at is null and users.role = 'student'
       and ((profiles.data::jsonb -> 'seeking' ->> 'mentor') = 'true' or (profiles.data::jsonb -> 'seeking' ->> 'internship') = 'true'
         or (profiles.data::jsonb -> 'seeking' ->> 'referral') = 'true')
     order by (users.branch is not distinct from ?) desc, profiles.updated_at desc limit 40`,
    viewer.id,
    viewer.branch
  );
  return found.filter((f) => Object.values(f.profile.seeking).some(Boolean)).slice(0, limit);
}

/** A department on Alumnity: its students and alumni, and who joined this week. */
export async function departmentCounts(branch: string | null): Promise<{ students: number; alumni: number; newThisWeek: number; staff: number } | null> {
  if (!branch) return null;
  const row = await db().one<{ students: number; alumni: number; fresh: number; staff: number }>(
    `select count(*) filter (where role = 'student') as students, count(*) filter (where role = 'alumnus') as alumni,
       count(*) filter (where role not in ('student', 'alumnus')) as staff, count(*) filter (where created_at > ?) as fresh
     from users where branch = ? and suspended_at is null and sample = 0`,
    Date.now() - WEEK,
    branch
  );
  return row ? { students: row.students, alumni: row.alumni, newThisWeek: row.fresh, staff: row.staff } : null;
}

/** The newest alumni from a department. */
export async function newestAlumni(viewer: User, branch: string | null, limit = 4): Promise<User[]> {
  if (!branch) return [];
  const blocked = await blockIds(viewer.id);
  return (await db().all("select * from users where branch = ? and role = 'alumnus' and suspended_at is null and id != ? order by created_at desc limit ?", branch, viewer.id, limit + 5))
    .map(toUser)
    .filter((u) => !blocked.has(u.id))
    .slice(0, limit);
}

/** The events someone has put up that are still to come, with who's coming. */
export async function myUpcomingEvents(me: User): Promise<{ id: number; title: string; startsAt: number; going: number; capacity: number | null }[]> {
  return db().all(
    `select events.id, events.title, events.starts_at as "startsAt", events.capacity, (select count(*) from rsvps where rsvps.event_id = events.id) as going
     from events where organiser = ? and cancelled_at is null and coalesce(ends_at, starts_at) >= ? order by starts_at limit 5`,
    me.id,
    Date.now()
  );
}

/** For the desk's Home: this week, in a few numbers. */
export async function weekInNumbers(): Promise<{ joined: number; posts: number; asks: number; answered: number }> {
  const since = Date.now() - WEEK;
  const row = await db().one<{ joined: number; posts: number; asks: number; answered: number }>(
    `select (select count(*) from users where created_at > ? and sample = 0) as joined,
            (select count(*) from posts where created_at > ? and removed_at is null) as posts,
            (select count(*) from asks where created_at > ?) as asks,
            (select count(*) from asks where answered_at > ?) as answered`,
    since,
    since,
    since,
    since
  );
  return row ?? { joined: 0, posts: 0, asks: 0, answered: 0 };
}

/** For the desk's getting-started steps: whether anyone's been invited, or an announcement put up. */
export async function deskBeginnings(): Promise<{ invited: number; announced: number }> {
  const row = await db().one<{ invited: number; announced: number }>(
    "select (select count(*) from staff_invites) as invited, (select count(*) from announcements) as announced"
  );
  return row ?? { invited: 0, announced: 0 };
}
