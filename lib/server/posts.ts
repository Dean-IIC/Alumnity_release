import { db } from "./db";
import type { User } from "./auth";
import { MENTION, mentionedIds } from "../mentions";
import { cleanQuery, MAX_FILTER_AUTHORS, MAX_FILTER_TAGS, QUERY_WORDS, ROLE_FILTERS, type RoleFilter } from "../feed-filters";
import { cleanTag, tagsIn, WORK_TAGS } from "../tags";
import { followingIds } from "./follows";
import { canPostInGroup, canReadGroup, groupNames, managesGroup, memberGroupIds } from "./groups";
import { mediaByIds, type MediaKind } from "./media";
import { blockIds, connectionIds, memberById, membersByIds, relation } from "./people";
import { isModerator } from "./roles";
import { acceptConnection, NOTE_LIMIT, notify, requestConnection, sendMessage, type Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";
import { MEDIA_LIMIT, SEND_LIMIT } from "../post-limits";

/*
 * Home: posts. Words, up to ten photos or videos, @mentions. Each post is for everyone
 * on Alumnity, for the author's batch, for their connections only, or for one group, and
 * only those people ever see it, its photos, its reactions or its comments. Group posts
 * stay in their group: they never show on Home. A #tag says what a post is about (#job,
 * #notice…), and the college can verify a post: it then shows on the HKBK board too.
 * A post can be a repost of another (with or without the reposter's own words); the
 * original keeps its own audience, so a reader who may not see it is told so instead.
 */

export type Audience = "everyone" | "batch" | "connections" | "group";
/** Who a post outside a group may be for. */
export const AUDIENCES: Audience[] = ["everyone", "batch", "connections"];
export const POST_LIMIT = 2000;
export const COMMENT_LIMIT = 500;
/** Photos and videos one post may carry, and people one may be sent to (shared with the composer). */
export { MEDIA_LIMIT, SEND_LIMIT } from "../post-limits";
const HOUR = 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });
const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");

/** The reactions, in the order they're offered. "cheer" is the quick one. */
export const REACTIONS = ["cheer", "proud", "congrats", "insightful", "support"] as const;
export type Reaction = (typeof REACTIONS)[number];

export type Comment = { id: number; author: User; body: string; createdAt: number; mine: boolean; editedAt: number | null };
export type PostMedia = { id: string; kind: MediaKind };
/** The post a repost carries, in short: enough for a compact card. */
export type EmbeddedPost = {
  id: number;
  author: User;
  /** The author's profile photo, if they have one (for the card's avatar). */
  authorPhoto: string | null;
  body: string;
  audience: Audience;
  createdAt: number;
  media: PostMedia[];
};
export type Post = {
  id: number;
  author: User;
  body: string;
  audience: Audience;
  /** The group it's in, if it's a group's post. */
  group: { id: number; name: string } | null;
  createdAt: number;
  /** Brought over from the old HKBK alumni portal (its date is the portal's). */
  archive: boolean;
  media: PostMedia[];
  /** How many of each reaction, and the total. */
  reactions: Partial<Record<Reaction, number>>;
  reactionCount: number;
  /** The viewer's own reaction, if any. */
  myReaction: Reaction | null;
  /** Kept for older callers: any reaction counts as a cheer. */
  cheers: number;
  cheered: boolean;
  comments: Comment[];
  /** All its comments (only the newest few are in `comments` on the board). */
  commentCount: number;
  mine: boolean;
  /** Its #tags, lower-cased. */
  tags: string[];
  /** When the college verified it (it's on the HKBK board), or null. */
  verifiedAt: number | null;
  /**
   * If it's a repost: the original's id, and the original itself, or null when the viewer
   * may not see it (its audience leaves them out, a block, or it was deleted).
   */
  repostOf: { id: number; post: EmbeddedPost | null } | null;
  /** How many times it has been reposted. */
  repostCount: number;
  /** When its writer last edited it, or null. */
  editedAt: number | null;
};

/** Comments shown under a post in the feed; the rest are on the post's own page. */
export const BOARD_COMMENTS = 2;

const sameBatch = (a: User, b: User) => Boolean(a.branch && a.joined && a.branch === b.branch && a.joined === b.joined && a.programme === b.programme);

/** Whether `viewer` may see a post by `author` meant for `audience` (and, for a group's post, that group). */
export async function canSeePost(viewer: User, author: User, audience: Audience, groupId: number | null = null): Promise<boolean> {
  if (audience === "group") {
    if (groupId === null || !(await canReadGroup(viewer, groupId))) return false;
    if (viewer.id === author.id) return true;
    const rel = await relation(viewer.id, author.id);
    return rel !== "blocked" && rel !== "blocked-by";
  }
  if (viewer.id === author.id) return true;
  const rel = await relation(viewer.id, author.id);
  if (rel === "blocked" || rel === "blocked-by") return false;
  if (audience === "everyone") return true;
  if (audience === "batch") return sameBatch(viewer, author) || rel === "connected";
  return rel === "connected";
}

type PostRow = {
  id: number;
  author: number;
  body: string;
  audience: Audience;
  group_id: number | null;
  created_at: number;
  from_archive?: number;
  verified_at?: number | null;
  /** The post it reposts, if it's a repost. */
  repost_of?: number | null;
  edited_at?: number | null;
};

