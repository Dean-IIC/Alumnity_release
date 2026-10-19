import { MESSAGE_EDIT_WINDOW } from "../chat-format";
import { firstName } from "../format";
import { queuePush } from "./alerts";
import { db, type Row } from "./db";
import type { User } from "./auth";
import { toUser } from "./auth";
import { blockedEitherWay, blockIds, memberById, membersByIds, relation } from "./people";
import { PAUSED, settings } from "./settings";
import { withinLimit } from "./throttle";

/*
 * Connections, blocks, notifications and messages. Every rule that protects a member from
 * another lives here: connection requests are capped per day and carry a note; a block
 * ends any connection and hides each from the other; messages go only between connections.
 */

export type Result = { ok: true } | { ok: false; error: string };
const no = (error: string): Result => ({ ok: false, error });
const DAY = 24 * 60 * 60_000;
const count = async (sql: string, ...params: unknown[]) => (await db().one<{ n: number }>(sql, ...params))?.n ?? 0;

// ---------- Notifications ----------

export type Notification = { id: number; kind: string; text: string; link: string; read: boolean; createdAt: number; actor: number | null };

export async function notify(userId: number, n: { actor?: number; kind: string; text: string; link: string }) {
  if (n.actor && (await blockedEitherWay(userId, n.actor))) return;
  await db().run("insert into notifications (user_id, actor, kind, text, link, created_at) values (?, ?, ?, ?, ?, ?)", userId, n.actor ?? null, n.kind, n.text, n.link, Date.now());
  // And on their phone, if they turned that on.
  await queuePush(userId, { text: n.text, link: n.link });
}

/**
 * Leaves out anyone blocked either way, even what came before the block. The block list
 * (usually empty) is read once, not checked again for every notification.
 */
async function notBlocked(userId: number): Promise<{ sql: string; args: number[] }> {
  const ids = [...(await blockIds(userId))];
  return ids.length ? { sql: `and (actor is null or actor not in (${ids.map(() => "?").join(",")}))`, args: ids } : { sql: "", args: [] };
}

export async function notificationsFor(userId: number, limit = 50): Promise<Notification[]> {
  const nb = await notBlocked(userId);
  return (await db().all(`select * from notifications where user_id = ? ${nb.sql} order by created_at desc limit ?`, userId, ...nb.args, limit)).map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    text: String(r.text),
    link: String(r.link),
    read: r.read_at != null,
    createdAt: Number(r.created_at),
    actor: r.actor == null ? null : Number(r.actor)
  }));
}

export async function unreadNotifications(userId: number): Promise<number> {
  const nb = await notBlocked(userId);
  return count(`select count(*) as n from notifications where user_id = ? and read_at is null ${nb.sql}`, userId, ...nb.args);
}

export const markNotificationsRead = (userId: number) => db().run("update notifications set read_at = ? where user_id = ? and read_at is null", Date.now(), userId);

// ---------- Connections ----------

export const NOTE_LIMIT = 300;
/** Requests a member may send in a day, by default: plenty for real people, too few for spam (a setting). */
export const DAILY_REQUESTS = 25;

