import type { Found } from "../register";
import { authProvider, SAME_PASSWORD } from "./auth-provider";
import { db } from "./db";
import { findInRegister } from "./register";
import { passwordProblem, randomToken } from "./secrets";
import { settings } from "./settings";
import { withinLimit } from "./throttle";
import { displayName } from "../format";

/*
 * Accounts. Joining: find your line in the register → we email a code → you choose a
 * password. One USN, one account. Logging in: email and password. Forgot your password:
 * we email a code → you choose a new one, and every other signed-in browser is signed out.
 *
 * Supabase Auth keeps the passwords, sends the codes and holds the sessions
 * (lib/server/auth-provider.ts); this file decides who may have an account, and which.
 *
 * Nothing here says whether an email address has an account (that's the person's own
 * business): joining with a taken email looks like any other start, and resetting always
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
/** A code works this long (as Supabase's email OTP expiry; see docs/deploy.md). */
const CODE_LIFE = 15 * MINUTE;
/** After the code is right, this long to choose a password. */
const SETUP_LIFE = 30 * MINUTE;
const CODE_TRIES = 5;

export const SLOW_DOWN = "That’s a lot of tries in a short time. Wait a few minutes and try again.";
const WRONG_CODE = "That code isn’t right. Check the email, or ask for a new one.";

export { toUser };

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;

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
  name: displayName(String(row.name)),
  usn: (row.usn as string) ?? null,
  branch: (row.branch as string) ?? null,
  branchName: (row.branch_name as string) ?? null,
  programme: (row.programme as string) ?? null,
  joined: row.joined == null ? null : Number(row.joined),
  role: configRole(String(row.email)) ?? (row.role as Role)
});

export const passwordContext = (u: { name: string; usn: string | null; email: string }) => [u.name, ...u.name.split(" "), u.usn ?? "", u.email.split("@")[0]];

// ---------- Who's signed in ----------

/**
 * The member signed in on this browser, or null: a Supabase session whose account is a
 * member here, not paused, and not signed out everywhere since they signed in.
 */
export async function signedInUser(): Promise<User | null> {
  const session = await (await authProvider()).session();
  if (!session) return null;
  const row = await db().one("select * from users where auth_id = ?::uuid and suspended_at is null", session.authId);
  if (!row) return null;
  // Sign-in times are kept to the second, so the sign-out is compared to the second too.
  if (row.signed_out_at != null && session.authAt < Math.floor(Number(row.signed_out_at) / 1000) * 1000) return null;
  // Seen today, to the hour (for the desk's numbers), without a write on every page.
  const now = Date.now();
  if (row.last_seen_at == null || now - Number(row.last_seen_at) > 60 * MINUTE) {
    const note = () => db().run("update users set last_seen_at = ? where id = ?", now, Number(row.id)).catch(() => 0);
    // After the page is sent, where the host allows it (it needn't hold the page up).
    try {
      const { after } = await import("next/server");
      after(note);
    } catch {
      await note();
    }
  }
  return toUser(row);
}

export async function logOut() {
  await (await authProvider()).signOut("local");
}

// ---------- Codes ----------

export type IntentRow = {
  ticket: string;
  purpose: "join" | "reset" | "staff";
  email: string;
  found: string | null;
  role: Role | null;
  attempts: number;
  auth_id: string | null;
  verified_at: number | null;
  expires_at: number;
};

export async function newIntent(purpose: "join" | "reset" | "staff", email: string, extra: { found?: Found; role?: Role } = {}) {
  const ticket = randomToken(18);
  const now = Date.now();
  await db().run("delete from auth_intents where expires_at < ? or (email = ? and purpose = ?)", now, email, purpose);
  await db().run(
    "insert into auth_intents (ticket, purpose, email, found, role, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?)",
    ticket,
    purpose,
    email,
    extra.found ? JSON.stringify(extra.found) : null,
    extra.role ?? null,
    now,
    now + CODE_LIFE
  );
  return ticket;
}

