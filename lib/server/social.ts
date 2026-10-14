import { database } from "./db";
import type { User } from "./auth";
import { blockedEitherWay, memberById, relation } from "./people";
import { withinLimit } from "./throttle";

/*
 * Connections, blocks, notifications and messages. Every rule that protects a member from
 * another lives here: connection requests are capped per day and carry a note; a block
 * ends any connection and hides each from the other; messages go only between connections.
 */

export type Result = { ok: true } | { ok: false; error: string };
const no = (error: string): Result => ({ ok: false, error });
const DAY = 24 * 60 * 60_000;
const firstName = (u: Pick<User, "name">) => u.name.split(" ")[0];

// ---------- Notifications ----------

export type Notification = { id: number; kind: string; text: string; link: string; read: boolean; createdAt: number; actor: number | null };

export function notify(userId: number, n: { actor?: number; kind: string; text: string; link: string }) {
  if (n.actor && blockedEitherWay(userId, n.actor)) return;
  database()
    .prepare("insert into notifications (user_id, actor, kind, text, link, created_at) values (?, ?, ?, ?, ?, ?)")
    .run(userId, n.actor ?? null, n.kind, n.text, n.link, Date.now());
}

export function notificationsFor(userId: number, limit = 50): Notification[] {
  return (
    database().prepare("select * from notifications where user_id = ? order by created_at desc limit ?").all(userId, limit) as Record<string, unknown>[]
  ).map((r) => ({ id: Number(r.id), kind: String(r.kind), text: String(r.text), link: String(r.link), read: r.read_at != null, createdAt: Number(r.created_at), actor: r.actor == null ? null : Number(r.actor) }));
}

export const unreadNotifications = (userId: number) =>
  (database().prepare("select count(*) as n from notifications where user_id = ? and read_at is null").get(userId) as { n: number }).n;

export const markNotificationsRead = (userId: number) =>
  database().prepare("update notifications set read_at = ? where user_id = ? and read_at is null").run(Date.now(), userId);

// ---------- Connections ----------

export const NOTE_LIMIT = 300;
/** Requests a member may send in a day: plenty for real people, too few for spam. */
export const DAILY_REQUESTS = 25;

export function requestConnection(from: User, toId: number, note: string): Result {
  const to = memberById(toId);
  if (!to || to.id === from.id) return no("That member isn’t here.");
  const rel = relation(from.id, to.id);
  if (rel === "blocked" || rel === "blocked-by") return no("You can’t connect with this member.");
  if (rel === "connected") return no("You’re already connected.");
  if (rel === "sent") return no("Your request is already waiting for them.");
  if (rel === "received") return acceptConnection(from, to.id);
  if (!withinLimit(`connect:${from.id}`, DAILY_REQUESTS, DAY)) return no(`That’s ${DAILY_REQUESTS} requests today: the most in a day. Try again tomorrow.`);
  const db = database();
  db.prepare("delete from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)").run(from.id, to.id, to.id, from.id);
  db.prepare("insert into connections (requester, addressee, status, note, created_at) values (?, ?, 'pending', ?, ?)").run(
    from.id,
    to.id,
    note.trim().slice(0, NOTE_LIMIT),
    Date.now()
  );
  notify(to.id, { actor: from.id, kind: "connect-request", text: `${from.name} would like to connect.`, link: "/connections" });
  return { ok: true };
}

export function acceptConnection(me: User, fromId: number): Result {
  const db = database();
  const result = db
    .prepare("update connections set status = 'accepted', responded_at = ? where requester = ? and addressee = ? and status = 'pending'")
    .run(Date.now(), fromId, me.id);
  if (!result.changes) return no("That request isn’t waiting any more.");
  notify(fromId, { actor: me.id, kind: "connect-accepted", text: `${me.name} accepted your request. You’re connected.`, link: `/people/${me.id}` });
  return { ok: true };
}

export function declineConnection(me: User, fromId: number): Result {
  database().prepare("update connections set status = 'declined', responded_at = ? where requester = ? and addressee = ? and status = 'pending'").run(Date.now(), fromId, me.id);
  return { ok: true }; // they aren't told
}

export function withdrawRequest(me: User, toId: number): Result {
  database().prepare("delete from connections where requester = ? and addressee = ? and status = 'pending'").run(me.id, toId);
  return { ok: true };
}

export function removeConnection(me: User, otherId: number): Result {
  database().prepare("delete from connections where ((requester = ? and addressee = ?) or (requester = ? and addressee = ?)) and status = 'accepted'").run(me.id, otherId, otherId, me.id);
  return { ok: true };
}

