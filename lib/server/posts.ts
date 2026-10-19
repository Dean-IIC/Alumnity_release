import { db } from "./db";
import type { User } from "./auth";
import { MENTION, mentionedIds } from "../mentions";
import { cleanTag, tagsIn, WORK_TAGS } from "../tags";
import { followingIds } from "./follows";
import { canPostInGroup, canReadGroup, groupNames, memberGroupIds } from "./groups";
import { mediaByIds, type MediaKind } from "./media";
import { blockIds, connectionIds, memberById, membersByIds, relation } from "./people";
import { isModerator } from "./roles";
import { acceptConnection, NOTE_LIMIT, notify, requestConnection, sendMessage, type Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Home: posts. Words, up to four photos or videos, @mentions. Each post is for everyone
 * on Alumnity, for the author's batch, for their connections only, or for one group, and
 * only those people ever see it, its photos, its reactions or its comments. Group posts
 * stay in their group: they never show on Home. A #tag says what a post is about (#job,
 * #notice…), and the college can verify a post: it then shows on the HKBK board too.
 */

export type Audience = "everyone" | "batch" | "connections" | "group";
/** Who a post outside a group may be for. */
export const AUDIENCES: Audience[] = ["everyone", "batch", "connections"];
export const POST_LIMIT = 2000;
export const COMMENT_LIMIT = 500;
/** Photos and videos one post may carry. */
export const MEDIA_LIMIT = 4;
const HOUR = 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });
const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");

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

type PostRow = { id: number; author: number; body: string; audience: Audience; group_id: number | null; created_at: number; from_archive?: number; verified_at?: number | null };

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

export async function createPost(me: User, body: string, audience: string, mediaIds: string[] = [], groupId: number | null = null, picked: string[] = []): Promise<Result & { id?: number }> {
  if (!(await settings()).features.notes) return no(PAUSED);
  const media = [...new Set(mediaIds)].slice(0, MEDIA_LIMIT + 1);
  if (media.length > MEDIA_LIMIT) return no(`A post can have up to ${MEDIA_LIMIT} photos or videos.`);
  const { text, ids } = await checkMentions(me, body.trim().slice(0, POST_LIMIT));
  if (!text && media.length === 0) return no("Write something, or add a photo.");
  if (groupId !== null) {
    if (!(await canPostInGroup(me, groupId))) return no("Join the group to post in it.");
    audience = "group";
  } else if (!AUDIENCES.includes(audience as Audience)) return no("Choose who it's for.");
  if (audience === "batch" && !(me.branch && me.joined)) return no("Your batch isn't known, so this can't go to it.");
  // Only your own uploads, each on one post.
  const uploads = await mediaByIds(media);
  for (const id of media) {
    const m = uploads.get(id);
    if (!m || m.userId !== me.id || (m.kind !== "image" && m.kind !== "video")) return no("One of those photos isn't yours to post.");
  }
  if (await mediaInUse(media)) return no("That photo is already posted.");
  if (!(await withinLimit(`post:${me.id}`, 20, HOUR))) return no("That's a lot of posts in an hour. Try again a little later.");
  const postId = await db().tx(async (t) => {
    const row = await t.one<{ id: number }>(
      "insert into posts (author, body, audience, group_id, created_at) values (?, ?, ?, ?, ?) returning id",
      me.id,
      text,
      audience,
      groupId,
      Date.now()
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
  return { ok: true, id: postId };
}

export async function removeOwnPost(me: User, id: number): Promise<Result> {
  await db().run("update posts set removed_at = ? where id = ? and author = ? and removed_at is null", Date.now(), id, me.id);
  return { ok: true };
}

/** React to a post; the same reaction again takes it back, another one replaces it. */
export async function react(me: User, id: number, kind: string): Promise<Result> {
  if (!REACTIONS.includes(kind as Reaction)) return no("That isn't a reaction.");
  const post = await visiblePost(me, id);
  if (!post) return no("That post isn't here any more.");
  if (!(await withinLimit(`cheer:${me.id}`, 300, HOUR))) return no("That's a lot of reacting in an hour. Try again a little later.");
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
  if (!post) return no("That post isn't here any more.");
  if (!(await settings()).features.notes) return no(PAUSED);
  const { text, ids } = await checkMentions(me, body.trim().slice(0, COMMENT_LIMIT));
  if (!text) return no("Write something first.");
  if (!(await withinLimit(`comment:${me.id}`, 60, HOUR))) return no("That's a lot of comments in an hour. Try again a little later.");
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
  await db().run("update post_comments set removed_at = ? where id = ? and author = ? and removed_at is null", Date.now(), id, me.id);
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
  const [counts, mine, commentCounts, media, commentRows, tags] = await Promise.all([
    db().all<{ post_id: number; kind: Reaction; n: number }>(`select post_id, kind, count(*) as n from post_cheers where post_id in (${q}) group by post_id, kind`, ...ids),
    db().all<{ post_id: number; kind: Reaction }>(`select post_id, kind from post_cheers where user_id = ? and post_id in (${q})`, viewer.id, ...ids),
    db().all<{ post_id: number; n: number }>(`select post_id, count(*) as n from post_comments where removed_at is null and post_id in (${q}) group by post_id`, ...ids),
    db().all<{ post_id: number; id: string; kind: MediaKind }>(
      `select post_media.post_id, post_media.media_id as id, media.kind from post_media join media on media.id = post_media.media_id where post_media.post_id in (${q}) order by post_media.position`,
      ...ids
    ),
    db().all<{ id: number; post_id: number; author: number; body: string; created_at: number }>(
      `select id, post_id, author, body, created_at from (
         select post_comments.*, row_number() over (partition by post_id order by created_at desc, id desc) as newest
         from post_comments where removed_at is null and post_id in (${q})
       ) as c where newest <= ? order by created_at, id`,
      ...ids,
      comments
    ),
    db().all<{ post_id: number; tag: string }>(`select post_id, tag from post_tags where post_id in (${q}) order by tag`, ...ids)
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
        return by ? [{ id: c.id, author: by, body: c.body, createdAt: c.created_at, mine: by.id === viewer.id }] : [];
      }),
      commentCount: commentCounts.find((c) => c.post_id === row.id)?.n ?? 0,
      mine: author.id === viewer.id,
      tags: tags.filter((t) => t.post_id === row.id).map((t) => t.tag),
      verifiedAt: row.verified_at ?? null
    };
  });
}

