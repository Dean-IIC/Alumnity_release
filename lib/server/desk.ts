import { db, type Row } from "./db";
import { configRole, removeAccount, sessionCount, signOutMember, toUser, type Role, type User } from "./auth";
import { askFor } from "./asks";
import { pageFor } from "./people";
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

export type SubjectKind = "member" | "post" | "comment" | "message" | "ask" | "group" | "cause";
export const SUBJECT_KINDS: SubjectKind[] = ["member", "post", "comment", "message", "ask", "group", "cause"];
const DAY = 24 * 60 * 60_000;
const no = (error: string): Result => ({ ok: false, error });
const DESK_ONLY = "Only the college desk can do that.";
const likeOf = (q: string) => `%${q.trim().toLowerCase().replace(/[%_\\]/g, "")}%`;
const count = async (sql: string, ...args: unknown[]) => (await db().one<{ n: number }>(sql, ...args))?.n ?? 0;

export async function audit(actor: User | null, action: string, subject: string, detail?: string) {
  await db().run("insert into audit (actor, action, subject, detail, created_at) values (?, ?, ?, ?, ?)", actor?.id ?? null, action, subject, detail ?? null, Date.now());
}

export type DeskMember = User & { suspended: boolean; sample: boolean; createdAt: number };

const toDeskMember = (r: Row): DeskMember => ({ ...toUser(r), suspended: r.suspended_at != null, sample: Boolean(r.sample), createdAt: Number(r.created_at) });

/** A member by id, paused or not (the desk sees everyone). */
async function anyMember(id: number): Promise<DeskMember | null> {
  if (!Number.isSafeInteger(id)) return null;
  const row = await db().one("select * from users where id = ?", id);
  return row ? toDeskMember(row) : null;
}

/** Several members by id, paused or not. */
async function anyMembers(ids: number[]): Promise<Map<number, DeskMember>> {
  const wanted = [...new Set(ids)].filter(Number.isSafeInteger);
  if (!wanted.length) return new Map();
  const rows = await db().all(`select * from users where id in (${wanted.map(() => "?").join(",")})`, ...wanted);
  return new Map(rows.map((r) => [Number(r.id), toDeskMember(r)]));
}

// ---------- Reports ----------

/** What a report is about, in a line, and who wrote it (null if it's gone). */
async function subjectOf(kind: SubjectKind, id: number): Promise<{ text: string; owner: number; link: string } | null> {
  const one = (sql: string) => db().one(sql, id);
  if (kind === "member") {
    const u = await one("select id, name from users where id = ?");
    return u ? { text: String(u.name), owner: Number(u.id), link: `/people/${u.id}` } : null;
  }
  if (kind === "post") {
    const p = await one("select author, body from posts where id = ?");
    return p ? { text: String(p.body), owner: Number(p.author), link: `/notes/${id}` } : null;
  }
  if (kind === "comment") {
    const c = await one("select author, body, post_id from post_comments where id = ?");
    return c ? { text: String(c.body), owner: Number(c.author), link: `/notes/${c.post_id}` } : null;
  }
  if (kind === "message") {
    const m = await one("select sender, body from messages where id = ?");
    return m ? { text: String(m.body), owner: Number(m.sender), link: "" } : null;
  }
  if (kind === "group") {
    const g = await one("select name, about, created_by from groups where id = ?");
    return g ? { text: `${g.name}: ${g.about}`, owner: Number(g.created_by ?? 0), link: `/groups/${id}` } : null;
  }
  if (kind === "cause") {
    const c = await one("select title, story, author from causes where id = ?");
    return c ? { text: `${c.title}: ${c.story}`, owner: Number(c.author ?? 0), link: `/causes/${id}` } : null;
  }
  const a = await one("select author, title, body from asks where id = ?");
  return a ? { text: `${a.title}: ${a.body}`, owner: Number(a.author), link: `/ask/${id}` } : null;
}