export async function visiblePost(viewer: User, id: number): Promise<{ row: PostRow; author: User } | null> {
  if (!Number.isSafeInteger(id)) return null;
  const row = await db().one<PostRow>("select * from posts where id = ? and removed_at is null", id);
  const author = row && (await memberById(row.author));
  return row && author && (await canSeePost(viewer, author, row.audience, row.group_id)) ? { row, author } : null;
}

/**
 * Checks every @mention in `body`: a mention of someone who isn't here, or who has blocked
 * the writer (or been blocked), becomes plain "@Name". Returns the text and who to tell.
 */
async function checkMentions(me: User, body: string): Promise<{ text: string; ids: number[] }> {
  const wanted = [...body.matchAll(MENTION)].map((m) => Number(m[2])).filter((id) => id !== me.id);
  const [members, blocked] = await Promise.all([membersByIds(wanted.slice(0, 50)), blockIds(me.id)]);
  const ids: number[] = [];
  const text = body.replace(MENTION, (whole, name: string, raw: string) => {
    const id = Number(raw);
    const member = id !== me.id ? members.get(id) : null;
    if (!member || blocked.has(id)) return `@${name}`;
    if (!ids.includes(id)) ids.push(id);
    // The stored name is the member's real one, whatever was typed.
    return `@[${member.name}](${id})`;
  });
  return { text, ids: ids.slice(0, 20) };
}

/** Whether an upload is already on a post or a story (each goes on one). */
export async function mediaInUse(mediaIds: string[]): Promise<boolean> {
  if (!mediaIds.length) return false;
  const q = marks(mediaIds.length);
  return Boolean(
    await db().one(`select 1 from post_media where media_id in (${q}) union all select 1 from stories where media_id in (${q}) limit 1`, ...mediaIds, ...mediaIds)
  );
}

/**
 * A new post. `repostOf`: the post it reposts (then words are optional: a plain repost has
 * none). A repost carries no photos of its own, and never goes into a group.
 */
export async function createPost(
  me: User,
  body: string,
  audience: string,
  mediaIds: string[] = [],
  groupId: number | null = null,
  picked: string[] = [],
  repostOf: number | null = null
): Promise<Result & { id?: number }> {
  if (!(await settings()).features.notes) return no(PAUSED);
  const media = [...new Set(mediaIds)].slice(0, MEDIA_LIMIT + 1);
  if (media.length > MEDIA_LIMIT) return no(`A post can have up to ${MEDIA_LIMIT} photos or videos.`);
  const { text, ids } = await checkMentions(me, body.trim().slice(0, POST_LIMIT));
  let original: { row: PostRow; author: User } | null = null;
  if (repostOf !== null) {
    if (groupId !== null) return no("You can't repost into a group. Reposts go on Home.");
    if (media.length) return no("You can't add photos to a repost.");
    original = await repostable(me, repostOf);
    if (!original) return no("This post is no longer available.");
    if (original.row.group_id !== null) return no("Posts in a group can't be shared outside the group.");
    // The same post reposted twice with nothing new to say would only repeat it.
    if (!text && (await db().one("select 1 from posts where author = ? and repost_of = ? and body = '' and removed_at is null", me.id, original.row.id))) {
      return no("You've already reposted this.");
    }
  } else if (!text && media.length === 0) return no("Write something, or add a photo.");
  if (groupId !== null) {
    if (!(await canPostInGroup(me, groupId))) return no("Join the group to post in it.");
    audience = "group";
  } else if (!AUDIENCES.includes(audience as Audience)) return no("Choose who can see your post.");
  if (audience === "batch" && !(me.branch && me.joined)) return no("We don't know your batch yet, so you can't post to it.");
  // Only your own uploads, each on one post.
  const uploads = await mediaByIds(media);
  for (const id of media) {
    const m = uploads.get(id);
    if (!m || m.userId !== me.id || (m.kind !== "image" && m.kind !== "video")) return no("You can post only photos and videos that you uploaded.");
  }
  if (await mediaInUse(media)) return no("That photo or video is already in another post.");
  if (!(await withinLimit(`post:${me.id}`, 20, HOUR))) return no("You've posted a lot in the last hour. Try again later.");
  const postId = await db().tx(async (t) => {
    const row = await t.one<{ id: number }>(
      "insert into posts (author, body, audience, group_id, created_at, repost_of) values (?, ?, ?, ?, ?, ?) returning id",
      me.id,
      text,
      audience,
      groupId,
      Date.now(),
      original?.row.id ?? null
    );
    for (const [i, id] of media.entries()) await t.run("insert into post_media (post_id, media_id, position) values (?, ?, ?)", row!.id, id, i);
    // Typed in the text, or picked in the composer: five at most.
    const tags = [...new Set([...tagsIn(text), ...picked.flatMap((p) => cleanTag(p) ?? [])])].slice(0, 5);
    for (const tag of tags) await t.run("insert into post_tags (post_id, tag) values (?, ?) on conflict do nothing", row!.id, tag);
    return row!.id;
  });
  // Tell those mentioned, if they can see the post.
  const mentioned = await membersByIds(ids);
  for (const member of mentioned.values()) {
    if (await canSeePost(member, me, audience as Audience, groupId)) await notify(member.id, { actor: me.id, kind: "mention", text: `${me.name} mentioned you in a post.`, link: `/notes/${postId}` });
  }
  // And the original's writer, if the repost is somewhere they can see it (and they weren't just told of a mention).
  if (original && original.author.id !== me.id && !mentioned.has(original.author.id) && (await canSeePost(original.author, me, audience as Audience, null))) {
    await notify(original.author.id, { actor: me.id, kind: "repost", text: `${me.name} reposted your post.`, link: `/notes/${postId}` });
  }
  return { ok: true, id: postId };
}

