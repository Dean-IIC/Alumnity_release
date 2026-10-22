import { BRANCHES, isBranch } from "../branches";
import { firstName } from "../format";
import { normaliseUsn } from "../register";
import type { User } from "./auth";
import { db, type Row } from "./db";
import { audit } from "./desk";
import { unsubscribeToken } from "./digest";
import { letter, sendMail, smtpReady } from "./mail";
import { isSuperAdmin } from "./roles";
import type { Result } from "./social";

/*
 * HQ (/hq): the super administrator's back office. The register itself (search with
 * USNs, edit, add, delete, import and export as CSV), members' records, mass email, and
 * the size of each table. Every function checks the role again, and every change goes in
 * the audit log. Nothing here is linked from the site.
 */

const no = (error: string): Result => ({ ok: false, error });
const DENIED = "Only a super administrator can do that.";
const YEAR_MIN = 1990;
const yearMax = () => new Date().getFullYear() + 1;

// ---------- CSV ----------

/** One CSV cell: quoted when it must be, and never read as a formula by a spreadsheet. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvOf = (head: string[], rows: unknown[][]) => "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** Reads CSV text (quotes, commas and new lines inside quotes) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// ---------- The register ----------

export type RegisterEntry = { id: number; name: string; usn: string; branch: string; branchName: string; programme: string; year: number; member: number | null };
export type RegisterInput = { name: string; usn: string; branch: string; branchName?: string; programme?: string; year: number };

const toEntry = (r: Row): RegisterEntry => ({
  id: Number(r.id),
  name: String(r.name),
  usn: String(r.usn),
  branch: String(r.branch),
  branchName: String(r.branch_name),
  programme: String(r.programme),
  year: Number(r.year),
  member: r.member_id == null ? null : Number(r.member_id)
});

export const REGISTER_BRANCHES: [string, string][] = [...BRANCHES.map(([c, n]) => [c, n] as [string, string]), ["GEN", "MBA"]];

/** The register's own long name for a branch ("Computer Science & Engineering"). */
async function branchNameOf(branch: string): Promise<string> {
  const row = await db().one<{ branch_name: string }>(
    "select branch_name from records.register where branch = ? group by branch_name order by count(*) desc limit 1",
    branch
  );
  return row?.branch_name ?? REGISTER_BRANCHES.find(([c]) => c === branch)?.[1] ?? branch;
}

/** A line checked and tidied, or what's wrong with it. */
function checkLine(input: RegisterInput): { ok: true; row: Required<RegisterInput> } | { ok: false; error: string } {
  const name = input.name.replace(/\s+/g, " ").trim();
  const usn = normaliseUsn(input.usn);
  const branch = input.branch.trim().toUpperCase();
  const year = Math.floor(Number(input.year));
  if (!name || name.length > 120) return { ok: false, error: "A name is needed (at most 120 letters)." };
  if (!/^[0-9A-Z]{6,14}$/.test(usn)) return { ok: false, error: "That USN doesn't look right." };
  if (!isBranch(branch) && branch !== "GEN") return { ok: false, error: `Branch must be one of ${REGISTER_BRANCHES.map(([c]) => c).join(", ")}.` };
  if (!(year >= YEAR_MIN && year <= yearMax())) return { ok: false, error: `The joining year must be between ${YEAR_MIN} and ${yearMax()}.` };
  const programme = (input.programme ?? "").trim().slice(0, 40) || (branch === "GEN" ? "MBA" : "B.Tech");
  return { ok: true, row: { name, usn, branch, branchName: (input.branchName ?? "").trim().slice(0, 80), programme, year } };
}

export type RegisterQuery = { q?: string; branch?: string; year?: number; page?: number };
export const HQ_PAGE_SIZE = 50;

