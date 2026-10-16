# Deploying Alumnity: Supabase + Vercel

Alumnity runs on **Vercel** (the Next.js app) with **Supabase** behind it:

| Supabase part | What Alumnity uses it for | Code |
|---|---|---|
| Postgres | Everything members do (the schema is `supabase/migrations/`) | `lib/server/db.ts` |
| Auth | Passwords, the emailed 6-digit codes, sessions (cookies) | `lib/server/auth-provider.ts`, `middleware.ts` |
| Storage | Uploaded photos, videos and HTML covers (private bucket `media`) | `lib/server/storage.ts` |

The browser never talks to the database. Row-level security is on for every table, with
no policies, so Supabase's public API (the anon key) can read and write **nothing**. Only
the app's server, using `DATABASE_URL` and the service role key, touches data, and the rules
in `lib/server/` decide what each member may see and do.

## 1. Supabase project

1. Create a project (region: **Mumbai, ap-south-1**, closest to HKBK). Keep the database password somewhere safe.
2. **Apply the migrations**, in order (by file name): `supabase/migrations/20261015000001_alumnity.sql`,
   `20261015000002_storage.sql`, then `20261016000001_groups_causes_alerts.sql` (groups,
   causes and donations, alerts, photo sizes). Paste each into the SQL editor and run it,
   or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.
   Each is safe to run again. **If the first two are already applied, just run the third.**
3. **Check the bucket**: Storage should now have `media`, **private**, 25 MB file limit.

## 2. Supabase Auth settings

Authentication → Providers → **Email**: enabled. "Confirm email": on.
Email OTP length: **6**. Email OTP expiry: **900** seconds (15 minutes: the app says so).

Authentication → **Emails → Templates**. Alumnity types the code into its own pages; it
never uses magic links. Put the code in **both** templates:

- **Confirm signup** (sent when someone joins), e.g. subject `{{ .Token }} is your Alumnity code`:
  ```html
  <h2>Welcome to Alumnity</h2>
  <p>Type this code on the Join page to confirm this is your email. It works for 15 minutes.</p>
  <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
  <p>If you didn't ask to join Alumnity, ignore this email: nothing happens without the code.</p>
  ```
- **Magic Link** (sent for "Forgot your password?"), e.g. subject `{{ .Token }} is your code to reset your Alumnity password`:
  ```html
  <p>Type this code on the reset page, then choose a new password. It works for 15 minutes.</p>
  <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
  <p>If you didn't ask to reset your password, ignore this email: your password stays as it is.</p>
  ```

Authentication → Emails → **SMTP Settings**: set up **custom SMTP**. Supabase's own
mailer sends only a few emails an hour, which isn't enough for real sign-ups. For Google
Workspace: host `smtp.gmail.com`, port `465`, the sending address (e.g.
`alumni@hkbk.edu.in`), and an **app password** (Google Account → Security → App
passwords), not the account's password. Sender name: `Alumnity`.

Authentication → **URL Configuration**: Site URL = the production address (e.g.
`https://alumnity.hkbk.edu.in`). Add the Vercel preview domain under Redirect URLs if
previews should work.

Authentication → **Rate Limits**: the defaults are fine; Alumnity also limits tries itself.

## 3. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production, and
Preview if wanted). For local work, the same in `.env.local` (never committed). They are
secrets: don't paste them into chats, issues or commits.

| Name | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, `anon` / publishable key | public (RLS blocks it from all data) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` / secret key | **secret**, server only |
| `DATABASE_URL` | Project Settings → Database → Connection string → **Transaction pooler** (port 6543) | **secret**; the app sets `prepare: false` for the pooler |
| `ALUMNITY_SUPER_ADMINS` | comma-separated emails | super administrators (can't be removed from the site) |
| `ALUMNITY_ADMINS` | comma-separated emails | optional: administrators set in config |
| `DATABASE_POOL` | optional | connections per server instance (default 5) |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Account & Settings → API Keys | donations; `rzp_test_…` for test mode first |
| `RAZORPAY_KEY_SECRET` | same place (shown once when the key is made) | **secret** |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you choose when adding the webhook (step 7) | **secret** |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run `npx web-push generate-vapid-keys` once | phone notifications; the private one is **secret** |
| `VAPID_SUBJECT` | `mailto:alumni@hkbk.edu.in` | who push services can contact |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | the same mailbox as Supabase's SMTP (step 2) | the daily email digest; `SMTP_PASS` is **secret** |
| `CRON_SECRET` | any long random string | **secret**; Vercel Cron sends it to the daily digest |
| `ALUMNITY_SECRET` | any long random string | **secret**; signs the digest's "stop these emails" links |
| `SITE_URL` | the production address, e.g. `https://alumnity.hkbk.edu.in` | links in emails |
| `DIGEST_BATCH` | optional | most digest emails per day (default 150; Gmail Workspace allows ~2,000/day) |

