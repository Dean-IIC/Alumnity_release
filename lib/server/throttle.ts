import { db } from "./db";

/**
 * Records an attempt under `key` and says whether it's within `limit` attempts per
 * `windowMs`. Kept in the database, so a restart (or another server) doesn't reset anyone's count.
 */
export async function withinLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  // Old attempts are cleared now and then, not on every call.
  if (Math.random() < 0.02) await db().run("delete from throttle where at < ?", now - 24 * 60 * 60_000);
  const row = await db().one<{ n: number }>("select count(*) as n from throttle where key = ? and at > ?", key, now - windowMs);
  if ((row?.n ?? 0) >= limit) return false;
  await db().run("insert into throttle (key, at) values (?, ?)", key, now);
  return true;
}
