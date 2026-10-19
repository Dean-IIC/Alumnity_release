import { BRANCHES } from "../branches";
import { authProvider, SAME_PASSWORD } from "./auth-provider";
import { intent, looksLikeEmail, newIntent, normaliseEmail, passwordContext, SLOW_DOWN, toUser, verify, type Outcome, type Role, type User } from "./auth";
import { catchUpIds, db } from "./db";
import { letter, sendMail } from "./mail";
import { assignable } from "./roles";
import { passwordProblem } from "./secrets";
import type { Result } from "./social";
import { withinLimit } from "./throttle";

/*
 * Staff: teachers, alumni coordinators and administrators aren't on the student register,
 * so they can't join by finding their line in it. The college desk invites them instead,
 * by email, with the role they'll have (only roles below the inviter's own). They join at
 * /join/staff: the invited email, a code sent to it, a password. An invitation lasts two
 * weeks and works once.
 */

const DAY = 24 * 60 * 60_000;
const INVITE_LIFE = 14 * DAY;
const SETUP_LIFE = 30 * 60_000;
const no = (error: string): Result => ({ ok: false, error });
export const STAFF_ROLES = ["faculty", "coordinator", "admin"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export type Invite = { email: string; name: string; role: StaffRole; branchName: string | null; createdAt: number; expiresAt: number; used: boolean };

const LABEL: Record<StaffRole, string> = { faculty: "a teacher (faculty)", coordinator: "an alumni coordinator", admin: "an administrator" };

const SENIOR_INVITE = "Someone with a higher role than yours invited this person. Only they can change or cancel this invitation.";

/** Whether an invitation still waiting for `email` is to a role `me` couldn't give (so isn't theirs to change or withdraw). */
async function outranked(me: User, email: string) {
  const open = await db().one<{ role: Role }>("select role from staff_invites where email = ? and used_at is null", email);
  return Boolean(open && !assignable(me).includes(open.role));
}

/** The desk invites a member of staff. */
export async function inviteStaff(me: User, input: { email: string; name: string; role: string; branch: string }, origin: string): Promise<Result> {
  const email = normaliseEmail(input.email);
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 100);
  const role = input.role as StaffRole;
  if (!looksLikeEmail(email)) return no("That doesn’t look like an email address.");
  if (name.length < 3) return no("Enter their full name, as members will see it.");
  if (!STAFF_ROLES.includes(role) || !assignable(me).includes(role as Role)) return no("You can invite people only to roles below your own.");
  const branch = BRANCHES.find(([code]) => code === input.branch);
  if (await db().one("select 1 from users where email = ?", email)) return no("That email already has an account. Change their role in Members instead.");
  if (await outranked(me, email)) return no(SENIOR_INVITE);
  if (!(await withinLimit(`invite:${me.id}`, 50, DAY))) return no("You have sent too many invitations today. Try again tomorrow.");
  const now = Date.now();
  await db().run(
    `insert into staff_invites (email, name, role, branch, branch_name, invited_by, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (email) do update set name = excluded.name, role = excluded.role, branch = excluded.branch, branch_name = excluded.branch_name,
       invited_by = excluded.invited_by, created_at = excluded.created_at, expires_at = excluded.expires_at, used_at = null`,
    email,
    name,
    role,
    branch?.[0] ?? null,
    branch?.[1] ?? null,
    me.id,
    now,
    now + INVITE_LIFE
  );
  const { audit } = await import("./desk");
  await audit(me, "invited staff", `invite ${email}`, `${name} as ${role}`);
  await sendMail({
    to: email,
    subject: `You're invited to Alumnity, HKBK College of Engineering's alumni network`,
    ...letter({
      greeting: `Dear ${name},`,
      lines: [
        `${me.name} has invited you to join Alumnity as ${LABEL[role]}.`,
        "Alumnity is where HKBK's students and alumni help each other. Seniors answer questions, and members join events and groups and stay in touch.",
        "Join with this email address. We'll send you a code to confirm it. The invitation works for two weeks."
      ],
      button: { text: "Join Alumnity", href: `${origin}/join/staff?email=${encodeURIComponent(email)}` },
      footer: "If you weren't expecting this email, you can ignore it. Nothing happens unless you join."
    })
  }).catch(() => false);
  return { ok: true };
}

export async function invites(me: User): Promise<Invite[]> {
  if (!assignable(me).includes("faculty")) return [];
  const rows = await db().all<{ email: string; name: string; role: StaffRole; branch_name: string | null; created_at: number; expires_at: number; used_at: number | null }>(
    "select * from staff_invites order by created_at desc limit 100"
  );
  return rows.map((r) => ({ email: r.email, name: r.name, role: r.role, branchName: r.branch_name, createdAt: r.created_at, expiresAt: r.expires_at, used: r.used_at !== null }));
}

