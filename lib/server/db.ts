import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/*
 * Alumnity's own database: one SQLite file (data/alumnity.db, never committed), so the
 * site runs anywhere Node does, the college's laptop server included, with nothing else
 * to set up. ALUMNITY_DB points elsewhere (tests use a fresh file each run).
 *
 * Server only: import from route handlers and server components, never from a component
 * that runs in the browser.
 */

const SCHEMA = `
create table if not exists users (
  id integer primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  usn text unique,
  branch text,
  branch_name text,
  programme text,
  joined integer,
  role text not null check (role in ('student', 'alumnus', 'faculty', 'coordinator', 'admin')),
  created_at integer not null
);

-- A signed-in browser: only a hash of its cookie is kept, so a copy of the database can't sign anyone in.
create table if not exists sessions (
  token_hash text primary key,
  user_id integer not null references users(id) on delete cascade,
  expires_at integer not null,
  created_at integer not null
);
create index if not exists sessions_user on sessions(user_id);

-- Emailed codes, for joining and for resetting a password. Only a hash of each code is kept.
create table if not exists codes (
  ticket text primary key,
  purpose text not null check (purpose in ('join', 'reset')),
  email text not null,
  code_hash text not null,
  payload text not null,
  attempts integer not null default 0,
  expires_at integer not null,
  verified_at integer,
  used_at integer,
  created_at integer not null
);

-- Recent attempts, for rate limits that hold across restarts.
create table if not exists throttle (
  key text not null,
  at integer not null
);
create index if not exists throttle_key on throttle(key, at);
`;

/*
 * The social side: who's connected, who's blocked whom, notifications, messages, Asks,
 * posts, events, and the college desk's reports and audit log.
 */
const SOCIAL = `
-- Members' pages (lib/server/profile.ts): one JSON document each.
create table if not exists profiles (
  user_id integer primary key references users(id) on delete cascade,
  data text not null,
  updated_at integer not null
);

create table if not exists connections (
  id integer primary key,
  requester integer not null references users(id) on delete cascade,
  addressee integer not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  note text not null default '',
  created_at integer not null,
  responded_at integer,
  unique (requester, addressee)
);
create index if not exists connections_addressee on connections(addressee, status);

create table if not exists blocks (
  blocker integer not null references users(id) on delete cascade,
  blocked integer not null references users(id) on delete cascade,
  created_at integer not null,
  primary key (blocker, blocked)
);

create table if not exists notifications (
  id integer primary key,
  user_id integer not null references users(id) on delete cascade,
  actor integer references users(id) on delete cascade,
  kind text not null,
  text text not null,
  link text not null,
  read_at integer,
  created_at integer not null
);
create index if not exists notifications_user on notifications(user_id, created_at);

create table if not exists messages (
  id integer primary key,
  sender integer not null references users(id) on delete cascade,
  recipient integer not null references users(id) on delete cascade,
  body text not null,
  created_at integer not null,
  read_at integer
);
create index if not exists messages_pair on messages(sender, recipient, created_at);
create index if not exists messages_recipient on messages(recipient, read_at);

create table if not exists asks (
  id integer primary key,
  author integer not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  topics text not null default '[]',
  status text not null check (status in ('open', 'taken', 'answered', 'closed')),
  taker integer references users(id) on delete set null,
  thanks text,
  created_at integer not null,
  taken_at integer,
  answered_at integer
);
create table if not exists ask_routes (
  ask_id integer not null references asks(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  reason text not null,
  primary key (ask_id, user_id)
);
create table if not exists ask_messages (
  id integer primary key,
  ask_id integer not null references asks(id) on delete cascade,
  author integer not null references users(id) on delete cascade,
  body text not null,
  created_at integer not null
);

create table if not exists posts (
  id integer primary key,
  author integer not null references users(id) on delete cascade,
  body text not null,
  audience text not null check (audience in ('everyone', 'batch', 'connections')),
  removed_at integer,
  created_at integer not null
);
create table if not exists post_cheers (
  post_id integer not null references posts(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  primary key (post_id, user_id)
);
create table if not exists post_comments (
  id integer primary key,
  post_id integer not null references posts(id) on delete cascade,
  author integer not null references users(id) on delete cascade,
  body text not null,
  removed_at integer,
  created_at integer not null
);

-- Uploads (lib/server/media.ts keeps the files): profile photos, covers, post and story media.
create table if not exists media (
  id text primary key,
  user_id integer not null references users(id) on delete cascade,
  kind text not null,
  mime text not null,
  size integer not null,
  path text not null,
  created_at integer not null
);

-- Photos and videos on a post, in order (the files themselves: lib/server/media.ts).
create table if not exists post_media (
  post_id integer not null references posts(id) on delete cascade,
  media_id text not null,
  position integer not null,
  primary key (post_id, position)
);
create index if not exists post_media_media on post_media(media_id);

-- Stories: a photo or video for a day, for one's connections and followers.
create table if not exists stories (
  id integer primary key,
  author integer not null references users(id) on delete cascade,
  media_id text not null,
  caption text not null default '',
  created_at integer not null,
  expires_at integer not null,
  removed_at integer
);
create index if not exists stories_author on stories(author, expires_at);
create table if not exists story_views (
  story_id integer not null references stories(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  viewed_at integer not null,
  primary key (story_id, user_id)
);

-- Following: one way, no asking (connecting is two way, and asks).
create table if not exists follows (
  follower integer not null references users(id) on delete cascade,
  followee integer not null references users(id) on delete cascade,
  created_at integer not null,
  primary key (follower, followee)
);
create index if not exists follows_followee on follows(followee);

create table if not exists events (
  id integer primary key,
  organiser integer not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  starts_at integer not null,
  ends_at integer,
  place text not null,
  online_link text,
  capacity integer,
  cancelled_at integer,
  created_at integer not null
);
create table if not exists rsvps (
  event_id integer not null references events(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  created_at integer not null,
  primary key (event_id, user_id)
);

create table if not exists reports (
  id integer primary key,
  reporter integer not null references users(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('member', 'post', 'comment', 'message', 'ask')),
  subject_id integer not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  resolved_by integer references users(id) on delete set null,
  created_at integer not null,
  resolved_at integer
);

-- Site settings the super administrators change (lib/server/settings.ts).
create table if not exists settings (
  key text primary key,
  value text not null,
  updated_by integer references users(id) on delete set null,
  updated_at integer not null
);

-- Notices from the college, shown at the top of Home until they end.
create table if not exists announcements (
  id integer primary key,
  author integer references users(id) on delete set null,
  title text not null,
  body text not null,
  ends_at integer,
  removed_at integer,
  created_at integer not null
);

create table if not exists audit (
  id integer primary key,
  actor integer references users(id) on delete set null,
  action text not null,
  subject text not null,
  detail text,
  created_at integer not null
);
`;

