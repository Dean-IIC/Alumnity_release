# Security review — 19 Oct 2026

What was tested, what was found, what was fixed, and what's left. The owner asked for "expert
cyber security tests on the db and site so it's safe: people cannot post DROP TABLE, mess with
donation amounts from the client side, and all that". Everything was tested on this computer
only: the code, tests with an in-memory database, and a production build run on port 3017 with
a throwaway database. No live site, no real accounts.

## In short

The site was already built carefully: every query takes values as parameters, every action
checks who's signed in and what they may do on the server, donations are decided and verified
on the server, uploads are checked by their bytes, and the database is closed to Supabase's
public API. The review found **one real hole worth worrying about** (a member could break pages
for everyone with one odd character in their profile) and a handful of smaller ones. All of
them are fixed, and each is locked in by a test that fails if it reopens.

## What was found

| # | Issue | Severity | Where | Fixed? |
|---|-------|----------|-------|--------|
| 1 | A NUL character ("\u0000") or half an emoji (a lone surrogate) saved in a profile is stored as JSON text that Postgres then refuses to read as `jsonb`. Every query that reads profiles as jsonb failed: Home and People for anyone who'd see that member, the member's own pages, the desk's numbers, "mentors for you", and **every new Ask for everyone** (the routing query reads all mentors' profiles). One member, one save, a lasting outage. Found by the live attack run. | **High** (stored denial of service by any member) | `lib/server/profile.ts` `saveProfile` | Yes: text is cleaned as it's stored (`storedProfile`). Test: `security-sql` "a NUL or half an emoji…" |
| 2 | Supabase's session cookies were readable by the page's scripts (`@supabase/ssr` defaults to `httpOnly: false`) and not explicitly HTTPS-only. Any script that got onto a page could carry a session away. | Medium | `lib/server/auth-provider.ts`, `middleware.ts` | Yes: `lib/session-cookies.ts` — HttpOnly, SameSite=Lax, Secure in production. Test: `security-config` |
| 3 | An upload could be bigger than the size it asked for: the signed upload link takes anything up to the bucket's 25 MB, so a "1 byte" start followed by a big file slipped past the 200 MB/day limit. | Medium-low | `lib/server/media.ts` `finishUpload` | Yes: refused when bytes > size asked for. Test: `security-uploads` |
| 4 | A NUL character anywhere (a post, a message, a search, a login) made the query fail: a server error instead of the words. | Low | `lib/server/db.ts` | Yes: dropped from every value, in one place. Test: `security-sql` |
| 5 | The Razorpay webhook counted a signed `payment.captured` with **no amount** without checking the amount, and didn't check the currency. (Only Razorpay can sign, so this needed Razorpay to misbehave.) Malformed JSON after a valid signature was a server error. | Low | `app/api/razorpay/webhook/route.ts` | Yes: amount must be a number equal to the order's, currency INR, bad JSON → 400. Test: `security-donations` |
| 6 | Amounts were read with `Number()`, so "0x10" was ₹16 and "1e5" ₹1,00,000 (for gifts, goals and payouts). Not exploitable (the server still decided, and limits held) but surprising. | Low | `lib/server/causes.ts` | Yes: digits with up to two decimals only. Test: `security-donations` |
| 7 | An `Origin: null` (or any non-URL Origin) on an account or upload endpoint threw: a 500 instead of a 403. | Low | `lib/server/http.ts` | Yes. Tests: `security-config`, `security-uploads` |
| 8 | Local sign-in (`ALUMNITY_AUTH=local`) in a production build trusted the `Host` header alone: someone on the same network could send `Host: localhost`. It also had no guard against being switched on on Vercel by mistake. | Low (needs a misconfigured or LAN-exposed local build) | `lib/server/local-auth.ts`, `lib/server/auth-provider.ts`, `lib/server/dev-only.ts` | Yes: the request must really come from this computer (forwarding headers read as for the dev tools), and never when `VERCEL` is set. Tests: `security-config`; live: a login via the LAN address got no session |
| 9 | No HSTS header. (Vercel adds its own on its domains; a custom domain should still say it.) | Low | `next.config.ts` | Yes, in production. Test: `security-config`; live: header present |
| 10 | The alumni card's crest, when it can't be read from disk, was fetched from the request's own Host header and then kept for every later card. | Low | `lib/server/alumni-card.ts` | Yes: `SITE_URL` first, 5 s timeout |
| 11 | Profile saves had no rate limit. | Low | `app/api/profile/route.ts` | Yes: 60 an hour |

