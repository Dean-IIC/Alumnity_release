import { database } from "./db";
import type { User } from "./auth";
import { toUser } from "./auth";
import { blockedEitherWay, blockIds, connectionIds, memberById } from "./people";
import { profileOf } from "./profile";
import { isSenior } from "./roles";
import { notify, type Result } from "./social";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Ask a senior. A question goes to the few seniors who fit it best (alumni and faculty
 * who said they're happy to mentor), never to everyone. One of them takes it on; from
 * then on it's a private thread between the two. When the asker marks it answered, their
 * thanks goes on the senior's Record.
 */

export type AskStatus = "open" | "taken" | "answered" | "closed";
export const ASK_LIMITS = { title: 140, body: 2000, topics: 5, topic: 30, reply: 2000 } as const;
/** How many seniors one question goes to. */
const ROUTE_TO = 5;
const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });

export { isSenior } from "./roles";

export type Ask = {
  id: number;
  author: User;
  title: string;
  body: string;
  topics: string[];
  status: AskStatus;
  taker: User | null;
  thanks: string | null;
  createdAt: number;
  /** Why it came to the viewer, if it was routed to them. */
  reason: string | null;
};

export type AskMessage = { id: number; author: User; body: string; createdAt: number; mine: boolean };

type AskRow = {
  id: number;
  author: number;
  title: string;
  body: string;
  topics: string;
  status: AskStatus;
  taker: number | null;
  thanks: string | null;
  created_at: number;
};

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1);

/** The seniors a question should go to, best first, each with why. */
export function routeFor(author: User, title: string, topics: string[]): { user: User; reason: string }[] {
  const wanted = new Set([...topics.flatMap(words), ...words(title)]);
  // Only those who said they're happy to mentor: found by the database, not by reading every page.
  // Each mentor and their page in one read, rather than two queries per mentor.
  const rows = database()
    .prepare(
      `select users.*, profiles.data as profile_data from users join profiles on profiles.user_id = users.id
       where users.id != ? and users.suspended_at is null and users.role != 'student'
       and json_extract(profiles.data, '$.happyTo.mentor') = 1`
    )
    .all(author.id) as Record<string, unknown>[];
  const blocked = blockIds(author.id);
  const circle = connectionIds(author.id);
  const scored: { user: User; score: number; reason: string }[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (blocked.has(id)) continue;
    const user = toUser(row);
    const saved = JSON.parse(String(row.profile_data)) as { skills?: string[]; title?: string };
    const profile = { skills: Array.isArray(saved.skills) ? saved.skills : [], title: typeof saved.title === "string" ? saved.title : "" };
    const theirs = new Set([...profile.skills.flatMap(words), ...words(profile.title)]);
    const shared = [...wanted].filter((w) => theirs.has(w));
    let score = shared.length * 3;
    const reasons: string[] = [];
    if (shared.length) reasons.push(`knows ${shared.slice(0, 3).join(", ")}`);
    if (user.branch && user.branch === author.branch) {
      score += 2;
      reasons.push(`also ${user.branch}`);
    }
    if (circle.has(id)) {
      score += 1;
      reasons.push("a connection");
    }
    scored.push({ user, score, reason: reasons.join(" · ") || "happy to mentor" });
  }
  // Only seniors who actually fit (shared topics, branch, a connection): a question that's
  // nothing to do with them teaches seniors to ignore Asks. Any mentor only if few fit.
  const fits = scored.filter((s) => s.score > 0);
  const pool = fits.length >= 2 ? fits : scored;
  return pool.sort((a, b) => b.score - a.score).slice(0, ROUTE_TO).map(({ user, reason }) => ({ user, reason }));
}