/** Indexes for what the pages read most: each list, newest first, without scanning a table. */
const INDEXES = `
create index if not exists users_batch on users(branch, joined);
create index if not exists users_role on users(role);
create index if not exists users_created on users(created_at);
create index if not exists connections_requester on connections(requester, status);
create index if not exists blocks_blocked on blocks(blocked);
create index if not exists messages_sender_time on messages(sender, created_at);
create index if not exists messages_recipient_time on messages(recipient, created_at);
create index if not exists notifications_unread on notifications(user_id, read_at);
create index if not exists posts_time on posts(created_at);
create index if not exists posts_author_time on posts(author, created_at);
create index if not exists comments_post on post_comments(post_id, created_at);
create index if not exists cheers_user on post_cheers(user_id);
create index if not exists asks_author on asks(author, created_at);
create index if not exists asks_taker on asks(taker);
create index if not exists asks_status on asks(status, created_at);
create index if not exists ask_routes_user on ask_routes(user_id);
create index if not exists events_time on events(starts_at);
create index if not exists rsvps_user on rsvps(user_id);
create index if not exists reports_status on reports(status, created_at);
create index if not exists reports_subject on reports(subject_kind, subject_id);
create index if not exists audit_time on audit(created_at);
create index if not exists sessions_time on sessions(created_at);
`;

/** Columns added after a table first shipped: added once, quietly, to databases that predate them. */
function addColumns(db: DatabaseSync) {
  const has = (table: string, column: string) =>
    (db.prepare(`pragma table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
  if (!has("users", "suspended_at")) db.exec("alter table users add column suspended_at integer");
  if (!has("users", "sample")) db.exec("alter table users add column sample integer not null default 0");
  // A reaction's kind (cheer, proud, congrats, insightful, support); older rows were all cheers.
  if (!has("post_cheers", "kind")) db.exec("alter table post_cheers add column kind text not null default 'cheer'");
}

let db: DatabaseSync | undefined;

export function database(): DatabaseSync {
  if (db) return db;
  const path = process.env.ALUMNITY_DB || join(process.cwd(), "data", "alumnity.db");
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 3000;");
  db.exec(SCHEMA);
  db.exec(SOCIAL);
  addColumns(db);
  db.exec(INDEXES);
  return db;
}

/** For tests: forget the open database so the next call opens ALUMNITY_DB afresh. */
export function closeDatabase() {
  db?.close();
  db = undefined;
}