## What was tested, and how it came out

### SQL injection (`tests/security-sql.test.ts`, live run)
Every SQL call in `lib/` and `app/` was scanned: all user input goes in as `?` parameters; the
only things built into SQL text are placeholders, fixed column/clause strings and the fixed
`IN_NETWORK` branch list. LIKE searches strip `% _ \`. Payloads (`'; drop table users; --`,
`' or '1'='1`, `%`, `_`, `\`, `$1`, `?`, unicode/RTL, `<script>`, 200,000-character strings, NUL)
were posted, commented, messaged, searched (feed, people, groups, desk, register, register-check),
saved in profiles and used as login emails: all stored or searched as plain text, every table
intact, long text cut to its limit (posts 2,000, comments 500, messages 2,000).

### Who may do what (`tests/security-access.test.ts`)
Refused, with nothing changed: editing/deleting someone else's post, comment or message;
reading another pair's messages; reporting a message not sent to you; reading, reacting,
commenting, reposting, sending or asking for a referral on a connections-only or batch post you
can't see (and its photos via /media); posting someone else's upload (post, story, cause cover,
profile photo); a private group's posts, members and comments for outsiders and for pending
askers; joining as anything but a plain member; letting yourself in, promoting yourself, editing
or closing someone's group; every desk button for an ordinary member (pause, sign out, roles,
delete, take down, restore, reports, settings, announcements, causes, payouts, invites, verify,
events); each desk role acting on equals or above; someone else's Ask thread, answer or close;
cancelling another's event, reading its attendees; deleting another's story, its viewers, its
media outside the author's circle; closing or giving to someone else's pending cause. Blocked
members can't message, connect, follow, see pages/posts, comment, mention or notify each other.
The server actions were also called straight with forged ids and wrong types, signed out and
as an attacker.

### Donations (`tests/security-donations.test.ts`)
Amounts `-500`, `0`, `9`, `9.99`, `-0`, `NaN`, `Infinity`, `1e9`, `500001`, `1,00,00,000`, `abc`,
`100 OR 1=1`, `0x10` are refused before any order is made; `10.99` becomes ₹10; orders are always
INR, made by the server. Giving to a pending, ended or closed cause is refused. A gift counts
only with Checkout's HMAC over `order|payment` with the key secret, for the donor's own order;
forged, upper-cased, padded, wrong-payment, other-order and "stand-in" signatures fail. The
webhook needs its own secret's HMAC over the exact body; changed bodies, wrong/absent amounts,
USD, `authorized`/`failed`, `payment.failed` and unknown orders don't count; replays count once.
The development stand-in is off in production. Only `markPaid` ever writes `status = 'paid'`
(a source scan in the test keeps it that way).

### XSS (`tests/security-xss.test.tsx`, live run)
Posts, comments, mentions, reposts and a whole profile page were drawn to HTML with
`<script>`, `<img onerror>`, `<svg onload>`, `javascript:` links, `<iframe>`, `<style>`, and a
member *named* `<img src=x onerror=…>`: all text, no live tag, no event handler, no
`javascript:`/`data:` href. Only `app/layout.tsx` uses `dangerouslySetInnerHTML` (the two fixed
theme/intro scripts). Profile and section links, and event links, must be http(s); notification
links must be paths on the site; message links are http(s) or Alumnity's own pages. Emails
escape everything; CSV exports neutralise `= + - @`; calendar files escape new lines.

### Uploads (`tests/security-uploads.test.ts`, live run)
Type comes from the first bytes. SVG and HTML are only accepted as a cover, and are served with
`sandbox allow-scripts` (no same-origin), `default-src 'none'`, `frame-ancestors` our own origin,
and `nosniff`; programs, PDFs, zips, text are refused; a `GIF89a<script>` polyglot is served as
`image/gif` with `default-src 'none'; sandbox` and `nosniff`. JPEG, PNG and WebP lose their EXIF
(camera, GPS) — sharp redraws them. Sizes: 0, negative, NaN, ∞, fractions, 1e20 and over-limit
refused; the day's limit holds; a bigger file than asked for is refused. Paths: `../`, `..\`,
absolute, encoded, NUL and over-long ids reach nothing; the local PUT endpoint writes only to the
place it gave out, for its own member, from this site.

### Configuration (`tests/security-config.test.ts`)
Every table in every schema has row-level security on, with **no policies** and no grants to
`anon`/`authenticated` in any migration; the storage bucket is private. Production headers: CSP
with `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, no
`unsafe-eval`; `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; no
`X-Powered-By`. Local sign-in: never in production (except a local build with
`ALUMNITY_LOCAL_PROD=1`), never on Vercel. The fake auth is test-only. Dev tools refuse tunnels,
other hosts and network addresses. Cron and health need the secret; health is off by default;
the stop-emails link needs its HMAC. Only `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` are public; no
client file reads a server secret; no keys in the code; `.env*` and data are git-ignored.
The git history of `dev` was searched for keys too: none.

### Live run against a local production build (port 3017, throwaway PGlite)
Three made-up members joined through the real flow (local sign-in, a made-up register), then
**100 of 101 checks passed** (the one miss was the script's own way of finding member ids):

- Headers as above on `/`; session cookie `HttpOnly; SameSite=Lax; Path=/`.
- Signed out: member pages send you to log in and show nothing (they stream, so status 200 with
  a redirect in the page); `/api/pulse`, `/api/alerts`, `/api/people/suggest`, `/media/…`,
  `/me/card`, the CSVs, `.ics`, profile save → 401.
- `/dev/seed`, `/lab`, `/api/health` → 404; cron without the secret → 401; `/.env`, `/.git/config`,
  `/package.json`, migrations, the PGlite folder, `/_next/../`, `%2e%2e` → 404.
- An ordinary member on `/desk`, its tabs and member pages gets "not found" and no desk data; the
  CSVs 404.
- CSRF: login, profile save, logout, upload from another Origin, no Origin, `Origin: null` or a
  look-alike host → 403; a plain-form (text/plain) login → 415. A server action posted from
  another site with the victim's cookie → refused by Next (500) and changed nothing; the same
  call from this site worked, so the origin check was what stopped it.
- Webhook: unsigned, forged, altered → 401; genuine-for-no-order → 200, nothing recorded; signed
  non-JSON → 400; a 6 MB unsigned body → 401, server fine.
- An 8 MB profile body saved but cut to 600 characters; a NUL and a lone surrogate saved and
  **Home, the member's page, People, the desk and Ask a senior all still worked** (before the fix
  the first live run turned all of these into 500s); 100,000-deep JSON → 400.
- Injection payloads in people, feed and group search, suggest and register-check: all 200, no
  errors, no email or USN leaked; injection login refused; a real login still worked after.
- `javascript:` website refused; a stored `<script>` profile drawn as text.
- Upload bigger than asked → 413; SVG as a photo refused; SVG cover served sandboxed; PUT into
  another's upload and every path traversal → 404.
- No other member's email or USN anywhere in the pages or payloads a member gets.
- Logout kills the session; a session id planted before login is replaced (no fixation).
- Local sign-in through the machine's network address (claiming `Host: localhost`) gets no session.
- Password guessing slowed after 8 tries per account; register lookups limited to 8 per 10
  minutes per address.
- None of the 172 files sent to browsers contains a secret or a secret's name.

### Dependencies
`npm audit --omit=dev`: 0 vulnerabilities (and 0 including dev dependencies).

## What remains, and what to do about it

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| A Supabase access token (JWT) stays valid for up to an hour after logout, a password change or "sign out other devices": Supabase ends the refresh token, but the server only checks the JWT's signature. (The desk's "sign out everywhere" *is* immediate: `users.signed_out_at`.) With cookies now HttpOnly, stealing one is much harder. | Low-medium | Shorten the JWT expiry in Supabase (Auth → Sessions, e.g. 10–15 min), or check `auth.sessions` for the token's `session_id` in `signedInUser` (one more query per page). |
| The CSP allows `'unsafe-inline'` scripts (Next streams inline scripts; nonces would make every page dynamic). XSS defence rests on React's escaping, which the tests above lock in. | Low | If ever needed: nonce-based CSP via middleware. Also consider adding `img-src`/`connect-src`/`frame-src` once the Razorpay and Supabase hosts are listed. |
| An HTML/SVG cover runs in a sandbox with no network, but it can navigate its own frame to another site (a fake "log in" inside the cover area). | Low | Consider dropping HTML covers, or serving them from a separate domain, or a visible "made by this member" frame. |
| Photos sharp can't decode are kept as uploaded (only a JPEG's EXIF is stripped then). They're served as images with `nosniff`, so not run; but a PNG/WebP's metadata stays. | Low | Refuse images sharp can't read, if that doesn't hurt real phone uploads. |
| Per-address limits trust `x-vercel-forwarded-for` first, then `x-forwarded-for`. On Vercel that's right; behind any other proxy, an attacker can rotate addresses (per-email limits still hold). | Low | Keep it on Vercel; elsewhere, trust only the proxy's header. |
| Members may page through the register's names (120 pages × 50 an hour, by design) and look a not-yet-joined person up by exact USN (120 an hour). No USN is ever returned. | Low (by design) | If that's more than wanted: require name + USN for an exact lookup. |
| Joining says when a register line already has an account; the staff join says whether an email has an invitation. Emails of members are never revealed. | Low (by design) | — |
| Member pages answer 200 (with a redirect or "not found" inside) rather than 307/404, because they stream. No data is sent. | Info | — |
| `next dev` through a tunnel would expose local sign-in and the pretend payments (dev tools themselves refuse tunnels). | Info | Never tunnel `next dev` for testers; tunnel a production build if needed. |
| Supabase's own Auth endpoints are reachable with the anon key (anyone can ask Supabase to sign up or send a code). A Supabase account with no member row is nobody here, so it can do nothing. | Info | Keep Supabase's Auth rate limits on; consider its CAPTCHA. |

## Checklist for whoever deploys

1. **RLS on the live database** (SQL editor):
   ```sql
   -- must return no rows
   select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r','p') and not c.relrowsecurity
     and n.nspname not in ('pg_catalog','information_schema','auth','storage','realtime','supabase_functions','vault','graphql','graphql_public','net','extensions','pgsodium','supabase_migrations','cron')
     and n.nspname not like 'pg_%';
   -- must return no rows for our schemas
   select * from pg_policies where schemaname not in ('auth','storage','realtime');
   ```
   New schemas (e.g. `records`, `site`) must have RLS on every table too, and should **not** be
   added to Supabase's "Exposed schemas" (API settings).
2. **Storage**: bucket `media` private, no storage policies for it.
3. **Profiles with a NUL saved before this fix** (would still break jsonb reads):
   ```sql
   select user_id from profiles where position('\u0000' in data) > 0;  -- review, then re-save or clean
   ```
4. **Secrets set in Vercel (Production), never `NEXT_PUBLIC_`**: `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (the same
   secret as in Razorpay → Webhooks, events `payment.captured` and `order.paid`), `CRON_SECRET`,
   `ALUMNITY_SECRET`, SMTP and VAPID keys. Live Razorpay keys only after a test-mode run.
   Razorpay **auto-capture** on (a confirmed payment should be a captured one).
5. **Never set on Vercel**: `ALUMNITY_AUTH`, `ALUMNITY_LOCAL_PROD`, `ALUMNITY_DB`,
   `ALUMNITY_STORAGE`, `ALUMNITY_HEALTH` (unless looking into speed, then off again).
6. **`SITE_URL`** set to the real address (staff invitation links and the card's crest use it).
7. **HTTPS only**, custom domain included; after the first deploy, check a page's headers show
   `Strict-Transport-Security`, and that `sb-…` cookies show `HttpOnly; Secure; SameSite=Lax`.
8. Supabase Auth: email OTP expiry 15 min, minimum password length ≥ 10 (Alumnity asks for 10),
   rate limits on; consider a shorter JWT expiry (see above).
