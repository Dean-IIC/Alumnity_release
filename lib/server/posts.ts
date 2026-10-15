import { database } from "./db";
import type { User } from "./auth";
import { MENTION, mentionedIds } from "../mentions";
import { followingIds } from "./follows";
import { mediaById, type MediaKind } from "./media";
import { blockedEitherWay, blockIds, connectionIds, memberById, relation } from "./people";
import { notify, type Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Home: posts. Words, up to four photos or videos, @mentions. Each post is for everyone
 * on Alumnity, for the author's batch, or for their connections only, and only those
 * people ever see it, its photos, its reactions or its comments.
 */

export type Audience = "everyone" | "batch" | "connections";
export const AUDIENCES: Audience[] = ["everyone", "batch", "connections"];
export const POST_LIMIT = 2000;
export const COMMENT_LIMIT = 500;
/** Photos and videos one post may carry. */
export const MEDIA_LIMIT = 4;
const HOUR = 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });

/** The reactions, in the order they're offered. "cheer" is the quick one. */
export const REACTIONS = ["cheer", "proud", "congrats", "insightful", "support"] as const;
export type Reaction = (typeof REACTIONS)[number];

export type Comment = { id: number; author: User; body: string; createdAt: number; mine: boolean };
export type PostMedia = { id: string; kind: MediaKind };
export type Post = {
  id: number;
  author: User;
  body: string;
  audience: Audience;
  createdAt: number;
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
};

/** Comments shown under a post in the feed; the rest are on the post's own page. */
export const BOARD_COMMENTS = 2;

const sameBatch = (a: User, b: User) => Boolean(a.branch && a.joined && a.branch === b.branch && a.joined === b.joined && a.programme === b.programme);

/** Whether `viewer` may see a post by `author` meant for `audience`. */
export function canSeePost(viewer: User, author: User, audience: Audience): boolean {
  if (viewer.id === author.id) return true;
  if (blockedEitherWay(viewer.id, author.id)) return false;
  if (audience === "everyone") return true;
  if (audience === "batch") return sameBatch(viewer, author) || relation(viewer.id, author.id) === "connected";
  return relation(viewer.id, author.id) === "connected";
}

type PostRow = { id: number; author: number; body: string; audience: Audience; created_at: number };

export function visiblePost(viewer: User, id: number): { row: PostRow; author: User } | null {
  const row = database().prepare("select * from posts where id = ? and removed_at is null").get(id) as PostRow | undefined;
  const author = row && memberById(row.author);
  return row && author && canSeePost(viewer, author, row.audience) ? { row, author } : null;
}

/**
 * Checks every @mention in `body`: a mention of someone who isn't here, or who has blocked
 * the writer (or been blocked), becomes plain "@Name". Returns the text and who to tell.
 */
function checkMentions(me: User, body: string): { text: string; ids: number[] } {
  const ids: number[] = [];
  const text = body.replace(MENTION, (whole, name: string, raw: string) => {
    const id = Number(raw);
    const member = id !== me.id ? memberById(id) : null;
    if (!member || blockedEitherWay(me.id, id)) return `@${name}`;
    if (!ids.includes(id)) ids.push(id);
    // The stored name is the member's real one, whatever was typed.
    return `@[${member.name}](${id})`;
  });
  return { text, ids: ids.slice(0, 20) };
}

export function createPost(me: User, body: string, audience: string, mediaIds: string[] = []): Result & { id?: number } {
  if (!settings().features.notes) return no(PAUSED);
  const { text, ids } = checkMentions(me, body.trim().slice(0, POST_LIMIT));
  const media = [...new Set(mediaIds)].slice(0, MEDIA_LIMIT + 1);
  if (media.length > MEDIA_LIMIT) return no(`A post can have up to ${MEDIA_LIMIT} photos or videos.`);
  if (!text && media.length === 0) return no("Write something, or add a photo.");
  if (!AUDIENCES.includes(audience as Audience)) return no("Choose who it's for.");
  if (audience === "batch" && !(me.branch && me.joined)) return no("Your batch isn't known, so this can't go to it.");
  // Only your own uploads, each on one post.
  const db = database();
  for (const id of media) {
    const m = mediaById(id);
    if (!m || m.userId !== me.id || (m.kind !== "image" && m.kind !== "video")) return no("One of those photos isn't yours to post.");
    if (db.prepare("select 1 from post_media where media_id = ?").get(id) || db.prepare("select 1 from stories where media_id = ?").get(id)) return no("That photo is already posted.");
  }
  if (!withinLimit(`post:${me.id}`, 20, HOUR)) return no("That's a lot of posts in an hour. Try again a little later.");
  const { lastInsertRowid } = db.prepare("insert into posts (author, body, audience, created_at) values (?, ?, ?, ?)").run(me.id, text, audience, Date.now());
  const postId = Number(lastInsertRowid);
  media.forEach((id, i) => db.prepare("insert into post_media (post_id, media_id, position) values (?, ?, ?)").run(postId, id, i));
  // Tell those mentioned, if they can see the post.
  for (const id of ids) {
    const member = memberById(id);
    if (member && canSeePost(member, me, audience as Audience)) notify(id, { actor: me.id, kind: "mention", text: `${me.name} mentioned you in a post.`, link: `/notes/${postId}` });
  }
  return { ok: true, id: postId };
}

