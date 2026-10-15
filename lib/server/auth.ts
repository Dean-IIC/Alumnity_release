import { loadRegister, lookup, type Found } from "../register";
import { settings } from "./settings";
import { database } from "./db";
import { letter, sendMail } from "./mail";
import { decoyHash, hashPassword, passwordProblem, randomToken, sameHash, sha256, sixDigitCode, verifyPassword } from "./secrets";
import { withinLimit } from "./throttle";

/*
 * Accounts. Joining: find your line in the register → we email a code → you choose a
 * password. One USN, one account. Logging in: email and password. Forgot your password:
 * we email a code → you choose a new one, and every other signed-in browser is signed out.
 *
 * Nothing here says whether an email address has an account (that's the person's own
 * business): joining with a taken email emails its owner instead, and resetting always
 * answers the same way.
 */

/** "superadmin" is never stored: it comes from ALUMNITY_SUPER_ADMINS only (see lib/server/roles.ts). */
export type Role = "student" | "alumnus" | "faculty" | "coordinator" | "admin" | "superadmin";

export type User = {
  id: number;
  email: string;
  name: string;
  usn: string | null;
  branch: string | null;
  branchName: string | null;
  programme: string | null;
  joined: number | null;
  role: Role;
};

export type Outcome<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MINUTE = 60_000;
const CODE_LIFE = 15 * MINUTE;
/** After the code is right, this long to choose a password. */
const SETUP_LIFE = 30 * MINUTE;
const CODE_TRIES = 5;
export const SESSION_LIFE = 30 * 24 * 60 * MINUTE;

const SLOW_DOWN = "That’s a lot of tries in a short time. Wait a few minutes and try again.";

export { toUser };

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;

/** B.Tech is four years; MBA and M.Tech two. Still inside that, you're a student. */
function roleFor(found: Found, now = new Date()): Role {
  const years = found.programme === "B.Tech" ? 4 : found.programme === "PHD" ? 5 : 2;
  return found.joined + years > now.getFullYear() ? "student" : "alumnus";
}

const emails = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * Roles set in the server's config, by email: super administrators
 * (ALUMNITY_SUPER_ADMINS) and administrators (ALUMNITY_ADMINS). The site can't change or
 * remove these, so the college can never be locked out of its own site.
 */
export function configRole(email: string): "superadmin" | "admin" | null {
  const e = email.toLowerCase();
  if (emails(process.env.ALUMNITY_SUPER_ADMINS).includes(e)) return "superadmin";
  if (emails(process.env.ALUMNITY_ADMINS).includes(e)) return "admin";
  return null;
}

const toUser = (row: Record<string, unknown>): User => ({
  id: Number(row.id),
  email: String(row.email),
  name: String(row.name),
  usn: (row.usn as string) ?? null,
  branch: (row.branch as string) ?? null,
  branchName: (row.branch_name as string) ?? null,
  programme: (row.programme as string) ?? null,
  joined: row.joined == null ? null : Number(row.joined),
  role: configRole(String(row.email)) ?? (row.role as Role)
});

// ---------- Codes ----------

function issueCode(purpose: "join" | "reset", email: string, payload: object) {
  const ticket = randomToken(18);
  const code = sixDigitCode();
  database()
    .prepare("insert into codes (ticket, purpose, email, code_hash, payload, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?)")
    .run(ticket, purpose, email, sha256(`${ticket}:${code}`), JSON.stringify(payload), Date.now() + CODE_LIFE, Date.now());
  return { ticket, code };
}

type CodeRow = { ticket: string; purpose: string; email: string; code_hash: string; payload: string; attempts: number; expires_at: number; verified_at: number | null; used_at: number | null };

const codeRow = (ticket: string, purpose: string) =>
  database().prepare("select * from codes where ticket = ? and purpose = ?").get(ticket, purpose) as CodeRow | undefined;

