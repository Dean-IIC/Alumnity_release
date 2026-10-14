import { database } from "./db";

/**
 * Records an attempt under `key` and says whether it's within `limit` attempts per
 * `windowMs`. Kept in the database, so a restart doesn't reset anyone's count.
 */
export function withinLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const db = database();
  db.prepare("delete from throttle where at < ?").run(now - 24 * 60 * 60_000);
  const { n } = db.prepare("select count(*) as n from throttle where key = ? and at > ?").get(key, now - windowMs) as { n: number };
  if (n >= limit) return false;
  db.prepare("insert into throttle (key, at) values (?, ?)").run(key, now);
  return true;
}
