import type { GalleryVideo } from "../gallery";
import { db } from "./db";
import { fileUrl, toVideo, type VideoRow } from "./showcase";

/*
 * News and videos: the college's news, alumni stories and notices (site.stories), and the
 * college's films (every video in a published gallery album), for the News & videos page
 * and the newest few on the welcome page. Public: nothing here is about a member.
 */

export type StoryKind = "news" | "story" | "notice";
export const STORY_KIND_LABEL: Record<StoryKind, string> = { news: "News", story: "Alumni story", notice: "Notice" };

export type Story = {
  slug: string;
  kind: StoryKind;
  title: string;
  summary: string;
  body: string;
  cover: string | null;
  videoUrl: string | null;
  pinned: boolean;
  /** "2025-09-29", or '' when not known. */
  date: string;
};

type StoryRow = {
  slug: string;
  kind: StoryKind;
  title: string;
  summary: string;
  body: string;
  cover_src: string | null;
  video_url: string | null;
  pinned: boolean;
  happened_on: string;
};

const toStory = (r: StoryRow): Story => ({
  slug: r.slug,
  kind: r.kind,
  title: r.title,
  summary: r.summary,
  body: r.body,
  cover: r.cover_src ? fileUrl(r.cover_src) : null,
  videoUrl: r.video_url,
  pinned: Boolean(r.pinned),
  date: r.happened_on
});

/** Published stories: pinned first, then newest. */
export async function stories(limit = 50): Promise<Story[]> {
  const rows = await db().all<StoryRow>(
    "select * from site.stories where published order by pinned desc, happened_on desc, id desc limit ?",
    Math.min(Math.max(1, limit), 200)
  );
  return rows.map(toStory);
}

export async function storyBySlug(slug: string): Promise<Story | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const row = await db().one<StoryRow>("select * from site.stories where published and slug = ?", slug);
  return row ? toStory(row) : null;
}

/** The college's films: every video in a published album, newest added first. */
export async function videos(limit = 30): Promise<GalleryVideo[]> {
  const rows = await db().all<VideoRow>(
    `select v.* from site.videos v join site.albums a on a.id = v.album_id where a.published order by v.id desc limit ?`,
    Math.min(Math.max(1, limit), 100)
  );
  return rows.flatMap((r) => toVideo(r) ?? []);
}

/** "29 September 2025", "September 2025", "2025", or ''. */
export function storyDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y) return "";
  if (!m) return String(y);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });
  return d ? `${d} ${month} ${y}` : `${month} ${y}`;
}
