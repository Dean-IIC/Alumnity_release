# A clean start for testing

Two operator scripts, run by the deployer from a checkout of this repository:

| Script | What it does |
|---|---|
| `scripts/fresh-start.mjs` | Deletes every account except the college's own, its administrators and the super admins, and **all** social data (posts, messages, stories, connections, follows, blocks, notifications, asks, groups, events, reports, alerts, uploads and their files). Keeps the college's things. Dry run unless told otherwise. |
| `scripts/make-test-accounts.mjs` | Makes 13 test accounts (3 students, 3 alumni, 3 faculty, 3 college desk admins, 1 super admin) with strong random passwords, written to a file **outside** the repository. Never prints a password. |

The logic is in `lib/server/fresh-start.ts` and `lib/server/test-accounts.ts` (tested in
`tests/fresh-start.test.ts` and `tests/test-accounts.test.ts`).

## What is kept, what goes

**Kept, never deleted:** the college register, the showcase (`announcements`, and anything
in the `records` and `site` schemas), `settings`, `audit`, `causes`, `donations`,
`cause_payouts`, `staff_invites`; and these accounts: the college's own
(`college_account = 1`), every administrator (role `admin`), and every email in
`ALUMNITY_SUPER_ADMINS` (and `ALUMNITY_ADMINS`, if set).

**Deleted:** every other account (its `users` row, its profile, its Supabase Auth user) and,
from everyone including kept accounts, everything social: `posts` and all that hangs off them
(`post_cheers`, `post_comments`, `post_media`, `post_tags`, reposts), `messages`
(`message_hidden`, `chat_cleared`), `stories` (`story_views`), `connections`, `follows`,
`blocks`, `notifications`, `asks` (`ask_routes`, `ask_messages`), `groups`
(`group_members`), `events` (`rsvps`), `reports`, `push_subscriptions`, `member_prefs`,
`auth_intents`, `throttle`, `media`, `uploads`, and every file in the Storage bucket `media`.

Because every upload goes, kept accounts' pages lose their photo, cover and pinned post, and
causes lose their cover photo (the cause itself stays).

**Foreign keys** are read from the database, not listed by hand. A kept table whose column
points at a removed account has that column set to null (a donation stays, with no donor;
an audit line stays, with no actor). If such a column can't be null, the script **stops
before changing anything** and says which. Any other table pointing at a removed account
loses those rows. The whole database part is one transaction: all of it, or none. Only
after it commits are the Auth users and stored files deleted; one that fails is listed and
is a harmless leftover.

## Before you start

- **Node 24** (22.18 or later also works). The scripts are plain `.mjs` files that load the
  app's `.ts` files directly (Node strips the types); there's no build step and no extra
  package. Run `npm ci` once, and run every command from this folder (the one with
  `package.json`).
- **The settings, in a file that git ignores.** Make `.env.production.local` here (any
  `.env.*` file is ignored by git), with the live site's values:

  ```
  DATABASE_URL=<Supabase → Project Settings → Database → Session pooler (port 5432) connection string>
  NEXT_PUBLIC_SUPABASE_URL=<the Project URL>
  SUPABASE_SERVICE_ROLE_KEY=<the service_role / secret key>
  ALUMNITY_SUPER_ADMINS=<exactly as on Vercel>
  ALUMNITY_ADMINS=<exactly as on Vercel, if it's set there>
  ```

  `vercel env pull .env.production.local --environment=production` fetches them, but values
  marked Sensitive come back empty: fill those in by hand. `ALUMNITY_DB` must **not** be set.
  The scripts print the database host and Supabase project before doing anything, and refuse
  a `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` from different projects.
- Each command below starts `node --env-file=.env.production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.
  (Without the last part Node prints a harmless warning that the `.ts` files have no module
  type.)

## The steps, in order

### 1. A full backup of the database

From any computer with `pg_dump` 17 (the same major version as the Supabase database, or
newer), using the **direct or Session pooler** connection string (port 5432):

```bash
pg_dump "<connection string>" --format=custom --file="../alumnity-before-fresh-start-$(date +%Y-%m-%d).dump"
```

Check the file isn't tiny. This includes the `auth` schema (sign-ins) and the register.
Keep it outside the repository: it holds members' personal data. The files in Storage
aren't in it; if they matter, copy the bucket first (Supabase CLI:
`supabase storage cp -r ss:///media ../media-backup --experimental`).