/** The register, with USNs, for the super administrator: by name or USN, branch and year. */
export async function hqRegister(me: User, query: RegisterQuery): Promise<{ rows: RegisterEntry[]; total: number; page: number; pages: number } | null> {
  if (!isSuperAdmin(me)) return null;
  const where: string[] = ["true"];
  const params: unknown[] = [];
  const q = (query.q ?? "").trim().slice(0, 100);
  if (q) {
    const usn = normaliseUsn(q);
    const words = q.toLowerCase().split(/[^a-z]+/).filter(Boolean).slice(0, 5);
    const parts = words.map(() => "lower(r.name) like ?");
    params.push(...words.map((w) => `%${w}%`));
    // Letters and digits could be part of a USN ("1HK20CS").
    if (/\d/.test(usn)) {
      where.push(`(r.usn like ?${parts.length ? ` or (${parts.join(" and ")})` : ""})`);
      params.unshift(`%${usn}%`);
    } else if (parts.length) where.push(`(${parts.join(" and ")})`);
  }
  if (query.branch) {
    where.push("r.branch = ?");
    params.push(query.branch);
  }
  if (query.year) {
    where.push("r.year = ?");
    params.push(query.year);
  }
  const total = Number((await db().one<{ n: number }>(`select count(*) as n from records.register r where ${where.join(" and ")}`, ...params))?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / HQ_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pages);
  const rows = await db().all(
    `select r.*, u.id as member_id from records.register r left join users u on u.usn = r.usn
     where ${where.join(" and ")} order by r.year desc, r.name limit ? offset ?`,
    ...params,
    HQ_PAGE_SIZE,
    (page - 1) * HQ_PAGE_SIZE
  );
  return { rows: rows.map(toEntry), total, page, pages };
}

export async function hqRegisterLine(me: User, id: number): Promise<RegisterEntry | null> {
  if (!isSuperAdmin(me) || !Number.isSafeInteger(id)) return null;
  const row = await db().one("select r.*, u.id as member_id from records.register r left join users u on u.usn = r.usn where r.id = ?", id);
  return row ? toEntry(row) : null;
}

/** Changes a line of the register (id) or adds one (no id). */
export async function saveRegisterLine(me: User, id: number | null, input: RegisterInput): Promise<Result> {
  if (!isSuperAdmin(me)) return no(DENIED);
  const checked = checkLine(input);
  if (!checked.ok) return no(checked.error);
  const r = checked.row;
  const branchName = r.branchName || (await branchNameOf(r.branch));
  const clash = await db().one<{ id: number }>("select id from records.register where usn = ? and id <> ? limit 1", r.usn, id ?? 0);
  if (clash) return no(`${r.usn} is already on the register (line ${clash.id}).`);
  if (id) {
    const before = await db().one("select * from records.register where id = ?", id);
    if (!before) return no("That line isn't on the register any more.");
    await db().run(
      "update records.register set name = ?, usn = ?, branch = ?, branch_name = ?, programme = ?, year = ? where id = ?",
      r.name, r.usn, r.branch, branchName, r.programme, r.year, id
    );
    await audit(me, "hq.register.edit", `register:${id}`, `${before.name} ${before.usn} ${before.branch} ${before.year} → ${r.name} ${r.usn} ${r.branch} ${r.year}`);
  } else {
    const row = await db().one<{ id: number }>(
      "insert into records.register (name, usn, branch, branch_name, programme, year) values (?, ?, ?, ?, ?, ?) returning id",
      r.name, r.usn, r.branch, branchName, r.programme, r.year
    );
    await audit(me, "hq.register.add", `register:${row?.id}`, `${r.name} ${r.usn} ${r.branch} ${r.year}`);
  }
  return { ok: true };
}

export async function deleteRegisterLine(me: User, id: number): Promise<Result> {
  if (!isSuperAdmin(me)) return no(DENIED);
  const before = await db().one("select * from records.register where id = ?", id);
  if (!before) return no("That line isn't on the register any more.");
  await db().run("delete from records.register where id = ?", id);
  await audit(me, "hq.register.delete", `register:${id}`, `${before.name} ${before.usn} ${before.branch} ${before.year}`);
  return { ok: true };
}

/** The whole register as CSV, in the form an import reads back. */
export async function registerCsv(me: User): Promise<string | null> {
  if (!isSuperAdmin(me)) return null;
  const rows = await db().all("select name, usn, branch, branch_name, programme, year from records.register order by year, branch, usn");
  await audit(me, "hq.register.export", "register", `${rows.length} lines`);
  return csvOf(
    ["name", "usn", "branch", "branch_name", "programme", "year"],
    rows.map((r) => [r.name, r.usn, r.branch, r.branch_name, r.programme, r.year])
  );
}

export type ImportReport = { added: number; changed: number; same: number; skipped: string[]; applied: boolean };

const IMPORT_MAX = 20_000;

/**
 * A CSV of the register (name,usn,branch,branch_name,programme,year; the first line names
 * the columns, in any order) matched by USN: new USNs are added, known ones updated. Nothing
 * is ever deleted by an import. Checks only, unless `apply`.
 */