export async function requestConnection(from: User, toId: number, note: string): Promise<Result> {
  const to = await memberById(toId);
  if (!to || to.id === from.id) return no("We couldn’t find that member.");
  // An account kept by the college (the alumni association's archive): nobody's there to accept.
  if (await db().one("select 1 from users where id = ? and college_account = 1", to.id)) return no("This is the college’s own account. You can’t connect with it.");
  const rel = await relation(from.id, to.id);
  if (rel === "blocked" || rel === "blocked-by") return no("You can’t connect with this member.");
  if (rel === "connected") return no("You’re already connected.");
  if (rel === "sent") return no("You’ve already sent them a connection request.");
  if (rel === "received") return acceptConnection(from, to.id);
  const daily = (await settings()).dailyRequests;
  if (!(await withinLimit(`connect:${from.id}`, daily, DAY))) return no(`You’ve sent ${daily} connection requests today. That’s the most for one day. Try again tomorrow.`);
  await db().tx(async (t) => {
    await t.run("delete from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)", from.id, to.id, to.id, from.id);
    await t.run("insert into connections (requester, addressee, status, note, created_at) values (?, ?, 'pending', ?, ?)", from.id, to.id, note.trim().slice(0, NOTE_LIMIT), Date.now());
  });
  // Withdrawing and asking again doesn't ping them again within a week.
  const recently = await db().one(
    "select 1 from notifications where user_id = ? and actor = ? and kind = 'connect-request' and created_at > ?",
    to.id,
    from.id,
    Date.now() - 7 * DAY
  );
  if (!recently) await notify(to.id, { actor: from.id, kind: "connect-request", text: `${from.name} sent you a connection request.`, link: "/connections" });
  return { ok: true };
}

export async function acceptConnection(me: User, fromId: number): Promise<Result> {
  const changes = await db().run(
    "update connections set status = 'accepted', responded_at = ? where requester = ? and addressee = ? and status = 'pending'",
    Date.now(),
    fromId,
    me.id
  );
  if (!changes) return no("This connection request was already answered or taken back.");
  await notify(fromId, { actor: me.id, kind: "connect-accepted", text: `${me.name} accepted your connection request. You’re now connected.`, link: `/people/${me.id}` });
  return { ok: true };
}

export async function declineConnection(me: User, fromId: number): Promise<Result> {
  await db().run("update connections set status = 'declined', responded_at = ? where requester = ? and addressee = ? and status = 'pending'", Date.now(), fromId, me.id);
  return { ok: true }; // they aren't told
}

export async function withdrawRequest(me: User, toId: number): Promise<Result> {
  await db().run("delete from connections where requester = ? and addressee = ? and status in ('pending', 'declined')", me.id, toId);
  return { ok: true };
}

export async function removeConnection(me: User, otherId: number): Promise<Result> {
  await db().run("delete from connections where ((requester = ? and addressee = ?) or (requester = ? and addressee = ?)) and status = 'accepted'", me.id, otherId, otherId, me.id);
  return { ok: true };
}

export async function block(me: User, otherId: number): Promise<Result> {
  if (me.id === otherId) return no("You can’t block yourself.");
  if (!(await db().one("select 1 from users where id = ?", otherId))) return no("We couldn’t find that member.");
  await db().tx(async (t) => {
    await t.run("insert into blocks (blocker, blocked, created_at) values (?, ?, ?) on conflict do nothing", me.id, otherId, Date.now());
    await t.run("delete from connections where (requester = ? and addressee = ?) or (requester = ? and addressee = ?)", me.id, otherId, otherId, me.id);
    // Nor does either follow the other any more.
    await t.run("delete from follows where (follower = ? and followee = ?) or (follower = ? and followee = ?)", me.id, otherId, otherId, me.id);
  });
  return { ok: true };
}

export async function unblock(me: User, otherId: number): Promise<Result> {
  await db().run("delete from blocks where blocker = ? and blocked = ?", me.id, otherId);
  return { ok: true };
}

export type Pending = { member: User; note: string; createdAt: number };

export async function requestsFor(me: User): Promise<{ received: Pending[]; sent: Pending[] }> {
  const load = async (sql: string) => {
    const rows = await db().all<{ other: number; note: string; created_at: number }>(sql, me.id);
    const members = await membersByIds(rows.map((r) => r.other));
    return rows.flatMap((r) => {
      const member = members.get(r.other);
      return member ? [{ member, note: r.note, createdAt: r.created_at }] : [];
    });
  };
  const [received, sent] = await Promise.all([
    load("select requester as other, note, created_at from connections where addressee = ? and status = 'pending' order by created_at desc"),
    // A declined request stays in the sender's list, as relation() keeps showing it "sent":
    // dropping it here told them they'd been declined, which they mustn't be.
    load("select addressee as other, note, created_at from connections where requester = ? and status in ('pending', 'declined') order by created_at desc")
  ]);
  return { received, sent };
}