/**
 * The post to repost when `me` reposts `id`: that post, if they may see it; or, when it's
 * itself a plain repost (no words of its own), the post inside it, so reposts don't nest.
 */
async function repostable(me: User, id: number): Promise<{ row: PostRow; author: User } | null> {
  const found = await visiblePost(me, id);
  if (!found || !found.row.repost_of || found.row.body.trim()) return found;
  return visiblePost(me, Number(found.row.repost_of));
}

/**
 * Reposts a post on Home, plain (no `thoughts`) or with the reposter's own words. Unless
 * `audience` is chosen, it goes to the same people as the original (a batch post to the
 * reposter's connections, if their batch isn't known): a plain repost then never shows
 * the post to a crowd that would only be told it isn't available.
 */
export async function repost(me: User, id: number, thoughts = "", audience?: string): Promise<Result & { id?: number }> {
  const original = await repostable(me, id);
  if (!original) return no("This post is no longer available.");
  if (original.row.group_id !== null) return no("Posts in a group can't be shared outside the group.");
  const same = original.row.audience === "batch" && !(me.branch && me.joined) ? "connections" : original.row.audience;
  return createPost(me, thoughts, audience || same, [], null, [], original.row.id);
}

/**
 * Sends a post privately: a message to each of `toIds` with its link (and `note`, if any).
 * Messages only go between connections, and only to people who may see the post
 * themselves; anyone else stops the whole send before anything goes, and is named.
 */
export async function sendPost(me: User, postId: number, toIds: number[], note = ""): Promise<Result & { sent?: number }> {
  const post = await visiblePost(me, postId);
  if (!post) return no("This post is no longer available.");
  const ids = [...new Set(toIds.filter((id) => Number.isSafeInteger(id) && id > 0 && id !== me.id))];
  if (!ids.length) return no("Choose who to send it to.");
  if (ids.length > SEND_LIMIT) return no(`You can send it to up to ${SEND_LIMIT} people at a time.`);
  const members = await membersByIds(ids);
  for (const id of ids) {
    const to = members.get(id);
    if (!to) return no("One of these people is no longer on Alumnity.");
    if ((await relation(me.id, id)) !== "connected") return no(`You can send posts only to your connections. ${to.name} is not one of your connections.`);
    if (!(await canSeePost(to, post.author, post.row.audience, post.row.group_id))) return no(`${to.name} can't see this post, so you can't send it to them.`);
  }
  const words = note.trim().slice(0, 500);
  const body = `${words ? `${words}\n\n` : ""}A post by ${post.author.name}: /notes/${postId}`;
  let sent = 0;
  for (const id of ids) {
    const done = await sendMessage(me, id, body);
    if (!done.ok) return sent ? no(`Sent to ${sent} ${sent === 1 ? "person" : "people"}, then it stopped: ${done.error}`) : done;
    sent += 1;
  }
  return { ok: true, sent };
}

export async function removeOwnPost(me: User, id: number): Promise<Result> {
  await db().run("update posts set removed_at = ? where id = ? and author = ? and removed_at is null", Date.now(), id, me.id);
  return { ok: true };
}

/**
 * Deletes a post: its writer's own, or any post in a group, by that group's owner or one
 * of its admins (keeping their group in order). The college desk removes anything from
 * the desk (lib/server/desk.ts), with its audit trail.
 */
export async function removePost(me: User, id: number): Promise<Result> {
  const row = Number.isSafeInteger(id) ? await db().one<{ author: number; group_id: number | null }>("select author, group_id from posts where id = ? and removed_at is null", id) : undefined;
  if (!row) return { ok: true }; // already gone
  if (row.author !== me.id) {
    if (row.group_id === null || !(await managesGroup(me, row.group_id))) return no("Only the person who wrote this post can delete it.");
  }
  await db().run("update posts set removed_at = ? where id = ? and removed_at is null", Date.now(), id);
  return { ok: true };
}

/** Members told of a mention in a post or comment already (at `link`): nobody is told twice. */
async function toldOfMention(ids: number[], link: string): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await db().all<{ user_id: number }>(`select user_id from notifications where kind = 'mention' and link = ? and user_id in (${marks(ids.length)})`, link, ...ids);
  return new Set(rows.map((r) => Number(r.user_id)));
}

/**
 * Its writer rewrites a post's words. Who it's for, its group, photos and the post it
 * reposts all stay. Its #tags are worked out again from the new words, as when it was
 * written (tags picked in the composer stay); anyone newly @mentioned who may see it is
 * told, and nobody already told is told again. A post on the HKBK board comes off it, as
 * the college verified the words it had then.
 */
