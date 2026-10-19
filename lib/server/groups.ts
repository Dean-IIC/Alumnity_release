import { db } from "./db";
import type { User } from "./auth";
import { blockIds, membersByIds } from "./people";
import { isModerator } from "./roles";
import { notify, type Result } from "./social";
import { withinLimit } from "./throttle";

/*
 * Groups: a class of 2012, the robotics club's alumni, people in Dubai, a hiring circle.
 * Any member may start one. Open groups: anyone may read and join. Private groups: you
 * ask to join and an admin of the group lets you in; only members see what's in them.
 * Posts in a group are for the group alone (lib/server/posts.ts): they never show on Home.
 *
 * Each group has one owner (who started it, or whom they handed it to) and any number of
 * admins, who let people in, remove members and edit it. The college desk can take a group
 * down, like anything else.
 */

export type GroupKind = "open" | "private";
export type GroupRole = "owner" | "admin" | "member";
export const GROUP_LIMITS = { name: 80, about: 1000 } as const;

export type Group = {
  id: number;
  name: string;
  about: string;
  kind: GroupKind;
  members: number;
  createdAt: number;
  /** The viewer's place in it. */
  my: { role: GroupRole; status: "member" | "pending" } | null;
};

export type GroupMember = { member: User; role: GroupRole; since: number };

const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });
const NOT_HERE = "We couldn't find that group.";

type GroupRow = { id: number; name: string; about: string; kind: GroupKind; created_at: number; removed_at: number | null };

async function toGroups(rows: GroupRow[], viewer: User): Promise<Group[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const q = ids.map(() => "?").join(",");
  const [counts, mine] = await Promise.all([
    db().all<{ group_id: number; n: number }>(
      `select group_id, count(*) as n from group_members join users on users.id = group_members.user_id
       where group_id in (${q}) and status = 'member' and users.suspended_at is null group by group_id`,
      ...ids
    ),
    db().all<{ group_id: number; role: GroupRole; status: "member" | "pending" }>(`select group_id, role, status from group_members where user_id = ? and group_id in (${q})`, viewer.id, ...ids)
  ]);
  return rows.map((r) => {
    const m = mine.find((x) => x.group_id === r.id);
    return {
      id: r.id,
      name: r.name,
      about: r.about,
      kind: r.kind,
      members: counts.find((c) => c.group_id === r.id)?.n ?? 0,
      createdAt: r.created_at,
      my: m ? { role: m.role, status: m.status } : null
    };
  });
}

const groupRow = (id: number) => (Number.isSafeInteger(id) ? db().one<GroupRow>("select * from groups where id = ? and removed_at is null", id) : Promise.resolve(undefined));

async function membership(groupId: number, userId: number) {
  return db().one<{ role: GroupRole; status: "member" | "pending" }>("select role, status from group_members where group_id = ? and user_id = ?", groupId, userId);
}

/** Whether `viewer` may read what's in a group: any member for open groups, members only for private ones. */
export async function canReadGroup(viewer: User, groupId: number): Promise<boolean> {
  const g = await groupRow(groupId);
  if (!g) return false;
  if (g.kind === "open") return true;
  return (await membership(groupId, viewer.id))?.status === "member";
}

/** The groups `userId` is in (for the feed's visibility checks): one query. */
export async function memberGroupIds(userId: number): Promise<Set<number>> {
  const rows = await db().all<{ group_id: number }>("select group_id from group_members where user_id = ? and status = 'member'", userId);
  return new Set(rows.map((r) => r.group_id));
}

/** A group as `viewer` sees it (null if it isn't there). Private groups show their name and about to anyone, so people can ask to join. */
export async function groupFor(viewer: User, id: number): Promise<Group | null> {
  const row = await groupRow(id);
  return row ? (await toGroups([row], viewer))[0] : null;
}

/** Your groups (and those you've asked to join), and open groups to find. */
export async function groupsFor(viewer: User, q = ""): Promise<{ mine: Group[]; discover: Group[] }> {
  const like = `%${q.trim().toLowerCase().replace(/[%_\\]/g, "")}%`;
  const [mine, discover] = await Promise.all([
    db().all<GroupRow>(
      "select groups.* from groups join group_members on group_members.group_id = groups.id where group_members.user_id = ? and groups.removed_at is null order by groups.name limit 200",
      viewer.id
    ),
    db().all<GroupRow>(
      `select groups.*, (select count(*) from group_members m where m.group_id = groups.id and m.status = 'member') as size
       from groups where removed_at is null and lower(name || ' ' || about) like ?
       and id not in (select group_id from group_members where user_id = ?)
       order by size desc, created_at desc limit 30`,
      like,
      viewer.id
    )
  ]);
  const [a, b] = await Promise.all([toGroups(mine, viewer), toGroups(discover, viewer)]);
  return { mine: a, discover: b };
}