export function removeOwnPost(me: User, id: number): Result {
  database().prepare("update posts set removed_at = ? where id = ? and author = ? and removed_at is null").run(Date.now(), id, me.id);
  return { ok: true };
}

/** React to a post; the same reaction again takes it back, another one replaces it. */
export function react(me: User, id: number, kind: string): Result {
  if (!REACTIONS.includes(kind as Reaction)) return no("That isn't a reaction.");
  const post = visiblePost(me, id);
  if (!post) return no("That post isn't here any more.");
  if (!withinLimit(`cheer:${me.id}`, 300, HOUR)) return no("That's a lot of reacting in an hour. Try again a little later.");
  const db = database();
  const had = db.prepare("select kind from post_cheers where post_id = ? and user_id = ?").get(id, me.id) as { kind: string } | undefined;
  if (had?.kind === kind) {
    db.prepare("delete from post_cheers where post_id = ? and user_id = ?").run(id, me.id);
    return { ok: true };
  }
  db.prepare("insert into post_cheers (post_id, user_id, kind) values (?, ?, ?) on conflict(post_id, user_id) do update set kind = excluded.kind").run(id, me.id, kind);
  // Told once per member per post: reacting again, or changing the reaction, doesn't ping them again.
  const link = `/notes/${id}`;
  const told = db.prepare("select 1 from notifications where user_id = ? and actor = ? and kind = 'cheer' and (link = ? or link = ?)").get(post.author.id, me.id, link, `/home#post-${id}`);
  if (post.author.id !== me.id && !told) notify(post.author.id, { actor: me.id, kind: "cheer", text: `${me.name} reacted to your post.`, link });
  return { ok: true };
}

/** The quick reaction (older callers). */
export const toggleCheer = (me: User, id: number) => react(me, id, "cheer");

export function addComment(me: User, id: number, body: string): Result {
  const post = visiblePost(me, id);
  if (!post) return no("That post isn't here any more.");
  if (!settings().features.notes) return no(PAUSED);
  const { text, ids } = checkMentions(me, body.trim().slice(0, COMMENT_LIMIT));
  if (!text) return no("Write something first.");
  if (!withinLimit(`comment:${me.id}`, 60, HOUR)) return no("That's a lot of comments in an hour. Try again a little later.");
  database().prepare("insert into post_comments (post_id, author, body, created_at) values (?, ?, ?, ?)").run(id, me.id, text, Date.now());
  if (post.author.id !== me.id) notify(post.author.id, { actor: me.id, kind: "comment", text: `${me.name} commented on your post.`, link: `/notes/${id}` });
  for (const mid of ids) {
    const member = memberById(mid);
    if (member && mid !== post.author.id && canSeePost(member, post.author, post.row.audience)) {
      notify(mid, { actor: me.id, kind: "mention", text: `${me.name} mentioned you in a comment.`, link: `/notes/${id}` });
    }
  }
  return { ok: true };
}

export function removeOwnComment(me: User, id: number): Result {
  database().prepare("update post_comments set removed_at = ? where id = ? and author = ? and removed_at is null").run(Date.now(), id, me.id);
  return { ok: true };
}

/** Whether `viewer` may see a post's photo or video (for /media). */
export function canSeePostMedia(viewer: User, mediaId: string): boolean | null {
  const rows = database().prepare("select post_id from post_media where media_id = ?").all(mediaId) as { post_id: number }[];
  if (!rows.length) return null; // not on a post
  return rows.some((r) => visiblePost(viewer, r.post_id) !== null);
}

/** What one page needs about the viewer's circle, read once and shared by every post on it. */
type Circle = { connections: Set<number>; following: Set<number>; blocks: Set<number>; members: Map<number, User | null> };