export async function editPost(me: User, id: number, body: string): Promise<Result> {
  if (!(await settings()).features.notes) return no(PAUSED);
  const row = Number.isSafeInteger(id) ? await db().one<PostRow>("select * from posts where id = ? and removed_at is null", id) : undefined;
  if (!row) return no("This post is no longer available.");
  if (row.author !== me.id) return no("Only the person who wrote this post can edit it.");
  const { text, ids } = await checkMentions(me, body.trim().slice(0, POST_LIMIT));
  if (text === row.body) return { ok: true };
  if (!text && !row.repost_of && !(await db().one("select 1 from post_media where post_id = ?", id))) return no("Write something, or delete the post instead.");
  if (!(await withinLimit(`post-edit:${me.id}`, 60, HOUR))) return no("You've made a lot of edits in the last hour. Try again later.");
  const typed = new Set(tagsIn(row.body));
  const picked = (await db().all<{ tag: string }>("select tag from post_tags where post_id = ?", id)).map((t) => t.tag).filter((t) => !typed.has(t));
  const tags = [...new Set([...tagsIn(text), ...picked])].slice(0, 5);
  await db().tx(async (t) => {
    await t.run(
      `update posts set body = ?, edited_at = ?${row.verified_at ? ", verified_at = null, verified_by = null" : ""} where id = ? and author = ? and removed_at is null`,
      text,
      Date.now(),
      id,
      me.id
    );
    await t.run("delete from post_tags where post_id = ?", id);
    for (const tag of tags) await t.run("insert into post_tags (post_id, tag) values (?, ?) on conflict do nothing", id, tag);
  });
  const link = `/notes/${id}`;
  const before = new Set(mentionedIds(row.body));
  const fresh = ids.filter((mid) => !before.has(mid));
  const told = await toldOfMention(fresh, link);
  const mentioned = await membersByIds(fresh.filter((mid) => !told.has(mid)));
  for (const member of mentioned.values()) {
    if (await canSeePost(member, me, row.audience, row.group_id)) await notify(member.id, { actor: me.id, kind: "mention", text: `${me.name} mentioned you in a post.`, link });
  }
  return { ok: true };
}

/** React to a post; the same reaction again takes it back, another one replaces it. */
export async function react(me: User, id: number, kind: string): Promise<Result> {
  if (!REACTIONS.includes(kind as Reaction)) return no("Choose one of the reactions shown.");
  const post = await visiblePost(me, id);
  if (!post) return no("This post is no longer available.");
  if (!(await withinLimit(`cheer:${me.id}`, 300, HOUR))) return no("You've reacted a lot in the last hour. Try again later.");
  const had = await db().one<{ kind: string }>("select kind from post_cheers where post_id = ? and user_id = ?", id, me.id);
  if (had?.kind === kind) {
    await db().run("delete from post_cheers where post_id = ? and user_id = ?", id, me.id);
    return { ok: true };
  }
  await db().run("insert into post_cheers (post_id, user_id, kind) values (?, ?, ?) on conflict (post_id, user_id) do update set kind = excluded.kind", id, me.id, kind);
  // Told once per member per post: reacting again, or changing the reaction, doesn't ping them again.
  const link = `/notes/${id}`;
  const told = await db().one("select 1 from notifications where user_id = ? and actor = ? and kind = 'cheer' and (link = ? or link = ?)", post.author.id, me.id, link, `/home#post-${id}`);
  if (post.author.id !== me.id && !told) await notify(post.author.id, { actor: me.id, kind: "cheer", text: `${me.name} reacted to your post.`, link });
  return { ok: true };
}

/** The quick reaction (older callers). */
export const toggleCheer = (me: User, id: number) => react(me, id, "cheer");

export async function addComment(me: User, id: number, body: string): Promise<Result> {
  const post = await visiblePost(me, id);
  if (!post) return no("This post is no longer available.");
  if (!(await settings()).features.notes) return no(PAUSED);
  const { text, ids } = await checkMentions(me, body.trim().slice(0, COMMENT_LIMIT));
  if (!text) return no("Write something first.");
  if (!(await withinLimit(`comment:${me.id}`, 60, HOUR))) return no("You've commented a lot in the last hour. Try again later.");
  await db().run("insert into post_comments (post_id, author, body, created_at) values (?, ?, ?, ?)", id, me.id, text, Date.now());
  if (post.author.id !== me.id) await notify(post.author.id, { actor: me.id, kind: "comment", text: `${me.name} commented on your post.`, link: `/notes/${id}` });
  const mentioned = await membersByIds(ids.filter((mid) => mid !== post.author.id));
  for (const member of mentioned.values()) {
    if (await canSeePost(member, post.author, post.row.audience, post.row.group_id)) {
      await notify(member.id, { actor: me.id, kind: "mention", text: `${me.name} mentioned you in a comment.`, link: `/notes/${id}` });
    }
  }
  return { ok: true };
}

export async function removeOwnComment(me: User, id: number): Promise<Result> {
  const changed = await db().run("update post_comments set removed_at = ? where id = ? and author = ? and removed_at is null", Date.now(), id, me.id);
  if (!changed && (await db().one("select 1 from post_comments where id = ? and removed_at is null", id))) return no("Only the person who wrote this comment can delete it.");
  return { ok: true };
}

/**
 * Its writer rewrites a comment (it then shows "edited"). Anyone newly @mentioned in it
 * who may see the post is told, as when a comment is written; nobody is told twice.
 */
