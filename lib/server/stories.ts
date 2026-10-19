import { firstName } from "../format";
import { db } from "./db";
import type { User } from "./auth";
import { followingIds } from "./follows";
import { mediaById, type MediaKind } from "./media";
import { blockIds, connectionIds, memberById, membersByIds, relation } from "./people";
import { mediaInUse } from "./posts";
import { sendMessage, type Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Stories: a photo or a short video that lasts a day (a campus visit, a reunion, an event
 * happening now). Seen by the author's connections, followers and batchmates; the author
 * sees who looked. They go on their own after 24 hours. A connection can reply to one, or
 * react with a quick emoji: that arrives in the author's Messages, with the story beside it.
 */

export const STORY_LIFE = 24 * 60 * 60_000;
export const CAPTION_LIMIT = 200;
const no = (error: string): Result => ({ ok: false, error });

export type Story = { id: number; mediaId: string; kind: MediaKind; caption: string; createdAt: number; seen: boolean };
export type StoryReel = { author: User; stories: Story[]; allSeen: boolean; mine: boolean };

type StoryRow = { id: number; author: number; media_id: string; caption: string; created_at: number; kind: MediaKind };

/**
 * The viewer's batchmates (same branch, joining year and programme), as a set. Stories
 * used to reach only connections and people you follow; Follow had no button until
 * lately, so testers who saw each other's posts in the feed never saw one another's
 * stories. A batch is the circle a college already shares (posts can go to it too).
 */
async function batchIds(viewer: User): Promise<Set<number>> {
  if (!viewer.branch || !viewer.joined) return new Set();
  const rows = await db().all<{ id: number }>(
    "select id from users where branch = ? and joined = ? and coalesce(programme, '') = ? and suspended_at is null and id != ? limit 1000",
    viewer.branch,
    viewer.joined,
    viewer.programme ?? "",
    viewer.id
  );
  return new Set(rows.map((r) => r.id));
}

/** Everyone whose stories `viewer` may see (not themselves): connections, those they follow, their batch; never anyone blocked either way. */
async function storyCircle(viewer: User): Promise<Set<number>> {
  const [blocked, connections, following, batch] = await Promise.all([blockIds(viewer.id), connectionIds(viewer.id), followingIds(viewer.id), batchIds(viewer)]);
  return new Set([...connections, ...following, ...batch].filter((id) => id !== viewer.id && !blocked.has(id)));
}

/** Whether `viewer` may see `authorId`'s stories: their own, or someone in their circle (above). */
async function maySee(viewer: User, authorId: number): Promise<boolean> {
  if (viewer.id === authorId) return true;
  return (await storyCircle(viewer)).has(authorId);
}

export async function createStory(me: User, mediaId: string, caption: string): Promise<Result & { id?: number }> {
  if (!(await settings()).features.notes) return no(PAUSED);
  const media = await mediaById(mediaId);
  if (!media || media.userId !== me.id || (media.kind !== "image" && media.kind !== "video")) return no("Add a photo or a video for your story.");
  if (await mediaInUse([mediaId])) return no("That photo or video is already posted.");
  if (!(await withinLimit(`story:${me.id}`, 20, STORY_LIFE))) return no("You can add up to 20 stories in 24 hours. Try again later.");
  const now = Date.now();
  const row = await db().one<{ id: number }>(
    "insert into stories (author, media_id, caption, created_at, expires_at) values (?, ?, ?, ?, ?) returning id",
    me.id,
    mediaId,
    caption.trim().slice(0, CAPTION_LIMIT),
    now,
    now + STORY_LIFE
  );
  return { ok: true, id: row!.id };
}

export async function removeStory(me: User, id: number): Promise<Result> {
  await db().run("update stories set removed_at = ? where id = ? and author = ?", Date.now(), id, me.id);
  return { ok: true };
}

/**
 * The stories bar: your own reel first, then everyone in your circle (connections, people
 * you follow, your batch) who has a story up, those with ones you haven't seen first,
 * newest first.
 */
export async function storyBar(viewer: User, now = Date.now(), only?: number): Promise<StoryReel[]> {
  const authors = only !== undefined ? [only] : [viewer.id, ...(await storyCircle(viewer))];
  const unique = [...new Set(authors)].slice(0, 2000);
  const [rows, seenRows] = await Promise.all([
    db().all<StoryRow>(
      `select stories.*, media.kind from stories join media on media.id = stories.media_id
       where stories.removed_at is null and stories.expires_at > ? and stories.author in (${unique.map(() => "?").join(",")})
       order by stories.created_at, stories.id`,
      now,
      ...unique
    ),
    db().all<{ story_id: number }>("select story_id from story_views where user_id = ? and viewed_at > ?", viewer.id, now - STORY_LIFE)
  ]);
  const seen = new Set(seenRows.map((r) => r.story_id));
  const members = await membersByIds(rows.map((r) => r.author).filter((id) => id !== viewer.id));
  const reels = new Map<number, StoryReel>();
  for (const r of rows) {
    if (!reels.has(r.author)) {
      const author = r.author === viewer.id ? viewer : members.get(r.author);
      if (!author) continue;
      reels.set(r.author, { author, stories: [], allSeen: true, mine: r.author === viewer.id });
    }
    const reel = reels.get(r.author)!;
    const isSeen = reel.mine || seen.has(r.id);
    reel.stories.push({ id: r.id, mediaId: r.media_id, kind: r.kind, caption: r.caption, createdAt: r.created_at, seen: isSeen });
    if (!isSeen) reel.allSeen = false;
  }
  const latest = (r: StoryReel) => r.stories[r.stories.length - 1].createdAt;
  return [...reels.values()].sort((a, b) => Number(b.mine) - Number(a.mine) || Number(a.allSeen) - Number(b.allSeen) || latest(b) - latest(a));
}

/** One member's current stories, for the viewer (marks nothing). */
export async function reelOf(viewer: User, authorId: number, now = Date.now()): Promise<StoryReel | null> {
  if (!(await maySee(viewer, authorId))) return null;
  return (await storyBar(viewer, now, authorId)).find((r) => r.author.id === authorId) ?? null;
}

/** The viewer looked at a story: remembered, so the bar can show what's new. */
export async function markSeen(viewer: User, storyId: number): Promise<Result> {
  const row = await db().one<{ author: number }>("select author from stories where id = ? and removed_at is null and expires_at > ?", storyId, Date.now());
  if (!row || !(await maySee(viewer, row.author))) return no("This story is no longer available.");
  if (row.author !== viewer.id) await db().run("insert into story_views (story_id, user_id, viewed_at) values (?, ?, ?) on conflict do nothing", storyId, viewer.id, Date.now());
  return { ok: true };
}

/** Who saw one of your stories (only you can ask). */
export async function storyViewers(me: User, storyId: number): Promise<User[]> {
  const row = await db().one<{ author: number }>("select author from stories where id = ?", storyId);
  if (!row || row.author !== me.id) return [];
  const [rows, blocked] = await Promise.all([
    db().all<{ user_id: number }>("select user_id from story_views where story_id = ? order by viewed_at desc", storyId),
    blockIds(me.id)
  ]);
  const members = await membersByIds(rows.map((r) => r.user_id).filter((id) => !blocked.has(id)));
  return rows.flatMap((r) => members.get(r.user_id) ?? []);
}

/** Whether `viewer` may see a story's photo or video (for /media). Null if it isn't a story's. */
export async function canSeeStoryMedia(viewer: User, mediaId: string): Promise<boolean | null> {
  const row = await db().one<{ author: number; expires_at: number; removed_at: number | null; suspended_at: number | null }>(
    "select stories.author, stories.expires_at, stories.removed_at, users.suspended_at from stories join users on users.id = stories.author where stories.media_id = ?",
    mediaId
  );
  if (!row) return null;
  if (row.author === viewer.id) return true;
  // Not once the author is suspended, even for someone who already has the link.
  return row.removed_at === null && row.suspended_at === null && row.expires_at > Date.now() && (await maySee(viewer, row.author));
}

// ---------- Replies and reactions ----------

/** The quick reactions under a story, as on Instagram and WhatsApp. */
export const STORY_REACTIONS = ["❤️", "🔥", "👏", "😂", "😮", "🎉"] as const;
export const STORY_REPLY_LIMIT = 1000;

/**
 * A reply to a story, or a quick reaction (`reaction`, one of STORY_REACTIONS): it goes to
 * the story's author as a direct message that remembers the story, and they're told as
 * for any message. Only between connections, as every message is; never to your own story.
 */
export async function replyToStory(me: User, storyId: number, reply: { text?: string; reaction?: string }): Promise<Result> {
  const row = await db().one<{ author: number }>("select author from stories where id = ? and removed_at is null and expires_at > ?", storyId, Date.now());
  const author = row ? await memberById(row.author) : null;
  if (!row || !author || !(await maySee(me, author.id))) return no("This story is no longer available.");
  if (author.id === me.id) return no("You can't reply to your own story.");
  if ((await relation(me.id, author.id)) !== "connected") return no(`Connect with ${firstName(author.name)} to reply to their story.`);
  if (reply.reaction !== undefined) {
    if (!(STORY_REACTIONS as readonly string[]).includes(reply.reaction)) return no("Choose one of the reactions shown.");
    return sendMessage(me, author.id, reply.reaction, { id: storyId, reaction: reply.reaction });
  }
  const text = (reply.text ?? "").trim().slice(0, STORY_REPLY_LIMIT);
  if (!text) return no("Write something first.");
  return sendMessage(me, author.id, text, { id: storyId, reaction: null });
}