export async function createGroup(me: User, input: { name: string; about: string; kind: string }): Promise<Result & { id?: number }> {
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, GROUP_LIMITS.name);
  const about = input.about.trim().slice(0, GROUP_LIMITS.about);
  if (name.length < 3) return no("Give the group a name (at least three letters).");
  if (input.kind !== "open" && input.kind !== "private") return no("Choose open or private.");
  if (!(await withinLimit(`group:${me.id}`, 3, DAY))) return no("You can start up to three groups a day. Please try again tomorrow.");
  const id = await db().tx(async (t) => {
    const row = await t.one<{ id: number }>("insert into groups (name, about, kind, created_by, created_at) values (?, ?, ?, ?, ?) returning id", name, about, input.kind, me.id, Date.now());
    await t.run("insert into group_members (group_id, user_id, role, status, created_at) values (?, ?, 'owner', 'member', ?)", row!.id, me.id, Date.now());
    return row!.id;
  });
  return { ok: true, id };
}

const admins = (groupId: number) =>
  db().all<{ user_id: number }>("select user_id from group_members where group_id = ? and role in ('owner', 'admin') and status = 'member'", groupId);

const canManage = (m: { role: GroupRole; status: string } | undefined) => m?.status === "member" && (m.role === "owner" || m.role === "admin");

/** Whether `me` is the owner or an admin of a group (who may delete any post in it). */
export async function managesGroup(me: User, groupId: number): Promise<boolean> {
  return canManage(await membership(groupId, me.id));
}

/** Join an open group, or ask to join a private one (its admins are told). */
export async function joinGroup(me: User, id: number): Promise<Result> {
  const g = await groupRow(id);
  if (!g) return no(NOT_HERE);
  if (await membership(id, me.id)) return { ok: true };
  if (!(await withinLimit(`group-join:${me.id}`, 50, DAY))) return no("You have joined many groups today. Please try again tomorrow.");
  const status = g.kind === "open" ? "member" : "pending";
  await db().run("insert into group_members (group_id, user_id, role, status, created_at) values (?, ?, 'member', ?, ?) on conflict do nothing", id, me.id, status, Date.now());
  if (status === "pending") {
    for (const a of await admins(id)) await notify(a.user_id, { actor: me.id, kind: "group-request", text: `${me.name} asked to join ${g.name}.`, link: `/groups/${id}?tab=members` });
  }
  return { ok: true };
}

/** Leave a group (or take back a request). The owner hands it on first, unless they're the last one in it. */
export async function leaveGroup(me: User, id: number): Promise<Result> {
  const m = await membership(id, me.id);
  if (!m) return { ok: true };
  if (m.role === "owner") {
    const others = await db().one<{ n: number }>("select count(*) as n from group_members where group_id = ? and user_id != ? and status = 'member'", id, me.id);
    if (others!.n > 0) return no("You own this group. Before you leave, make someone else the owner (in Members).");
    // The last one out: the group goes with them.
    await db().run("update groups set removed_at = ? where id = ?", Date.now(), id);
  }
  await db().run("delete from group_members where group_id = ? and user_id = ?", id, me.id);
  return { ok: true };
}

/** Members of a group, admins first (only for those who may read the group). */
export async function groupMembers(viewer: User, id: number): Promise<{ members: GroupMember[]; pending: GroupMember[] }> {
  if (!(await canReadGroup(viewer, id))) return { members: [], pending: [] };
  const [rows, blocked, mine] = await Promise.all([
    db().all<{ user_id: number; role: GroupRole; status: string; created_at: number }>(
      "select user_id, role, status, created_at from group_members where group_id = ? order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, created_at limit 2000",
      id
    ),
    blockIds(viewer.id),
    membership(id, viewer.id)
  ]);
  const people = await membersByIds(rows.map((r) => r.user_id));
  const list = (status: string) =>
    rows.flatMap((r) => {
      const member = people.get(r.user_id);
      return r.status === status && member && !blocked.has(member.id) ? [{ member, role: r.role, since: r.created_at }] : [];
    });
  // Only the group's admins see who's waiting to be let in.
  return { members: list("member"), pending: canManage(mine) ? list("pending") : [] };
}

