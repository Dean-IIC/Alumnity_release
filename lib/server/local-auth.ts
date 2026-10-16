import { randomUUID } from "node:crypto";
import type { AuthProvider, AuthSession } from "./auth-provider";
import { db } from "./db";
import { hashPassword, randomToken, sha256, sixDigitCode, verifyPassword } from "./secrets";

/*
 * Signing in without Supabase, for working on this computer (`next dev` with
 * ALUMNITY_AUTH=local): accounts and sessions in the local database, the emailed code
 * printed in the server's output instead of sent. It refuses to run in production.
 *
 * It behaves like Supabase where the app can tell: one session per browser (a cookie),
 * codes that work once for fifteen minutes, sign-in times kept to the second.
 */

const COOKIE = "alumnity_local";
const CODE_LIFE = 15 * 60_000;
const SESSION_LIFE = 30 * 24 * 60 * 60_000;

let ready: Promise<void> | undefined;
const tables = () =>
  (ready ??= db().exec(`
    create table if not exists local_auth (
      email text primary key,
      auth_id uuid not null unique,
      password_hash text,
      code_hash text,
      code_expires bigint
    );
    create table if not exists local_sessions (
      token_hash text primary key,
      auth_id uuid not null,
      auth_at bigint not null,
      expires_at bigint not null
    );
  `));

async function jar() {
  const { cookies } = await import("next/headers");
  return cookies();
}

const toSecond = (ms: number) => Math.floor(ms / 1000) * 1000;

async function startSession(authId: string): Promise<AuthSession> {
  const token = randomToken();
  const authAt = toSecond(Date.now());
  await db().run("insert into local_sessions (token_hash, auth_id, auth_at, expires_at) values (?, ?::uuid, ?, ?)", sha256(token), authId, authAt, Date.now() + SESSION_LIFE);
  (await jar()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_LIFE / 1000 });
  return { authId, authAt };
}

async function currentToken() {
  return (await jar()).get(COOKIE)?.value;
}

export function localAuth(): AuthProvider {
  if (process.env.NODE_ENV === "production") throw new Error("Local sign-in is for development only.");
  return {
    async sendCode(email, create) {
      await tables();
      let row = await db().one<{ auth_id: string }>("select auth_id from local_auth where email = ?", email);
      if (!row && !create) return { ok: true };
      if (!row) {
        row = { auth_id: randomUUID() };
        await db().run("insert into local_auth (email, auth_id) values (?, ?::uuid)", email, row.auth_id);
      }
      const code = sixDigitCode();
      await db().run("update local_auth set code_hash = ?, code_expires = ? where email = ?", sha256(`${email}:${code}`), Date.now() + CODE_LIFE, email);
      console.log(`\n[alumnity] Code for ${email}: ${code}  (local sign-in: this is the email)\n`);
      return { ok: true };
    },
    async verifyCode(email, code) {
      await tables();
      const row = await db().one<{ auth_id: string; code_hash: string | null; code_expires: number | null }>("select * from local_auth where email = ?", email);
      if (!row?.code_hash || !row.code_expires || row.code_expires < Date.now() || row.code_hash !== sha256(`${email}:${code}`)) return null;
      await db().run("update local_auth set code_hash = null, code_expires = null where email = ?", email);
      return startSession(row.auth_id);
    },
    async signInWithPassword(email, password) {
      await tables();
      const row = await db().one<{ auth_id: string; password_hash: string | null }>("select auth_id, password_hash from local_auth where email = ?", email);
      if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) return null;
      return startSession(row.auth_id);
    },
    async session() {
      await tables();
      const token = await currentToken();
      if (!token) return null;
      const row = await db().one<{ auth_id: string; auth_at: number }>(
        "select auth_id, auth_at from local_sessions where token_hash = ? and expires_at > ?",
        sha256(token),
        Date.now()
      );
      return row ? { authId: row.auth_id, authAt: row.auth_at } : null;
    },
    async setPassword(password) {
      const s = await this.session();
      if (!s) return "Please log in again.";
      await db().run("update local_auth set password_hash = ? where auth_id = ?::uuid", await hashPassword(password), s.authId);
      return null;
    },
    async signOut(scope) {
      await tables();
      const token = await currentToken();
      if (!token) return;
      const s = await this.session();
      if (scope === "local" || !s) await db().run("delete from local_sessions where token_hash = ?", sha256(token));
      else if (scope === "others") await db().run("delete from local_sessions where auth_id = ?::uuid and token_hash != ?", s.authId, sha256(token));
      else await db().run("delete from local_sessions where auth_id = ?::uuid", s.authId);
      if (scope !== "others") (await jar()).delete(COOKIE);
    },
    async endSessionsOf(authId) {
      await tables();
      return db().run("delete from local_sessions where auth_id = ?::uuid", authId);
    },
    async sessionsOf(authId) {
      await tables();
      return (await db().one<{ n: number }>("select count(*) as n from local_sessions where auth_id = ?::uuid and expires_at > ?", authId, Date.now()))?.n ?? 0;
    },
    async deleteAccount(authId) {
      await tables();
      await db().run("delete from local_sessions where auth_id = ?::uuid", authId);
      await db().run("delete from local_auth where auth_id = ?::uuid", authId);
    }
  };
}