const circleOf = (viewer: User): Circle => ({
  connections: connectionIds(viewer.id),
  following: followingIds(viewer.id),
  blocks: blockIds(viewer.id),
  members: new Map()
});

function cachedMember(circle: Circle, id: number): User | null {
  if (!circle.members.has(id)) circle.members.set(id, memberById(id));
  return circle.members.get(id) ?? null;
}

/** The same rule as canSeePost, answered from the circle (no query per post). */
function seesPost(viewer: User, circle: Circle, author: User, audience: Audience): boolean {
  if (viewer.id === author.id) return true;
  if (circle.blocks.has(author.id)) return false;
  if (audience === "everyone") return true;
  if (audience === "batch") return sameBatch(viewer, author) || circle.connections.has(author.id);
  return circle.connections.has(author.id);
}

/** A post's newest `limit` comments, oldest first. */
function commentsOf(viewer: User, circle: Circle, postId: number, limit: number): Comment[] {
  return (
    database()
      .prepare("select * from (select * from post_comments where post_id = ? and removed_at is null order by created_at desc limit ?) order by created_at")
      .all(postId, limit) as { id: number; author: number; body: string; created_at: number }[]
  ).flatMap((c) => {
    const author = cachedMember(circle, c.author);
    if (!author || circle.blocks.has(author.id)) return [];
    return [{ id: c.id, author, body: c.body, createdAt: c.created_at, mine: author.id === viewer.id }];
  });
}

function toPost(viewer: User, circle: Circle, row: PostRow, author: User, comments = BOARD_COMMENTS): Post {
  const db = database();
  const counts = db.prepare("select kind, count(*) as n from post_cheers where post_id = ? group by kind").all(row.id) as { kind: Reaction; n: number }[];
  const reactions: Partial<Record<Reaction, number>> = {};
  for (const c of counts) reactions[c.kind] = c.n;
  const reactionCount = counts.reduce((a, c) => a + c.n, 0);
  const mine = db.prepare("select kind from post_cheers where post_id = ? and user_id = ?").get(row.id, viewer.id) as { kind: Reaction } | undefined;
  const { c } = db.prepare("select count(*) as c from post_comments where post_id = ? and removed_at is null").get(row.id) as { c: number };
  const media = (db.prepare("select post_media.media_id as id, media.kind from post_media join media on media.id = post_media.media_id where post_id = ? order by position").all(row.id) as PostMedia[]);
  return {
    id: row.id,
    author,
    body: row.body,
    audience: row.audience,
    createdAt: row.created_at,
    media,
    reactions,
    reactionCount,
    myReaction: mine?.kind ?? null,
    cheers: reactionCount,
    cheered: Boolean(mine),
    comments: commentsOf(viewer, circle, row.id, comments),
    commentCount: c,
    mine: author.id === viewer.id
  };
}

/** One post with all its comments (up to 500), if `viewer` may see it. */
export function postFor(viewer: User, id: number): Post | null {
  const found = visiblePost(viewer, id);
  return found ? toPost(viewer, circleOf(viewer), found.row, found.author, 500) : null;
}

export type FeedScope = "all" | "following";

/**
 * The newest posts `viewer` may see. `scope: "following"`: only from people they're
 * connected to or follow (and themselves). Only by `authorIds`, if given (a member's page, a batch).
 */
export function feedFor(
  viewer: User,
  { authorId, authorIds, limit = 15, before, scope = "all" }: { authorId?: number; authorIds?: number[]; limit?: number; before?: number; scope?: FeedScope } = {}
): Post[] {
  const circle = circleOf(viewer);
  let ids = (authorId ? [authorId] : authorIds ?? []).slice(0, 500);
  if (authorIds && ids.length === 0) return [];
  if (scope === "following" && !authorId && !authorIds) {
    ids = [viewer.id, ...circle.connections, ...circle.following].slice(0, 2000);
  }
  // Scans a bounded number of the newest posts: enough to fill a page after visibility.
  const rows = database()
    .prepare(
      `select * from posts where removed_at is null ${before ? "and created_at < ?" : ""} ${ids.length ? `and author in (${ids.map(() => "?").join(",")})` : ""} order by created_at desc limit ?`
    )
    .all(...(before ? [before] : []), ...ids, limit * 5) as PostRow[];
  const posts: Post[] = [];
  for (const row of rows) {
    const author = cachedMember(circle, row.author);
    if (!author || !seesPost(viewer, circle, author, row.audience)) continue;
    posts.push(toPost(viewer, circle, row, author));
    if (posts.length >= limit) break;
  }
  return posts;
}

export { mentionedIds };
