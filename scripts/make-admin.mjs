// Makes one administrator sign-in on the hosted site (the operator's own account), with a
// strong random password written to a file OUTSIDE the repository. Nothing secret is printed.
// It's a super admin once its email is in ALUMNITY_SUPER_ADMINS (Vercel settings).
//
//   node scripts/make-admin.mjs <email> <display name> <file for the login>
//
// Needs: DATABASE_URL (session pooler), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { randomInt } from "node:crypto";
import { appendFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const [email, name, out] = process.argv.slice(2);
if (!email || !name || !out) throw new Error("usage: node scripts/make-admin.mjs <email> <display name> <file>");
for (const k of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!process.env[k]) throw new Error(`missing ${k}`);

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 30 });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).auth.admin;

// Letters (no look-alikes) and digits, 20 long, grouped in fours so it's easy to type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const raw = Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const password = raw.match(/.{4}/g).join("-");

const lower = email.trim().toLowerCase();
const [existing] = await sql`select id, role from users where lower(email) = ${lower}`;
if (existing) {
  console.log(`A member with this email already exists (#${existing.id}, ${existing.role}); nothing made.`);
  await sql.end();
  process.exit(0);
}
const [authRow] = await sql`select id::text as id from auth.users where lower(email) = ${lower}`;
let authId = authRow?.id;
if (authId) {
  const { error } = await admin.updateUserById(authId, { password, email_confirm: true });
  if (error) throw new Error(error.message);
} else {
  const { data, error } = await admin.createUser({ email: lower, password, email_confirm: true });
  if (error) throw new Error(error.message);
  authId = data.user.id;
}
const [row] = await sql`insert into users (auth_id, email, name, usn, branch, branch_name, programme, joined, role, created_at)
  values (${authId}::uuid, ${lower}, ${name}, null, null, null, null, null, 'admin', ${Date.now()}) returning id`;
if (!existsSync(out)) appendFileSync(out, "# Alumnity admin login. Keep private; don't paste it into chats or commit it.\n", { mode: 0o600 });
appendFileSync(out, `site: https://alumni.hkbkce.in/login\nemail: ${lower}\npassword: ${password}\n(made ${new Date().toISOString()})\n`, { mode: 0o600 });
console.log(`made: member #${row.id}, role admin; login saved to the file.`);
await sql.end();
