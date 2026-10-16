import { firstName } from "../format";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { letter, sendMail } from "./mail";

/*
 * The daily email: once a day (app/api/cron/digest, run by Vercel Cron), each member who
 * has something waiting that they haven't seen (they haven't been on the site since it
 * arrived) gets one short email saying what. Never more than one a day; never the words
 * of a message; a one-click link to stop them (and Settings).
 *
 * A run sends to at most DIGEST_BATCH members (default 150), those waiting longest first,
 * to stay inside the mail account's daily limit.
 */

const DAY = 24 * 60 * 60_000;

const secret = () => process.env.ALUMNITY_SECRET || "";

/** The one-click stop link: signed, so nobody can turn off someone else's emails. */
export function unsubscribeToken(userId: number): string | null {
  return secret() ? createHmac("sha256", secret()).update(`digest-off:${userId}`).digest("base64url").slice(0, 32) : null;
}

export function checkUnsubscribe(userId: number, token: string): boolean {
  const want = unsubscribeToken(userId);
  if (!want || !token) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function stopDigest(userId: number) {
  await db().run("insert into member_prefs (user_id, email_digest) values (?, 0) on conflict (user_id) do update set email_digest = 0", userId);
}

type Waiting = { id: number; name: string; email: string; since: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Sends today's digests; returns how many went. */
export async function runDigest(origin: string, now = Date.now()): Promise<{ sent: number; considered: number }> {
  const batch = Math.max(1, Math.min(2000, Number(process.env.DIGEST_BATCH || 150)));
  // Members with digests on, not emailed in the last day, with unread notifications newer
  // than both their last digest and their last visit.
  const members = await db().all<Waiting>(
    `select users.id, users.name, users.email, min(notifications.created_at) as since
     from users
     join notifications on notifications.user_id = users.id and notifications.read_at is null
     left join member_prefs on member_prefs.user_id = users.id
     where users.suspended_at is null and users.sample = 0 and users.auth_id is not null
       and coalesce(member_prefs.email_digest, 1) = 1
       and coalesce(member_prefs.last_digest_at, 0) < ?
       and notifications.created_at > coalesce(member_prefs.last_digest_at, 0)
       and notifications.created_at > coalesce(users.last_seen_at, 0)
       and notifications.created_at < ?
     group by users.id, users.name, users.email
     order by since
     limit ?`,
    now - DAY + 60 * 60_000,
    now - 30 * 60_000,
    batch
  );
  let sent = 0;
  for (const m of members) {
    const rows = await db().all<{ kind: string; text: string }>(
      "select kind, text from notifications where user_id = ? and read_at is null and created_at > coalesce((select last_digest_at from member_prefs where user_id = ?), 0) order by created_at desc limit 50",
      m.id,
      m.id
    );
    if (!rows.length) continue;
    const count = (kinds: string[]) => rows.filter((r) => kinds.includes(r.kind)).length;
    const summary = [
      count(["message"]) && plural(count(["message"]), "conversation with new messages", "conversations with new messages"),
      count(["connect-request"]) && plural(count(["connect-request"]), "connection request", "connection requests"),
      count(["ask"]) && plural(count(["ask"]), "question that fits you", "questions that fit you"),
      count(["mention", "comment"]) && plural(count(["mention", "comment"]), "mention or comment", "mentions and comments")
    ].filter(Boolean) as string[];
    const token = unsubscribeToken(m.id);
    const stop = token ? `${origin}/api/alerts/unsubscribe?u=${m.id}&t=${token}` : undefined;
    const body = letter({
      greeting: `Hello ${firstName(m.name)},`,
      lines: [
        summary.length ? `Waiting for you on Alumnity: ${summary.join(", ")}.` : `You have ${plural(rows.length, "new notification", "new notifications")} on Alumnity.`,
        ...rows.slice(0, 5).map((r) => `• ${r.text}`)
      ],
      button: { text: "Open Alumnity", href: `${origin}/notifications` },
      footer: `One email a day at most, only when something's waiting. ${stop ? `Stop these: ${stop}` : "Turn these off in Settings."}`
    });
    try {
      await sendMail({ to: m.email, subject: summary[0] ? `Alumnity: ${summary[0]}` : "Something's waiting for you on Alumnity", ...body, unsubscribe: stop });
      sent += 1;
    } catch {
      continue; // try them again tomorrow
    }
    await db().run(
      "insert into member_prefs (user_id, last_digest_at) values (?, ?) on conflict (user_id) do update set last_digest_at = excluded.last_digest_at",
      m.id,
      now
    );
  }
  return { sent, considered: members.length };
}
