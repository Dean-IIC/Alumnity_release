# Alumnity · Alpha 4

Started 12 Oct 2026. Fresh codebase, fresh schema, fresh visual language.

The thesis survives. Almost nothing else does.

---

## 1. Why alpha 3 failed

Alpha 3 had the best strategy in the repo — *"ask a senior, back a junior"* — and the
worst execution. It read its own lesson about alpha 1 ("an attendance register: rigid
forms, data entry, no flow") and then shipped a **ledger**: beige paper, a serif on
everything, hairline rows, tabular figures, one accent, and **zero photographs**. The
design expressed the *college's records office* for a product whose core moment is a
**person helping a person**.

Two features also broke the rules in its own §6:

| Shipped | Shape it actually is |
|---|---|
| **Roles** ("I'm hiring" + HOD shortlist + stamped hires) | A jobs board. The LinkedIn mechanic, renamed. |
| **Rooms** (composer, Poll/Event, "Appreciate") | A WhatsApp group. |

What alpha 4 keeps: the thesis, the anti-clone rules (**enforced, not aspirational**),
the alpha 2 load-test lessons, the Record + honour-letter mechanic, and the security
architecture (RLS, deny-by-default) which is expensive, hard-won work.

What alpha 4 drops: the whole visual layer, Rooms, Roles.

## 2. The one constraint that decides the design

**Profile photos exist for 231 of 7,034 members — 3.3%.**

Alpha 3's asset library claimed "36 real alumni portraits." They are mostly coloured
initial tiles; one is a photograph of a temple idol, pulled by a broken media scraper.
There is no face archive and there never was.

So: **no face wall.** Not as a compromise — it is the better design, and Mam rejected
the face wall anyway ("too many people"). Human presence in alpha 4 is carried
**typographically**: real names, real roles, real employers, real cities, and a
`backed N juniors` count that does the work a headshot would do.

The photographs we *do* have are excellent and real: 25 campus shots and 13 event
banners from the old portal, including a golden-hour avenue. Those carry the place.

## 3. Data — what is real

Everything below is extracted from the college's own records. No invented people.

| File | Rows | What it is |
|---|---|---|
| `data/college-records.csv` | **9,327** | Official passout register. name · USN · branch · year · programme, 1998–2023, from the Department of Examination spreadsheet. **This is the verification backbone** — you cannot join without matching a row here. |
| `data/directory.csv` | **7,034** | The portal's own admin directory export. name · branch · grad year · employer · title · city · LinkedIn · photo. |
| `data/cohort-summary.json` | — | Branch and year counts. |
| `data/directory-summary.json` | — | Employers, cities, coverage. |

Join rate: **46.2%** of directory members match a passout record (562 by USN, 2,685 by
name) — the portal only populates USN for 8.6% of members, so name matching does most
of the work.

### The shape of the college, from real numbers

- **6,439 alumni, 442 students, 153 faculty.** Founded 2001.
- **68% of alumni are in Bengaluru** (4,804 of 7,034). Then Noida, Riyadh, Mumbai, Hyderabad.
- Branch: CSE 1,742 · ECE 706 · ISE 542 · MECH 539 · EEE 189 · CIVIL 171 · AIML 56.
- Top employers: Accenture 59 · TCS 53 · Capgemini 49 · Infosys 43 · **Amazon 38** ·
  Cognizant 35 · IBM 28 · DXC 25 · HP 18.
- **231 have a photo (3.3%). Email 44%. LinkedIn 91%. City 85%.**

> **Reachability consequence:** outreach for seeding must be **LinkedIn-first**. Email
> reaches under half. Roughly 3 in 10 records have no direct contact route at all.

### A legal flag

`hkbk-alumni-v3/webscraping/linkedin/` holds a LinkedIn scrape with per-profile
folders and a `students.csv`. Alpha 3's own §6 says *"Scraping LinkedIn or anyone else.
Illegal under their terms and unnecessary; the college's records are enough."*
Nothing in alpha 4 uses it and nothing should. Worth deciding what to do with it.

## 4. Product — what alpha 4 is

One loop, done properly:

> a student makes a **specific** Ask → it routes to the few seniors who can actually
> answer it → one **backs** it → they talk → both sign the outcome → it lands on the
> senior's **Record** → the college sees what is answered and what is not.

**Cut:** Roles (jobs board). Rooms (chat groups). Global feed. Followers, endorsements,
profile views, streaks.

> **Changed, Oct 2026:** connections are in (requests with a note, suggestions from your
> own batch), and the feed is in, scoped to your connections, batch and department. The
> full plan, merged with the ChatGPT feature blueprint, is in [`docs/plan.md`](docs/plan.md).

**The student is the hero.** Not the principal. The Record and the principal's letter
are the *alumni-supply engine* — they exist to make seniors show up, not to be the
face of the product.

## 5. Visual direction

**Conventional, bright, institutional — done unusually well.** The reviewers respond to
familiar professional sites, so the layout is conventional on purpose. The warmth comes
from colour, photography and language, not from a gimmick.

| | |
|---|---|
| Ground | The crest, the building and the photographs are all the **same blue**, shot in **golden-hour light**. That is the palette, taken from the place itself. |
| Page | White. Soft neutral surfaces. Real campus photography used as light, never as wallpaper. |
| Type | One sans (Inter) does all the work. **One serif, used about 5% of the time**, for the college's formal voice — the honour letter, Record entries. This is the exact correction to alpha 3's serif-everything. |
| Shape | 10–14px radii, soft layered shadows. Softer than alpha 3's 6px, which read as a document. |
| Colour | Campus blue for structure. Gold for *backing* and highlights — the golden hour, and the warm thing the product is about. Green reserved for *verified*. |

## 6. Where it is

```
alpha-4/
  docs/                    this file
  data/
    extract-records.py     passout spreadsheet  -> college-records.csv
    extract-directory.py   portal export        -> directory.csv
    college-records.csv    9,327 verified graduates
    directory.csv          7,034 portal members
    *_summary.json         counts for the prototype
  prototype/               <- next: the clickable thing
    assets/photos/         25 real campus photographs
    assets/brand/          crest, wordmark, VTU / AICTE / NBA marks
    assets/events/         13 real event banners
    assets/portraits/      principal + HOD (the only real portraits)
```

Still to do: the clickable prototype (landing, find-yourself, student home, Ask
composer, Ask thread, backing, the Record, people directory, Desk), then the Next +
Supabase build on a fresh schema.
## 7. What's built (October 2026)

Every feature works end to end on its own SQLite database (`data/alumnity.db`). The
members' pages are plain wireframes on purpose (`app/styles/wire.css`): each gets its own
design next, page by page.

| Page | What it does | Rules (in `lib/server/`) |
|---|---|---|
| `/home` | Getting-started steps, batchmates to connect with, Asks waiting for you, events, write a note, the noticeboard (cheer, comment, report) | `posts.ts`: each note is for everyone, your batch, or your connections, and only they see it or can touch it |
| `/people`, `/people/[id]` | Search by name, company, city, skill, branch, year, "happy to"; a member's page with Connect (with a note), Accept, Message, Remove, Block, Report, their Record and notes | `people.ts`, `profile.ts`: blocks hide both ways; every field shown only to whom its owner chose |
| `/connections` | Requests waiting, your connections, suggestions from your batch, requests you sent, who you've blocked | `social.ts`: 25 requests a day; declining is silent |
| `/messages`, `/messages/[id]` | Conversations and threads, between connections only; report a message | `social.ts`: 120 an hour; one notification until read |
| `/ask`, `/ask/[id]` | Ask a question; it goes to the few seniors who fit (shared topics, branch, connection) and mentor; one takes it on; a private thread; mark answered with thanks (their Record) | `asks.ts`: 5 a day; only seniors take Asks; the thread is private to the two |
| `/events`, `/events/[id]` | Upcoming and past; faculty, coordinators and admins put them up; RSVP with capacity; Add to calendar (`.ics`); the organiser sees who's coming and can cancel | `events.ts` |
| `/batch/[branch]/[year]` | How many joined that year (a count from the register, never names), who's here, their notes | `register.ts` `batchCount` |
| `/notifications` | Everything that concerns you | |
| `/desk` | Coordinators and admins only (404 for everyone else): reports (take down / dismiss), members (pause / unpause, roles for admins), audit log (admins), totals | `desk.ts`: everything here is audited |
| `/how-it-works` | Public: joining, and how members are kept safe | |
| `/dev/seed` | Development only (404 in production): add or remove 12 made-up "… Sample" members who can't be signed in to | `samples.ts` |

Forms post to server actions (`lib/actions/`), which check who's signed in; the rules
check what they may do. Security checked: cross-site form posts are refused (tested with
a real replayed form), safe redirects after login (`lib/safe-next.ts`), headers against
framing and sniffing (`next.config.ts`), every query parameterised, user text never
rendered as HTML. An independent review then found, and we fixed: blocks now close Ask
threads; cheers and repeat requests can't flood notifications; a senior's Record shows
only thanks (never the question or who asked); search and Home are bounded; members can
only report what they can see; coordinators can't pause each other; the calendar file
escapes every line break; the dev tools answer only on this computer (`lib/server/dev-only.ts`).
Never put `next dev` behind a public tunnel: run `next build` + `next start` for demos.
Tests: `npm test` (rules for every feature in `tests/social.test.ts`).

### The college desk and its roles

One ladder decides every permission (`lib/server/roles.ts`): members → faculty →
alumni coordinators → administrators → super administrators. You can only act on people
below you and give roles below yours. Super administrators are named only in the server's
config (`ALUMNITY_SUPER_ADMINS`, comma-separated emails); administrators can be named there
too (`ALUMNITY_ADMINS`) or appointed by a super administrator. Config roles can't be
changed or removed from the site, so the college can't be locked out of it.

`/desk` (also `/admin`): Overview (totals, new members per week) · Reports · Content (take
down; admins bring back) · Members (filter; per member: pause, sign out everywhere, role,
delete for good with their name typed) · Announcements (top of everyone's Home) · Team ·
Settings (joining open, each feature on/off, daily request limit; super administrators
only, enforced on the server) · Audit log (admins; search; CSV download, formula-safe).

### How it holds up (measured, October 2026)

`SCALE=1 npx vitest run tests/scale.test.ts` fills a throwaway database with 15,000
members, 150,000 connections, 30,000 notes, 60,000 comments and 50,000 messages, and times
each page's main work: everything is under ~50 ms except routing a new Ask (~30 ms) and
search (~35–55 ms). Load-tested end to end on a laptop: one server process serves about
55 pages a second; four processes sharing the one database file, about 105. That is ample
for HKBK (9,327 on the register). Hundreds of thousands of members would need a database server (PostgreSQL) and several app servers.