export function createAsk(me: User, input: { title: string; body: string; topics: string }): Result & { id?: number } {
  if (!settings().features.asks) return no(PAUSED);
  const title = input.title.trim().slice(0, ASK_LIMITS.title);
  const body = input.body.trim().slice(0, ASK_LIMITS.body);
  const topics = [...new Set(input.topics.split(",").map((t) => t.trim().slice(0, ASK_LIMITS.topic)).filter(Boolean))].slice(0, ASK_LIMITS.topics);
  if (!title) return no("Say what you'd like to ask, in a line.");
  if (!body) return no("Add a few lines: what you've tried, what you're stuck on.");
  if (!withinLimit(`ask:${me.id}`, 5, DAY)) return no("That's five Asks today: the most in a day. Try again tomorrow.");
  const db = database();
  const { lastInsertRowid } = db
    .prepare("insert into asks (author, title, body, topics, status, created_at) values (?, ?, ?, ?, 'open', ?)")
    .run(me.id, title, body, JSON.stringify(topics), Date.now());
  const id = Number(lastInsertRowid);
  for (const { user, reason } of routeFor(me, title, topics)) {
    db.prepare("insert or ignore into ask_routes (ask_id, user_id, reason) values (?, ?, ?)").run(id, user.id, reason);
    notify(user.id, { actor: me.id, kind: "ask", text: `${me.name} has a question that fits you: “${title}”`, link: `/ask/${id}` });
  }
  return { ok: true, id };
}

const routedTo = (askId: number, userId: number) =>
  (database().prepare("select reason from ask_routes where ask_id = ? and user_id = ?").get(askId, userId) as { reason: string } | undefined)?.reason ?? null;