export async function editComment(me: User, id: number, body: string): Promise<Result> {
  if (!(await settings()).features.notes) return no(PAUSED);
  const c = Number.isSafeInteger(id) ? await db().one<{ post_id: number; author: number; body: string }>("select post_id, author, body from post_comments where id = ? and removed_at is null", id) : undefined;
  if (!c) return no("This comment is no longer available.");
  if (c.author !== me.id) return no("Only the person who wrote this comment can edit it.");
  const post = await visiblePost(me, c.post_id);
  if (!post) return no("This post is no longer available.");
  const { text, ids } = await checkMentions(me, body.trim().slice(0, COMMENT_LIMIT));
  if (!text) return no("Write something, or delete the comment instead.");
  if (text === c.body) return { ok: true };
  if (!(await withinLimit(`comment-edit:${me.id}`, 60, HOUR))) return no("You've made a lot of edits in the last hour. Try again later.");
  await db().run("update post_comments set body = ?, edited_at = ? where id = ? and author = ? and removed_at is null", text, Date.now(), id, me.id);
  const link = `/notes/${c.post_id}`;
  const before = new Set(mentionedIds(c.body));
  // The post's writer hears of every comment already, as addComment leaves them out too.
  const fresh = ids.filter((mid) => !before.has(mid) && mid !== post.author.id);
  const told = await toldOfMention(fresh, link);
  const mentioned = await membersByIds(fresh.filter((mid) => !told.has(mid)));
  for (const member of mentioned.values()) {
    if (await canSeePost(member, post.author, post.row.audience, post.row.group_id)) {
      await notify(member.id, { actor: me.id, kind: "mention", text: `${me.name} mentioned you in a comment.`, link });
    }
  }
  return { ok: true };
}

/** Whether `viewer` may see a post's photo or video (for /media). Null if it isn't on a post. */
export async function canSeePostMedia(viewer: User, mediaId: string): Promise<boolean | null> {
  const rows = await db().all<{ post_id: number }>("select post_id from post_media where media_id = ?", mediaId);
  if (!rows.length) return null;
  for (const r of rows) if (await visiblePost(viewer, r.post_id)) return true;
  return false;
}

/** What one page needs about the viewer's circle, read once and shared by every post on it. */
type Circle = { connections: Set<number>; following: Set<number>; blocks: Set<number>; groups: Set<number> };

async function circleOf(viewer: User): Promise<Circle> {
  const [connections, following, blocks, groups] = await Promise.all([connectionIds(viewer.id), followingIds(viewer.id), blockIds(viewer.id), memberGroupIds(viewer.id)]);
  return { connections, following, blocks, groups };
}

/** The same rule as canSeePost, answered from the circle (no query per post). */
function seesPost(viewer: User, circle: Circle, author: User, audience: Audience): boolean {
  // A group's posts are only ever listed on the group's own page, after its check.
  if (audience === "group") return !circle.blocks.has(author.id);
  if (viewer.id === author.id) return true;
  if (circle.blocks.has(author.id)) return false;
  if (audience === "everyone") return true;
  if (audience === "batch") return sameBatch(viewer, author) || circle.connections.has(author.id);
  return circle.connections.has(author.id);
}

/**
 * Everything shown with a page of posts, read together: a handful of queries for the
 * whole page, however many posts are on it (each is a trip to the database).
 */
async function toPosts(viewer: User, circle: Circle, items: { row: PostRow; author: User }[], comments = BOARD_COMMENTS): Promise<Post[]> {
  if (!items.length) return [];
  const ids = items.map((i) => i.row.id);
  const q = marks(ids.length);
  const originalIds = [...new Set(items.flatMap((i) => (i.row.repost_of ? [Number(i.row.repost_of)] : [])))];
  const [counts, mine, commentCounts, media, commentRows, tags, reposts, embedded] = await Promise.all([
    db().all<{ post_id: number; kind: Reaction; n: number }>(`select post_id, kind, count(*) as n from post_cheers where post_id in (${q}) group by post_id, kind`, ...ids),
    db().all<{ post_id: number; kind: Reaction }>(`select post_id, kind from post_cheers where user_id = ? and post_id in (${q})`, viewer.id, ...ids),
    db().all<{ post_id: number; n: number }>(`select post_id, count(*) as n from post_comments where removed_at is null and post_id in (${q}) group by post_id`, ...ids),
    db().all<{ post_id: number; id: string; kind: MediaKind }>(
      `select post_media.post_id, post_media.media_id as id, media.kind from post_media join media on media.id = post_media.media_id where post_media.post_id in (${q}) order by post_media.position`,
      ...ids
    ),
    db().all<{ id: number; post_id: number; author: number; body: string; created_at: number; edited_at: number | null }>(
      `select id, post_id, author, body, created_at, edited_at from (
         select post_comments.*, row_number() over (partition by post_id order by created_at desc, id desc) as newest
         from post_comments where removed_at is null and post_id in (${q})
       ) as c where newest <= ? order by created_at, id`,
      ...ids,
      comments
    ),
    db().all<{ post_id: number; tag: string }>(`select post_id, tag from post_tags where post_id in (${q}) order by tag`, ...ids),
    db().all<{ repost_of: number; n: number }>(`select repost_of, count(*) as n from posts where removed_at is null and repost_of in (${q}) group by repost_of`, ...ids),
    embeddedPosts(viewer, circle, originalIds)
  ]);
  const [authors, groups] = await Promise.all([
    membersByIds(commentRows.map((c) => c.author).filter((a) => !circle.blocks.has(a))),
    groupNames(items.flatMap((i) => (i.row.group_id === null ? [] : [i.row.group_id])))
  ]);
  return items.map(({ row, author }) => {
    const reactions: Partial<Record<Reaction, number>> = {};
    for (const c of counts) if (c.post_id === row.id) reactions[c.kind] = c.n;
    const reactionCount = Object.values(reactions).reduce((a, n) => a + (n ?? 0), 0);
    const myReaction = mine.find((r) => r.post_id === row.id)?.kind ?? null;
    return {
      id: row.id,
      author,
      body: row.body,
      audience: row.audience,
      group: row.group_id === null ? null : { id: row.group_id, name: groups.get(row.group_id) ?? "A group" },
      createdAt: row.created_at,
      archive: Number(row.from_archive ?? 0) === 1,
      media: media.filter((m) => m.post_id === row.id).map(({ id, kind }) => ({ id, kind })),
      reactions,
      reactionCount,
      myReaction,
      cheers: reactionCount,
      cheered: myReaction !== null,
      comments: commentRows.flatMap((c) => {
        const by = c.post_id === row.id ? authors.get(c.author) : undefined;
        return by ? [{ id: c.id, author: by, body: c.body, createdAt: c.created_at, mine: by.id === viewer.id, editedAt: c.edited_at ?? null }] : [];
      }),
      commentCount: commentCounts.find((c) => c.post_id === row.id)?.n ?? 0,
      mine: author.id === viewer.id,
      tags: tags.filter((t) => t.post_id === row.id).map((t) => t.tag),
      verifiedAt: row.verified_at ?? null,
      repostOf: row.repost_of ? { id: Number(row.repost_of), post: embedded.get(Number(row.repost_of)) ?? null } : null,
      repostCount: reposts.find((r) => Number(r.repost_of) === row.id)?.n ?? 0,
      editedAt: row.edited_at ?? null
    };
  });
}

