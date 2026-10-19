import { db } from "./db";
import type { User } from "./auth";
import { audit } from "./desk";
import { isModerator } from "./roles";
import type { Result } from "./social";

/*
 * Announcements: notices from the college (the alumni office, a department), shown at
 * the top of every member's Home until they end. Put up by the college desk. Part of the
 * college's showcase, so they're in the `site` schema (`site.announcements`), not `public`.
 */

export const ANNOUNCEMENT_LIMITS = { title: 120, body: 1000 } as const;

export type Announcement = { id: number; title: string; body: string; endsAt: number | null; createdAt: number; removed: boolean; author: string | null };

const toAnnouncement = (r: Record<string, unknown>): Announcement => ({
  id: Number(r.id),
  title: String(r.title),
  body: String(r.body),
  endsAt: r.ends_at == null ? null : Number(r.ends_at),
  createdAt: Number(r.created_at),
  removed: r.removed_at != null,
  author: (r.author_name as string) ?? null
});

/** What's showing now, newest first. */
export async function activeAnnouncements(now = Date.now()): Promise<Announcement[]> {
  return (await db().all("select * from site.announcements where removed_at is null and (ends_at is null or ends_at > ?) order by created_at desc limit 3", now)).map(toAnnouncement);
}

export async function allAnnouncements(me: User): Promise<Announcement[]> {
  if (!isModerator(me)) return [];
  return (
    await db().all("select announcements.*, users.name as author_name from site.announcements left join users on users.id = announcements.author order by announcements.created_at desc limit 50")
  ).map(toAnnouncement);
}

export async function createAnnouncement(me: User, input: { title: string; body: string; days: number }): Promise<Result & { id?: number }> {
  if (!isModerator(me)) return { ok: false, error: "Only the college desk can do that." };
  const title = input.title.trim().slice(0, ANNOUNCEMENT_LIMITS.title);
  const body = input.body.trim().slice(0, ANNOUNCEMENT_LIMITS.body);
  if (!title) return { ok: false, error: "Add a title." };
  if (!body) return { ok: false, error: "Add the announcement text." };
  const days = Number.isInteger(input.days) && input.days > 0 && input.days <= 365 ? input.days : null;
  const now = Date.now();
  const row = await db().one<{ id: number }>(
    "insert into site.announcements (author, title, body, ends_at, created_at) values (?, ?, ?, ?, ?) returning id",
    me.id,
    title,
    body,
    days ? now + days * 24 * 60 * 60_000 : null,
    now
  );
  await audit(me, "announced", `announcement ${row!.id}`, title);
  return { ok: true, id: row!.id };
}

export async function removeAnnouncement(me: User, id: number): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: "Only the college desk can do that." };
  const changes = await db().run("update site.announcements set removed_at = ? where id = ? and removed_at is null", Date.now(), id);
  if (changes) await audit(me, "took down announcement", `announcement ${id}`);
  return { ok: true };
}
