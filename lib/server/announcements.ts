import { database } from "./db";
import type { User } from "./auth";
import { audit } from "./desk";
import { isModerator } from "./roles";
import type { Result } from "./social";

/*
 * Announcements: notices from the college (the alumni office, a department), shown at
 * the top of every member's Home until they end. Put up by the college desk.
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
export function activeAnnouncements(now = Date.now()): Announcement[] {
  return (
    database().prepare("select * from announcements where removed_at is null and (ends_at is null or ends_at > ?) order by created_at desc limit 3").all(now) as Record<string, unknown>[]
  ).map(toAnnouncement);
}

export function allAnnouncements(me: User): Announcement[] {
  if (!isModerator(me)) return [];
  return (
    database()
      .prepare("select announcements.*, users.name as author_name from announcements left join users on users.id = announcements.author order by announcements.created_at desc limit 50")
      .all() as Record<string, unknown>[]
  ).map(toAnnouncement);
}

export function createAnnouncement(me: User, input: { title: string; body: string; days: number }): Result & { id?: number } {
  if (!isModerator(me)) return { ok: false, error: "Only the college desk can do that." };
  const title = input.title.trim().slice(0, ANNOUNCEMENT_LIMITS.title);
  const body = input.body.trim().slice(0, ANNOUNCEMENT_LIMITS.body);
  if (!title) return { ok: false, error: "Give it a title." };
  if (!body) return { ok: false, error: "Say what it's about." };
  const days = Number.isInteger(input.days) && input.days > 0 && input.days <= 365 ? input.days : null;
  const now = Date.now();
  const { lastInsertRowid } = database()
    .prepare("insert into announcements (author, title, body, ends_at, created_at) values (?, ?, ?, ?, ?)")
    .run(me.id, title, body, days ? now + days * 24 * 60 * 60_000 : null, now);
  audit(me, "announced", `announcement ${lastInsertRowid}`, title);
  return { ok: true, id: Number(lastInsertRowid) };
}

export function removeAnnouncement(me: User, id: number): Result {
  if (!isModerator(me)) return { ok: false, error: "Only the college desk can do that." };
  const { changes } = database().prepare("update announcements set removed_at = ? where id = ? and removed_at is null").run(Date.now(), id);
  if (changes) audit(me, "took down announcement", `announcement ${id}`);
  return { ok: true };
}
