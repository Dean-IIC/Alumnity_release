import { randomUUID } from "node:crypto";
import { db } from "./db";

/** What setPassword says when the password is already this one (on a join, a retry: fine). */
export const SAME_PASSWORD = "That’s your current password. Choose a new one.";

/*
 * Who's signed in, and the emailed codes and passwords that get them there: Supabase
 * Auth. Supabase keeps the passwords (hashed), sends the codes, and keeps each browser's
 * session in cookies that refresh themselves (see middleware.ts). Alumnity's own `users`
 * table says who that account is on the register, and what they may do.
 *
 * Everything goes through this small interface, so the tests can use a stand-in with no
 * network (ALUMNITY_AUTH=fake).
 */

export type AuthSession = {
  /** The Supabase Auth user id. */
  authId: string;
  /** When they last proved who they are (a password, a code), in ms: a refreshed session keeps it. */
  authAt: number;
};

export type AuthProvider = {
  /** Emails a six-digit code. `create`: a new account may be made for it (joining). */
  sendCode(email: string, create: boolean): Promise<{ ok: true } | { ok: false; error: string }>;
  /** The code is right: this browser is now signed in to that account. */
  verifyCode(email: string, code: string): Promise<AuthSession | null>;
  /** The password is right: this browser is now signed in. */
  signInWithPassword(email: string, password: string): Promise<AuthSession | null>;
  /** This browser's session, if any. */
  session(): Promise<AuthSession | null>;
  /** A new password for whoever is signed in on this browser. */
  setPassword(password: string): Promise<string | null>;
  /** Signs out this browser, every other one, or all of them. */
  signOut(scope: "local" | "others" | "global"): Promise<void>;
  /** Administration, for any account. */
  endSessionsOf(authId: string): Promise<number | null>;
  sessionsOf(authId: string): Promise<number | null>;
  deleteAccount(authId: string): Promise<void>;
};

// ---------- Supabase ----------

const SUPABASE_ERRORS: [RegExp, string][] = [
  [/rate limit|too many|security purposes/i, "That’s a lot of tries in a short time. Wait a few minutes and try again."],
  [/signups? not allowed|not allowed for otp/i, "We couldn’t send a code to that address."]
];

function friendly(message: string) {
  return SUPABASE_ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? "We couldn’t send the code just now. Please try again in a minute.";
}

/** When the session's sign-in happened: the newest "amr" entry (a refresh doesn't change it). */
function authTime(claims: Record<string, unknown>): number {
  const amr = Array.isArray(claims.amr) ? (claims.amr as { timestamp?: number }[]) : [];
  const latest = Math.max(0, ...amr.map((a) => Number(a.timestamp) || 0));
  return (latest || Number(claims.iat) || 0) * 1000;
}

async function supabaseProvider(): Promise<AuthProvider> {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const { supabaseAdmin } = await import("./storage");

  const client = async () => {
    const jar = await cookies();
    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) jar.set(name, value, options);
          } catch {
            // A server component can't set cookies; middleware.ts refreshes them instead.
          }
        }
      }
    });
  };

  const fromUser = (user: { id: string } | null | undefined): AuthSession | null => (user ? { authId: user.id, authAt: Date.now() } : null);

  return {
    async sendCode(email, create) {
      const { error } = await (await client()).auth.signInWithOtp({ email, options: { shouldCreateUser: create } });
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    },
    async verifyCode(email, code) {
      const { data, error } = await (await client()).auth.verifyOtp({ email, token: code, type: "email" });
      return error ? null : fromUser(data.user);
    },
    async signInWithPassword(email, password) {
      const { data, error } = await (await client()).auth.signInWithPassword({ email, password });
      return error ? null : fromUser(data.user);
    },
    async session() {
      // Checked against Supabase's signing keys (not just read from the cookie).
      const { data, error } = await (await client()).auth.getClaims();
      if (error || !data?.claims?.sub) return null;
      return { authId: String(data.claims.sub), authAt: authTime(data.claims as Record<string, unknown>) };
    },
    async setPassword(password) {
      const { error } = await (await client()).auth.updateUser({ password });
      if (!error) return null;
      if (/same/i.test(error.message)) return SAME_PASSWORD;
      // Supabase's own rule (letters, digits, symbols…) in its own words, rather than a guess.
      console.error("setPassword refused:", error.message);
      return /password/i.test(error.message) ? `That password can’t be used: ${error.message.replace(/^Password\s*/i, "")}` : "That password can’t be used. Try a longer one.";
    },
    async signOut(scope) {
      await (await client()).auth.signOut({ scope });
    },
    // Ends every session of another member (the college desk): their refresh tokens go, and
    // users.signed_out_at turns away the access tokens they still hold (see currentUser).
    async endSessionsOf(authId) {
      try {
        return await db().run("delete from auth.sessions where user_id = ?::uuid", authId);
      } catch {
        return null;
      }
    },
    async sessionsOf(authId) {
      try {
        return (await db().one<{ n: number }>("select count(*) as n from auth.sessions where user_id = ?::uuid and (not_after is null or not_after > now())", authId))?.n ?? 0;
      } catch {
        return null;
      }
    },
    async deleteAccount(authId) {
      await supabaseAdmin().auth.admin.deleteUser(authId);
    }
  };
}

