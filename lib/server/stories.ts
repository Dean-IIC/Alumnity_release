import { database } from "./db";
import type { User } from "./auth";
import { followingIds } from "./follows";
import { mediaById, type MediaKind } from "./media";
import { blockIds, connectionIds, memberById } from "./people";
import type { Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Stories: a photo or a short video that lasts a day (a campus visit, a reunion, an event
 * happening now). Seen by the author's connections and followers; the author sees who
 * looked. They go on their own after 24 hours.
 */

export const STORY_LIFE = 24 * 60 * 60_000;
export const CAPTION_LIMIT = 200;
const no = (error: string): Result => ({ ok: false, error });

export type Story = { id: number; mediaId: string; kind: MediaKind; caption: string; createdAt: number; seen: boolean };
export type StoryReel = { author: User; stories: Story[]; allSeen: boolean; mine: boolean };

type StoryRow = { id: number; author: number; media_id: string; caption: string; created_at: number; kind: MediaKind };

/** Whether `viewer` may see `authorId`'s stories: their own, a connection's, or someone they follow. */
function maySee(viewer: User, authorId: number): boolean {
  if (viewer.id === authorId) return true;
  if (blockIds(viewer.id).has(authorId)) return false;
  return connectionIds(viewer.id).has(authorId) || followingIds(viewer.id).has(authorId);
}

export function createStory(me: User, mediaId: string, caption: string): Result & { id?: number } {
  if (!settings().features.notes) return no(PAUSED);
  const media = mediaById(mediaId);
  if (!media || media.userId !== me.id || (media.kind !== "image" && media.kind !== "video")) return no("Add a photo or a video for your story.");
  const db = database();
  if (db.prepare("select 1 from stories where media_id = ?").get(mediaId) || db.prepare("select 1 from post_media where media_id = ?").get(mediaId)) return no("That's already posted.");
  if (!withinLimit(`story:${me.id}`, 20, STORY_LIFE)) return no("That's twenty stories today: the most in a day.");
  const now = Date.now();
  const { lastInsertRowid } = db
    .prepare("insert into stories (author, media_id, caption, created_at, expires_at) values (?, ?, ?, ?, ?)")
    .run(me.id, mediaId, caption.trim().slice(0, CAPTION_LIMIT), now, now + STORY_LIFE);
  return { ok: true, id: Number(lastInsertRowid) };
}

export function removeStory(me: User, id: number): Result {
  database().prepare("update stories set removed_at = ? where id = ? and author = ?").run(Date.now(), id, me.id);
  return { ok: true };
}

/**
 * The stories bar: your own reel first, then everyone you're connected to or follow who
 * has a story up, those with ones you haven't seen first, newest first.
 */
export function storyBar(viewer: User, now = Date.now()): StoryReel[] {
  const blocked = blockIds(viewer.id);
  const authors = [viewer.id, ...[...connectionIds(viewer.id), ...followingIds(viewer.id)].filter((id) => !blocked.has(id))];
  const unique = [...new Set(authors)].slice(0, 2000);
  const rows = database()
    .prepare(
      `select stories.*, media.kind from stories join media on media.id = stories.media_id
       where stories.removed_at is null and stories.expires_at > ? and stories.author in (${unique.map(() => "?").join(",")})
       order by stories.created_at`
    )
    .all(now, ...unique) as StoryRow[];
  const seen = new Set(
    (database().prepare("select story_id from story_views where user_id = ? and viewed_at > ?").all(viewer.id, now - STORY_LIFE) as { story_id: number }[]).map((r) => r.story_id)
  );
  const reels = new Map<number, StoryReel>();
  for (const r of rows) {
    if (!reels.has(r.author)) {
      const author = r.author === viewer.id ? viewer : memberById(r.author);
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
export function reelOf(viewer: User, authorId: number, now = Date.now()): StoryReel | null {
  if (!maySee(viewer, authorId)) return null;
  return storyBar(viewer, now).find((r) => r.author.id === authorId) ?? null;
}

/** The viewer looked at a story: remembered, so the bar can show what's new. */
export function markSeen(viewer: User, storyId: number): Result {
  const row = database().prepare("select author from stories where id = ? and removed_at is null and expires_at > ?").get(storyId, Date.now()) as { author: number } | undefined;
  if (!row || !maySee(viewer, row.author)) return no("That story isn't here any more.");
  if (row.author !== viewer.id) database().prepare("insert or ignore into story_views (story_id, user_id, viewed_at) values (?, ?, ?)").run(storyId, viewer.id, Date.now());
  return { ok: true };
}

/** Who saw one of your stories (only you can ask). */
export function storyViewers(me: User, storyId: number): User[] {
  const row = database().prepare("select author from stories where id = ?").get(storyId) as { author: number } | undefined;
  if (!row || row.author !== me.id) return [];
  return (database().prepare("select user_id from story_views where story_id = ? order by viewed_at desc").all(storyId) as { user_id: number }[])
    .map((r) => memberById(r.user_id))
    .filter((u): u is User => u !== null && !blockIds(me.id).has(u.id));
}

/** Whether `viewer` may see a story's photo or video (for /media). Null if it isn't a story's. */
export function canSeeStoryMedia(viewer: User, mediaId: string): boolean | null {
  const row = database().prepare("select author, expires_at, removed_at from stories where media_id = ?").get(mediaId) as { author: number; expires_at: number; removed_at: number | null } | undefined;
  if (!row) return null;
  if (row.author === viewer.id) return true;
  return row.removed_at === null && row.expires_at > Date.now() && maySee(viewer, row.author);
}
