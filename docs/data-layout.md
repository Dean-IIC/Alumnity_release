# Where Alumnity's data lives

Four kinds of data, kept apart so each can be backed up, changed and reasoned about on
its own.

| Kind | What it is | Where it lives | Who changes it |
|---|---|---|---|
| 1. College records | The college's register of students: everyone enrolled, joined Alumnity or not. Added to every year. | Postgres schema **`records`**: `records.register` | `scripts/import-register.mjs` (from the college's CSV, never committed). Offline: loaded once from `data/college-records.csv`. |
| 2. The college's showcase | What the public pages show off: gallery albums, photos and videos; the college's own words (the director's letter, the About and Community opening words, the committee); notices on members' Home. | Postgres schema **`site`**: `site.albums`, `site.album_parts`, `site.photos`, `site.videos`, `site.pages`, `site.announcements` (and `site.seeds`, which one-time seeds have run). Photo files: the repo's `public/assets/gallery` for the first albums; the public Storage bucket **`site`** for photos added from the desk (offline: `data/site-files/`). | The college desk (coordinators and up): `/desk?tab=showcase`, and the Announcements tab. Every change is in the audit log. |
| 3. The social side | Members and everything they do: users, pages, posts, messages, groups, events, asks, donations, the audit log... | Postgres schema **`public`**. Members' uploads: the private Storage bucket **`media`** (offline: `data/uploads/`). | Members, under the rules in `lib/server/`. |
| 4. Site assets | Logos, icons, the intro video, the first gallery photos. | The repo's `public/` folder. | Developers, with a deploy. |

Notes:

- Every table, in every schema, has row-level security on with no policies: Supabase's
  public API reads and writes nothing. Only the app's server (`DATABASE_URL`) does.
- The register is never sent to a browser, and USNs are never shown anywhere. MBA lines
  (branch `GEN`) stay in `records.register` but are left out of every count, list, search
  and join (`LEFT_OUT` in `lib/server/register.ts`).
- The `site` bucket is public because the gallery is public. Photos reach it only after the
  server has checked them and made its own copies (1600 px, and 640 px for the grid); while
  they wait to be checked they sit in the private `media` bucket under `site-pending/`.
- Pages fall back to the words in the code (`lib/about-content.ts`, via `lib/site-pages.ts`)
  if their row is missing or can't be read, so they never go blank.
- The gallery's videos are links (YouTube, Instagram...), kept in `site.videos`. The desk
  doesn't edit those yet; add or change one with SQL if needed.
- `lib/gallery-photos.json`, `lib/gallery-videos.json` and `lib/gallery-video-posters.json`
  are no longer read by the app: they are the record the first albums were loaded from
  (`supabase/migrations/20261019220002_site_seed.sql`), and what `scripts/make-gallery.py`
  and `scripts/fetch-video-posters.py` write when bundling photos into the repo.

## Deploying this change (October 2026: the `records` and `site` schemas)

No new environment variables in production. (Offline only, optional: `ALUMNITY_SITE_FILES`,
the folder for desk-added gallery photos; default `data/site-files`.)

1. **Back up first.** Supabase → Database → Backups (or `pg_dump` the database). The
   migrations move two tables; a backup makes that reversible.
2. **Run the four new migrations, in filename order**, after every earlier one (with the
   Supabase CLI, `supabase db push`; or paste each into the SQL editor and run it):
   1. `20261019220000_records_register.sql`: makes schema `records` and moves
      `public.register` into it (its indexes, row-level security and id counter go with it).
   2. `20261019220001_site_showcase.sql`: makes schema `site`, its gallery and pages tables,
      and moves `public.announcements` into it.
   3. `20261019220002_site_seed.sql`: loads today's 11 albums (72 photos, 3 videos) and the
      six pages' words, once.
   4. `20261019220003_site_storage.sql`: makes the public bucket `site` (Supabase only).
   Each is safe to run again. The moves never drop a table that has rows: if both
   `public.register` and `records.register` exist and the public one has rows, the
   migration stops with an error and changes nothing (the same for announcements).
3. **Check the bucket**: Storage → `site`, **public**, 20 MB limit. If the migration
   couldn't make it (no rights on `storage.buckets`), make it by hand with those settings.
4. **Deploy the code straight after** (or run the migrations straight after the deploy goes
   live). The old code reads `public.register` and `public.announcements`; the new code
   reads `records.*` and `site.*`. Between the two, joining, People's register search, the
   landing page and the gallery fail, so do it at a quiet time and keep the gap to a minute.
5. **Check**: `/gallery` shows 11 albums and 72 photos; `/about` shows the director's
   letter; `/desk?tab=showcase` lists the albums and pages; Join still finds a register line.

To undo (before anyone has used the desk's Showcase tab): restore the backup, or move the
tables back (`alter table records.register set schema public; alter table
site.announcements set schema public;`) and deploy the previous code.
