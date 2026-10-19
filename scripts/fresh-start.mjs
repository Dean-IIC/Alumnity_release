// A clean start for testing: deletes every account except the college's own, its
// administrators and the configured super admins, and ALL social data (posts, messages,
// stories, connections, groups, events, asks, notifications, uploads and their files…).
// Keeps the register, the showcase, settings, the audit log, causes, donations, payouts
// and staff invitations. The logic is lib/server/fresh-start.ts; the steps for the
// deployer are docs/fresh-start.md.
//
//   node --env-file=.env.production.local scripts/fresh-start.mjs                  dry run: prints what it would do, changes nothing
//   node --env-file=.env.production.local scripts/fresh-start.mjs --confirm-wipe   does it (asks you to type WIPE)
//
// Options:
//   --confirm-wipe   actually delete (without it: a dry run)
//   --yes            with --confirm-wipe: don't ask for WIPE (for a script that has already shown the dry run)
//   --local          the database is on this computer (PGlite folder or localhost); required for it, refused otherwise
//   --list-files     print every stored file's path, not just how many
//
// Needs (hosted): DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and the
// same ALUMNITY_SUPER_ADMINS (and ALUMNITY_ADMINS, if used) as the live site.

import { createInterface } from "node:readline/promises";
import { checkTarget, databaseTarget, filesUnder, localUploads, parseArgs, removeUnder, supabaseConfigured } from "./operator-common.mjs";

const fail = (message, code = 1) => {
  console.error(`\n${message}`);
  process.exit(code);
};

let flags;
try {
  flags = parseArgs(process.argv.slice(2), { "confirm-wipe": "flag", yes: "flag", local: "flag", "list-files": "flag" });
} catch (e) {
  fail(`${e.message}\nOptions: --confirm-wipe, --yes, --local, --list-files (see the top of scripts/fresh-start.mjs).`);
}
if (flags.yes && !flags["confirm-wipe"]) fail("--yes only goes with --confirm-wipe.");

let target;
try {
  target = databaseTarget();
  checkTarget(target, Boolean(flags.local));
} catch (e) {
  fail(e.message);
}

const { db } = await import("../lib/server/db.ts");
const fresh = await import("../lib/server/fresh-start.ts");
const rule = fresh.keepRuleFromEnv();
const real = Boolean(flags["confirm-wipe"]);

console.log(real ? "FRESH START: THIS DELETES DATA" : "Fresh start: DRY RUN (nothing is changed)");
console.log(`Database:      ${target.describe}`);

/** Auth users and stored files: Supabase's (hosted), or this computer's (--local). */
let services = null;
if (flags.local) {
  const folder = localUploads();
  console.log(`Auth:          local sign-ins (the local_auth table, if there is one)`);
  console.log(`Stored files:  ${folder}`);
  console.log("               (stop `npm run dev` first: two programs on one PGlite folder can corrupt it)");
  const hasLocalAuth = async () => Boolean((await db().one("select to_regclass('public.local_auth') as t"))?.t);
  services = {
    async deleteAuthUser(authId) {
      if (!(await hasLocalAuth())) return;
      await db().run("delete from local_sessions where auth_id = ?::uuid", authId);
      await db().run("delete from local_auth where auth_id = ?::uuid", authId);
    },
    listFiles: async () => filesUnder(folder),
    removeFiles: async (paths) => removeUnder(folder, paths)
  };
} else if (supabaseConfigured()) {
  const { supabaseAdmin, BUCKET } = await import("../lib/server/storage.ts");
  console.log(`Auth, files:   ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host} (bucket "${BUCKET}")`);
  const bucket = () => supabaseAdmin().storage.from(BUCKET);
  const listAll = async (prefix) => {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket().list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`Storage: ${error.message}`);
      for (const entry of data) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        // A folder has no id.
        if (entry.id === null || entry.id === undefined) out.push(...(await listAll(path)));
        else out.push(path);
      }
      if (data.length < 1000) return out;
    }
  };
  services = {
    async deleteAuthUser(authId) {
      const { error } = await supabaseAdmin().auth.admin.deleteUser(authId);
      // Already gone is what we wanted.
      if (error && !/not.?found/i.test(error.message)) throw new Error(error.message);
    },
    listFiles: () => listAll(""),
    async removeFiles(paths) {
      const { error } = await bucket().remove(paths);
      if (error) throw new Error(error.message);
      return [];
    }
  };
} else {
  console.log("Auth, files:   NOT CONFIGURED (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY aren't set)");
  if (real) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first: without them the Auth users and files can't be deleted.");
}
console.log(`Kept by email: ALUMNITY_SUPER_ADMINS: ${rule.superAdmins.join(", ") || "(none set)"}${rule.admins.length ? `; ALUMNITY_ADMINS: ${rule.admins.join(", ")}` : ""}`);
console.log("");

let plan;
try {
  plan = await fresh.planFreshStart(db(), services, rule);
} catch (e) {
  fail(`Couldn't read the database: ${e.message}`);
}
if (services && plan.files === null) console.log("(The stored files couldn't be listed: check the Supabase settings.)\n");
for (const line of fresh.describePlan(plan, { listFiles: Boolean(flags["list-files"]) })) console.log(line);
console.log("");

if (plan.blockers.length) fail("Stopped: see above. Nothing was changed.", 2);
if (!real) {
  console.log("That was a dry run: nothing was changed. To do it: add --confirm-wipe.");
  process.exit(0);
}

if (!flags.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`This deletes the above from ${target.describe}. There is no undo (only the backup). Type WIPE to go ahead: `);
  rl.close();
  if (answer.trim() !== "WIPE") fail("Not WIPE: stopped. Nothing was changed.");
}

try {
  const done = await fresh.runFreshStart(db(), services, rule, (line) => console.log(line));
  console.log("");
  console.log("Done:");
  for (const s of done.plan.steps) console.log(`  ${s.kind === "null" || s.kind === "reset" ? "changed" : "deleted"} ${String(s.rows).padStart(7)}  ${s.what}`);
  if (done.authFailed.length || done.filesFailed.length) console.log(`\n${done.authFailed.length} Auth users and ${done.filesFailed.length} files were left over (listed above). Harmless: nothing points at them.`);
  process.exit(0);
} catch (e) {
  if (e instanceof fresh.FreshStartAborted) fail(e.message, 2);
  fail(`Stopped: ${e.message}\nThe database transaction was rolled back: nothing in the database was changed, and no Auth users or files were deleted.`);
}