async function canReport(me: User, kind: SubjectKind, id: number): Promise<boolean> {
  if (!Number.isSafeInteger(id)) return false;
  if (kind === "member") return (await pageFor(me, id)) !== null;
  if (kind === "post") return (await visiblePost(me, id)) !== null;
  if (kind === "comment") {
    const c = await db().one<{ post_id: number }>("select post_id from post_comments where id = ? and removed_at is null", id);
    return Boolean(c && (await visiblePost(me, c.post_id)));
  }
  if (kind === "message") return Boolean(await db().one("select 1 from messages where id = ? and recipient = ?", id, me.id));
  if (kind === "group") return Boolean(await db().one("select 1 from groups where id = ? and removed_at is null", id));
  if (kind === "cause") return Boolean(await db().one("select 1 from causes where id = ? and status = 'live'", id));
  return (await askFor(me, id)) !== null;
}

/**
 * A member reports something they've seen. They may only report a message sent to them,
 * and nothing of their own.
 */
export async function report(me: User, kind: string, id: number, reason: string): Promise<Result> {
  if (!SUBJECT_KINDS.includes(kind as SubjectKind)) return no("That can't be reported.");
  // Only what the reporter can actually see (one answer for "not there" and "not yours to see").
  if (!(await canReport(me, kind as SubjectKind, id))) return no("This is no longer available.");
  const subject = await subjectOf(kind as SubjectKind, id);
  if (!subject) return no("This is no longer available.");
  if (subject.owner === me.id) return no("You can't report yourself or anything you made.");
  const why = reason.trim().slice(0, 500);
  if (!why) return no("Say in a few words what's wrong. It helps the alumni coordinators check.");
  if (!(await withinLimit(`report:${me.id}`, 20, DAY))) return no("You have sent many reports today. The alumni coordinators will look at them soon.");
  await db().run("insert into reports (reporter, subject_kind, subject_id, reason, created_at) values (?, ?, ?, ?, ?)", me.id, kind, id, why, Date.now());
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

export async function reports(viewer: User, status: "open" | "closed" = "open"): Promise<Report[]> {
  if (!isModerator(viewer)) return [];
  const rows = await db().all<{ id: number; reporter: number; subject_kind: SubjectKind; subject_id: number; reason: string; status: Report["status"]; created_at: number }>(
    `select * from reports where ${status === "open" ? "status = 'open'" : "status != 'open'"} order by created_at desc limit 100`
  );
  const subjects = await Promise.all(rows.map((r) => subjectOf(r.subject_kind, r.subject_id)));
  const people = await anyMembers([...rows.map((r) => r.reporter), ...subjects.flatMap((s) => (s ? [s.owner] : []))]);
  return rows.map((r, i) => {
    const s = subjects[i];
    const reporter = people.get(r.reporter);
    return {
      id: r.id,
      reporter: reporter && !reporter.suspended ? reporter : null,
      kind: r.subject_kind,
      subjectId: r.subject_id,
      subject: s && { text: s.text.slice(0, 400), owner: people.get(s.owner) ?? null, link: s.link },
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at
    };
  });
}

/** Take down what was reported (a member is paused), or dismiss the report. */
export async function resolveReport(me: User, id: number, action: "remove" | "dismiss"): Promise<Result> {
  if (!isModerator(me)) return no(DESK_ONLY);
  const r = await db().one<{ subject_kind: SubjectKind; subject_id: number }>("select * from reports where id = ? and status = 'open'", id);
  if (!r) return no("This report has already been handled.");
  if (action === "remove") {
    const sid = r.subject_id;
    let result: Result;
    if (r.subject_kind === "member") result = await suspend(me, sid, true);
    else if (r.subject_kind === "message") {
      await db().run("delete from messages where id = ?", sid);
      result = { ok: true };
    } else if (r.subject_kind === "group") {
      result = await (await import("./groups")).removeGroup(me, sid);
    } else if (r.subject_kind === "cause") {
      result = await (await import("./causes")).closeCause(me, sid, `Taken down after a report (report ${id}).`);
    } else result = await takeDown(me, r.subject_kind, sid, `report ${id}`);
    if (!result.ok) return result;
    // Every other report about the same thing is settled with it.
    await db().run(
      "update reports set status = 'removed', resolved_by = ?, resolved_at = ? where subject_kind = ? and subject_id = ? and status = 'open'",
      me.id,
      Date.now(),
      r.subject_kind,
      sid
    );
    if (r.subject_kind === "message") await audit(me, "removed", `message ${sid}`, `report ${id}`);
  } else {
    await db().run("update reports set status = 'dismissed', resolved_by = ?, resolved_at = ? where id = ?", me.id, Date.now(), id);
    await audit(me, "dismissed report", `${r.subject_kind} ${r.subject_id}`, `report ${id}`);
  }
  return { ok: true };
}

// ---------- What's written: notes, comments, Asks ----------

export type ContentKind = "post" | "comment" | "ask";
export type ContentItem = { kind: ContentKind; id: number; text: string; author: User | null; createdAt: number; removed: boolean; link: string };

const CONTENT_SQL: Record<ContentKind, string> = {
  post: "select id, author, body as text, created_at, removed_at as gone, null::bigint as post_id from posts",
  comment: "select id, author, body as text, created_at, removed_at as gone, post_id from post_comments",
  ask: "select id, author, title || ': ' || body as text, created_at, case when status = 'closed' then created_at end as gone, null::bigint as post_id from asks"
};

/** The newest notes, comments or Asks (removed ones included), optionally containing `q`. */
export async function recentContent(me: User, kind: ContentKind, q = ""): Promise<ContentItem[]> {
  if (!isModerator(me)) return [];
  const rows = await db().all<{ id: number; author: number; text: string; created_at: number; gone: number | null; post_id: number | null }>(
    `select * from (${CONTENT_SQL[kind]}) as content where lower(text) like ? order by created_at desc limit 50`,
    likeOf(q)
  );
  const authors = await anyMembers(rows.map((r) => r.author));
  return rows.map((r) => ({
    kind,
    id: r.id,
    text: r.text.slice(0, 400),
    author: authors.get(r.author) ?? null,
    createdAt: r.created_at,
    removed: r.gone != null,
    link: kind === "ask" ? `/ask/${r.id}` : `/notes/${kind === "comment" ? r.post_id : r.id}`
  }));
}

const KIND_LABEL: Record<ContentKind, string> = { post: "post", comment: "comment", ask: "question" };

/** Take something down. Its author is told (not by whom), so a removal is never a mystery. */
export async function takeDown(me: User, kind: ContentKind, id: number, reason = ""): Promise<Result> {
  if (!isModerator(me)) return no(DESK_ONLY);
  const now = Date.now();
  const author =
    kind === "post"
      ? await db().one<{ author: number }>("update posts set removed_at = ? where id = ? and removed_at is null returning author", now, id)
      : kind === "comment"
        ? await db().one<{ author: number }>("update post_comments set removed_at = ? where id = ? and removed_at is null returning author", now, id)
        : await db().one<{ author: number }>("update asks set status = 'closed' where id = ? and status != 'closed' returning author", id);
  if (!author) return no("This has already been taken down.");
  await audit(me, "removed", `${kind} ${id}`, reason || undefined);
  await notify(author.author, { kind: "removed", text: `The college desk took down your ${KIND_LABEL[kind]}. It broke the community rules.`, link: "/how-it-works" });
  return { ok: true };
}

/** Bring back a note or comment taken down by mistake (administrators). */
export async function restore(me: User, kind: ContentKind, id: number): Promise<Result> {
  if (!isAdmin(me)) return no("Only an administrator can bring this back.");
  if (kind === "ask") return no("A closed question can't be opened again.");
  const table = kind === "post" ? "posts" : "post_comments";
  const changes = await db().run(`update ${table} set removed_at = null where id = ? and removed_at is not null`, id);
  if (!changes) return no("This has not been taken down.");
  await audit(me, "restored", `${kind} ${id}`);
  return { ok: true };
}

// ---------- Members ----------

/** Pause a member (they can't sign in, and aren't shown) or let them back. Only someone above them may. */
export async function suspend(me: User, userId: number, paused: boolean): Promise<Result> {
  if (!isModerator(me)) return no(DESK_ONLY);
  if (userId === me.id) return no("You can't pause yourself.");
  const target = await anyMember(userId);
  if (!target) return no("We couldn't find that member.");
  if (!outranks(me, target)) return no("Only someone with a higher college desk role can do that.");
  await db().run("update users set suspended_at = ? where id = ?", paused ? Date.now() : null, userId);
  if (paused) await signOutMember(userId);
  await audit(me, paused ? "paused member" : "unpaused member", `member ${userId}`, target.name);
  return { ok: true };
}

/** Sign a member out on every device (a lost phone, a shared computer). */
export async function signOutEverywhere(me: User, userId: number): Promise<Result> {
  if (!isModerator(me)) return no(DESK_ONLY);
  const target = await anyMember(userId);
  if (!target) return no("We couldn't find that member.");
  if (userId !== me.id && !outranks(me, target)) return no("Only someone with a higher college desk role can do that.");
  const ended = await signOutMember(userId);
  await audit(me, "signed out everywhere", `member ${userId}`, ended === null ? target.name : `${target.name} · ${ended} session${ended === 1 ? "" : "s"}`);
  return { ok: true };
}

/**
 * Change a member's role. You can only change the role of someone below you, and only to
 * a role below yours: administrators make coordinators; super administrators make
 * administrators. Roles set in the server's config can't be changed here.
 */
export async function setRole(me: User, userId: number, role: string): Promise<Result> {
  if (!isAdmin(me)) return no("Only an administrator can change roles.");
  if (userId === me.id) return no("You can't change your own role.");
  const target = await anyMember(userId);
  if (!target) return no("We couldn't find that member.");
  if (configRole(target.email)) return no("This role is set by the site's technical team. You can't change it here.");
  if (!outranks(me, target)) return no("You can only change roles for people below you on the college desk.");
  if (!assignable(me).includes(role as Role)) return no(isSuperAdmin(me) ? "That role does not exist." : "Only a super administrator can make administrators.");
  if (target.role === role) return { ok: true };
  await db().run("update users set role = ? where id = ?", role, userId);
  await audit(me, "changed role", `member ${userId}`, `${target.name}: ${target.role} → ${role}`);
  const a = role === "alumnus" || role === "admin" ? "an" : "a";
  const label = role === "admin" ? "administrator" : role === "coordinator" ? "alumni coordinator" : role;
  await notify(userId, { actor: me.id, kind: "role", text: `The college desk made you ${a} ${label} on Alumnity.`, link: "/me" });
  return { ok: true };
}

/**
 * Delete a member and everything they made, for good (super administrators only; the
 * member can also do it themselves from Settings). Their name must be typed to confirm.
 * The audit log keeps that it happened, and who did it.
 */
export async function deleteMember(me: User, userId: number, typedName: string): Promise<Result> {
  if (!isSuperAdmin(me)) return no("Only a super administrator can delete a member.");
  const target = await anyMember(userId);
  if (!target || userId === me.id) return no("That member can't be deleted here.");
  if (!outranks(me, target)) return no("That member can't be deleted here.");
  if (typedName.trim() !== target.name) return no(`Type their name exactly as shown: “${target.name}”.`);
  await removeAccount(userId);
  await audit(me, "deleted member", `member ${userId}`, target.name);
  return { ok: true };
}

export type MemberFilter = { q?: string; role?: string; status?: "active" | "paused" | ""; branch?: string };

/** Members for the desk, paused ones included: by name or email, role, status, branch. */
export async function deskMembers(me: User, filter: MemberFilter | string = {}): Promise<DeskMember[]> {
  if (!isModerator(me)) return [];
  const f = typeof filter === "string" ? { q: filter } : filter;
  const like = likeOf(f.q ?? "");
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
  let list = (await db().all(`select * from users where ${where.join(" and ")} order by created_at desc limit 100`, ...args)).map(toDeskMember);
  // Administrators can come from the config, so their role is checked after reading.
  if (f.role === "admin" || f.role === "superadmin") list = list.filter((u) => u.role === f.role);
  return list.slice(0, 50);
}

export type MemberDetail = DeskMember & {
  sessions: { count: number | null; lastSignIn: number | null };
  counts: { connections: number; notes: number; asks: number; answered: number; reportsAbout: number; reportsMade: number };
  configRole: "superadmin" | "admin" | null;
  recentAudit: AuditEntry[];
};

/** Everything the desk needs to decide about one member. No passwords, no message contents. */
export async function memberDetail(me: User, userId: number): Promise<MemberDetail | null> {
  if (!isModerator(me)) return null;
  const member = await anyMember(userId);
  if (!member) return null;
  const [seen, sessions, connections, notes, asks, answered, reportsAbout, reportsMade, recentAudit] = await Promise.all([
    db().one<{ at: number | null }>("select last_seen_at as at from users where id = ?", userId),
    sessionCount(userId),
    count("select count(*) as n from connections where (requester = ? or addressee = ?) and status = 'accepted'", userId, userId),
    count("select count(*) as n from posts where author = ? and removed_at is null", userId),
    count("select count(*) as n from asks where author = ?", userId),
    count("select count(*) as n from asks where taker = ? and status = 'answered'", userId),
    count("select count(*) as n from reports where subject_kind = 'member' and subject_id = ?", userId),
    count("select count(*) as n from reports where reporter = ?", userId),
    isAdmin(me) ? auditLog(me, { subject: `member ${userId}`, limit: 10 }) : Promise.resolve([])
  ]);
  return {
    ...member,
    sessions: { count: sessions, lastSignIn: seen?.at ?? null },
    counts: { connections, notes, asks, answered, reportsAbout, reportsMade },
    configRole: configRole(member.email),
    recentAudit
  };
}

// ---------- The team ----------

export type TeamMember = DeskMember & { locked: boolean };

/** Everyone with a desk role: super administrators, administrators, coordinators, and where each comes from. */
export async function team(me: User): Promise<TeamMember[]> {
  if (!isModerator(me)) return [];
  // Desk roles in the database, plus anyone named in the server's config.
  const configured = [...(process.env.ALUMNITY_SUPER_ADMINS ?? "").split(","), ...(process.env.ALUMNITY_ADMINS ?? "").split(",")]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const rows = await db().all(
    `select * from users where role in ('coordinator', 'admin') ${configured.length ? `or lower(email) in (${configured.map(() => "?").join(",")})` : ""} order by name`,
    ...configured
  );
  const order = { superadmin: 0, admin: 1, coordinator: 2 } as Record<string, number>;
  return rows
    .map((r) => ({ ...toDeskMember(r), locked: configRole(String(r.email)) !== null }))
    .filter((u) => u.role in order)
    .sort((a, b) => order[a.role] - order[b.role]);
}

// ---------- Settings ----------

/** The site's switches, for the desk to show (anyone on the desk may look; only super administrators change them). */
export const deskSettings = async (me: User): Promise<Settings | null> => (isModerator(me) ? settings() : null);

export async function updateSettings(me: User, next: Settings): Promise<Result> {
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
  const before = await settings();
  const changes: string[] = [];
  if (before.joiningOpen !== clean.joiningOpen) changes.push(`joining ${clean.joiningOpen ? "opened" : "closed"}`);
  for (const k of Object.keys(clean.features) as (keyof Settings["features"])[]) {
    if (before.features[k] !== clean.features[k]) changes.push(`${k} ${clean.features[k] ? "on" : "off"}`);
  }
  if (before.dailyRequests !== clean.dailyRequests) changes.push(`daily requests ${before.dailyRequests} → ${clean.dailyRequests}`);
  if (!changes.length) return { ok: true };
  await saveSettings(clean, me.id);
  await audit(me, "changed settings", "site", changes.join(", "));
  return { ok: true };
}

export { DEFAULT_SETTINGS };

// ---------- The audit log ----------

export type AuditEntry = { id: number; actor: string; action: string; subject: string; detail: string | null; createdAt: number };

export async function auditLog(me: User, opts: { q?: string; subject?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  if (!isAdmin(me)) return [];
  const rows = await db().all(
    `select audit.*, users.name as actor_name from audit left join users on users.id = audit.actor
     where (lower(audit.action || ' ' || audit.subject || ' ' || coalesce(audit.detail, '') || ' ' || coalesce(users.name, '')) like ?)
     ${opts.subject ? "and audit.subject = ?" : ""}
     order by audit.created_at desc, audit.id desc limit ?`,
    likeOf(opts.q ?? ""),
    ...(opts.subject ? [opts.subject] : []),
    Math.min(opts.limit ?? 100, 5000)
  );
  return rows.map((r) => ({
    id: Number(r.id),
    actor: (r.actor_name as string) ?? "—",
    action: String(r.action),
    subject: String(r.subject),
    detail: (r.detail as string) ?? null,
    createdAt: Number(r.created_at)
  }));
}

/** The audit log as a spreadsheet (CSV), for the college's records. */
export async function auditCsv(me: User): Promise<string | null> {
  if (!isAdmin(me)) return null;
  // A cell starting with = + - @ would run as a formula in a spreadsheet: neutralise it.
  const cell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  const rows = (await auditLog(me, { limit: 5000 })).map((e) => [new Date(e.createdAt).toISOString(), e.actor, e.action, e.subject, e.detail ?? ""].map(cell).join(","));
  return ["when,who,did,to,detail", ...rows].join("\r\n") + "\r\n";
}

// ---------- The numbers ----------

/** Totals only, nobody in particular; sample members (development) aren't counted. */
export async function stats(me: User) {
  if (!isModerator(me)) return null;
  const now = Date.now();
  const week = now - 7 * DAY;
  // Sample members exist only in development; without any, every total is a plain count.
  const samples = (await count("select count(*) as n from users where sample = 1")) > 0;
  const real = "select id from users where sample = 0";
  const by = (col: string) => (samples ? `and ${col} in (${real})` : "");
  // Every total in one query (one round trip, one connection), not one each.
  const totals: [string, string, ...unknown[]][] = [
    ["members", "select count(*) from users where suspended_at is null and sample = 0"],
    ["joinedThisWeek", "select count(*) from users where created_at > ? and sample = 0", week],
    ["signedInThisWeek", "select count(*) from users where last_seen_at > ? and sample = 0", week],
    ["alumni", "select count(*) from users where role = 'alumnus' and suspended_at is null and sample = 0"],
    ["students", "select count(*) from users where role = 'student' and suspended_at is null and sample = 0"],
    [
      "mentors",
      "select count(*) from profiles join users on users.id = profiles.user_id where (profiles.data::jsonb -> 'happyTo' ->> 'mentor') = 'true' and users.sample = 0"
    ],
    ["connections", `select count(*) from connections where status = 'accepted' ${by("requester")} ${by("addressee")}`],
    ["asks", `select count(*) from asks where true ${by("author")}`],
    ["answered", `select count(*) from asks where status = 'answered' ${by("author")}`],
    ["posts", `select count(*) from posts where removed_at is null ${by("author")}`],
    ["events", `select count(*) from events where true ${by("organiser")}`],
    ["openReports", "select count(*) from reports where status = 'open'"],
    ["paused", "select count(*) from users where suspended_at is not null"],
    ["groups", "select count(*) from groups where removed_at is null"],
    ["causesWaiting", "select count(*) from causes where status = 'pending'"],
    ["raised", "select coalesce(sum(amount), 0) from donations where status = 'paid'"],
    // New members in each of the last eight weeks, oldest first.
    ...Array.from({ length: 8 }, (_, i): [string, string, ...unknown[]] => {
      const from = now - (8 - i) * 7 * DAY;
      return [`week${i}`, "select count(*) from users where sample = 0 and created_at > ? and created_at <= ?", from, from + 7 * DAY];
    })
  ];
  const row =
    (await db().one<Record<string, number>>(
      `select ${totals.map(([name, sql]) => `(${sql}) as "${name}"`).join(", ")}`,
      ...totals.flatMap(([, , ...args]) => args)
    )) ?? {};
  const n = (name: string) => Number(row[name] ?? 0);
  const [members, joinedThisWeek, signedInThisWeek, alumni, students, mentors, connections, asks, answered, posts, events, openReports, paused, groups, causesWaiting, raised] = totals
    .slice(0, 16)
    .map(([name]) => n(name));
  const joinsByWeek = Array.from({ length: 8 }, (_, i) => n(`week${i}`));
  return { members, joinedThisWeek, signedInThisWeek, alumni, students, mentors, connections, asks, answered, posts, events, openReports, paused, groups, causesWaiting, raised, joinsByWeek };
}