/** One post with all its comments (up to 500), if `viewer` may see it. */
export async function postFor(viewer: User, id: number): Promise<Post | null> {
  const found = await visiblePost(viewer, id);
  return found ? (await toPosts(viewer, await circleOf(viewer), [found], 500))[0] : null;
}

export type FeedScope = "all" | "following";

/**
 * The newest posts `viewer` may see. `scope: "following"`: only from people they're
 * connected to or follow (and themselves). Only by `authorIds`, if given (a member's page, a batch).
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
    /** Only posts the college has verified (the HKBK board), newest verified first. */
    verified?: boolean;
  } = {}
): Promise<Post[]> {
  if (groupId !== undefined && !(await canReadGroup(viewer, groupId))) return [];
  const tags = (tag === undefined ? [] : Array.isArray(tag) ? tag : [tag]).slice(0, 10);
  const circle = await circleOf(viewer);
  let ids = (authorId ? [authorId] : authorIds ?? []).slice(0, 500);
  if (authorIds && ids.length === 0) return [];
  if (scope === "following" && !authorId && !authorIds) {
    ids = [viewer.id, ...circle.connections, ...circle.following].slice(0, 2000);
  }
  // Scans a bounded number of the newest posts: enough to fill a page after visibility.
  const rows = await db().all<PostRow>(
    `select * from posts where removed_at is null and ${groupId !== undefined ? "group_id = ?" : "group_id is null"}
     ${before ? "and created_at < ?" : ""} ${ids.length ? `and author in (${marks(ids.length)})` : ""}
     ${tags.length ? `and id in (select post_id from post_tags where tag in (${marks(tags.length)}))` : ""} ${verified ? "and verified_at is not null" : ""}
     order by ${verified ? "verified_at desc," : ""} created_at desc, id desc limit ?`,
    ...(groupId !== undefined ? [groupId] : []),
    ...(before ? [before] : []),
    ...ids,
    ...tags,
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

export { mentionedIds };

/**
 * The college's check mark: a coordinator or administrator verifies a post (it goes on the
 * HKBK board), or takes it back. Only posts for everyone can be on the board. Written to the
 * audit log; the writer is told when theirs is verified.
 */
export async function verifyPost(me: User, id: number, on: boolean): Promise<Result> {
  if (!isModerator(me)) return no("Only the college desk can verify posts.");
  const post = await visiblePost(me, id);
  if (!post) return no("That post isn't here any more.");
  if (on && post.row.audience !== "everyone") return no("Only a post for everyone can go on the board.");
  const changed = await db().run(
    on ? "update posts set verified_at = ?, verified_by = ? where id = ? and verified_at is null" : "update posts set verified_at = null, verified_by = null where id = ? and verified_at is not null",
    ...(on ? [Date.now(), me.id, id] : [id])
  );
  if (!changed) return { ok: true };
  const { audit } = await import("./desk");
  await audit(me, on ? "verified" : "unverified", `post ${id}`, plainStart(post.row.body));
  if (on && post.author.id !== me.id) await notify(post.author.id, { actor: me.id, kind: "post-verified", text: "The college verified your post. It's on the HKBK board now.", link: `/notes/${id}` });
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
  for (const s of students) await notify(s.id, { actor: author.id, kind: "board-work", text: `On the HKBK board: ${what} from ${author.name}. You said you're looking.`, link });
}

const plainStart = (body: string) => body.replace(MENTION, (_, name: string) => `@${name}`).slice(0, 80);

/**
 * Asking the writer of a #job, #internship or #referral post to refer you, with a line on
 * why you fit. Not connected yet: it's a connection request with that note (they accept,
 * you talk). Already connected: it goes to them as a message. No new kind of thing to learn.
 */
export async function askForReferral(me: User, postId: number, note: string): Promise<Result & { as?: "request" | "message" }> {
  const post = await visiblePost(me, postId);
  if (!post) return no("That post isn't here any more.");
  if (post.author.id === me.id) return no("That's your own post.");
  const tags = tagsIn(post.row.body);
  const tag = WORK_TAGS.find((t) => tags.includes(t));
  if (!tag) return no("You can ask for a referral on a #job, #internship or #referral post.");
  const why = note.trim();
  if (why.length < 20) return no("Write a line or two about why you fit: your branch, skills, a project.");
  const about = `Referral, about your #${tag} post: `;
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