Not for production: `ALUMNITY_DB`, `ALUMNITY_AUTH`, `ALUMNITY_STORAGE`, `ALUMNITY_UPLOADS`
(tests only).

## 4. The college register

The register (name, USN, branch, branch name, programme, joining year; ~9,300 lines) is
real student data. It is **never committed** and never sent to a browser. Load it into the
`register` table from the computer that has the CSV:

```bash
DATABASE_URL="<the Session pooler or direct connection string, port 5432>" node scripts/import-register.mjs data/college-records.csv
```

It replaces the whole table in one transaction. Run it again whenever the college sends a
new register. Until it's loaded, Join answers "the register isn't reachable".

## 5. Vercel

1. Import the Git repository; framework **Next.js**; root directory: this folder (`alpha-4`).
   Build command `next build`, install command `npm ci` (the defaults).
2. Add the environment variables (step 3), then deploy.
3. Region: Project Settings → Functions → **Mumbai (bom1)**, next to the database (each
   page makes a few database round trips, so distance matters).
4. Add the domain, and set it as the Supabase Site URL (step 2).

## 6. Scheduled job

`vercel.json` runs the daily digest (`/api/cron/digest`) at 09:00 India time, and pins the
functions to Mumbai (`bom1`). Vercel picks it up on deploy; set `CRON_SECRET` first.

## 7. Razorpay (donations)

1. In the college's Razorpay account, start with **Test mode** keys (`rzp_test_…`): set
   `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Vercel and try a gift with Razorpay's
   test cards/UPI. Switch to live keys when the college's account is activated.
2. Razorpay → Settings → **Webhooks** → Add: URL `https://<site>/api/razorpay/webhook`,
   events **payment.captured** and **order.paid**, a secret of your choosing → put the
   same value in `RAZORPAY_WEBHOOK_SECRET`. (Gifts count when the browser confirms or
   when this arrives, whichever is first; both are signature-checked.)
3. Without keys, giving shows "opens once the college has set up payments".

## 8. After the first deploy

1. Join with an email listed in `ALUMNITY_SUPER_ADMINS` (it must also be on the register),
   or join first and add the email afterwards: config roles apply at once.
2. Open `/desk`: Settings shows joining open and every feature on.
3. Try: join, log out, log in, forgot password, upload a profile photo, post with a photo,
   add a story, start a group and post in it, propose a cause and approve it from the
   desk, give ₹10 in Razorpay test mode, turn on notifications in Settings → Alerts.
4. **Before inviting members:** the college fills in `lib/legal.ts` (address, contact
   email, grievance officer) and has `/privacy` and `/terms` reviewed; until then both
   pages say they're drafts. Uploads go straight from the browser to Storage (Vercel limits request
   bodies to 4.5 MB) and are checked by the server before anyone can see them.

## How it fits together (for whoever maintains it)

- **Signing in.** Join: register check → `auth_intents` row → Supabase emails a code
  (`signInWithOtp`) → the code is verified (`verifyOtp`; the browser now has a Supabase
  session) → the password is set (`updateUser`) and the `users` row is made with that
  Supabase user id (`users.auth_id`). Log in: `signInWithPassword`, then the `users` row
  must exist and not be paused. `middleware.ts` refreshes sessions before each page.
- **Signed out everywhere** (the desk, a paused member): their Supabase sessions are deleted
  (`auth.sessions`) and `users.signed_out_at` is set, so an access token they still hold
  (valid up to an hour) is refused too.
- **Uploads.** `POST /api/media {step:"start"}` → a one-time signed upload URL → the browser
  PUTs the file → `{step:"finish"}`: the server reads it back, checks its real type and
  size, strips JPEG location data, and only then makes it a `media` row. Photos and videos
  are served by `/media/<id>` after a permission check, as a redirect to a one-hour signed
  link; HTML covers are always served by the app, sandboxed.
- **Working on this computer without Supabase**: `npm run dev` with a
  `.env.development.local` of `ALUMNITY_AUTH=local`, `ALUMNITY_DB=pglite:data/pglite`,
  `ALUMNITY_STORAGE=folder` (sign-in codes print in the dev server's output). Never in
  production: both refuse to run there.
- **Tests** run on PGlite (the same Postgres, in memory) with a stand-in for Supabase Auth:
  `npm test`. No network or Supabase project needed.