/**
 * The originals inside a page's reposts, each only if `viewer` may see it (the original's
 * own audience, blocks, not deleted): those they may not are simply missing from the map.
 */
async function embeddedPosts(viewer: User, circle: Circle, ids: number[]): Promise<Map<number, EmbeddedPost>> {
  const out = new Map<number, EmbeddedPost>();
  if (!ids.length) return out;
  const q = marks(ids.length);
  const [rows, media] = await Promise.all([
    db().all<PostRow>(`select * from posts where removed_at is null and id in (${q})`, ...ids),
    db().all<{ post_id: number; id: string; kind: MediaKind }>(
      `select post_media.post_id, post_media.media_id as id, media.kind from post_media join media on media.id = post_media.media_id where post_media.post_id in (${q}) order by post_media.position`,
      ...ids
    )
  ]);
  const authors = await membersByIds(rows.map((r) => r.author));
  const seen: { row: PostRow; author: User }[] = [];
  for (const row of rows) {
    const author = authors.get(row.author);
    if (!author) continue;
    // A group's post gets the full check (they can't be reposted, but older data might differ).
    const may = row.group_id !== null ? await canSeePost(viewer, author, row.audience, row.group_id) : seesPost(viewer, circle, author, row.audience);
    if (may) seen.push({ row, author });
  }
  // Read here, not imported above: profile.ts reads posts too.
  const { photoIdsOf } = await import("./profile");
  const photos = seen.length ? await photoIdsOf(seen.map((s) => s.author.id)) : new Map<number, string>();
  for (const { row, author } of seen) {
    out.set(row.id, {
      id: row.id,
      author,
      authorPhoto: photos.get(author.id) ?? null,
      body: row.body,
      audience: row.audience,
      createdAt: row.created_at,
      media: media.filter((m) => m.post_id === row.id).map(({ id, kind }) => ({ id, kind }))
    });
  }
  return out;
}

/** One post with all its comments (up to 500), if `viewer` may see it. */
export async function postFor(viewer: User, id: number): Promise<Post | null> {
  const found = await visiblePost(viewer, id);
  return found ? (await toPosts(viewer, await circleOf(viewer), [found], 500))[0] : null;
}

/**
 * Which posts Home shows: everyone's, those of people you follow or are connected to, only
 * the college's own ("From HKBK": its desk and college accounts), or only members' (no college).
 */
export type FeedScope = "all" | "following" | "college" | "members";
export const FEED_SCOPES: FeedScope[] = ["all", "following", "college", "members"];
export const feedScope = (v: unknown): FeedScope => (FEED_SCOPES.includes(v as FeedScope) ? (v as FeedScope) : "all");

/**
 * The words of a search, as SQL: each word must be in the post's text or its #tags ("#job"
 * means the tag job, or "#job" written in the text). Mentions are stored as "@[Name](id)",
 * so a name finds the posts that mention its owner too.
 */
function searchClauses(q: string): { sql: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];
  for (const word of cleanQuery(q).toLowerCase().split(" ").slice(0, QUERY_WORDS)) {
    const asTag = word.startsWith("#") ? cleanTag(word.slice(1)) : null;
    if (asTag) {
      parts.push("(id in (select post_id from post_tags where tag = ?) or lower(body) like ?)");
      params.push(asTag, `%#${asTag}%`);
      continue;
    }
    // LIKE's own wildcards are taken out, so a search is only ever its words.
    const plain = word.replace(/^#/, "").replace(/[%_\\]/g, "");
    if (!plain) continue;
    parts.push("(lower(body) like ? or id in (select post_id from post_tags where tag like ?))");
    params.push(`%${plain}%`, `${plain}%`);
  }
  return { sql: parts.map((p) => `and ${p}`).join(" "), params };
}