// ---------- A stand-in, for the tests ----------

type FakeAccount = { authId: string; password: string | null; code: string | null };

/** The tests' Supabase: accounts, codes and browsers in memory. */
export class FakeAuth implements AuthProvider {
  accounts = new Map<string, FakeAccount>();
  /** Each "browser" and who's signed in on it. */
  browsers = new Map<string, AuthSession | null>();
  browser = "main";
  sent: { email: string; code: string }[] = [];

  /** Switch to another browser (its own cookies). */
  use(name: string) {
    this.browser = name;
    return this;
  }
  lastCode(email: string) {
    return this.sent.filter((s) => s.email === email).at(-1)?.code;
  }
  private signIn(account: FakeAccount): AuthSession {
    // To the second, as Supabase records it.
    const session = { authId: account.authId, authAt: Math.floor(Date.now() / 1000) * 1000 };
    this.browsers.set(this.browser, session);
    return session;
  }
  private current() {
    return this.browsers.get(this.browser) ?? null;
  }

  async sendCode(email: string, create: boolean) {
    let account = this.accounts.get(email);
    if (!account && !create) return { ok: true as const }; // Supabase answers the same way
    if (!account) this.accounts.set(email, (account = { authId: randomUUID(), password: null, code: null }));
    account.code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    this.sent.push({ email, code: account.code });
    return { ok: true as const };
  }
  async verifyCode(email: string, code: string) {
    const account = this.accounts.get(email);
    if (!account?.code || account.code !== code) return null;
    account.code = null;
    return this.signIn(account);
  }
  async signInWithPassword(email: string, password: string) {
    const account = this.accounts.get(email);
    return account?.password && account.password === password ? this.signIn(account) : null;
  }
  async session() {
    const s = this.current();
    return s && [...this.accounts.values()].some((a) => a.authId === s.authId) ? s : null;
  }
  async setPassword(password: string) {
    const s = this.current();
    const account = [...this.accounts.values()].find((a) => a.authId === s?.authId);
    if (!account) return "Please log in again.";
    if (account.password === password) return "That’s your current password. Choose a new one.";
    account.password = password;
    return null;
  }
  async signOut(scope: "local" | "others" | "global") {
    const s = this.current();
    if (!s) return;
    for (const [name, other] of this.browsers) {
      if (other?.authId !== s.authId) continue;
      if (scope === "global" || (scope === "local" && name === this.browser) || (scope === "others" && name !== this.browser)) this.browsers.set(name, null);
    }
  }
  async endSessionsOf(authId: string) {
    let n = 0;
    for (const [name, s] of this.browsers) if (s?.authId === authId) (this.browsers.set(name, null), n++);
    return n;
  }
  async sessionsOf(authId: string) {
    return [...this.browsers.values()].filter((s) => s?.authId === authId).length;
  }
  async deleteAccount(authId: string) {
    for (const [email, a] of this.accounts) if (a.authId === authId) this.accounts.delete(email);
    await this.endSessionsOf(authId);
  }
}

let provider: Promise<AuthProvider> | undefined;

export function authProvider(): Promise<AuthProvider> {
  // The stand-in is for the tests only: it has one shared "browser", so on a real server
  // everyone would be the same person.
  const fake = process.env.ALUMNITY_AUTH === "fake" && process.env.NODE_ENV === "test";
  // Working on this computer without Supabase (never in production): see lib/server/local-auth.ts.
  // A production build on this computer may use it too, to test it as it runs on Vercel
  // (ALUMNITY_LOCAL_PROD=1); local-auth.ts then refuses any request not from localhost.
  const local = process.env.ALUMNITY_AUTH === "local" && (process.env.NODE_ENV !== "production" || process.env.ALUMNITY_LOCAL_PROD === "1");
  return (provider ??= fake ? Promise.resolve(new FakeAuth()) : local ? import("./local-auth").then((m) => m.localAuth()) : supabaseProvider());
}

/** For tests: the stand-in, to read its codes and switch browsers. */
export async function fakeAuth(): Promise<FakeAuth> {
  const p = await authProvider();
  if (!(p instanceof FakeAuth)) throw new Error("Not the fake auth provider");
  return p;
}