export function block(me: User, otherId: number): Result {
  if (me.id === otherId) return no("You can’t block yourself.");
  const db = database();
  db.prepare("insert or ignore into blocks (blocker, blocked, created_at) values (?, ?, ?)").run(me.id, otherId, Date.now());
  db.prepare("delete from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)").run(me.id, otherId, otherId, me.id);
  return { ok: true };
}

export function unblock(me: User, otherId: number): Result {
  database().prepare("delete from blocks where blocker = ? and blocked = ?").run(me.id, otherId);
  return { ok: true };
}

export type Pending = { member: User; note: string; createdAt: number };

export function requestsFor(me: User): { received: Pending[]; sent: Pending[] } {
  const db = database();
  const load = (sql: string) =>
    (db.prepare(sql).all(me.id) as { other: number; note: string; created_at: number }[])
      .map((r) => ({ member: memberById(r.other), note: r.note, createdAt: r.created_at }))
      .filter((p): p is Pending => p.member !== null);
  return {
    received: load("select requester as other, note, created_at from connections where addressee = ? and status = 'pending' order by created_at desc"),
    sent: load("select addressee as other, note, created_at from connections where requester = ? and status = 'pending' order by created_at desc")
  };
}

export function connectionsOf(userId: number): User[] {
  return (
    database()
      .prepare(
        "select case when requester = ? then addressee else requester end as other from connections where (requester = ? or addressee = ?) and status = 'accepted' order by responded_at desc"
      )
      .all(userId, userId, userId) as { other: number }[]
  )
    .map((r) => memberById(r.other))
    .filter((u): u is User => u !== null);
}

export const connectionCount = (userId: number) =>
  (database().prepare("select count(*) as n from connections where (requester = ? or addressee = ?) and status = 'accepted'").get(userId, userId) as { n: number }).n;

export const blockedBy = (userId: number): User[] =>
  (database().prepare("select blocked from blocks where blocker = ?").all(userId) as { blocked: number }[]).map((r) => memberById(r.blocked)).filter((u): u is User => u !== null);

// ---------- Messages ----------

export const MESSAGE_LIMIT = 2000;

export type Message = { id: number; mine: boolean; body: string; createdAt: number };

export function sendMessage(from: User, toId: number, body: string): Result {
  const text = body.trim().slice(0, MESSAGE_LIMIT);
  if (!text) return no("Write something first.");
  if (relation(from.id, toId) !== "connected") return no("You can message your connections. Connect first, or Ask.");
  if (!withinLimit(`message:${from.id}`, 120, 60 * 60_000)) return no("That’s a lot of messages in an hour. Take a breather and try again.");
  const db = database();
  // One notification per conversation until it's read, not one per message.
  const unread = db.prepare("select 1 from messages where sender = ? and recipient = ? and read_at is null").get(from.id, toId);
  db.prepare("insert into messages (sender, recipient, body, created_at) values (?, ?, ?, ?)").run(from.id, toId, text, Date.now());
  if (!unread) notify(toId, { actor: from.id, kind: "message", text: `New message from ${firstName(from)}.`, link: `/messages/${from.id}` });
  return { ok: true };
}

export function thread(me: User, otherId: number, limit = 200): Message[] {
  const db = database();
  db.prepare("update messages set read_at = ? where sender = ? and recipient = ? and read_at is null").run(Date.now(), otherId, me.id);
  return (
    db
      .prepare("select * from (select * from messages where (sender = ? and recipient = ?) or (sender = ? and recipient = ?) order by created_at desc limit ?) order by created_at")
      .all(me.id, otherId, otherId, me.id, limit) as Record<string, unknown>[]
  ).map((r) => ({ id: Number(r.id), mine: Number(r.sender) === me.id, body: String(r.body), createdAt: Number(r.created_at) }));
}

export type Conversation = { with: User; last: string; lastAt: number; mine: boolean; unread: number };

export function conversations(me: User): Conversation[] {
  const rows = database()
    .prepare(
      `select case when sender = ? then recipient else sender end as other, body, created_at, sender
       from messages where sender = ? or recipient = ? order by created_at desc`
    )
    .all(me.id, me.id, me.id) as { other: number; body: string; created_at: number; sender: number }[];
  const seen = new Map<number, Conversation>();
  for (const r of rows) {
    if (seen.has(r.other)) continue;
    const other = memberById(r.other);
    if (!other || blockedEitherWay(me.id, other.id)) continue;
    const { n } = database().prepare("select count(*) as n from messages where sender = ? and recipient = ? and read_at is null").get(r.other, me.id) as { n: number };
    seen.set(r.other, { with: other, last: r.body, lastAt: r.created_at, mine: r.sender === me.id, unread: n });
  }
  return [...seen.values()];
}

export const unreadMessages = (userId: number) =>
  (database().prepare("select count(*) as n from messages where recipient = ? and read_at is null").get(userId) as { n: number }).n;