export const intent = (ticket: string, purpose: "join" | "reset" | "staff") =>
  ticket ? db().one<IntentRow>("select * from auth_intents where ticket = ? and purpose = ?", ticket, purpose) : Promise.resolve(undefined);

/** Checks a typed code: five tries, fifteen minutes. Right, and this browser is signed in to that Supabase account. */
export async function verify(row: IntentRow | undefined, code: string): Promise<Outcome<{ authId: string }>> {
  if (!row) return { ok: false, error: WRONG_CODE };
  if (row.expires_at < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (row.attempts >= CODE_TRIES) return { ok: false, error: "Too many wrong codes. Ask for a new one." };
  await db().run("update auth_intents set attempts = attempts + 1 where ticket = ?", row.ticket);
  const typed = code.replace(/\D/g, "");
  if (typed.length !== 6) return { ok: false, error: WRONG_CODE };
  const session = await (await authProvider()).verifyCode(row.email, typed);
  if (!session) return { ok: false, error: WRONG_CODE };
  await db().run("update auth_intents set verified_at = ?, auth_id = ?::uuid where ticket = ?", Date.now(), session.authId, row.ticket);
  return { ok: true, authId: session.authId };
}

// ---------- Joining ----------

export type JoinStart = { name: string; usn?: string; branch?: string; year?: number; email: string; ip: string };

/** Step 1: the register check, again on the server, then a code to the email. */
export async function startJoin(input: JoinStart): Promise<Outcome<{ ticket: string }>> {
  if (!(await settings()).joiningOpen) return { ok: false, error: "Joining is paused by the college for now. Please try again later." };
  const email = normaliseEmail(input.email);
  if (!looksLikeEmail(email)) return { ok: false, error: "That doesn’t look like an email address." };
  if (!(await withinLimit(`join:ip:${input.ip}`, 6, 60 * MINUTE)) || !(await withinLimit(`join:email:${email}`, 3, 60 * MINUTE))) return { ok: false, error: SLOW_DOWN };

  const found = await findInRegister({ name: input.name, usn: input.usn, branch: input.branch, year: input.year });
  if (!found) return { ok: false, error: "The register isn’t reachable just now. Please try again in a little while." };
  if (found.status !== "found") return { ok: false, error: "We couldn’t find that line in the register." };

  if (await db().one("select 1 from users where usn = ?", found.usn)) {
    return { ok: false, error: "That line in the register already has an account. Log in, or reset your password if you’ve forgotten it." };
  }
  // An email that already has an account: the visitor isn't told, and no code is sent,
  // so the ticket leads nowhere.
  if (await db().one("select 1 from users where email = ?", email)) return { ok: true, ticket: randomToken(18) };

  const ticket = await newIntent("join", email, { found, role: roleFor(found) });
  const sent = await (await authProvider()).sendCode(email, true);
  if (!sent.ok) return sent;
  return { ok: true, ticket };
}

/** Step 2: the emailed code. */
export async function checkJoinCode(ticket: string, code: string): Promise<Outcome> {
  const checked = await verify(await intent(ticket, "join"), code);
  return checked.ok ? { ok: true } : checked;
}

/** Step 3: choose a password, and the account exists (and you're signed in). */
export async function completeJoin(ticket: string, password: string): Promise<Outcome<{ user: User }>> {
  const row = await intent(ticket, "join");
  const auth = await authProvider();
  const session = await auth.session();
  if (!row?.verified_at || !row.found || row.verified_at + SETUP_LIFE < Date.now() || !session || session.authId !== row.auth_id) {
    return { ok: false, error: "This sign-up has expired. Please start again." };
  }
  const found = JSON.parse(row.found) as Found;
  const problem = passwordProblem(password, passwordContext({ name: found.name, usn: found.usn, email: row.email }));
  if (problem) return { ok: false, error: problem };
  // On a retry the password may already be this one: that's the job half done, not a refusal.
  const refused = await auth.setPassword(password);
  if (refused && refused !== SAME_PASSWORD) return { ok: false, error: refused };

  const fresh = await db().one(
    `insert into users (auth_id, email, name, usn, branch, branch_name, programme, joined, role, created_at)
     values (?::uuid, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict do nothing returning *`,
    session.authId,
    row.email,
    found.name,
    found.usn,
    found.branch,
    found.branchName,
    found.programme,
    found.joined,
    row.role,
    Date.now()
  );
  // Already made for this very sign-in (an earlier try got this far): finish, don't refuse.
  const inserted = fresh ?? (await db().one("select * from users where auth_id = ?::uuid and email = ?", session.authId, row.email));
  await db().run("delete from auth_intents where ticket = ?", ticket);
  if (!inserted) {
    // The USN or the email was taken while this sign-up was waiting.
    await auth.signOut("local");
    return { ok: false, error: "That line or that email already has an account. Log in instead." };
  }
  return { ok: true, user: toUser(inserted) };
}

// ---------- Logging in ----------

const NO_MATCH = "That email and password don’t match. Check them, or reset your password.";

export async function logIn(emailInput: string, password: string, ip: string): Promise<Outcome<{ user: User }>> {
  const email = normaliseEmail(emailInput);
  if (!(await withinLimit(`login:ip:${ip}`, 20, 15 * MINUTE)) || !(await withinLimit(`login:email:${email}`, 8, 15 * MINUTE))) return { ok: false, error: SLOW_DOWN };
  if (!password) return { ok: false, error: NO_MATCH };
  const auth = await authProvider();
  const session = await auth.signInWithPassword(email, password);
  if (!session) return { ok: false, error: NO_MATCH };
  const row = await db().one("select * from users where auth_id = ?::uuid", session.authId);
  // A Supabase account with no member behind it (a join never finished) isn't an account here.
  if (!row) {
    await auth.signOut("local");
    return { ok: false, error: NO_MATCH };
  }
  if (row.suspended_at) {
    await auth.signOut("local");
    return { ok: false, error: "This account is paused by the college. Write to the alumni office to sort it out." };
  }
  return { ok: true, user: toUser(row) };
}

// ---------- Forgot password ----------

/** Always answers the same way, whether or not the email has an account. */
export async function startReset(emailInput: string, ip: string): Promise<Outcome<{ ticket: string }>> {
  const email = normaliseEmail(emailInput);
  if (!looksLikeEmail(email)) return { ok: false, error: "That doesn’t look like an email address." };
  if (!(await withinLimit(`reset:ip:${ip}`, 6, 60 * MINUTE)) || !(await withinLimit(`reset:email:${email}`, 3, 60 * MINUTE))) return { ok: false, error: SLOW_DOWN };
  // Sample members (development only) have no account to sign in to, so they can't be reset either.
  const user = await db().one("select id from users where email = ? and auth_id is not null and sample = 0", email);
  if (!user) return { ok: true, ticket: randomToken(18) };
  const ticket = await newIntent("reset", email);
  const sent = await (await authProvider()).sendCode(email, false);
  if (!sent.ok) return sent;
  return { ok: true, ticket };
}

export async function completeReset(ticket: string, code: string, password: string): Promise<Outcome<{ user: User }>> {
  const row = await intent(ticket, "reset");
  const userRow = row && (await db().one("select * from users where email = ?", row.email));
  if (!row || !userRow) return { ok: false, error: WRONG_CODE };
  const user = toUser(userRow);
  // The password first: a code works once, so it isn't spent on a password that won't do.
  const problem = passwordProblem(password, passwordContext(user));
  if (problem) return { ok: false, error: problem };
  const checked = await verify(row, code);
  if (!checked.ok) return checked;
  const auth = await authProvider();
  if (checked.authId !== userRow.auth_id) {
    await auth.signOut("local");
    return { ok: false, error: "This reset has expired. Please start again." };
  }
  const refused = await auth.setPassword(password);
  if (refused) return { ok: false, error: refused };
  await db().run("delete from auth_intents where ticket = ?", ticket);
  // A new password signs out every other browser.
  await auth.signOut("others");
  if (userRow.suspended_at) {
    await auth.signOut("local");
    return { ok: false, error: "This account is paused by the college. Write to the alumni office to sort it out." };
  }
  return { ok: true, user };
}

// ---------- Settings ----------

/** A new password, with the current one as proof; other browsers are signed out, this one stays in. */
export async function changePassword(me: User, current: string, next: string): Promise<Outcome> {
  const auth = await authProvider();
  const row = await db().one<{ auth_id: string }>("select auth_id from users where id = ?", me.id);
  if (!(await withinLimit(`password:${me.id}`, 8, 15 * MINUTE))) return { ok: false, error: SLOW_DOWN };
  const proof = current ? await auth.signInWithPassword(me.email, current) : null;
  if (!row || !proof || proof.authId !== row.auth_id) return { ok: false, error: "Your current password isn’t right." };
  const problem = passwordProblem(next, passwordContext(me));
  if (problem) return { ok: false, error: problem };
  const refused = await auth.setPassword(next);
  if (refused) return { ok: false, error: refused };
  await auth.signOut("others");
  return { ok: true };
}

/** Signs out every browser but this one (a lost phone, a shared computer). */
export async function endOtherSessions(me: User): Promise<Outcome<{ ended: number }>> {
  const auth = await authProvider();
  const row = await db().one<{ auth_id: string }>("select auth_id from users where id = ?", me.id);
  const before = row ? await auth.sessionsOf(row.auth_id) : null;
  await auth.signOut("others");
  return { ok: true, ended: before === null ? 0 : Math.max(0, before - 1) };
}

/** Deletes the account and everything that hangs off it, with the password as proof. */
export async function deleteAccount(me: User, password: string): Promise<Outcome> {
  const auth = await authProvider();
  const row = await db().one<{ auth_id: string }>("select auth_id from users where id = ?", me.id);
  if (!(await withinLimit(`delete:${me.id}`, 5, 15 * MINUTE))) return { ok: false, error: SLOW_DOWN };
  const proof = password ? await auth.signInWithPassword(me.email, password) : null;
  if (!row || !proof || proof.authId !== row.auth_id) return { ok: false, error: "That password isn’t right." };
  await removeAccount(me.id);
  return { ok: true };
}

/** A member gone for good: their files, their row (everything they made cascades) and their Supabase account. */
export async function removeAccount(userId: number) {
  const row = await db().one<{ auth_id: string | null }>("select auth_id from users where id = ?", userId);
  const { removeMedia } = await import("./media");
  for (const m of await db().all<{ id: string }>("select id from media where user_id = ?", userId)) await removeMedia(userId, m.id);
  await db().run("delete from users where id = ?", userId);
  if (row?.auth_id) await (await authProvider()).deleteAccount(row.auth_id);
}

/** The college desk signs a member out everywhere: every session ends, and tokens still held are turned away. */
export async function signOutMember(userId: number): Promise<number | null> {
  const row = await db().one<{ auth_id: string | null }>("select auth_id from users where id = ?", userId);
  await db().run("update users set signed_out_at = ? where id = ?", Date.now(), userId);
  return row?.auth_id ? (await authProvider()).endSessionsOf(row.auth_id) : 0;
}

/** How many browsers a member is signed in on (null where that can't be told). */
export async function sessionCount(userId: number): Promise<number | null> {
  const row = await db().one<{ auth_id: string | null }>("select auth_id from users where id = ?", userId);
  return row?.auth_id ? (await authProvider()).sessionsOf(row.auth_id) : 0;
}
