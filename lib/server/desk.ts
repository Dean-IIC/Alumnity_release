import { database } from "./db";
import { configRole, toUser, type Role, type User } from "./auth";
import { askFor } from "./asks";
import { memberById, pageFor } from "./people";
import { visiblePost } from "./posts";
import { assignable, isAdmin, isModerator, isSuperAdmin, outranks } from "./roles";
import { DEFAULT_SETTINGS, saveSettings, settings, type Settings } from "./settings";
import { notify, type Result } from "./social";
import { withinLimit } from "./throttle";

/*
 * The college desk: reports from members and what the coordinators do about them;
 * moderating what's written; members (pause, sign out, roles, deletion); the team; the
 * site's settings; the audit log and the numbers. Who may do what is decided on one
 * ladder (lib/server/roles.ts), and every action here is written to the audit log.
 */

export { isAdmin, isModerator, isSuperAdmin } from "./roles";

export type SubjectKind = "member" | "post" | "comment" | "message" | "ask";
export const SUBJECT_KINDS: SubjectKind[] = ["member", "post", "comment", "message", "ask"];
const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });
const DESK_ONLY = "Only the college desk can do that.";

export function audit(actor: User | null, action: string, subject: string, detail?: string) {
  database().prepare("insert into audit (actor, action, subject, detail, created_at) values (?, ?, ?, ?, ?)").run(actor?.id ?? null, action, subject, detail ?? null, Date.now());
}