/** Checks a typed code against its ticket: five tries, fifteen minutes. */
export function checkCode(ticket: string, code: string, purpose: "join" | "reset"): Outcome {
  const row = codeRow(ticket, purpose);
  const wrong = { ok: false as const, error: "That code isn’t right. Check the email, or ask for a new one." };
  if (!row || row.used_at) return wrong;
  if (row.expires_at < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (row.attempts >= CODE_TRIES) return { ok: false, error: "Too many wrong codes. Ask for a new one." };
  database().prepare("update codes set attempts = attempts + 1 where ticket = ?").run(ticket);
  const typed = code.replace(/\D/g, "");
  // Demo mode only (ALUMNITY_DEMO_CODE in .env.local): that code also works, so a demo needs no inbox. Remove it after.
  const demo = process.env.ALUMNITY_DEMO_CODE?.replace(/\D/g, "");
  if (!(demo && demo.length >= 6 && typed === demo) && !sameHash(sha256(`${ticket}:${typed}`), row.code_hash)) return wrong;
  database().prepare("update codes set verified_at = ? where ticket = ?").run(Date.now(), ticket);
  return { ok: true };
}

/** A ticket whose code was right, recently, and hasn't been used yet. */
function verifiedTicket(ticket: string, purpose: "join" | "reset") {
  const row = codeRow(ticket, purpose);
  if (!row || row.used_at || !row.verified_at || row.verified_at + SETUP_LIFE < Date.now()) return null;
  return row;
}

// ---------- Sessions ----------

export function startSession(userId: number): { token: string; expires: Date } {
  const token = randomToken();
  const expires = Date.now() + SESSION_LIFE;
  database().prepare("insert into sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)").run(sha256(token), userId, expires, Date.now());
  return { token, expires: new Date(expires) };
}

export function userForSession(token: string | undefined): User | null {
  if (!token) return null;
  const db = database();
  const row = db
    .prepare(
      "select users.* from sessions join users on users.id = sessions.user_id where sessions.token_hash = ? and sessions.expires_at > ? and users.suspended_at is null"
    )
    .get(sha256(token), Date.now()) as Record<string, unknown> | undefined;
  return row ? toUser(row) : null;
}

export function endSession(token: string | undefined) {
  if (token) database().prepare("delete from sessions where token_hash = ?").run(sha256(token));
}

// ---------- Joining ----------

export type JoinStart = { name: string; usn?: string; branch?: string; year?: number; email: string; ip: string };

/** Step 1: the register check, again on the server, then a code to the email. */
export async function startJoin(input: JoinStart): Promise<Outcome<{ ticket: string }>> {
  if (!settings().joiningOpen) return { ok: false, error: "Joining is paused by the college for now. Please try again later." };
  const email = normaliseEmail(input.email);
  if (!looksLikeEmail(email)) return { ok: false, error: "That doesn’t look like an email address." };
  if (!withinLimit(`join:ip:${input.ip}`, 6, 60 * MINUTE) || !withinLimit(`join:email:${email}`, 3, 60 * MINUTE)) return { ok: false, error: SLOW_DOWN };

  const register = loadRegister();
  if (!register) return { ok: false, error: "The register isn’t reachable just now. Please try again in a little while." };
  const found = lookup(register, { name: input.name, usn: input.usn, branch: input.branch, year: input.year });
  if (found.status !== "found") return { ok: false, error: "We couldn’t find that line in the register." };

  const db = database();
  if (db.prepare("select 1 from users where usn = ?").get(found.usn)) {
    return { ok: false, error: "That line in the register already has an account. Log in, or reset your password if you’ve forgotten it." };
  }

  const taken = db.prepare("select name from users where email = ?").get(email) as { name: string } | undefined;
  if (taken) {
    // Don't tell the visitor; tell the owner. The visitor waits for a code that never comes.
    await sendMail({
      to: email,
      subject: "Someone tried to join Alumnity with your email",
      ...letter({
        greeting: `Hello ${taken.name.split(" ")[0]},`,
        lines: [
          "Someone just tried to join Alumnity using this email address. You already have an account, so nothing has changed.",
          "If it was you, just log in. If you’ve forgotten your password, use “Forgot your password?” on the log in page."
        ]
      })
    });
    return { ok: true, ticket: randomToken(18) };
  }

  const { ticket, code } = issueCode("join", email, { found, role: roleFor(found) });
  await sendMail({
    to: email,
    subject: `${code} is your Alumnity code`,
    ...letter({
      greeting: `Welcome, ${found.name.split(" ")[0]}.`,
      lines: [
        `You’re on HKBK College of Engineering’s register: ${found.branchName}, joined ${found.joined}.`,
        "Type this code on the Join page to confirm this is your email. It works for 15 minutes."
      ],
      code,
      footer: "If you didn’t ask to join Alumnity, ignore this email: nothing happens without the code."
    })
  });
  return { ok: true, ticket };
}

/** Step 3: choose a password, and the account exists (and you're signed in). */
export async function completeJoin(ticket: string, password: string): Promise<Outcome<{ token: string; expires: Date; user: User }>> {
  const row = verifiedTicket(ticket, "join");
  if (!row) return { ok: false, error: "This sign-up has expired. Please start again." };
  const { found, role } = JSON.parse(row.payload) as { found: Found; role: Role };
  const problem = passwordProblem(password, [found.name, ...found.name.split(" "), found.usn, row.email.split("@")[0]]);
  if (problem) return { ok: false, error: problem };

  const db = database();
  const hash = await hashPassword(password);
  try {
    db.prepare(
      "insert into users (email, password_hash, name, usn, branch, branch_name, programme, joined, role, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(row.email, hash, found.name, found.usn, found.branch, found.branchName, found.programme, found.joined, role, Date.now());
  } catch {
    // The USN or the email was taken while this sign-up was waiting.
    return { ok: false, error: "That line or that email already has an account. Log in instead." };
  }
  db.prepare("update codes set used_at = ? where ticket = ?").run(Date.now(), ticket);
  const user = toUser(db.prepare("select * from users where email = ?").get(row.email) as Record<string, unknown>);
  return { ok: true, user, ...startSession(user.id) };
}

// ---------- Logging in ----------

export async function logIn(emailInput: string, password: string, ip: string): Promise<Outcome<{ token: string; expires: Date; user: User }>> {
  const email = normaliseEmail(emailInput);
  if (!withinLimit(`login:ip:${ip}`, 20, 15 * MINUTE) || !withinLimit(`login:email:${email}`, 8, 15 * MINUTE)) return { ok: false, error: SLOW_DOWN };
  const row = database().prepare("select * from users where email = ?").get(email) as Record<string, unknown> | undefined;
  // Check a decoy when there's no such account, so a wrong email takes as long as a wrong password.
  const ok = await verifyPassword(password, row ? String(row.password_hash) : await decoyHash());
  if (!row || !ok) return { ok: false, error: "That email and password don’t match. Check them, or reset your password." };
  if (row.suspended_at) return { ok: false, error: "This account is paused by the college. Write to the alumni office to sort it out." };
  const user = toUser(row);
  return { ok: true, user, ...startSession(user.id) };
}

// ---------- Forgot password ----------

/** Always answers the same way, whether or not the email has an account. */
export async function startReset(emailInput: string, ip: string): Promise<Outcome<{ ticket: string }>> {
  const email = normaliseEmail(emailInput);
  if (!looksLikeEmail(email)) return { ok: false, error: "That doesn’t look like an email address." };
  if (!withinLimit(`reset:ip:${ip}`, 6, 60 * MINUTE) || !withinLimit(`reset:email:${email}`, 3, 60 * MINUTE)) return { ok: false, error: SLOW_DOWN };
  // Sample members (development only) can never be signed in to, so they can't be reset either.
  const user = database().prepare("select id, name from users where email = ? and sample = 0").get(email) as { id: number; name: string } | undefined;
  if (!user) return { ok: true, ticket: randomToken(18) };
  const { ticket, code } = issueCode("reset", email, { userId: user.id });
  await sendMail({
    to: email,
    subject: `${code} is your code to reset your Alumnity password`,
    ...letter({
      greeting: `Hello ${user.name.split(" ")[0]},`,
      lines: ["Type this code on the reset page, then choose a new password. It works for 15 minutes."],
      code,
      footer: "If you didn’t ask to reset your password, ignore this email: your password stays as it is."
    })
  });
  return { ok: true, ticket };
}

export async function completeReset(ticket: string, code: string, password: string): Promise<Outcome<{ token: string; expires: Date; user: User }>> {
  const checked = checkCode(ticket, code, "reset");
  if (!checked.ok) return checked;
  const row = verifiedTicket(ticket, "reset");
  if (!row) return { ok: false, error: "This reset has expired. Please start again." };
  const { userId } = JSON.parse(row.payload) as { userId: number };
  const db = database();
  const userRow = db.prepare("select * from users where id = ?").get(userId) as Record<string, unknown> | undefined;
  if (!userRow) return { ok: false, error: "This reset has expired. Please start again." };
  const user = toUser(userRow);
  const problem = passwordProblem(password, [user.name, ...user.name.split(" "), user.usn ?? "", user.email.split("@")[0]]);
  if (problem) {
    // Let them try another password with the same code.
    db.prepare("update codes set attempts = attempts - 1 where ticket = ?").run(ticket);
    return { ok: false, error: problem };
  }
  db.prepare("update users set password_hash = ? where id = ?").run(await hashPassword(password), userId);
  db.prepare("update codes set used_at = ? where ticket = ?").run(Date.now(), ticket);
  // A new password signs out every other browser.
  db.prepare("delete from sessions where user_id = ?").run(userId);
  return { ok: true, user, ...startSession(userId) };
}

// ---------- Settings ----------

/** A new password, with the current one as proof; other browsers are signed out, this one stays in. */
export async function changePassword(userId: number, current: string, next: string, keepToken: string): Promise<Outcome> {
  const db = database();
  const row = db.prepare("select * from users where id = ?").get(userId) as Record<string, unknown> | undefined;
  if (!row || !(await verifyPassword(current, String(row.password_hash)))) return { ok: false, error: "Your current password isn’t right." };
  const user = toUser(row);
  const problem = passwordProblem(next, [user.name, ...user.name.split(" "), user.usn ?? "", user.email.split("@")[0]]);
  if (problem) return { ok: false, error: problem };
  db.prepare("update users set password_hash = ? where id = ?").run(await hashPassword(next), userId);
  db.prepare("delete from sessions where user_id = ? and token_hash != ?").run(userId, sha256(keepToken));
  return { ok: true };
}

/** Signs out every browser but this one (a lost phone, a shared computer). */
export function endOtherSessions(userId: number, keepToken: string): Outcome<{ ended: number }> {
  const result = database().prepare("delete from sessions where user_id = ? and token_hash != ?").run(userId, sha256(keepToken));
  return { ok: true, ended: Number(result.changes) };
}

/** Deletes the account and everything that hangs off it (sessions, profile), with the password as proof. */
export async function deleteAccount(userId: number, password: string): Promise<Outcome> {
  const db = database();
  const row = db.prepare("select password_hash from users where id = ?").get(userId) as { password_hash: string } | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) return { ok: false, error: "That password isn’t right." };
  db.prepare("delete from users where id = ?").run(userId);
  return { ok: true };
}
