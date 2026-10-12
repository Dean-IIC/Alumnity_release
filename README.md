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

**Cut:** Roles (jobs board). Rooms (chat groups). Global feed. Connections, followers,
endorsements, profile views, streaks.

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