/**
 * Who wrote it, as SQL. Alumni, students and faculty are people with that role; the
 * college is its coordinators and administrators, and its own account (users.college_account),
 * which is never counted among the alumni.
 */
function roleClause(roles: RoleFilter[]): { sql: string; params: string[] } {
  if (!roles.length) return { sql: "", params: [] };
  const people = roles.filter((r) => r !== "college");
  const parts = [...people.map(() => "(role = ? and college_account = 0)"), ...(roles.includes("college") ? ["role in ('coordinator', 'admin', 'superadmin') or college_account = 1"] : [])];
  return { sql: `and author in (select id from users where ${parts.join(" or ")})`, params: people };
}

/**
 * The newest posts `viewer` may see. `scope: "following"`: only from people they're
 * connected to or follow (and themselves). Only by `authorIds`, if given (a member's page, a batch).
 * Home's filters narrow it further, each kind with "any of": `tags`, `roles`, `authors` (named
 * people), and `q` (words in the text or the tags, all of them). Filters only ever narrow:
 * every post still passes the same visibility check as the unfiltered feed.
 */
export async function feedFor(
  viewer: User,
  {
    authorId,
    authorIds,
    groupId,
    limit = 15,
    before,
    scope = "all",
    tag,
    tags: tagList,
    roles: roleList,
    authors: authorList,
    q,
    verified = false
  }: {
    authorId?: number;
    authorIds?: number[];
    groupId?: number;
    limit?: number;
    before?: number;
    scope?: FeedScope;
    /** Only posts with this #tag (or any of these). */
    tag?: string | string[];
    /** The same, from Home's filters: any of these #tags (five at most). */
    tags?: string[];
    /** Only posts by people with one of these roles ("college": the college's own accounts and its desk). */
    roles?: RoleFilter[];
    /** Only posts by one of these members (ten at most). */
    authors?: number[];
    /** Only posts with these words in their text or #tags. */
    q?: string;
    /** Only posts the college has verified (the HKBK board), newest verified first. */
    verified?: boolean;
  } = {}
): Promise<Post[]> {
  if (groupId !== undefined && !(await canReadGroup(viewer, groupId))) return [];
  // Everything from outside is cleaned and capped here too, whoever called.
  const tags = [...new Set([...(tag === undefined ? [] : Array.isArray(tag) ? tag : [tag]), ...(tagList ?? [])].flatMap((t) => cleanTag(t) ?? []))].slice(0, MAX_FILTER_TAGS);
  const roles = [...new Set(roleList ?? [])].filter((r) => ROLE_FILTERS.some(([v]) => v === r));
  const named = [...new Set(authorList ?? [])].filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, MAX_FILTER_AUTHORS);
  if (authorList?.length && !named.length) return [];
  const search = searchClauses(q ?? "");
  const byRole = roleClause(roles);
  // "From HKBK" is the college filter; "From members" leaves the college's own accounts out.
  const byScope =
    authorId || authorIds
      ? ""
      : scope === "college"
        ? "and author in (select id from users where role in ('coordinator', 'admin', 'superadmin') or college_account = 1)"
        : scope === "members"
          ? "and author in (select id from users where role not in ('coordinator', 'admin', 'superadmin') and college_account = 0)"
          : "";
  const circle = await circleOf(viewer);
  let ids = (authorId ? [authorId] : authorIds ?? []).slice(0, 500);
  if (authorIds && ids.length === 0) return [];
  if (scope === "following" && !authorId && !authorIds) {
    ids = [viewer.id, ...circle.connections, ...circle.following].slice(0, 2000);
  }
  // One query finds the page's posts, filters and all. It reads a bounded number of the newest
  // (enough to fill a page after visibility), walking the created_at index; each filter is an
  // indexed lookup (post_tags by tag, users by role, posts by author) or a check on the row.
  const rows = await db().all<PostRow>(
    `select * from posts where removed_at is null and ${groupId !== undefined ? "group_id = ?" : "group_id is null"}
     ${before ? "and created_at < ?" : ""} ${ids.length ? `and author in (${marks(ids.length)})` : ""}
     ${named.length ? `and author in (${marks(named.length)})` : ""} ${byRole.sql} ${byScope}
     ${tags.length ? `and id in (select post_id from post_tags where tag in (${marks(tags.length)}))` : ""} ${search.sql} ${verified ? "and verified_at is not null" : ""}
     order by ${verified ? "verified_at desc," : ""} created_at desc, id desc limit ?`,
    ...(groupId !== undefined ? [groupId] : []),
    ...(before ? [before] : []),
    ...ids,
    ...named,
    ...byRole.params,
    ...tags,
    ...search.params,
    limit * 5
  );
  const authors = await membersByIds(rows.map((r) => r.author));
  const items: { row: PostRow; author: User }[] = [];
  for (const row of rows) {
    const author = authors.get(row.author);
    if (!author || !seesPost(viewer, circle, author, row.audience)) continue;
    items.push({ row, author });
    if (items.length >= limit) break;
  }
  return toPosts(viewer, circle, items);
}

/**
 * The #tags most used lately in posts `viewer` may see (Home's posts, so no group's), most
 * used first: the filter bar's topic chips. Reads at most the newest 2,000 tags of the last
 * `days`, so it stays cheap however busy the site gets.
 */