export async function connectionsOf(userId: number): Promise<User[]> {
  return (
    await db().all(
      `select users.* from (
         select addressee as other, responded_at from connections where requester = ? and status = 'accepted'
         union all
         select requester as other, responded_at from connections where addressee = ? and status = 'accepted'
       ) as c join users on users.id = c.other and users.suspended_at is null
       order by c.responded_at desc limit 1000`,
      userId,
      userId
    )
  ).map(toUser);
}

/** Requests waiting for `userId`: a count for the nav (from active members only). */
export const waitingRequests = (userId: number) =>
  count(
    "select count(*) as n from connections join users on users.id = connections.requester where connections.addressee = ? and connections.status = 'pending' and users.suspended_at is null",
    userId
  );

/**
 * How many connections `userId` has: the same people connectionsOf lists. It used to count
 * paused members too, so Home and a member's page said "5 connections" over a list of 4.
 */
export const connectionCount = (userId: number) =>
  count(
    `select count(*) as n from (
       select addressee as other from connections where requester = ? and status = 'accepted'
       union
       select requester from connections where addressee = ? and status = 'accepted'
     ) as c join users on users.id = c.other and users.suspended_at is null`,
    userId,
    userId
  );

export async function blockedBy(userId: number): Promise<User[]> {
  return (await db().all("select users.* from blocks join users on users.id = blocks.blocked where blocks.blocker = ? and users.suspended_at is null", userId)).map(toUser);
}

// ---------- Messages ----------

export const MESSAGE_LIMIT = 2000;

/**
 * A message that answered a story (a reply, or a quick reaction): which story, and its
 * photo or video while the reader may still see it (null once it has gone, or for the
 * one who replied once the day is up; the story's author can always see their own).
 */
export type StoryRef = { id: number | null; mediaId: string | null; kind: "image" | "video" | null; reaction: string | null };

export type Message = {
  id: number;
  mine: boolean;
  /** Empty once it's deleted for everyone. */
  body: string;
  createdAt: number;
  readAt: number | null;
  story: StoryRef | null;
  /** When its sender last edited it, or null. */
  editedAt: number | null;
  /** When its sender deleted it for everyone (its words are gone), or null. */
  deletedAt: number | null;
};

export async function sendMessage(from: User, toId: number, body: string, story?: { id: number; reaction: string | null }): Promise<Result> {
  if (!(await settings()).features.messages) return no(PAUSED);
  const text = body.trim().slice(0, MESSAGE_LIMIT);
  if (!text) return no("Type a message first.");
  if (!(await memberById(toId))) return no("We couldn't find that member.");
  if ((await relation(from.id, toId)) !== "connected") return no("You can only message your connections. Connect with them first, or use Ask a senior.");
  if (!(await withinLimit(`message:${from.id}`, 120, 60 * 60_000))) return no("You’ve sent too many messages in the last hour. Wait a while, then try again.");
  // One notification per conversation until it's read, not one per message: none while
  // earlier messages wait unread, nor while the last "new message" notification does (a
  // thread read some other way used to leave that one behind, and each new burst added another).
  const [unread, told] = await Promise.all([
    db().one("select 1 from messages where sender = ? and recipient = ? and read_at is null", from.id, toId),
    db().one("select 1 from notifications where user_id = ? and actor = ? and kind = 'message' and read_at is null", toId, from.id)
  ]);
  await db().run(
    "insert into messages (sender, recipient, body, created_at, story_id, reaction) values (?, ?, ?, ?, ?, ?)",
    from.id,
    toId,
    text,
    Date.now(),
    story?.id ?? null,
    story?.reaction ?? null
  );
  if (!unread && !told) {
    const first = firstName(from.name);
    const said = !story ? `New message from ${first}.` : story.reaction ? `${first} reacted ${story.reaction} to your story.` : `${first} replied to your story.`;
    await notify(toId, { actor: from.id, kind: "message", text: said, link: `/messages/${from.id}` });
  }
  return { ok: true };
}

