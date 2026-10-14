# Alumnity · the plan

What we're building, in what order, and how each part should feel. It merges three
sources: the ChatGPT blueprint (`../Alumnity_Feature_Blueprint by chat gpt.md`: roles,
priorities, privacy rules, the demo story, metrics), this repo's README (verification
against the college register, the Ask loop), and the decisions made since (full
connections; jobs still open).

## The idea

**A social network for HKBK College of Engineering that feels like a hand-drawn,
animated storybook**, not a LinkedIn screen. Paper, pencil and ink; things drawn in by a
pen and coloured in by ink; wind in the leaves of the margins. The warmth of a Ghibli
film, in spirit only: no characters, frames or anything else of theirs.

What only Alumnity can do, and so what it leads with:

- **The college's own register** (9,327 passout records since 1998) says who is who. You
  don't apply to be verified; you find your line in the register.
- **Your batch already exists.** CSE, class of 2012, is a real list of real people
  before anyone signs up.
- **Asking a senior** who has been exactly where you are, and that help going on their
  Record.

## Roles

Checked on the server for every action, never just hidden buttons.

| Role | Can |
|---|---|
| Student | Profile, find people, connect, post to their batch and department, Ask, RSVP |
| Alumnus | All of that, plus take on Asks, offer referrals, post to alumni spaces |
| Faculty / department rep | Department announcements, events for their department |
| Alumni coordinator | Verification queue, reports and moderation, events |
| Administrator | Roles, settings, audit log, aggregate reports |

## The features, and how each should feel

Every feature gets its own moment from the storybook, so nothing looks generic.

| # | Feature | The storybook moment |
|---|---|---|
| 1 | **Join, with register verification** | You find your name in the college register: an old ruled book. The pen writes your line in, and the register's red stamp lands on it. |
| 2 | **Log in** | Your page in the book opens again: an emailed code, no password to forget. |
| 3 | **Profile and settings** | Your page: sketched like the gallery's photos; what you've done is written in the margins. Every field has who-can-see-it. |
| 4 | **Find people** | The register, searchable: branch, batch, company, city. People appear as written names, not a wall of faces (only 3% have photos). |
| 5 | **Connections** | Connecting draws the intro's red ink line between two names. Requests carry a note; suggestions start with your own batch. Block, and a daily cap on requests. |
| 6 | **Batch pages** | Your class, as a page: the year in the intro's big serif, everyone on the register, who's here, a reunion. |
| 7 | **Home** | A noticeboard, not a firehose: notes from your connections, batch and department, college news, answered Asks, memories. |
| 8 | **Ask a senior** | A paper plane folded from your question flies to the few seniors who fit; one catches it. The answer is stamped onto their Record. |
| 9 | **Messages** | Letters between connections, and inside Asks. |
| 10 | **Events** | Hand-drawn invitation cards; after the day, the event's photos become a gallery album. |
| 11 | **Referrals / opportunities** | Start as "I can refer at …" on alumni pages; a board only if it's used. (Undecided.) |
| 12 | **College desk** | The coordinators' room: verification queue, reports, events, audit log. |
| — | **Gallery** | Built: HKBK memories. |

Later: city chapters (from cities people choose to share), career resources (talks,
resume help, alumni stories), the AI matchmaker on top of Ask routing, a digest,
a digital alumni card.

## Rules the blueprint gets right, kept

- Privacy by default: every profile field has a visibility; being findable and
  mentoring are opt-in; nobody's phone or email is shown by default.
- Report and block everywhere people meet; a moderation queue; an audit trail for
  verification, role changes and removals; rate limits on sign-in, requests, comments.
- Account deletion and correction; a retention policy; backups that have been restored.
- AI may suggest or flag; it never posts, bans or reveals what normal search wouldn't.
- Everything works on a phone.

## The register, carefully

The register (`data/college-records.csv`) is real student data. It is never sent to
the browser and never committed (`.gitignore`). The join check runs on the server and
needs **two things that agree**: USN and name, or name, branch and year. It answers only
"that's you" or "not found", because USNs are sequential: a lookup by USN alone would let
anyone list every name in it. The years in it are the years people **joined**.

## Demo for the Principal

The blueprint's story, in our language: an alumnus finds their line in the register;
completes their page; a student finds them in Find people and connects; the student
Asks, the alumnus takes it on; the student RSVPs for a guest lecture; the college desk
shows what's answered and what isn't. Demo accounts and sample data clearly marked.

## Measuring it

Profiles completed, members verified, requests accepted, Asks answered (and how fast),
event RSVPs and attendance, reports resolved. Aggregate only.