export async function popularTags(viewer: User, { days = 30, limit = 8 }: { days?: number; limit?: number } = {}): Promise<string[]> {
  const rows = await db().all<{ tag: string; author: number; audience: Audience }>(
    `select post_tags.tag, posts.author, posts.audience from post_tags join posts on posts.id = post_tags.post_id
     where posts.removed_at is null and posts.group_id is null and posts.created_at > ?
     order by posts.created_at desc limit 2000`,
    Date.now() - days * 24 * HOUR
  );
  if (!rows.length) return [];
  const [circle, authors] = await Promise.all([circleOf(viewer), membersByIds(rows.map((r) => r.author))]);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const author = authors.get(r.author);
    if (author && seesPost(viewer, circle, author, r.audience)) counts.set(r.tag, (counts.get(r.tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export { mentionedIds };

/**
 * The college's check mark: a coordinator or administrator verifies a post (it goes on the
 * HKBK board), or takes it back. Only posts for everyone can be on the board. Written to the
 * audit log; the writer is told when theirs is verified.
 */
export async function verifyPost(me: User, id: number, on: boolean): Promise<Result> {
  if (!isModerator(me)) return no("Only the college desk can check posts for the HKBK board.");
  const post = await visiblePost(me, id);
  if (!post) return no("This post is no longer available.");
  if (on && post.row.audience !== "everyone") return no("Only posts that everyone can see can go on the HKBK board.");
  const changed = await db().run(
    on ? "update posts set verified_at = ?, verified_by = ? where id = ? and verified_at is null" : "update posts set verified_at = null, verified_by = null where id = ? and verified_at is not null",
    ...(on ? [Date.now(), me.id, id] : [id])
  );
  if (!changed) return { ok: true };
  const { audit } = await import("./desk");
  await audit(me, on ? "verified" : "unverified", `post ${id}`, plainStart(post.row.body));
  if (on && post.author.id !== me.id) await notify(post.author.id, { actor: me.id, kind: "post-verified", text: "The college checked your post. It's on the HKBK board now.", link: `/notes/${id}` });
  if (on) await tellStudentsLooking(id, post.author);
  return { ok: true };
}

/**
 * A #job, #internship or #referral post just put on the board: the students who said
 * they're looking for that (an internship, a referral; on their page) are told, once.
 * That's their own switch, so it's news they asked for, and the daily email carries it.
 */
async function tellStudentsLooking(postId: number, author: User) {
  const tags = (await db().all<{ tag: string }>("select tag from post_tags where post_id = ?", postId)).map((t) => t.tag);
  const wants = [...(tags.includes("internship") ? ["internship"] : []), ...(tags.includes("job") || tags.includes("referral") ? ["referral"] : [])];
  if (!wants.length) return;
  const link = `/notes/${postId}`;
  const students = await db().all<{ id: number }>(
    `select users.id from users join profiles on profiles.user_id = users.id
     where users.role = 'student' and users.suspended_at is null and users.sample = 0 and users.college_account = 0 and users.id != ?
       and (${wants.map(() => "(profiles.data::jsonb -> 'seeking' ->> ?) = 'true'").join(" or ")})
       and not exists (select 1 from notifications where notifications.user_id = users.id and notifications.link = ? and notifications.kind = 'board-work')
     limit 500`,
    author.id,
    ...wants,
    link
  );
  const what = tags.includes("internship") ? "an internship" : "a job";
  // notify() leaves out anyone blocked either way with the writer.
  for (const s of students) await notify(s.id, { actor: author.id, kind: "board-work", text: `New on the HKBK board: ${what} posted by ${author.name}. You said you are looking for one.`, link });
}

const plainStart = (body: string) => body.replace(MENTION, (_, name: string) => `@${name}`).slice(0, 80);

/**
 * Asking the writer of a #job, #internship or #referral post to refer you, with a line on
 * why you fit. Not connected yet: it's a connection request with that note (they accept,
 * you talk). Already connected: it goes to them as a message. No new kind of thing to learn.
 */
export async function askForReferral(me: User, postId: number, note: string): Promise<Result & { as?: "request" | "message" }> {
  const post = await visiblePost(me, postId);
  if (!post) return no("This post is no longer available.");
  if (post.author.id === me.id) return no("You can't ask for a referral on your own post.");
  const tags = tagsIn(post.row.body);
  const tag = WORK_TAGS.find((t) => tags.includes(t));
  if (!tag) return no("You can ask for a referral only on #job, #internship or #referral posts.");
  const why = note.trim();
  if (why.length < 20) return no("Say in a line or two why you're a good fit. For example, your branch, skills or a project.");
  const about = `Asking for a referral for your #${tag} post: `;
  const rel = await relation(me.id, post.author.id);
  if (rel === "connected" || rel === "received") {
    if (rel === "received") {
      const accepted = await acceptConnection(me, post.author.id);
      if (!accepted.ok) return accepted;
    }
    const sent = await sendMessage(me, post.author.id, `${about}${why}`.slice(0, 1800) + `\n\n/notes/${postId}`);
    return sent.ok ? { ok: true, as: "message" } : sent;
  }
  const asked = await requestConnection(me, post.author.id, `${about}${why}`.slice(0, NOTE_LIMIT));
  return asked.ok ? { ok: true, as: "request" } : asked;
}