/**
 * Reading a conversation: their messages to you, and the "new message" notifications they
 * brought. Those notifications used to stay unread after the thread was read, so the bell
 * (and the tab's title, which adds the two) kept counting a message already seen.
 */
export async function markThreadRead(me: User, otherId: number): Promise<void> {
  const now = Date.now();
  await db().run("update messages set read_at = ? where sender = ? and recipient = ? and read_at is null", now, otherId, me.id);
  await db().run("update notifications set read_at = ? where user_id = ? and actor = ? and kind = 'message' and read_at is null", now, me.id, otherId);
}

/** A message row's story, as `viewerId` may see it (see StoryRef). */
function storyRefOf(r: Row, viewerId: number, now: number): StoryRef | null {
  if (r.story_id == null && r.reaction == null) return null;
  const live = r.story_removed == null && r.story_media != null && (Number(r.story_author) === viewerId || Number(r.story_expires) > now);
  const kind = r.story_kind === "image" || r.story_kind === "video" ? r.story_kind : null;
  return {
    id: r.story_id == null ? null : Number(r.story_id),
    mediaId: live && kind ? String(r.story_media) : null,
    kind: live ? kind : null,
    reaction: r.reaction == null ? null : String(r.reaction)
  };
}

/**
 * The messages of a conversation one member still has: not deleted for them alone
 * (message_hidden), nor from before they deleted the whole chat (chat_cleared). `m` names
 * the messages row and `other` the other member (a column, or "?"); the member's id goes
 * in twice, then the other's if it's a "?".
 */
const STILL_THERE = (m: string, other: string) =>
  `not exists (select 1 from message_hidden where message_hidden.user_id = ? and message_hidden.message_id = ${m}.id)
   and ${m}.id > coalesce((select before_id from chat_cleared where chat_cleared.user_id = ? and chat_cleared.other_id = ${other}), 0)`;

/** One conversation, oldest first (the newest `limit`), as `me` still has it. Opening it reads it. */
export async function thread(me: User, otherId: number, limit = 200): Promise<Message[]> {
  await markThreadRead(me, otherId);
  const now = Date.now();
  const rows = await db().all(
    `select recent.*, stories.author as story_author, stories.media_id as story_media, stories.expires_at as story_expires,
            stories.removed_at as story_removed, media.kind as story_kind
     from (select * from messages where ((sender = ? and recipient = ?) or (sender = ? and recipient = ?)) and ${STILL_THERE("messages", "?")}
           order by created_at desc, id desc limit ?) as recent
     left join stories on stories.id = recent.story_id
     left join media on media.id = stories.media_id
     order by recent.created_at, recent.id`,
    me.id,
    otherId,
    otherId,
    me.id,
    me.id,
    me.id,
    otherId,
    limit
  );
  return rows.map((r) => ({
    id: Number(r.id),
    mine: Number(r.sender) === me.id,
    // Cleared when it was deleted for everyone; never shown even if older data kept words.
    body: r.deleted_at == null ? String(r.body) : "",
    createdAt: Number(r.created_at),
    readAt: r.read_at == null ? null : Number(r.read_at),
    story: r.deleted_at == null ? storyRefOf(r, me.id, now) : null,
    editedAt: r.edited_at == null ? null : Number(r.edited_at),
    deletedAt: r.deleted_at == null ? null : Number(r.deleted_at)
  }));
}

// ---------- Editing and deleting messages ----------

/** A message `me` sent, or undefined (not theirs, or not there). */
const sentBy = (me: User, id: number) =>
  Number.isSafeInteger(id) && id > 0
    ? db().one<{ created_at: number; deleted_at: number | null; reaction: string | null }>("select created_at, deleted_at, reaction from messages where id = ? and sender = ?", id, me.id)
    : Promise.resolve(undefined);

