// Makes the 13 test accounts (3 students, 3 alumni, 3 faculty, 3 college desk admins,
// 1 super admin), each with a strong random password, and writes the logins to a file
// OUTSIDE the repository. Passwords are never printed. Accounts that already exist (by
// email) are skipped. The logic is lib/server/test-accounts.ts; the steps for the deployer
// are docs/fresh-start.md.
//
//   node --env-file=.env.production.local scripts/make-test-accounts.mjs
//
// Options:
//   --domain <name>  the addresses' domain (default alumnity.test: tester01@alumnity.test … tester13@…)
//   --out <file>     where the logins go (default ../test-accounts-<date>.txt, next to this checkout); never inside it
//   --local          the local dev database (PGlite folder or localhost) with ALUMNITY_AUTH=local sign-ins
//
// Needs (hosted): DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkTarget, databaseTarget, insideRepo, parseArgs, repoRoot, supabaseConfigured } from "./operator-common.mjs";

const fail = (message, code = 1) => {
  console.error(`\n${message}`);
  process.exit(code);
};

let flags;
try {
  flags = parseArgs(process.argv.slice(2), { domain: "value", out: "value", local: "flag" });
} catch (e) {
  fail(`${e.message}\nOptions: --domain <name>, --out <file>, --local (see the top of scripts/make-test-accounts.mjs).`);
}

let target;
try {
  target = databaseTarget();
  checkTarget(target, Boolean(flags.local));
} catch (e) {
  fail(e.message);
}

const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const out = resolve(flags.out ?? resolve(repoRoot, "..", `test-accounts-${date}.txt`));
if (insideRepo(out)) fail(`${out} is inside this checkout: the passwords must never be where git could commit them. Choose a path outside it.`);

const { db } = await import("../lib/server/db.ts");
const tests = await import("../lib/server/test-accounts.ts");
let accounts;
try {
  accounts = tests.testAccounts(flags.domain);
} catch (e) {
  fail(e.message);
}

console.log("Test accounts");
console.log(`Database:  ${target.describe}`);

/** Makes the sign-in: Supabase Auth (hosted), or the local sign-ins table (--local). */
let maker;
if (flags.local) {
  if (process.env.ALUMNITY_AUTH !== "local") console.log("Note:      ALUMNITY_AUTH isn't \"local\" here: these sign-ins work with the dev server's local sign-in (ALUMNITY_AUTH=local).");
  console.log("Auth:      local sign-ins (the local_auth table); stop `npm run dev` first if it uses this PGlite folder");
  const { hashPassword } = await import("../lib/server/secrets.ts");
  // The same table lib/server/local-auth.ts makes.
  await db().exec(`
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
  `);
  maker = {
    async create(email, password) {
      const hash = await hashPassword(password);
      const row = await db().one("select auth_id::text as auth_id from local_auth where email = ?", email);
      if (row) {
        await db().run("update local_auth set password_hash = ? where email = ?", hash, email);
        return row.auth_id;
      }
      const authId = randomUUID();
      await db().run("insert into local_auth (email, auth_id, password_hash) values (?, ?::uuid, ?)", email, authId, hash);
      return authId;
    }
  };
} else {
  if (!supabaseConfigured()) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the accounts' sign-ins are made in Supabase Auth).");
  const { supabaseAdmin } = await import("../lib/server/storage.ts");
  console.log(`Auth:      ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host}`);
  maker = {
    async create(email, password) {
      const admin = supabaseAdmin().auth.admin;
      const { data, error } = await admin.createUser({ email, password, email_confirm: true });
      if (!error && data?.user) return data.user.id;
      // A sign-in left by an earlier run that stopped before its member row: give it this password.
      if (error && (error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message))) {
        const row = await db().one("select id::text as id from auth.users where lower(email) = ?", email);
        if (!row) throw new Error("Supabase says this email already has a sign-in, but it can't be found in auth.users");
        const again = await admin.updateUserById(row.id, { password, email_confirm: true });
        if (again.error) throw new Error(again.error.message);
        return row.id;
      }
      throw new Error(error?.message ?? "Supabase made no user");
    }
  };
}
console.log(`Logins:    ${out}`);
console.log("");

let header = !existsSync(out);
const saveLogin = (line) => {
  if (header) {
    appendFileSync(out, `# Alumnity test accounts (made ${new Date().toISOString()} on ${target.describe})\n# role | name | email | password\n`, { mode: 0o600 });
    header = false;
  }
  appendFileSync(out, `${line}\n`, { mode: 0o600 });
};

const result = await tests.makeTestAccounts(db(), maker, { domain: flags.domain, saveLogin, log: (line) => console.log(line) });
const superAdmin = accounts.find((a) => a.kind === "superadmin");

console.log("");
console.log(`${result.made.length} made, ${result.existed.length} already there, ${result.failed.length} failed.`);
if (result.made.length) console.log(`Their logins (passwords included) are in ${out}. Give that file to Rumaan privately; don't commit it or paste it into a chat.`);
if (result.existed.length) console.log("Accounts that were already there keep their passwords (not in this file): see an earlier test-accounts file.");
console.log("");
console.log(`SUPER ADMIN: ${superAdmin.email} is stored as an administrator. To make it the super admin, add it to the`);
console.log(`environment variable ALUMNITY_SUPER_ADMINS ${flags.local ? "(in .env.development.local)" : "on Vercel (Production)"}, comma-separated with any already there, and ${flags.local ? "restart the dev server" : "redeploy"}.`);
process.exit(result.failed.length ? 1 : 0);
