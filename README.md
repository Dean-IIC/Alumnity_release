# Alumnity

The alumni and student network for **HKBK College of Engineering**, Bengaluru.

A student makes a specific Ask, it reaches the seniors who can actually answer it, one of them backs it, they talk, both sign the outcome, and it lands on that senior's Record. The college sees what is answered and what is not.

## How it is built

| Piece | What it does |
|---|---|
| Next.js (App Router) | The site. Server components, server actions, route handlers. |
| Supabase Postgres | Everything members do. The schema is `supabase/migrations/`. |
| Supabase Auth | Passwords, the emailed 6-digit codes, sessions (cookies). |
| Supabase Storage | Uploaded photos and videos, in a **private** bucket, served through the app after a permission check. |
| Vercel | Hosting. Functions are pinned to Mumbai (`bom1`), next to the database. |

The browser never talks to the database. Row-level security is on for every table with no policies, so Supabase's public API can read and write **nothing**; only the app's server touches data, and the rules in `lib/server/` decide what each member may see.

## Running it

```bash
npm ci
cp .env.example .env.local     # then fill it in - see docs/deploy.md
npm run dev
```

`docs/deploy.md` is the full runbook: the Supabase project, the migrations in order, the Auth settings, every environment variable, the college register, and the scheduled job.

```bash
npm test          # database and unit tests, on PGlite in memory
npm run typecheck
npm run lint
npm run build
```

The tests need no network and no Supabase project.

## The college register

Joining means finding your line in the college's own register of students. It is real data about real people, so it is **never committed** and never sent to a browser. Load it into the `records.register` table from the machine that holds the CSV (where each kind of data lives: [docs/data-layout.md](docs/data-layout.md)):

```bash
DATABASE_URL="<direct or session connection string, port 5432>" \
  node scripts/import-register.mjs data/college-records.csv
```

Until it is loaded, Join answers "the register isn't reachable".

## Where things are

```
app/            pages and route handlers
components/     the interface
lib/server/     everything that decides what a member may see and do
supabase/       the schema, and the storage bucket
scripts/        the register importer, and the intro video recorder
tests/          database, unit and browser tests
docs/           the runbook, the design system, the architecture
```

## Images that belong to the college

`public/college/` holds HKBK College of Engineering's own logo and the photos of its chairman, director and principal, copied from hkbkce.in with the team's OK (19 Oct 2026) for this alumni network, which is the college's. They are the college's, not this project's; replace them from hkbkce.in if the college updates them.