/** A member by id, paused or not (the desk sees everyone). */
function anyMember(id: number): (User & { suspended: boolean; sample: boolean; createdAt: number }) | null {
  const row = database().prepare("select * from users where id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? { ...toUser(row), suspended: row.suspended_at != null, sample: Boolean(row.sample), createdAt: Number(row.created_at) } : null;
}

// ---------- Reports ----------

/** What a report is about, in a line, and who wrote it (null if it's gone). */
function subjectOf(kind: SubjectKind, id: number): { text: string; owner: number; link: string } | null {
  const db = database();
  const one = (sql: string) => db.prepare(sql).get(id) as Record<string, unknown> | undefined;
  if (kind === "member") {
    const u = one("select id, name from users where id = ?");
    return u ? { text: String(u.name), owner: Number(u.id), link: `/people/${u.id}` } : null;
  }
  if (kind === "post") {
    const p = one("select author, body from posts where id = ?");
    return p ? { text: String(p.body), owner: Number(p.author), link: `/home#post-${id}` } : null;
  }
  if (kind === "comment") {
    const c = one("select author, body, post_id from post_comments where id = ?");
    return c ? { text: String(c.body), owner: Number(c.author), link: `/home#post-${c.post_id}` } : null;
  }
  if (kind === "message") {
    const m = one("select sender, body from messages where id = ?");
    return m ? { text: String(m.body), owner: Number(m.sender), link: "" } : null;
  }
  const a = one("select author, title, body from asks where id = ?");
  return a ? { text: `${a.title}: ${a.body}`, owner: Number(a.author), link: `/ask/${id}` } : null;
}

function canReport(me: User, kind: SubjectKind, id: number): boolean {
  const db = database();
  if (kind === "member") return pageFor(me, id) !== null;
  if (kind === "post") return visiblePost(me, id) !== null;
  if (kind === "comment") {
    const c = db.prepare("select post_id from post_comments where id = ? and removed_at is null").get(id) as { post_id: number } | undefined;
    return Boolean(c && visiblePost(me, c.post_id));
  }
  if (kind === "message") return Boolean(db.prepare("select 1 from messages where id = ? and recipient = ?").get(id, me.id));
  return askFor(me, id) !== null;
}

/**
 * A member reports something they've seen. They may only report a message sent to them,
 * and nothing of their own.
 */
export function report(me: User, kind: string, id: number, reason: string): Result {
  if (!SUBJECT_KINDS.includes(kind as SubjectKind)) return no("That can't be reported.");
  // Only what the reporter can actually see (one answer for "not there" and "not yours to see").
  if (!canReport(me, kind as SubjectKind, id)) return no("That isn't here any more.");
  const subject = subjectOf(kind as SubjectKind, id);
  if (!subject) return no("That isn't here any more.");
  if (subject.owner === me.id) return no("That's yours.");
  const why = reason.trim().slice(0, 500);
  if (!why) return no("Say briefly what's wrong, so the coordinators know what to look at.");
  if (!withinLimit(`report:${me.id}`, 20, DAY)) return no("That's a lot of reports today. The coordinators will get to them.");
  database().prepare("insert into reports (reporter, subject_kind, subject_id, reason, created_at) values (?, ?, ?, ?, ?)").run(me.id, kind, id, why, Date.now());
  return { ok: true };
}

export type Report = {
  id: number;
  reporter: User | null;
  kind: SubjectKind;
  subjectId: number;
  subject: { text: string; owner: User | null; link: string } | null;
  reason: string;
  status: "open" | "removed" | "dismissed";
  createdAt: number;
};

export function reports(viewer: User, status: "open" | "closed" = "open"): Report[] {
  if (!isModerator(viewer)) return [];
  const rows = database()
    .prepare(`select * from reports where ${status === "open" ? "status = 'open'" : "status != 'open'"} order by created_at desc limit 100`)
    .all() as { id: number; reporter: number; subject_kind: SubjectKind; subject_id: number; reason: string; status: Report["status"]; created_at: number }[];
  return rows.map((r) => {
    const s = subjectOf(r.subject_kind, r.subject_id);
    return {
      id: r.id,
      reporter: memberById(r.reporter),
      kind: r.subject_kind,
      subjectId: r.subject_id,
      subject: s && { text: s.text.slice(0, 400), owner: anyMember(s.owner), link: s.link },
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at
    };
  });
}

/** Take down what was reported (a member is paused), or dismiss the report. */
export function resolveReport(me: User, id: number, action: "remove" | "dismiss"): Result {
  if (!isModerator(me)) return no(DESK_ONLY);
  const db = database();
  const r = db.prepare("select * from reports where id = ? and status = 'open'").get(id) as { subject_kind: SubjectKind; subject_id: number } | undefined;
  if (!r) return no("That report is already dealt with.");
  if (action === "remove") {
    const sid = r.subject_id;
    const result =
      r.subject_kind === "member"
        ? suspend(me, sid, true)
        : r.subject_kind === "message"
          ? (db.prepare("delete from messages where id = ?").run(sid), { ok: true as const })
          : takeDown(me, r.subject_kind, sid, `report ${id}`);
    if (!result.ok) return result;
    // Every other report about the same thing is settled with it.
    db.prepare("update reports set status = 'removed', resolved_by = ?, resolved_at = ? where subject_kind = ? and subject_id = ? and status = 'open'").run(me.id, Date.now(), r.subject_kind, sid);
    if (r.subject_kind === "message") audit(me, "removed", `message ${sid}`, `report ${id}`);
  } else {
    db.prepare("update reports set status = 'dismissed', resolved_by = ?, resolved_at = ? where id = ?").run(me.id, Date.now(), id);
    audit(me, "dismissed report", `${r.subject_kind} ${r.subject_id}`, `report ${id}`);
  }
  return { ok: true };
}

// ---------- What's written: notes, comments, Asks ----------

export type ContentKind = "post" | "comment" | "ask";
export type ContentItem = { kind: ContentKind; id: number; text: string; author: User | null; createdAt: number; removed: boolean; link: string };

const CONTENT_SQL: Record<ContentKind, { list: string; removedCol: string }> = {
  post: { list: "select id, author, body as text, created_at, removed_at as gone from posts", removedCol: "removed_at" },
  comment: { list: "select id, author, body as text, created_at, removed_at as gone, post_id from post_comments", removedCol: "removed_at" },
  ask: { list: "select id, author, title || ': ' || body as text, created_at, case when status = 'closed' then created_at end as gone from asks", removedCol: "" }
};

/** The newest notes, comments or Asks (removed ones included), optionally containing `q`. */
export function recentContent(me: User, kind: ContentKind, q = ""): ContentItem[] {
  if (!isModerator(me)) return [];
  const like = `%${q.trim().toLowerCase().replace(/[%_]/g, "")}%`;
  const rows = database()
    .prepare(`select * from (${CONTENT_SQL[kind].list}) where lower(text) like ? order by created_at desc limit 50`)
    .all(like) as { id: number; author: number; text: string; created_at: number; gone: number | null; post_id?: number }[];
  return rows.map((r) => ({
    kind,
    id: r.id,
    text: r.text.slice(0, 400),
    author: anyMember(r.author),
    createdAt: r.created_at,
    removed: r.gone != null,
    link: kind === "ask" ? `/ask/${r.id}` : `/home#post-${kind === "comment" ? r.post_id : r.id}`
  }));
}

const KIND_LABEL: Record<ContentKind, string> = { post: "note", comment: "comment", ask: "question" };

/** Take something down. Its author is told (not by whom), so a removal is never a mystery. */
export function takeDown(me: User, kind: ContentKind, id: number, reason = ""): Result {
  if (!isModerator(me)) return no(DESK_ONLY);
  const db = database();
  const now = Date.now();
  const author =
    kind === "post"
      ? (db.prepare("select author from posts where id = ? and removed_at is null").get(id) as { author: number } | undefined)
      : kind === "comment"
        ? (db.prepare("select author from post_comments where id = ? and removed_at is null").get(id) as { author: number } | undefined)
        : (db.prepare("select author from asks where id = ? and status != 'closed'").get(id) as { author: number } | undefined);
  if (!author) return no("That's already down.");
  if (kind === "post") db.prepare("update posts set removed_at = ? where id = ?").run(now, id);
  if (kind === "comment") db.prepare("update post_comments set removed_at = ? where id = ?").run(now, id);
  if (kind === "ask") db.prepare("update asks set status = 'closed' where id = ?").run(id);
  audit(me, "removed", `${kind} ${id}`, reason || undefined);
  notify(author.author, { kind: "removed", text: `A ${KIND_LABEL[kind]} of yours was taken down by the college desk for breaking the community rules.`, link: "/how-it-works" });
  return { ok: true };
}

/** Bring back a note or comment taken down by mistake (administrators). */
export function restore(me: User, kind: ContentKind, id: number): Result {
  if (!isAdmin(me)) return no("Only an administrator can bring something back.");
  if (kind === "ask") return no("A closed question can't be reopened.");
  const table = kind === "post" ? "posts" : "post_comments";
  const { changes } = database().prepare(`update ${table} set removed_at = null where id = ? and removed_at is not null`).run(id);
  if (!changes) return no("That isn't taken down.");
  audit(me, "restored", `${kind} ${id}`);
  return { ok: true };
}

// ---------- Members ----------

/** Pause a member (they can't sign in, and aren't shown) or let them back. Only someone above them may. */
export function suspend(me: User, userId: number, paused: boolean): Result {
  if (!isModerator(me)) return no(DESK_ONLY);
  if (userId === me.id) return no("You can't pause yourself.");
  const target = anyMember(userId);
  if (!target) return no("That member isn't here.");
  if (!outranks(me, target)) return no("Only someone above them on the college desk can do that.");
  const db = database();
  db.prepare("update users set suspended_at = ? where id = ?").run(paused ? Date.now() : null, userId);
  if (paused) db.prepare("delete from sessions where user_id = ?").run(userId);
  audit(me, paused ? "paused member" : "unpaused member", `member ${userId}`, target.name);
  return { ok: true };
}

/** Sign a member out on every device (a lost phone, a shared computer). */
export function signOutEverywhere(me: User, userId: number): Result {
  if (!isModerator(me)) return no(DESK_ONLY);
  const target = anyMember(userId);
  if (!target) return no("That member isn't here.");
  if (userId !== me.id && !outranks(me, target)) return no("Only someone above them on the college desk can do that.");
  const { changes } = database().prepare("delete from sessions where user_id = ?").run(userId);
  audit(me, "signed out everywhere", `member ${userId}`, `${target.name} · ${changes} session${changes === 1 ? "" : "s"}`);
  return { ok: true };
}

/**
 * Change a member's role. You can only change the role of someone below you, and only to
 * a role below yours: administrators make coordinators; super administrators make
 * administrators. Roles set in the server's config can't be changed here.
 */
export function setRole(me: User, userId: number, role: string): Result {
  if (!isAdmin(me)) return no("Only an administrator can change roles.");
  if (userId === me.id) return no("You can't change your own role.");
  const target = anyMember(userId);
  if (!target) return no("That member isn't here.");
  if (configRole(target.email)) return no("This role is set in the server's config, so it can't be changed here.");
  if (!outranks(me, target)) return no("You can only change the roles of people below you.");
  if (!assignable(me).includes(role as Role)) return no(isSuperAdmin(me) ? "That isn't a role." : "Only a super administrator can make administrators.");
  if (target.role === role) return { ok: true };
  database().prepare("update users set role = ? where id = ?").run(role, userId);
  audit(me, "changed role", `member ${userId}`, `${target.name}: ${target.role} → ${role}`);
  const a = role === "alumnus" || role === "admin" ? "an" : "a";
  const label = role === "admin" ? "administrator" : role === "coordinator" ? "alumni coordinator" : role;
  notify(userId, { actor: me.id, kind: "role", text: `The college desk made you ${a} ${label} on Alumnity.`, link: "/me" });
  return { ok: true };
}

/**
 * Delete a member and everything they made, for good (super administrators only; the
 * member can also do it themselves from Settings). Their name must be typed to confirm.
 * The audit log keeps that it happened, and who did it.
 */
export function deleteMember(me: User, userId: number, typedName: string): Result {
  if (!isSuperAdmin(me)) return no("Only a super administrator can delete a member.");
  const target = anyMember(userId);
  if (!target || userId === me.id) return no("That member can't be deleted here.");
  if (!outranks(me, target)) return no("That member can't be deleted here.");
  if (typedName.trim() !== target.name) return no(`Type their name exactly (“${target.name}”) to confirm.`);
  database().prepare("delete from users where id = ?").run(userId);
  audit(me, "deleted member", `member ${userId}`, target.name);
  return { ok: true };
}

export type DeskMember = User & { suspended: boolean; sample: boolean; createdAt: number };
export type MemberFilter = { q?: string; role?: string; status?: "active" | "paused" | ""; branch?: string };

/** Members for the desk, paused ones included: by name or email, role, status, branch. */
export function deskMembers(me: User, filter: MemberFilter | string = {}): DeskMember[] {
  if (!isModerator(me)) return [];
  const f = typeof filter === "string" ? { q: filter } : filter;
  const like = `%${(f.q ?? "").trim().toLowerCase().replace(/[%_]/g, "")}%`;
  const where = ["(lower(name) like ? or lower(email) like ?)"];
  const args: (string | number)[] = [like, like];
  if (f.role && f.role !== "admin" && f.role !== "superadmin") {
    where.push("role = ?");
    args.push(f.role);
  }
  if (f.status === "active") where.push("suspended_at is null");
  if (f.status === "paused") where.push("suspended_at is not null");
  if (f.branch) {
    where.push("branch = ?");
    args.push(f.branch);
  }
  let list = (database().prepare(`select * from users where ${where.join(" and ")} order by created_at desc limit 100`).all(...args) as Record<string, unknown>[]).map(
    (r) => ({ ...toUser(r), suspended: r.suspended_at != null, sample: Boolean(r.sample), createdAt: Number(r.created_at) })
  );
  // Administrators can come from the config, so their role is checked after reading.
  if (f.role === "admin" || f.role === "superadmin") list = list.filter((u) => u.role === f.role);
  return list.slice(0, 50);
}

export type MemberDetail = DeskMember & {
  sessions: { count: number; lastSignIn: number | null };
  counts: { connections: number; notes: number; asks: number; answered: number; reportsAbout: number; reportsMade: number };
  configRole: "superadmin" | "admin" | null;
  recentAudit: AuditEntry[];
};

/** Everything the desk needs to decide about one member. No passwords, no message contents. */
export function memberDetail(me: User, userId: number): MemberDetail | null {
  if (!isModerator(me)) return null;
  const member = anyMember(userId);
  if (!member) return null;
  const db = database();
  const n = (sql: string, ...args: number[]) => (db.prepare(sql).get(...args) as { n: number }).n;
  const last = db.prepare("select max(created_at) as at from sessions where user_id = ?").get(userId) as { at: number | null };
  return {
    ...member,
    sessions: { count: n("select count(*) as n from sessions where user_id = ? and expires_at > ?", userId, Date.now()), lastSignIn: last.at },
    counts: {
      connections: n("select count(*) as n from connections where (requester = ? or addressee = ?) and status = 'accepted'", userId, userId),
      notes: n("select count(*) as n from posts where author = ? and removed_at is null", userId),
      asks: n("select count(*) as n from asks where author = ?", userId),
      answered: n("select count(*) as n from asks where taker = ? and status = 'answered'", userId),
      reportsAbout: n("select count(*) as n from reports where subject_kind = 'member' and subject_id = ?", userId),
      reportsMade: n("select count(*) as n from reports where reporter = ?", userId)
    },
    configRole: configRole(member.email),
    recentAudit: isAdmin(me) ? auditLog(me, { subject: `member ${userId}`, limit: 10 }) : []
  };
}

// ---------- The team ----------

export type TeamMember = DeskMember & { locked: boolean };

/** Everyone with a desk role: super administrators, administrators, coordinators, and where each comes from. */
export function team(me: User): TeamMember[] {
  if (!isModerator(me)) return [];
  // Desk roles in the database, plus anyone named in the server's config.
  const configured = [...(process.env.ALUMNITY_SUPER_ADMINS ?? "").split(","), ...(process.env.ALUMNITY_ADMINS ?? "").split(",")].map((e) => e.trim().toLowerCase()).filter(Boolean);
  const rows = database()
    .prepare(`select * from users where role in ('coordinator', 'admin') ${configured.length ? `or lower(email) in (${configured.map(() => "?").join(",")})` : ""} order by name`)
    .all(...configured) as Record<string, unknown>[];
  const order = { superadmin: 0, admin: 1, coordinator: 2 } as Record<string, number>;
  return rows
    .map((r) => ({ ...toUser(r), suspended: r.suspended_at != null, sample: Boolean(r.sample), createdAt: Number(r.created_at), locked: configRole(String(r.email)) !== null }))
    .filter((u) => u.role in order)
    .sort((a, b) => order[a.role] - order[b.role]);
}

// ---------- Settings ----------

/** The site's switches, for the desk to show (anyone on the desk may look; only super administrators change them). */
export const deskSettings = (me: User): Settings | null => (isModerator(me) ? settings() : null);

export function updateSettings(me: User, next: Settings): Result {
  if (!isSuperAdmin(me)) return no("Only a super administrator can change the site's settings.");
  const limit = Math.floor(next.dailyRequests);
  if (!(limit >= 1 && limit <= 200)) return no("Daily connection requests should be between 1 and 200.");
  const clean: Settings = {
    joiningOpen: Boolean(next.joiningOpen),
    features: {
      notes: Boolean(next.features.notes),
      asks: Boolean(next.features.asks),
      events: Boolean(next.features.events),
      messages: Boolean(next.features.messages)
    },
    dailyRequests: limit
  };
  const before = settings();
  const changes: string[] = [];
  if (before.joiningOpen !== clean.joiningOpen) changes.push(`joining ${clean.joiningOpen ? "opened" : "closed"}`);
  for (const k of Object.keys(clean.features) as (keyof Settings["features"])[]) {
    if (before.features[k] !== clean.features[k]) changes.push(`${k} ${clean.features[k] ? "on" : "off"}`);
  }
  if (before.dailyRequests !== clean.dailyRequests) changes.push(`daily requests ${before.dailyRequests} → ${clean.dailyRequests}`);
  if (!changes.length) return { ok: true };
  saveSettings(clean, me.id);
  audit(me, "changed settings", "site", changes.join(", "));
  return { ok: true };
}

export { DEFAULT_SETTINGS };

// ---------- The audit log ----------

export type AuditEntry = { id: number; actor: string; action: string; subject: string; detail: string | null; createdAt: number };

export function auditLog(me: User, opts: { q?: string; subject?: string; limit?: number } = {}): AuditEntry[] {
  if (!isAdmin(me)) return [];
  const like = `%${(opts.q ?? "").trim().toLowerCase().replace(/[%_]/g, "")}%`;
  return (
    database()
      .prepare(
        `select audit.*, users.name as actor_name from audit left join users on users.id = audit.actor
         where (lower(audit.action || ' ' || audit.subject || ' ' || coalesce(audit.detail, '') || ' ' || coalesce(users.name, '')) like ?)
         ${opts.subject ? "and audit.subject = ?" : ""}
         order by audit.created_at desc limit ?`
      )
      .all(like, ...(opts.subject ? [opts.subject] : []), Math.min(opts.limit ?? 100, 5000)) as Record<string, unknown>[]
  ).map((r) => ({
    id: Number(r.id),
    actor: (r.actor_name as string) ?? "—",
    action: String(r.action),
    subject: String(r.subject),
    detail: (r.detail as string) ?? null,
    createdAt: Number(r.created_at)
  }));
}

/** The audit log as a spreadsheet (CSV), for the college's records. */
export function auditCsv(me: User): string | null {
  if (!isAdmin(me)) return null;
  // A cell starting with = + - @ would run as a formula in a spreadsheet: neutralise it.
  const cell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  const rows = auditLog(me, { limit: 5000 }).map((e) => [new Date(e.createdAt).toISOString(), e.actor, e.action, e.subject, e.detail ?? ""].map(cell).join(","));
  return ["when,who,did,to,detail", ...rows].join("\r\n") + "\r\n";
}

// ---------- The numbers ----------

/** Totals only, nobody in particular; sample members (development) aren't counted. */
export function stats(me: User) {
  if (!isModerator(me)) return null;
  const db = database();
  const n = (sql: string, ...args: number[]) => (db.prepare(sql).get(...args) as { n: number }).n;
  const now = Date.now();
  const week = now - 7 * DAY;
  // Sample members exist only in development; without any, every total is a plain count.
  const samples = n("select count(*) as n from users where sample = 1") > 0;
  const real = samples ? "select id from users where sample = 0" : "";
  const by = (col: string) => (samples ? `and ${col} in (${real})` : "");
  return {
    members: n("select count(*) as n from users where suspended_at is null and sample = 0"),
    joinedThisWeek: n("select count(*) as n from users where created_at > ? and sample = 0", week),
    signedInThisWeek: n(`select count(distinct user_id) as n from sessions where created_at > ? ${by("user_id")}`, week),
    alumni: n("select count(*) as n from users where role = 'alumnus' and suspended_at is null and sample = 0"),
    students: n("select count(*) as n from users where role = 'student' and suspended_at is null and sample = 0"),
    mentors: n("select count(*) as n from profiles join users on users.id = profiles.user_id where json_extract(profiles.data, '$.happyTo.mentor') = 1 and users.sample = 0"),
    connections: n(`select count(*) as n from connections where status = 'accepted' ${by("requester")} ${by("addressee")}`),
    asks: n(`select count(*) as n from asks where 1 ${by("author")}`),
    answered: n(`select count(*) as n from asks where status = 'answered' ${by("author")}`),
    posts: n(`select count(*) as n from posts where removed_at is null ${by("author")}`),
    events: n(`select count(*) as n from events where 1 ${by("organiser")}`),
    openReports: n("select count(*) as n from reports where status = 'open'"),
    paused: n("select count(*) as n from users where suspended_at is not null"),
    /** New members in each of the last eight weeks, oldest first. */
    joinsByWeek: Array.from({ length: 8 }, (_, i) => {
      const from = now - (8 - i) * 7 * DAY;
      return n("select count(*) as n from users where sample = 0 and created_at > ? and created_at <= ?", from, from + 7 * DAY);
    })
  };
}