(To restore, if ever needed: `pg_restore --clean --if-exists --no-owner --dbname="<connection string>" <file>`.)

### 2. Migrations

Apply any file in `supabase/migrations/` not yet run on the live database, in order of file
name (see `docs/deploy.md`, step 1.2): Supabase SQL editor, or `supabase db push`. Each is
safe to run again.

### 3. Fresh start: the dry run, then the real thing

```bash
node --env-file=.env.production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/fresh-start.mjs
```

This changes **nothing**. It prints:

- the database host and Supabase project it's looking at, and the emails in `ALUMNITY_SUPER_ADMINS`;
- **Accounts kept**: each with why (`college account`, `role admin`, `in ALUMNITY_SUPER_ADMINS`);
- **Accounts to delete**: how many of each role, then each one's id, role and email;
- **Database rows**: per table, how many rows would be deleted (`every row` for the social
  tables; `rows whose user_id is a removed account` for profiles) or changed (`→ null` in
  kept tables);
- **Stored files to delete**: how many (`--list-files` prints each path);
- if it would stop, **IT WOULD STOP, CHANGING NOTHING** and why.

Read it. Check that every account that must stay is under "Accounts kept" (Rumaan's and the
college's). If someone is missing, add their email to `ALUMNITY_SUPER_ADMINS` (Vercel and the
file above) and run the dry run again. Then:

```bash
node --env-file=.env.production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/fresh-start.mjs --confirm-wipe
```

It prints the same plan and asks you to type `WIPE`. (`--yes` skips the question; only for
a run you've already checked.) It then prints what it did. Running the dry run again
afterwards should show nothing left to delete.

### 4. The test accounts

```bash
node --env-file=.env.production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/make-test-accounts.mjs
```

It makes `tester01@alumnity.test` … `tester13@alumnity.test` (`--domain <name>` for another
domain: use one nobody receives mail at, since these addresses are made up; `.test` never
does) and writes their logins to `../test-accounts-<date>.txt`, next to this folder (the
path is printed; `--out <file>` for another place, never inside the repository), one line
each: `role | name | email | password`. The console shows only `made` / `exists` per
account, never a password.

| Emails | Accounts | Role |
|---|---|---|
| tester01–03 | Test Student 1–3 (CSE 2024, CSE 2024, ECE 2023) | student |
| tester04–06 | Test Alumnus 1–3 (CSE 2012, CSE 2012, MECH 2015) | alumnus |
| tester07–09 | Test Faculty 1–3 (departments CSE, ISE, ECE; no batch) | faculty |
| tester10–12 | Test Desk 1–3 (no branch or batch) | admin (the college desk) |
| tester13 | Test Super Admin | admin, until step 5 |

They're ordinary accounts (not linked to the register, not "sample", so they find each
other in People and suggestions); what marks them is the address and the "Test …" names.
An account that already exists is skipped (`exists`), so running it twice is safe; its
password stays the one in the earlier file. If Supabase refuses an address, rerun with
`--domain` and another made-up domain.

### 5. Make the super admin a super admin

The super admin isn't a stored role. On **Vercel → Project → Settings → Environment
Variables → `ALUMNITY_SUPER_ADMINS`** (Production), add `tester13@alumnity.test`
(comma-separated with the emails already there; don't remove them), then **redeploy**.
The script prints this reminder with the exact email.

### 6. Hand over the logins

Give Rumaan the `test-accounts-<date>.txt` file privately (not in a chat, an issue or a
commit), then delete your copy.

## Trying it on this computer

With the local setup of `docs/deploy.md` (`ALUMNITY_DB=pglite:data/pglite`,
`ALUMNITY_AUTH=local`, `ALUMNITY_STORAGE=folder` in `.env.development.local`). **Stop
`npm run dev` first**: two programs on one PGlite folder can corrupt it.

```bash
node --env-file=.env.development.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/make-test-accounts.mjs --local
node --env-file=.env.development.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/fresh-start.mjs --local
node --env-file=.env.development.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/fresh-start.mjs --local --confirm-wipe
```

`--local` is required for a database on this computer (a PGlite folder, or a `DATABASE_URL`
on localhost) and refused for any other: neither script can reach the live site by
mistake with it, nor the local one without it. Locally the sign-ins are the dev server's own
(`local_auth`), and the files are `data/uploads` (or `ALUMNITY_UPLOADS`).