/** A member by id even if paused: an Ask they were part of stays readable to the other side. */
const anyMember = (id: number): User | null => {
  const row = database().prepare("select * from users where id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? toUser(row) : null;
};

function toAsk(row: AskRow, viewer: User): Ask | null {
  const author = anyMember(row.author);
  if (!author) return null;
  return {
    id: row.id,
    author,
    title: row.title,
    body: row.body,
    topics: JSON.parse(row.topics) as string[],
    status: row.status,
    taker: row.taker ? anyMember(row.taker) : null,
    thanks: row.thanks,
    createdAt: row.created_at,
    reason: routedTo(row.id, viewer.id)
  };
}

const rowById = (id: number) => database().prepare("select * from asks where id = ?").get(id) as AskRow | undefined;

/**
 * Whether `viewer` may see an Ask. Its author always; the senior who took it; before
 * anyone has, the seniors it went to, or any senior if it went to nobody (an open Ask).
 */
/** Whether the asker and the senior on it have blocked each other: then the thread is closed to both. */
const pairBlocked = (row: AskRow) => row.taker !== null && blockedEitherWay(row.author, row.taker);

function mayView(viewer: User, row: AskRow): boolean {
  if (row.author === viewer.id) return true;
  if (row.taker === viewer.id) return !pairBlocked(row);
  if (!memberById(row.author) || blockedEitherWay(viewer.id, row.author)) return false;
  if (row.status !== "open") return false;
  if (routedTo(row.id, viewer.id) !== null) return true;
  const routes = (database().prepare("select count(*) as n from ask_routes where ask_id = ?").get(row.id) as { n: number }).n;
  return routes === 0 && isSenior(viewer);
}

export function askFor(viewer: User, id: number): Ask | null {
  const row = rowById(id);
  return row && mayView(viewer, row) ? toAsk(row, viewer) : null;
}

export function asksFor(viewer: User): { mine: Ask[]; forMe: Ask[]; taken: Ask[]; open: Ask[] } {
  const db = database();
  const list = (sql: string, ...args: (number | string)[]) =>
    (db.prepare(sql).all(...args) as AskRow[]).filter((r) => mayView(viewer, r)).map((r) => toAsk(r, viewer)).filter((a): a is Ask => a !== null);
  return {
    mine: list("select * from asks where author = ? order by created_at desc", viewer.id),
    forMe: list(
      "select asks.* from asks join ask_routes on ask_routes.ask_id = asks.id where ask_routes.user_id = ? and asks.status = 'open' order by asks.created_at desc",
      viewer.id
    ),
    taken: list("select * from asks where taker = ? order by created_at desc", viewer.id),
    open: isSenior(viewer)
      ? list(
          "select * from asks where status = 'open' and author != ? and not exists (select 1 from ask_routes where ask_routes.ask_id = asks.id) order by created_at desc limit 30",
          viewer.id
        )
      : []
  };
}

export function takeAsk(me: User, id: number): Result {
  const row = rowById(id);
  if (!row || !mayView(me, row)) return no("That Ask isn't here.");
  if (!isSenior(me)) return no("Asks are taken on by alumni and faculty.");
  if (row.author === me.id) return no("You can't take your own Ask.");
  const result = database().prepare("update asks set status = 'taken', taker = ?, taken_at = ? where id = ? and status = 'open'").run(me.id, Date.now(), id);
  if (!result.changes) return no("Someone has just taken this one on.");
  notify(row.author, { actor: me.id, kind: "ask-taken", text: `${me.name} took on your question “${row.title}”.`, link: `/ask/${id}` });
  return { ok: true };
}

/** The thread: between the asker and the senior who took it on. */
export function askThread(viewer: User, id: number): AskMessage[] {
  const row = rowById(id);
  if (!row || (row.author !== viewer.id && row.taker !== viewer.id) || pairBlocked(row)) return [];
  return (
    database().prepare("select * from ask_messages where ask_id = ? order by created_at").all(id) as { id: number; author: number; body: string; created_at: number }[]
  ).flatMap((m) => {
    const author = anyMember(m.author);
    return author ? [{ id: m.id, author, body: m.body, createdAt: m.created_at, mine: author.id === viewer.id }] : [];
  });
}

export function replyToAsk(me: User, id: number, body: string): Result {
  const row = rowById(id);
  if (!row || (row.author !== me.id && row.taker !== me.id)) return no("Only the asker and the senior who took it on can write here.");
  if (row.status !== "taken" && row.status !== "answered") return no("This Ask isn't open for replies.");
  if (pairBlocked(row)) return no("This conversation is closed.");
  const text = body.trim().slice(0, ASK_LIMITS.reply);
  if (!text) return no("Write something first.");
  if (!withinLimit(`ask-reply:${me.id}`, 120, 60 * 60_000)) return no("That's a lot of replies in an hour. Take a breather and try again.");
  database().prepare("insert into ask_messages (ask_id, author, body, created_at) values (?, ?, ?, ?)").run(id, me.id, text, Date.now());
  const other = me.id === row.author ? row.taker : row.author;
  if (other) notify(other, { actor: me.id, kind: "ask-reply", text: `${me.name} replied on “${row.title}”.`, link: `/ask/${id}` });
  return { ok: true };
}

/** The asker marks it answered, with a line of thanks that goes on the senior's Record. */
export function markAnswered(me: User, id: number, thanks: string): Result {
  const row = rowById(id);
  if (!row || row.author !== me.id) return no("Only the asker can mark it answered.");
  if (row.status !== "taken" || !row.taker) return no("A senior has to take it on first.");
  const note = thanks.trim().slice(0, 300) || null;
  database().prepare("update asks set status = 'answered', thanks = ?, answered_at = ? where id = ?").run(note, Date.now(), id);
  notify(row.taker, { actor: me.id, kind: "ask-answered", text: `${me.name} marked “${row.title}” answered${note ? ", with thanks" : ""}. It's on your Record.`, link: `/ask/${id}` });
  return { ok: true };
}

export function closeAsk(me: User, id: number): Result {
  database().prepare("update asks set status = 'closed' where id = ? and author = ? and status in ('open', 'taken')").run(id, me.id);
  return { ok: true };
}

/**
 * A senior's Record: how many Asks they've answered, and the lines of thanks. Only the
 * thanks (which the asker wrote to be shown): never the question, which may be private,
 * nor who asked. Paused askers' thanks drop out.
 */
export function recordOf(userId: number): { count: number; thanks: string[] } {
  const rows = database()
    .prepare(
      "select asks.thanks from asks join users on users.id = asks.author where asks.taker = ? and asks.status = 'answered' and users.suspended_at is null order by asks.answered_at desc"
    )
    .all(userId) as { thanks: string | null }[];
  return { count: rows.length, thanks: rows.flatMap((r) => (r.thanks ? [r.thanks] : [])).slice(0, 10) };
}