/** An admin lets someone in, or turns them away (they aren't told). */
export async function answerRequest(me: User, id: number, userId: number, accept: boolean): Promise<Result> {
  const g = await groupRow(id);
  if (!g || !canManage(await membership(id, me.id))) return no("Only the group's admins can do that.");
  const changes = accept
    ? await db().run("update group_members set status = 'member', created_at = ? where group_id = ? and user_id = ? and status = 'pending'", Date.now(), id, userId)
    : await db().run("delete from group_members where group_id = ? and user_id = ? and status = 'pending'", id, userId);
  if (!changes) return no("Someone has already answered this.");
  if (accept) await notify(userId, { actor: me.id, kind: "group-joined", text: `You are now a member of ${g.name}.`, link: `/groups/${id}` });
  return { ok: true };
}

/**
 * An admin removes a member, makes them an admin (or not), or the owner hands the group
 * on. Admins can't act on the owner, or on other admins unless they're the owner.
 */
export async function setGroupRole(me: User, id: number, userId: number, action: "remove" | "admin" | "member" | "owner"): Promise<Result> {
  const g = await groupRow(id);
  const mine = await membership(id, me.id);
  if (!g || !canManage(mine)) return no("Only the group's admins can do that.");
  if (userId === me.id) return no("To remove yourself, use Leave the group.");
  const theirs = await membership(id, userId);
  if (!theirs || theirs.status !== "member") return no("They aren't in this group.");
  const owner = mine!.role === "owner";
  if (theirs.role === "owner" || (theirs.role === "admin" && !owner)) return no("Only the group's owner can do that.");
  if ((action === "admin" || action === "owner") && !owner) return no("Only the group's owner can make admins.");
  if (action === "remove") await db().run("delete from group_members where group_id = ? and user_id = ?", id, userId);
  else if (action === "owner") {
    await db().tx(async (t) => {
      await t.run("update group_members set role = 'admin' where group_id = ? and user_id = ?", id, me.id);
      await t.run("update group_members set role = 'owner' where group_id = ? and user_id = ?", id, userId);
    });
    await notify(userId, { actor: me.id, kind: "group-owner", text: `${me.name} made you the owner of ${g.name}.`, link: `/groups/${id}` });
  } else await db().run("update group_members set role = ? where group_id = ? and user_id = ?", action, id, userId);
  return { ok: true };
}

export async function updateGroup(me: User, id: number, input: { name: string; about: string; kind: string }): Promise<Result> {
  const g = await groupRow(id);
  if (!g || !canManage(await membership(id, me.id))) return no("Only the group's admins can do that.");
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, GROUP_LIMITS.name);
  if (name.length < 3) return no("Give the group a name (at least three letters).");
  const kind = input.kind === "open" || input.kind === "private" ? input.kind : g.kind;
  await db().run("update groups set name = ?, about = ?, kind = ? where id = ?", name, input.about.trim().slice(0, GROUP_LIMITS.about), kind, id);
  // Made open: whoever was waiting is let in.
  if (kind === "open" && g.kind === "private") await db().run("update group_members set status = 'member' where group_id = ? and status = 'pending'", id);
  return { ok: true };
}

/** The owner closes the group, or the college desk takes it down. */
export async function removeGroup(me: User, id: number): Promise<Result> {
  const g = await groupRow(id);
  if (!g) return no(NOT_HERE);
  const mine = await membership(id, me.id);
  if (mine?.role !== "owner" && !isModerator(me)) return no("Only the group's owner can close it.");
  await db().run("update groups set removed_at = ? where id = ?", Date.now(), id);
  if (mine?.role !== "owner") {
    const { audit } = await import("./desk");
    await audit(me, "removed", `group ${id}`, g.name);
  }
  return { ok: true };
}

/** Whether `me` may post in a group: a member. */
export async function canPostInGroup(me: User, id: number): Promise<boolean> {
  return Boolean((await groupRow(id)) && (await membership(id, me.id))?.status === "member");
}

/** Names of groups by id (for posts shown outside their group). */
export async function groupNames(ids: number[]): Promise<Map<number, string>> {
  const wanted = [...new Set(ids)].filter(Number.isSafeInteger);
  if (!wanted.length) return new Map();
  const rows = await db().all<{ id: number; name: string }>(`select id, name from groups where id in (${wanted.map(() => "?").join(",")})`, ...wanted);
  return new Map(rows.map((r) => [r.id, r.name]));
}