export async function revokeInvite(me: User, email: string): Promise<Result> {
  if (!assignable(me).includes("faculty")) return no("Only the college desk can do that.");
  if (await outranked(me, normaliseEmail(email))) return no(SENIOR_INVITE);
  await db().run("delete from staff_invites where email = ? and used_at is null", normaliseEmail(email));
  return { ok: true };
}

type InviteRow = { email: string; name: string; role: StaffRole; branch: string | null; branch_name: string | null; expires_at: number; used_at: number | null };

const openInvite = (email: string) => db().one<InviteRow>("select * from staff_invites where email = ? and used_at is null and expires_at > ?", email, Date.now());

/** Step 1: an invited email gets a code. */
export async function startStaffJoin(emailInput: string, ip: string): Promise<Outcome<{ ticket: string; name: string }>> {
  const email = normaliseEmail(emailInput);
  if (!looksLikeEmail(email)) return { ok: false, error: "That doesn’t look like an email address." };
  if (!(await withinLimit(`staff-join:ip:${ip}`, 6, 60 * 60_000)) || !(await withinLimit(`staff-join:email:${email}`, 3, 60 * 60_000))) return { ok: false, error: SLOW_DOWN };
  const invite = await openInvite(email);
  if (!invite) return { ok: false, error: "We can't find a valid invitation for that email. Check that it's the email the college wrote to, or ask the alumni office to invite you again." };
  if (await db().one("select 1 from users where email = ?", email)) return { ok: false, error: "That email already has an account. Log in instead." };
  const ticket = await newIntent("staff", email, { role: invite.role });
  const sent = await (await authProvider()).sendCode(email, true);
  if (!sent.ok) return sent;
  return { ok: true, ticket, name: invite.name };
}

export async function checkStaffCode(ticket: string, code: string): Promise<Outcome> {
  const checked = await verify(await intent(ticket, "staff"), code);
  return checked.ok ? { ok: true } : checked;
}

/** Step 3: a password, and the staff account exists, with the role they were invited to. */
export async function completeStaffJoin(ticket: string, password: string): Promise<Outcome<{ user: User }>> {
  const row = await intent(ticket, "staff");
  const auth = await authProvider();
  const session = await auth.session();
  const invite = row && (await openInvite(row.email));
  if (!row?.verified_at || !invite || row.verified_at + SETUP_LIFE < Date.now() || !session || session.authId !== row.auth_id) {
    return { ok: false, error: "Your joining session has expired. Please start again." };
  }
  const problem = passwordProblem(password, passwordContext({ name: invite.name, usn: null, email: row.email }));
  if (problem) return { ok: false, error: problem };
  // On a retry the password may already be this one: that's the job half done, not a refusal.
  const refused = await auth.setPassword(password);
  if (refused && refused !== SAME_PASSWORD) return { ok: false, error: refused };
  // Anyone else holding a session on this sign-in goes: someone could have made the Supabase
  // account for this email before its owner joined, and kept a session on it.
  await auth.signOut("others");
  // The member and the used invitation, together: neither without the other.
  await catchUpIds("users");
  const member = await db().tx(async (t) => {
    const inserted = await t.one(
      "insert into users (auth_id, email, name, branch, branch_name, role, created_at) values (?::uuid, ?, ?, ?, ?, ?, ?) on conflict do nothing returning *",
      session.authId,
      row.email,
      invite.name,
      invite.branch,
      invite.branch_name,
      invite.role,
      Date.now()
    );
    // Already made for this very sign-in (an earlier try got this far): finish, don't refuse.
    const made = inserted ?? (await t.one("select * from users where auth_id = ?::uuid and email = ?", session.authId, row.email));
    if (made) await t.run("update staff_invites set used_at = ? where email = ?", Date.now(), row.email);
    return made;
  });
  await db().run("delete from auth_intents where ticket = ?", ticket);
  if (!member) {
    // Say which: a member with this email, or this sign-in already tied to another member
    // (seen live: refused with no member under this email). The server log names the rows.
    const clash = await db().all<{ id: number; email: string; same_login: boolean }>(
      "select id, email, auth_id = ?::uuid as same_login from users where auth_id = ?::uuid or lower(email) = lower(?)",
      session.authId,
      session.authId,
      row.email
    );
    console.error("staff join complete: no member made", { invited: row.email, authId: session.authId, clash });
    await auth.signOut("local");
    const byLogin = clash.find((c) => c.same_login && c.email.toLowerCase() !== row.email.toLowerCase());
    return {
      ok: false,
      error: byLogin
        ? "This login is already linked to another member's account. Please ask the college desk for help."
        : "That email already has an account. Log in instead."
    };
  }
  return { ok: true, user: toUser(member) };
}