/**
 * The sender rewrites a message, within MESSAGE_EDIT_WINDOW of sending it (as WhatsApp
 * allows). Both then see "edited"; the other's open conversation redraws through the pulse.
 */
export async function editMessage(me: User, id: number, body: string): Promise<Result> {
  if (!(await settings()).features.messages) return no(PAUSED);
  const m = await sentBy(me, id);
  if (!m || m.deleted_at != null) return no("We couldn't find that message.");
  if (m.reaction != null) return no("You can't edit a reaction.");
  const since = Date.now() - MESSAGE_EDIT_WINDOW;
  if (m.created_at <= since) return no("You can only edit a message for 15 minutes after you send it.");
  const text = body.trim().slice(0, MESSAGE_LIMIT);
  if (!text) return no("Type a message, or delete it instead.");
  // Unchanged words leave it as it was (no "edited" for nothing).
  await db().run("update messages set body = ?, edited_at = ? where id = ? and sender = ? and deleted_at is null and created_at > ? and body <> ?", text, Date.now(), id, me.id, since, text);
  return { ok: true };
}

/**
 * The sender deletes a message for everyone: its words (and any story it answered) are
 * cleared from the database, not just hidden, and both see "This message was deleted".
 */
export async function deleteMessageForEveryone(me: User, id: number): Promise<Result> {
  if (!(await sentBy(me, id))) return no("Only the sender can delete a message for everyone.");
  await db().run(
    "update messages set body = '', reaction = null, story_id = null, edited_at = null, deleted_at = ? where id = ? and sender = ? and deleted_at is null",
    Date.now(),
    id,
    me.id
  );
  return { ok: true };
}

/** Either of the two deletes a message for themselves only: the other still has it. */
export async function deleteMessageForMe(me: User, id: number): Promise<Result> {
  const m = Number.isSafeInteger(id) && id > 0 ? await db().one<{ recipient: number }>("select recipient from messages where id = ? and (sender = ? or recipient = ?)", id, me.id, me.id) : undefined;
  if (!m) return no("We couldn't find that message.");
  const now = Date.now();
  await db().run("insert into message_hidden (user_id, message_id, hidden_at) values (?, ?, ?) on conflict do nothing", me.id, id, now);
  // Gone for them, so never left counting as unread.
  if (m.recipient === me.id) await db().run("update messages set read_at = ? where id = ? and read_at is null", now, id);
  return { ok: true };
}

/**
 * Deletes a whole conversation for `me` only: everything in it so far is gone for them (the
 * other still has it all). If either writes again, it comes back with only the new messages.
 */
export async function deleteChat(me: User, otherId: number): Promise<Result> {
  if (!Number.isSafeInteger(otherId) || otherId <= 0 || otherId === me.id) return no("We couldn't find that conversation.");
  const last = await db().one<{ id: number | null }>(
    "select max(id) as id from messages where (sender = ? and recipient = ?) or (sender = ? and recipient = ?)",
    me.id,
    otherId,
    otherId,
    me.id
  );
  if (!last?.id) return { ok: true };
  await db().run(
    `insert into chat_cleared (user_id, other_id, before_id, cleared_at) values (?, ?, ?, ?)
     on conflict (user_id, other_id) do update set before_id = greatest(chat_cleared.before_id, excluded.before_id), cleared_at = excluded.cleared_at`,
    me.id,
    otherId,
    last.id,
    Date.now()
  );
  await markThreadRead(me, otherId);
  return { ok: true };
}

export type Conversation = {
  with: User;
  last: string;
  lastAt: number;
  mine: boolean;
  unread: number;
  /** The last message answered a story: "reply", or "reaction" (then `last` is the emoji). */
  story: "reply" | "reaction" | null;
  /** The last message was deleted for everyone (`last` is then empty). */
  deleted: boolean;
};

