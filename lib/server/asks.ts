import { db } from "./db";
import type { User } from "./auth";
import { toUser } from "./auth";
import { blockedEitherWay, blockIds, connectionIds, memberById } from "./people";
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
export async function routeFor(author: User, title: string, topics: string[]): Promise<{ user: User; reason: string }[]> {
  const wanted = new Set([...topics.flatMap(words), ...words(title)]);
  // Only those who said they're happy to mentor: found by the database, not by reading every page.
  // Each mentor and their page in one read, rather than two queries per mentor.
  const [rows, blocked, circle] = await Promise.all([
    db().all(
      `select users.*, profiles.data as profile_data from users join profiles on profiles.user_id = users.id
       where users.id != ? and users.suspended_at is null and users.role != 'student'
       and (profiles.data::jsonb -> 'happyTo' ->> 'mentor') = 'true'
       limit 5000`,
      author.id
    ),
    blockIds(author.id),
    connectionIds(author.id)
  ]);
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

export async function createAsk(me: User, input: { title: string; body: string; topics: string }): Promise<Result & { id?: number }> {
  if (!(await settings()).features.asks) return no(PAUSED);
  const title = input.title.trim().slice(0, ASK_LIMITS.title);
  const body = input.body.trim().slice(0, ASK_LIMITS.body);
  const topics = [...new Set(input.topics.split(",").map((t) => t.trim().slice(0, ASK_LIMITS.topic)).filter(Boolean))].slice(0, ASK_LIMITS.topics);
  if (!title) return no("Say what you'd like to ask, in a line.");
  if (!body) return no("Add a few lines: what you've tried, what you're stuck on.");
  if (!(await withinLimit(`ask:${me.id}`, 5, DAY))) return no("That's five Asks today: the most in a day. Try again tomorrow.");
  const routes = await routeFor(me, title, topics);
  const id = await db().tx(async (t) => {
    const row = await t.one<{ id: number }>(
      "insert into asks (author, title, body, topics, status, created_at) values (?, ?, ?, ?, 'open', ?) returning id",
      me.id,
      title,
      body,
      JSON.stringify(topics),
      Date.now()
    );
    for (const { user, reason } of routes) await t.run("insert into ask_routes (ask_id, user_id, reason) values (?, ?, ?) on conflict do nothing", row!.id, user.id, reason);
    return row!.id;
  });
  for (const { user } of routes) await notify(user.id, { actor: me.id, kind: "ask", text: `${me.name} has a question that fits you: “${title}”`, link: `/ask/${id}` });
  return { ok: true, id };
}

const routedTo = async (askId: number, userId: number) =>
  (await db().one<{ reason: string }>("select reason from ask_routes where ask_id = ? and user_id = ?", askId, userId))?.reason ?? null;

/** A member by id even if paused: an Ask they were part of stays readable to the other side. */
const anyMember = async (id: number): Promise<User | null> => {
  const row = await db().one("select * from users where id = ?", id);
  return row ? toUser(row) : null;
};

async function toAsk(row: AskRow, viewer: User): Promise<Ask | null> {
  const [author, taker, reason] = await Promise.all([anyMember(row.author), row.taker ? anyMember(row.taker) : null, routedTo(row.id, viewer.id)]);
  if (!author) return null;
  return {
    id: row.id,
    author,
    title: row.title,
    body: row.body,
    topics: JSON.parse(row.topics) as string[],
    status: row.status,
    taker,
    thanks: row.thanks,
    createdAt: row.created_at,
    reason
  };
}

const rowById = (id: number) => (Number.isSafeInteger(id) ? db().one<AskRow>("select * from asks where id = ?", id) : Promise.resolve(undefined));

/** Whether the asker and the senior on it have blocked each other: then the thread is closed to both. */
const pairBlocked = async (row: AskRow) => row.taker !== null && (await blockedEitherWay(row.author, row.taker));

/**
 * Whether `viewer` may see an Ask. Its author always; the senior who took it; before
 * anyone has, the seniors it went to, or any senior if it went to nobody (an open Ask).
 */
async function mayView(viewer: User, row: AskRow): Promise<boolean> {
  if (row.author === viewer.id) return true;
  if (row.taker === viewer.id) return !(await pairBlocked(row));
  if (!(await memberById(row.author)) || (await blockedEitherWay(viewer.id, row.author))) return false;
  if (row.status !== "open") return false;
  if ((await routedTo(row.id, viewer.id)) !== null) return true;
  const routes = await db().one<{ n: number }>("select count(*) as n from ask_routes where ask_id = ?", row.id);
  return routes!.n === 0 && isSenior(viewer);
}

export async function askFor(viewer: User, id: number): Promise<Ask | null> {
  const row = await rowById(id);
  return row && (await mayView(viewer, row)) ? toAsk(row, viewer) : null;
}

/**
 * Many Asks as `viewer` may see them, read together: a few queries for the whole list
 * (the same rules as mayView and toAsk, without asking about each one separately).
 */
async function visibleAsks(viewer: User, rows: AskRow[]): Promise<Ask[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const q = ids.map(() => "?").join(",");
  // Authors and takers, paused ones too: an Ask they were part of stays readable to the other side.
  const who = [...new Set(rows.flatMap((r) => [r.author, ...(r.taker ? [r.taker] : [])]))];
  const [blocked, people, mine, counts] = await Promise.all([
    blockIds(viewer.id),
    db().all(`select * from users where id in (${who.map(() => "?").join(",")})`, ...who),
    db().all<{ ask_id: number; reason: string }>(`select ask_id, reason from ask_routes where user_id = ? and ask_id in (${q})`, viewer.id, ...ids),
    db().all<{ ask_id: number; n: number }>(`select ask_id, count(*) as n from ask_routes where ask_id in (${q}) group by ask_id`, ...ids)
  ]);
  const users = new Map(people.map((r) => [Number(r.id), { user: toUser(r), active: r.suspended_at == null }]));
  const reason = new Map(mine.map((r) => [r.ask_id, r.reason]));
  const routes = new Map(counts.map((r) => [r.ask_id, r.n]));
  const asks: Ask[] = [];
  for (const row of rows) {
    // As in mayView: a thread between two who've blocked each other is closed to both.
    let ok: boolean;
    if (row.author === viewer.id) ok = true;
    else if (row.taker === viewer.id) ok = !blocked.has(row.author);
    else
      ok =
        Boolean(users.get(row.author)?.active) &&
        !blocked.has(row.author) &&
        row.status === "open" &&
        (reason.has(row.id) || ((routes.get(row.id) ?? 0) === 0 && isSenior(viewer)));
    const author = users.get(row.author)?.user;
    if (!ok || !author) continue;
    asks.push({
      id: row.id,
      author,
      title: row.title,
      body: row.body,
      topics: JSON.parse(row.topics) as string[],
      status: row.status,
      taker: row.taker ? (users.get(row.taker)?.user ?? null) : null,
      thanks: row.thanks,
      createdAt: row.created_at,
      reason: reason.get(row.id) ?? null
    });
  }
  return asks;
}

export async function asksFor(viewer: User): Promise<{ mine: Ask[]; forMe: Ask[]; taken: Ask[]; open: Ask[] }> {
  const [mine, forMe, taken, open] = await Promise.all([
    db().all<AskRow>("select * from asks where author = ? order by created_at desc limit 100", viewer.id),
    db().all<AskRow>(
      "select asks.* from asks join ask_routes on ask_routes.ask_id = asks.id where ask_routes.user_id = ? and asks.status = 'open' order by asks.created_at desc limit 100",
      viewer.id
    ),
    db().all<AskRow>("select * from asks where taker = ? order by created_at desc limit 100", viewer.id),
    isSenior(viewer)
      ? db().all<AskRow>(
          "select * from asks where status = 'open' and author != ? and not exists (select 1 from ask_routes where ask_routes.ask_id = asks.id) order by created_at desc limit 30",
          viewer.id
        )
      : Promise.resolve([])
  ]);
  const all = await visibleAsks(viewer, [...mine, ...forMe, ...taken, ...open]);
  const byId = new Map(all.map((a) => [a.id, a]));
  const pick = (rows: AskRow[]) => rows.flatMap((r) => byId.get(r.id) ?? []);
  return { mine: pick(mine), forMe: pick(forMe), taken: pick(taken), open: pick(open) };
}

export async function takeAsk(me: User, id: number): Promise<Result> {
  const row = await rowById(id);
  if (!row || !(await mayView(me, row))) return no("That Ask isn't here.");
  if (!isSenior(me)) return no("Asks are taken on by alumni and faculty.");
  if (row.author === me.id) return no("You can't take your own Ask.");
  const changes = await db().run("update asks set status = 'taken', taker = ?, taken_at = ? where id = ? and status = 'open'", me.id, Date.now(), id);
  if (!changes) return no("Someone has just taken this one on.");
  await notify(row.author, { actor: me.id, kind: "ask-taken", text: `${me.name} took on your question “${row.title}”.`, link: `/ask/${id}` });
  return { ok: true };
}

/** The thread: between the asker and the senior who took it on. */
export async function askThread(viewer: User, id: number): Promise<AskMessage[]> {
  const row = await rowById(id);
  if (!row || (row.author !== viewer.id && row.taker !== viewer.id) || (await pairBlocked(row))) return [];
  const [rows, author, taker] = await Promise.all([
    db().all<{ id: number; author: number; body: string; created_at: number }>("select * from ask_messages where ask_id = ? order by created_at, id", id),
    anyMember(row.author),
    row.taker ? anyMember(row.taker) : null
  ]);
  const people = new Map([author, taker].filter((u): u is User => u !== null).map((u) => [u.id, u]));
  return rows.flatMap((m) => {
    const by = people.get(m.author);
    return by ? [{ id: m.id, author: by, body: m.body, createdAt: m.created_at, mine: by.id === viewer.id }] : [];
  });
}

export async function replyToAsk(me: User, id: number, body: string): Promise<Result> {
  const row = await rowById(id);
  if (!row || (row.author !== me.id && row.taker !== me.id)) return no("Only the asker and the senior who took it on can write here.");
  if (row.status !== "taken" && row.status !== "answered") return no("This Ask isn't open for replies.");
  if (await pairBlocked(row)) return no("This conversation is closed.");
  const text = body.trim().slice(0, ASK_LIMITS.reply);
  if (!text) return no("Write something first.");
  if (!(await withinLimit(`ask-reply:${me.id}`, 120, 60 * 60_000))) return no("That's a lot of replies in an hour. Take a breather and try again.");
  await db().run("insert into ask_messages (ask_id, author, body, created_at) values (?, ?, ?, ?)", id, me.id, text, Date.now());
  const other = me.id === row.author ? row.taker : row.author;
  if (other) await notify(other, { actor: me.id, kind: "ask-reply", text: `${me.name} replied on “${row.title}”.`, link: `/ask/${id}` });
  return { ok: true };
}

/** The asker marks it answered, with a line of thanks that goes on the senior's Record. */
export async function markAnswered(me: User, id: number, thanks: string): Promise<Result> {
  const row = await rowById(id);
  if (!row || row.author !== me.id) return no("Only the asker can mark it answered.");
  if (row.status !== "taken" || !row.taker) return no("A senior has to take it on first.");
  const note = thanks.trim().slice(0, 300) || null;
  await db().run("update asks set status = 'answered', thanks = ?, answered_at = ? where id = ?", note, Date.now(), id);
  await notify(row.taker, {
    actor: me.id,
    kind: "ask-answered",
    text: `${me.name} marked “${row.title}” answered${note ? ", with thanks" : ""}. It's on your Record.`,
    link: `/ask/${id}`
  });
  return { ok: true };
}

export async function closeAsk(me: User, id: number): Promise<Result> {
  await db().run("update asks set status = 'closed' where id = ? and author = ? and status in ('open', 'taken')", id, me.id);
  return { ok: true };
}

/**
 * A senior's Record: how many Asks they've answered, and the lines of thanks. Only the
 * thanks (which the asker wrote to be shown): never the question, which may be private,
 * nor who asked. Paused askers' thanks drop out.
 */
export async function recordOf(userId: number): Promise<{ count: number; thanks: string[] }> {
  const rows = await db().all<{ thanks: string | null }>(
    "select asks.thanks from asks join users on users.id = asks.author where asks.taker = ? and asks.status = 'answered' and users.suspended_at is null order by asks.answered_at desc",
    userId
  );
  return { count: rows.length, thanks: rows.flatMap((r) => (r.thanks ? [r.thanks] : [])).slice(0, 10) };
}

/** How many Asks someone has asked (for Home's getting-started steps). */
export async function askCount(userId: number): Promise<number> {
  return (await db().one<{ n: number }>("select count(*) as n from asks where author = ?", userId))?.n ?? 0;
}