export async function importRegister(me: User, csv: string, apply: boolean): Promise<{ ok: true; report: ImportReport } | { ok: false; error: string }> {
  if (!isSuperAdmin(me)) return no(DENIED) as { ok: false; error: string };
  const lines = parseCsv(csv);
  if (lines.length < 2) return { ok: false, error: "The file has no lines to import (the first line must name the columns)." };
  if (lines.length > IMPORT_MAX + 1) return { ok: false, error: `At most ${IMPORT_MAX.toLocaleString("en-IN")} lines at a time.` };
  const head = lines[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const at = { name: col("name", "student_name"), usn: col("usn"), branch: col("branch"), branchName: col("branch_name"), programme: col("programme", "program", "course"), year: col("year", "joined", "joining_year") };
  const missing = (["name", "usn", "branch", "year"] as const).filter((k) => at[k] < 0);
  if (missing.length) return { ok: false, error: `The first line must name these columns: ${missing.join(", ")}.` };

  const existing = new Map<string, Row[]>();
  for (const r of await db().all("select * from records.register")) {
    const list = existing.get(String(r.usn)) ?? [];
    list.push(r);
    existing.set(String(r.usn), list);
  }
  const names = new Map<string, string>();
  for (const [code] of REGISTER_BRANCHES) names.set(code, await branchNameOf(code));

  const report: ImportReport = { added: 0, changed: 0, same: 0, skipped: [], applied: apply };
  const adds: Required<RegisterInput>[] = [];
  const updates: { id: number; row: Required<RegisterInput> }[] = [];
  const seen = new Set<string>();
  const skip = (line: number, why: string) => {
    if (report.skipped.length < 200) report.skipped.push(`Line ${line}: ${why}`);
    else if (report.skipped.length === 200) report.skipped.push("…and more.");
  };
  lines.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (k: keyof typeof at) => (at[k] >= 0 ? (cells[at[k]] ?? "").trim() : "");
    const checked = checkLine({ name: get("name"), usn: get("usn"), branch: get("branch"), branchName: get("branchName"), programme: get("programme"), year: Number(get("year")) });
    if (!checked.ok) return skip(line, checked.error);
    const row = checked.row;
    if (seen.has(row.usn)) return skip(line, `${row.usn} is in the file twice.`);
    seen.add(row.usn);
    row.branchName ||= names.get(row.branch) ?? row.branch;
    const known = existing.get(row.usn);
    if (!known) {
      adds.push(row);
      report.added++;
    } else if (known.length > 1) skip(line, `${row.usn} is on the register more than once: sort that out by hand first.`);
    else {
      const k = known[0];
      const same = k.name === row.name && k.branch === row.branch && k.branch_name === row.branchName && k.programme === row.programme && Number(k.year) === row.year;
      if (same) report.same++;
      else {
        updates.push({ id: Number(k.id), row });
        report.changed++;
      }
    }
  });

  if (apply && (adds.length || updates.length)) {
    await db().tx(async (t) => {
      for (let i = 0; i < adds.length; i += 500) {
        const part = adds.slice(i, i + 500);
        await t.run(
          `insert into records.register (name, usn, branch, branch_name, programme, year) values ${part.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
          ...part.flatMap((r) => [r.name, r.usn, r.branch, r.branchName, r.programme, r.year])
        );
      }
      for (const u of updates)
        await t.run(
          "update records.register set name = ?, branch = ?, branch_name = ?, programme = ?, year = ? where id = ?",
          u.row.name, u.row.branch, u.row.branchName, u.row.programme, u.row.year, u.id
        );
    });
    await audit(me, "hq.register.import", "register", `${report.added} added, ${report.changed} changed, ${report.same} the same, ${report.skipped.length} skipped`);
  }
  return { ok: true, report };
}

// ---------- Members ----------

export type HqMember = { id: number; name: string; email: string; usn: string | null; branch: string | null; programme: string | null; joined: number | null; role: string; paused: boolean; sample: boolean; createdAt: number; lastSeen: number | null };

const toHqMember = (r: Row): HqMember => ({
  id: Number(r.id),
  name: String(r.name),
  email: String(r.email),
  usn: (r.usn as string) ?? null,
  branch: (r.branch as string) ?? null,
  programme: (r.programme as string) ?? null,
  joined: r.joined == null ? null : Number(r.joined),
  role: String(r.role),
  paused: r.suspended_at != null,
  sample: Boolean(r.sample),
  createdAt: Number(r.created_at),
  lastSeen: r.last_seen_at == null ? null : Number(r.last_seen_at)
});

/** Members by name, email or USN (newest first), with their records. */
export async function hqMembers(me: User, q = "", limit = 100): Promise<HqMember[] | null> {
  if (!isSuperAdmin(me)) return null;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const where = words.map(() => "(lower(name) like ? or lower(email) like ? or lower(coalesce(usn, '')) like ?)");
  const rows = await db().all(
    `select * from users ${where.length ? `where ${where.join(" and ")}` : ""} order by created_at desc limit ?`,
    ...words.flatMap((w) => {
      const like = `%${w.replace(/[%_\\]/g, "")}%`;
      return [like, like, like];
    }),
    Math.min(Math.max(1, limit), 500)
  );
  return rows.map(toHqMember);
}

export async function hqMember(me: User, id: number): Promise<HqMember | null> {
  if (!isSuperAdmin(me) || !Number.isSafeInteger(id)) return null;
  const row = await db().one("select * from users where id = ?", id);
  return row ? toHqMember(row) : null;
}

export type MemberRecordInput = { name: string; usn: string; branch: string; programme: string; joined: number | null };

/** A member's record (name, USN, branch, course, joining year). Their email is their login: not here. */
export async function saveMemberRecord(me: User, userId: number, input: MemberRecordInput): Promise<Result> {
  if (!isSuperAdmin(me)) return no(DENIED);
  const before = await db().one("select * from users where id = ?", userId);
  if (!before) return no("That member isn't here any more.");
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name || name.length > 120) return no("A name is needed (at most 120 letters).");
  const usn = input.usn ? normaliseUsn(input.usn) : "";
  if (usn && !/^[0-9A-Z]{6,14}$/.test(usn)) return no("That USN doesn't look right.");
  if (usn && (await db().one("select id from users where usn = ? and id <> ?", usn, userId))) return no(`Another member already has ${usn}.`);
  const branch = input.branch.trim().toUpperCase();
  if (branch && !isBranch(branch) && branch !== "GEN") return no(`Branch must be blank or one of ${REGISTER_BRANCHES.map(([c]) => c).join(", ")}.`);
  const joined = input.joined ? Math.floor(input.joined) : null;
  if (joined != null && !(joined >= YEAR_MIN && joined <= yearMax())) return no(`The joining year must be between ${YEAR_MIN} and ${yearMax()}.`);
  const branchName = branch ? await branchNameOf(branch) : null;
  await db().run(
    "update users set name = ?, usn = ?, branch = ?, branch_name = ?, programme = ?, joined = ? where id = ?",
    name, usn || null, branch || null, branchName, input.programme.trim().slice(0, 40) || null, joined, userId
  );
  await audit(me, "hq.member.edit", `member:${userId}`, `${before.name} ${before.usn ?? "-"} ${before.branch ?? "-"} ${before.joined ?? "-"} → ${name} ${usn || "-"} ${branch || "-"} ${joined ?? "-"}`);
  return { ok: true };
}

/** Every member as CSV (with emails: keep it safe). */
export async function membersCsv(me: User): Promise<string | null> {
  if (!isSuperAdmin(me)) return null;
  const rows = (await db().all("select * from users order by id")).map(toHqMember);
  await audit(me, "hq.members.export", "members", `${rows.length} members`);
  const day = (t: number | null) => (t ? new Date(t).toISOString().slice(0, 10) : "");
  return csvOf(
    ["id", "name", "email", "usn", "branch", "programme", "joined", "role", "paused", "sample", "member_since", "last_seen"],
    rows.map((m) => [m.id, m.name, m.email, m.usn, m.branch, m.programme, m.joined, m.role, m.paused ? "yes" : "", m.sample ? "yes" : "", day(m.createdAt), day(m.lastSeen)])
  );
}

// ---------- Mass email ----------

export type Audience = { who: "everyone" | "alumni" | "students" | "staff"; branch?: string; year?: number; skipOptedOut: boolean };
export const AUDIENCE_LABEL: Record<Audience["who"], string> = { everyone: "Every member", alumni: "Alumni", students: "Students", staff: "Teachers and staff" };

function audienceWhere(a: Audience): { sql: string; params: unknown[] } {
  const where = ["u.sample = 0", "u.suspended_at is null"];
  const params: unknown[] = [];
  if (a.who === "alumni") where.push("u.role = 'alumnus'");
  if (a.who === "students") where.push("u.role = 'student'");
  if (a.who === "staff") where.push("u.role in ('faculty', 'coordinator', 'admin', 'superadmin')");
  if (a.branch) {
    where.push("u.branch = ?");
    params.push(a.branch);
  }
  if (a.year) {
    where.push("u.joined = ?");
    params.push(a.year);
  }
  if (a.skipOptedOut) where.push("not exists (select 1 from member_prefs p where p.user_id = u.id and p.email_digest = 0)");
  return { sql: where.join(" and "), params };
}

export function readAudience(text: string): Audience {
  let raw: Partial<Audience> = {};
  try {
    raw = JSON.parse(text) as Partial<Audience>;
  } catch {
    raw = {};
  }
  return {
    who: raw.who && raw.who in AUDIENCE_LABEL ? raw.who : "everyone",
    branch: isBranch(raw.branch) ? raw.branch : undefined,
    year: Number.isInteger(raw.year) ? raw.year : undefined,
    skipOptedOut: raw.skipOptedOut !== false
  };
}

export const describeAudience = (a: Audience) =>
  [AUDIENCE_LABEL[a.who], a.branch, a.year && `joined ${a.year}`, a.skipOptedOut ? "(not those who turned emails off)" : "(including those who turned emails off)"].filter(Boolean).join(" · ");

export async function audienceSize(me: User, a: Audience): Promise<number | null> {
  if (!isSuperAdmin(me)) return null;
  const w = audienceWhere(a);
  return Number((await db().one<{ n: number }>(`select count(*) as n from users u where ${w.sql}`, ...w.params))?.n ?? 0);
}

/** The email as each member gets it ("Dear Asha," and the text, paragraph by paragraph). */
function mailFor(to: { id: number; name: string; email: string }, subject: string, body: string, origin: string) {
  const token = unsubscribeToken(to.id);
  const stop = token ? `${origin}/api/alerts/unsubscribe?u=${to.id}&t=${token}` : undefined;
  const lines = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  const content = letter({
    greeting: `Dear ${firstName(to.name)},`,
    lines,
    button: { text: "Open Alumnity", href: `${origin}/home` },
    footer: `From the alumni office, HKBK College of Engineering, on Alumnity.${stop ? ` To stop emails from Alumnity: ${stop}` : ""}`
  });
  return { to: to.email, subject, ...content, unsubscribe: stop };
}

const MAIL_SUBJECT_MAX = 150;
const MAIL_BODY_MAX = 10_000;

function checkMail(subject: string, body: string): string | null {
  if (!subject.trim() || subject.length > MAIL_SUBJECT_MAX) return `A subject is needed (at most ${MAIL_SUBJECT_MAX} letters).`;
  if (!body.trim() || body.length > MAIL_BODY_MAX) return `The email needs some words (at most ${MAIL_BODY_MAX.toLocaleString("en-IN")} letters).`;
  return null;
}

/** On this computer without SMTP, emails are printed in the server's output: count those as sent. */
const printedLocally = () => !smtpReady() && process.env.NODE_ENV !== "production";

/** The email to yourself first, to see how it looks. */
export async function testMail(me: User, subject: string, body: string, origin: string): Promise<Result> {
  if (!isSuperAdmin(me)) return no(DENIED);
  const wrong = checkMail(subject, body);
  if (wrong) return no(wrong);
  if (!smtpReady() && !printedLocally()) return no("Email isn't set up on this server yet (SMTP_HOST, SMTP_USER, SMTP_PASS).");
  const sent = await sendMail(mailFor(me, `[Test] ${subject}`, body, origin)).catch(() => false);
  return sent || printedLocally() ? { ok: true } : no("The email server didn't take it. Check the SMTP settings.");
}

export type Mailout = { id: number; subject: string; audience: string; total: number; sent: number; failed: number; createdAt: number; by: string };

/** A new mass email: saved, then sent in batches (sendMailoutBatch). */
export async function startMailout(me: User, subject: string, body: string, a: Audience): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!isSuperAdmin(me)) return { ok: false, error: DENIED };
  const wrong = checkMail(subject, body);
  if (wrong) return { ok: false, error: wrong };
  if (!smtpReady() && !printedLocally()) return { ok: false, error: "Email isn't set up on this server yet (SMTP_HOST, SMTP_USER, SMTP_PASS)." };
  const total = (await audienceSize(me, a)) ?? 0;
  if (!total) return { ok: false, error: "Nobody is in that audience." };
  const row = await db().one<{ id: number }>(
    "insert into site.mailouts (subject, body, audience, total, created_by, created_at) values (?, ?, ?, ?, ?, ?) returning id",
    subject.trim(), body.trim(), JSON.stringify(a), total, me.id, Date.now()
  );
  await audit(me, "hq.mail.start", `mailout:${row?.id}`, `${subject.trim()} → ${describeAudience(a)} (${total})`);
  return { ok: true, id: Number(row?.id) };
}

export const MAIL_BATCH = 100;

/** Sends the next batch of a mass email to those who haven't had it yet. */
export async function sendMailoutBatch(me: User, id: number, origin: string): Promise<{ ok: true; sent: number; failed: number; left: number } | { ok: false; error: string }> {
  if (!isSuperAdmin(me)) return { ok: false, error: DENIED };
  const m = await db().one("select * from site.mailouts where id = ?", id);
  if (!m) return { ok: false, error: "That email isn't here." };
  if (!smtpReady() && !printedLocally()) return { ok: false, error: "Email isn't set up on this server yet (SMTP_HOST, SMTP_USER, SMTP_PASS)." };
  const w = audienceWhere(readAudience(String(m.audience)));
  const notYet = `${w.sql} and not exists (select 1 from site.mailout_sent s where s.mailout_id = ? and s.user_id = u.id and s.ok)`;
  const batch = await db().all<{ id: number; name: string; email: string }>(`select u.id, u.name, u.email from users u where ${notYet} order by u.id limit ?`, ...w.params, id, MAIL_BATCH);
  let sent = 0;
  let failed = 0;
  // Three at a time: what the mail connection pool holds.
  for (let i = 0; i < batch.length; i += 3) {
    await Promise.all(
      batch.slice(i, i + 3).map(async (u) => {
        const ok = (await sendMail(mailFor({ id: Number(u.id), name: u.name, email: u.email }, String(m.subject), String(m.body), origin)).catch(() => false)) || printedLocally();
        if (ok) sent++;
        else failed++;
        await db().run(
          "insert into site.mailout_sent (mailout_id, user_id, sent_at, ok) values (?, ?, ?, ?) on conflict (mailout_id, user_id) do update set sent_at = excluded.sent_at, ok = excluded.ok",
          id, u.id, Date.now(), ok
        );
      })
    );
  }
  const left = Number((await db().one<{ n: number }>(`select count(*) as n from users u where ${notYet}`, ...w.params, id))?.n ?? 0);
  await audit(me, "hq.mail.batch", `mailout:${id}`, `${sent} sent, ${failed} failed, ${left} left`);
  return { ok: true, sent, failed, left };
}

export async function mailouts(me: User): Promise<Mailout[] | null> {
  if (!isSuperAdmin(me)) return null;
  const rows = await db().all(
    `select m.id, m.subject, m.audience, m.total, m.created_at, u.name as by_name,
       (select count(*) from site.mailout_sent s where s.mailout_id = m.id and s.ok) as sent,
       (select count(*) from site.mailout_sent s where s.mailout_id = m.id and not s.ok) as failed
     from site.mailouts m left join users u on u.id = m.created_by order by m.id desc limit 20`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    subject: String(r.subject),
    audience: describeAudience(readAudience(String(r.audience))),
    total: Number(r.total),
    sent: Number(r.sent),
    failed: Number(r.failed),
    createdAt: Number(r.created_at),
    by: String(r.by_name ?? "")
  }));
}

// ---------- The database ----------

const TABLES = [
  "records.register",
  "users",
  "profiles",
  "posts",
  "comments",
  "reactions",
  "connections",
  "messages",
  "notifications",
  "events",
  "groups",
  "asks",
  "causes",
  "audit",
  "site.albums",
  "site.photos",
  "site.videos",
  "site.stories",
  "site.mailouts"
];

/** How many rows each table holds (those that exist). */
export async function tableSizes(me: User): Promise<{ table: string; rows: number }[] | null> {
  if (!isSuperAdmin(me)) return null;
  const out: { table: string; rows: number }[] = [];
  for (const table of TABLES) {
    const exists = await db().one<{ t: string | null }>("select to_regclass(?)::text as t", table);
    if (!exists?.t) continue;
    out.push({ table, rows: Number((await db().one<{ n: number }>(`select count(*) as n from ${table}`))?.n ?? 0) });
  }
  return out;
}