/**
 * Messages that count as unread: not from anyone blocked either way, nor from a suspended
 * member. Neither has a conversation that can be opened, so their messages could never be
 * read, and the Messages badge never cleared.
 */
const UNREAD_FROM_REACHABLE = `messages.recipient = ? and messages.read_at is null
  and exists (select 1 from users where users.id = messages.sender and users.suspended_at is null)
  and not exists (select 1 from blocks where (blocks.blocker = messages.recipient and blocks.blocked = messages.sender)
                                          or (blocks.blocker = messages.sender and blocks.blocked = messages.recipient))`;

export async function conversations(me: User): Promise<Conversation[]> {
  const [rows, unreadRows, blocked] = await Promise.all([
    db().all<{ other: number; body: string; created_at: number; sender: number; story_id: number | null; reaction: string | null; deleted_at: number | null }>(
      `select * from (
         select recipient as other, body, created_at, sender, id, story_id, reaction, deleted_at from messages where sender = ?
         union all
         select sender as other, body, created_at, sender, id, story_id, reaction, deleted_at from messages where recipient = ?
       ) as m where ${STILL_THERE("m", "m.other")} order by created_at desc, id desc limit 2000`,
      me.id,
      me.id,
      me.id,
      me.id
    ),
    db().all<{ sender: number; n: number }>(`select sender, count(*) as n from messages where ${UNREAD_FROM_REACHABLE} group by sender`, me.id),
    blockIds(me.id)
  ]);
  const unread = new Map(unreadRows.map((r) => [r.sender, r.n]));
  const latest = new Map<number, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.other) && !blocked.has(r.other)) latest.set(r.other, r);
  const members = await membersByIds([...latest.keys()].slice(0, 150));
  const list: Conversation[] = [];
  for (const [other, r] of latest) {
    const member = members.get(other);
    if (!member) continue;
    const story = r.reaction != null ? "reaction" : r.story_id != null ? "reply" : null;
    const deleted = r.deleted_at != null;
    list.push({ with: member, last: deleted ? "" : r.body, lastAt: r.created_at, mine: r.sender === me.id, unread: unread.get(other) ?? 0, story: deleted ? null : story, deleted });
    if (list.length >= 100) break;
  }
  return list;
}

export const unreadMessages = (userId: number) => count(`select count(*) as n from messages where ${UNREAD_FROM_REACHABLE}`, userId);

/**
 * What an open page watches (components/app/pulse.tsx, through /api/pulse): unread
 * notifications, unread messages and requests waiting, for the bar; and in an open
 * conversation its newest message (`t`), the newest of yours they've read (`s`) and the
 * last time one was edited or deleted for everyone (`e`), so a new message, "Seen", an edit
 * and a deletion all show without a reload. Counted over the messages the viewer still has.
 */
export async function pulseFor(userId: number, threadWith?: number): Promise<{ n: number; m: number; r: number; t: number; s: number; e: number }> {
  const other = threadWith !== undefined && Number.isSafeInteger(threadWith) && threadWith > 0 ? threadWith : null;
  const [n, m, r, latest] = await Promise.all([
    unreadNotifications(userId),
    unreadMessages(userId),
    waitingRequests(userId),
    other
      ? db().one<{ t: number | null; s: number | null; e: number | null }>(
          `select max(id) as t, max(case when sender = ? and read_at is not null then id end) as s,
                  max(greatest(coalesce(edited_at, 0), coalesce(deleted_at, 0))) as e
           from messages where ((sender = ? and recipient = ?) or (sender = ? and recipient = ?)) and ${STILL_THERE("messages", "?")}`,
          userId,
          userId,
          other,
          other,
          userId,
          userId,
          userId,
          other
        )
      : Promise.resolve(undefined)
  ]);
  return { n, m, r, t: latest?.t ?? 0, s: latest?.s ?? 0, e: latest?.e ?? 0 };
}
