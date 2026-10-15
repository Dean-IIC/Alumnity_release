# Design research: the rest of Alumnity (15 October 2026)

Home is designed: a social feed in Alumnity's paper and ink. Everything else signed in is
still a wireframe. This is research into how the best apps handle each remaining page, and
how to redraw each idea in our own hand, so the whole site feels like one place.

Read it with the screenshots: `design-review/alumnity-pages-2026-10-15.pdf`.

**How it was done:** four researchers looked at one area each (profiles and people;
messages, notifications and Ask; events, groups and causes; the College desk and utility
pages). Most findings come from search results rather than full pages (the page reader
failed for most of the night), so treat product details as secondhand and check before
building on them. Sources are at the end of each section.

---

## The direction in one line

**Alumnity is the college register, come alive.** Every page is a thing you'd find on a
college desk: letters and postmarks (messages), index cards and a card catalogue
(people), a yearbook (batches), invitation cards (events), notebooks (groups), an ink
well filling (causes), a ledger with rubber stamps (the College desk). Each is a familiar
social-app pattern underneath, so nobody has to learn anything new.

| Page | It's a… | The familiar pattern underneath |
|---|---|---|
| Profile | A page in the register, with a "then and now" cover | Instagram/LinkedIn profile |
| People | A card catalogue | LinkedIn Alumni search with counted filters |
| Connections | Postcards | LinkedIn My Network |
| Batch | A yearbook spread | University digital class books |
| Messages | Letters, with postmarks | WhatsApp / iMessage |
| Notifications | The day's post, sorted | Instagram Activity, Linear Inbox |
| Ask a senior | A paper plane | Stack Overflow Ask Wizard + mentoring routing |
| Events | Invitation cards that turn into albums | Luma, Partiful, Apple Invites |
| Groups | Notebooks with tabbed dividers | Circle spaces, Facebook Groups |
| Causes | An ink well filling | GoFundMe, Milaap, university Giving Days |
| College desk | A ledger with rubber stamps | Reddit mod queue, GitHub audit log, Stripe home |
| 404 | The pen line wandering off the page | Mailchimp, GitHub, LEGO 404s |

---

## 1. Fix cohesion first (before any new page)

From the PDF, these break the feeling of one product. They're quick and lift every page:

1. **One app bar, not two.** Signed-in pages stack the site's links (Home, Explore
   people, Gallery) over the section pills. Make one bar: lockup · search · Home, People,
   Messages, Notifications (icons with counts) · your face. The section pills become the
   left column on desktop (as on Home) and the tab bar on phones.
2. **Faces in every list.** People, Connections, Messages, Batch and the desk show names
   as text lines; Home shows avatars. Use the same `Avatar` everywhere.
3. **One page shape.** Home is a centred feed with side columns; the rest are a narrow
   left column. Use Home's layout for every member page: main column 600–640 px, a side
   column where it helps (people you may know, upcoming events).
4. **One button style.** Wireframe pages use shadowed pills; Home uses flat ones. Pick
   flat (the design system says no shadows on cards; buttons can keep a gentle lift on
   hover only).
5. **No landing footer inside the app.** The "Play the intro" footer belongs to the
   public site, not to someone reading their messages.
6. **One bubble.** Message threads and Home comments use different speech bubbles. Make
   one, in two tones (yours / theirs).
7. **A real 404** (see §11). Today it's Next.js's black default.

---

## 2. Profile (yours and others')

**Borrow:**
- **Small header, the person first** (Instagram): name, what they do now, batch, city in a
  compact card; their posts and photos below as a grid of prints (pencil sketch until
  hovered or tapped, then colour, the same motif as the landing page).
- **Career as a story** (Read.cv, now closed): a hand-picked timeline as a pen line down
  the margin. We already have the journey timeline: keep it optional, as decided.
- **"Happy to" on the photo** (LinkedIn's #OpenToWork ring, which gets more messages but
  can read as "unemployed"): a hand-drawn gold ring labelled *happy to mentor* or *happy
  to meet for chai*. Only ever positive, never "looking for a job".
- **Follow and Connect** side by side: Follow (one way, no asking) and Connect (asks).
- **Your own page: no completeness percentage.** Empty spots hold faint pencil prompts
  ("Add the photo from your first day on campus") that turn to ink when filled.

**Standout:** a **Then & Now cover**: their joining-year photo and a recent one pinned side
by side with the red pen line joining them (US university class books do this).

**Caution:** "tag who's in this old photo" is a lovely idea, but photos of people need the
college's sign-off and the tagged person's consent before showing.

Sources: Instagram/LinkedIn profile patterns via eleken.co/blog-posts/profile-page-design;
linkedin.com/help (Open to Work); executivecareerbrand.com (the downside);
hackdesign.org/toolkit/read-cv; dev.to (Polywork impressions).

## 3. People (search)

**Borrow:**
- **Counted filters** (LinkedIn's Alumni tool): where they live, where they work, what
  they do, what they studied, each a list of counts you can tap to narrow. Ours: drawn as
  tally marks in ink ("Bengaluru |||| |||| 312"), like a ledger, not a dashboard.
- **One search field plus chips** (Hivebrite, BrightCrowd): name, company, city, skill,
  and shared interests.
- **A map of cities** (Hivebrite): city level only, and only what each member shares.
- **Empty search:** say what was searched, offer to clear it, and "Know someone from
  MECH 2009? Send them an invite card."

**Standout:** **the card catalogue**: results as index cards in a drawer per branch, each
with a sketch, name and year. (Pretty, but heavy for long lists: use it for the browse
view, a plain list for search results.)

Sources: cultivatedculture.com/linkedin-alumni; hivebrite.io/features/member-directory;
hivebrite.io/customers/fullbright-case-study.

## 4. Connections

**Borrow:**
- **Requests above suggestions** (LinkedIn, Facebook): requests as postcards with their
  note; Accept (blue) / Not now.
- **Say why you might know them, in words** (Meta says mutual friends and shared schools
  are the main signals; a Penn State study found mutual friends raise acceptance):
  "Also CSE 2011 · 6 people you both know".
- **Dismiss a suggestion** (the ×), so the list gets better.
- **Quiet numbers** (Glass hides follower counts on purpose): consider "classmates you're
  in touch with" instead of a count on profiles. *This changes what we show today:
  your call.*

**Standout:** suggestions **dealt as a hand of cards** on phones (swipe to connect / pass).

Sources: blog.linkedin.com (2014, People You May Know); news.linkedin.com (2020 redesign);
transparency.meta.com (PYMK); bellisario.psu.edu (Penn State study); petapixel.com (Glass).

## 5. Batch pages

**Borrow:**
- **The class book** (BrightCrowd, used by Stanford, Duke, Northwestern, Kellogg, Booth):
  each classmate a portrait; only the class can see it; it stays after the reunion.
  Ours: a **yearbook spread**: portraits in a grid, pencil outlines for those not here yet,
  colour once they join.
- **Where they are now:** "Class of 2008 is in 14 cities", the red pen line running from
  campus out to each city.
- **A flashback column:** what was happening the year they joined (college fest, cricket,
  films).
- **The register as a nudge:** "142 of 418 have found their way here", drawn as an ink
  well filling, with "Invite them".

**Standout:** **Sign my yearbook**: classmates leave short notes in the margins of the
batch page. Each note notifies the person: a reason to come back.

Sources: alumni.northwestern.edu (class book); reunion.vanderbilt.edu/classbook;
kellogg.northwestern.edu (digital yearbook); chicagobooth.edu (digital yearbook);
myevent.com/class-reunions/features; almabase.com (reunion ideas).

## 6. Messages ("letters")

**Borrow:**
- **Grouped runs and day dividers** (iMessage, Telegram): messages a few minutes apart
  read as one letter with one name; a pencil-ruled divider when the day changes, the date
  in Young Serif; exact times on hover or tap.
- **Delivery in ink:** a faint dot while sending, an ink tick when sent, and (optional,
  can be turned off for privacy) a red underline when read. A failed send says so in
  words, never colour alone.
- **The list** (WhatsApp, LinkedIn): face, name, one-line preview, short time ("2h"),
  unread count in a gold wax-seal dot; unread rows in bolder ink.
- **A composer strip at the bottom**: "Write to Priya…", a blue Send.
- **Empty:** "No letters yet. Write to a batchmate", with three batchmates to write to.

**Standout:** **postmarks**: a round "HKBK · BENGALURU · 15 OCT" postmark on the first
letter of each day, and small milestone stamps between two people ("10 letters").
(Inspired by pen-pal apps Dearyou and Slowly; delivery stays instant.)

Sources: ethora.com and cometchat.com (chat UX); slowly.app; Dearyou and Lettre (App Store).

## 7. Notifications

**Borrow:**
- **Sorted by time:** New · Today · This week · Earlier (Instagram-style), headings as
  margin notes.
- **Grouped:** "Asha and 3 others stamped your post", with their faces overlapping (GetStream, Uxcel).
- **Two piles** (Linear Inbox): *For you to answer* (requests, Asks, replies) and
  *Goings-on* (reactions, follows).
- **Act from the row** (Linear, GitHub): Accept · Not now on a request; Take it on for an
  Ask; "Set aside till tomorrow".
- **Why you're seeing it:** a tiny stamp: *mentioned you*, *your batch*, *Ask*.

**Standout:** **all caught up**: a desk lamp switching off over a tidy letter tray.

Sources: linear.app/docs/inbox (read in full); linear.app changelog (snooze); docs.github.com
(notifications inbox); getstream.io (activity feeds); uxcel.com; eleken.co (notification UX).

## 8. Ask a senior

**Borrow:**
- **Guided asking** (Stack Overflow's Ask Wizard; in their A/B test it cut poor questions
  by 5%): three short folds: the question in a line · some context (what you've tried) ·
  who you'd like to hear from (an industry, a city, someone who studied abroad).
- **Similar answered Asks while you type**, as pinned paper slips.
- **Say honestly where it went** (PeopleGrove's routing): "Sent to 4 seniors who fit".
- **Status as stamps:** In flight → Caught → Answered.
- **Trust** (ADPList): a senior's Record shows the questions they took on and the thanks.

**Standout:** **the paper plane** (the original idea): the question card folds and flies
off (one second, once; a plain "Sent" under reduced motion); a "caught" stamp with the
senior's face when one takes it on; the thanks pressed onto their Record as a dated stamp.

Sources: stackoverflow.blog (Ask Wizard impact, read in full); peoplegrove.com
(Engagement Hub, read in full); adplist.org/faqs; Discord forum guide (communityone.io);
paper-plane demos: codepen.io/cihadturhan/pen/DPJRRK, codepen.io/pfeilal23/pen/wvKdmJr.

## 9. Events

**Borrow:**
- **The page is the invitation** (Luma, Partiful, Apple Invites): a cream card with a
  deckle edge, a sketched cover, the title in Young Serif. Three "stationery" styles to
  choose from: Reunion (gold border), Talk (letterpress), College day (bunting).
- **Going / Maybe, never "Can't go" shown** (Partiful): faces of who's going, grouped by
  batch ("14 from 2004"). *Needs a Maybe in the backend.*
- **Seats and a waiting list** (Luma): chairs that fill with ink; when full, "Join the
  waiting list". *Needs a waitlist in the backend.*
- **A tear-off stub** after you say you're coming: add to Google / Apple / any calendar.
- **A share card** for WhatsApp, the invitation as an image; RSVP still needs a login.
- **How to get there:** a drawn campus pin and a note.

**Standout:** **the invitation turns over into an album**: after the day, the back of the
card becomes a scrapbook where people who came add photos, and a "who came" class photo
forms. It connects straight to the gallery we already have.

Sources: help.luma.com (creating events, waitlist, Luma vs Partiful); ixd.prattsi.org
(Partiful critique); apple.com newsroom (Apple Invites); codepen.io/cballenar/pen/mdKwxjx
(an unfolding invitation).

## 10. Groups (coming next)

**Borrow:**
- **A group is a notebook** with tabbed dividers: Posts · Gatherings · Members · Pinned
  (Circle's spaces).
- **A "Start here" letter** from the founder, with one prompt: "Introduce yourself:
  batch, branch, city" (Circle; Discord says keep onboarding to one step).
- **The next gathering pinned on the cover** (Meetup: upcoming events are how people
  judge a group).
- **A few post tags** (Reddit flair, 2–3 words): Hiring · Ask · Meetup · Memory, plus
  Official for the college only.
- **Four kinds, four doodles:** Department (a gear), City (a skyline), Company (a block),
  Interest (a leaf).

**Standout:** a **map of city chapters** that fills with ink as each grows (UC Irvine's
Giving Day "turn the map gold").

Sources: community.circle.so (Start Here); circle.so vs Facebook Groups; support.discord.com
(onboarding); meetup.com blog (2025 redesign); reddithelp.com (post flair).

## 11. Causes and giving (Razorpay)

**Borrow:**
- **Honest progress** (GoFundMe): no percentage until about 20%; before that, "23
  supporters". Amounts in Indian style: ₹12,34,567 (`Intl.NumberFormat('en-IN')`); a
  custom lakh/crore short form (the built-in one gives odd results like ₹0.999Cr).
- **A guestbook of supporters:** "Priya, 2009, gave ₹2,000", with give-anonymously and
  hide-the-amount (the default).
- **Updates as diary entries**, with receipts; a "Where the money went" page ruled like an
  account book (Milaap releases money only against bills).
- **Trust next to the Give button** (Milaap, Ketto): "Approved by HKBK College Desk" with
  the date; the proposer's name, batch and relation to the beneficiary; an 80G seal only
  where it truly applies.
- **Giving Day** (university giving days): a yearly Founders' Day (founded 1997) with
  batch-versus-batch leaderboards by *number of gifts*, not amount, and "100 gifts unlock
  ₹X" matches.
- **Paying** (Razorpay): UPI first, quick amounts (₹500 / ₹1,000 / ₹2,500 / ₹5,000) and
  your own; ask for PAN only when 80G applies; a handwritten thank-you with a share card.

**Standout:** **the ink fill**: the cause's pencil sketch (a lab, a certificate) fills with
colour from the bottom as money comes in, and becomes the full photograph at 100%, the
same sketch-to-colour as the landing page.

**Must-knows before taking money (please check with the college's CA):**
- 80G receipts only if the *receiving trust/society* holds 80G approval. Donors claim it
  through a **Form 10BE** certificate after the trust files **Form 10BD** each year (the
  new Income-tax Act renumbers these; confirm the current form). A Razorpay receipt is
  not a Form 10BE.
- A classmate's medical cause is usually *not* 80G-eligible: say so. Pay hospitals against
  bills; never collect into anyone's personal UPI: everything through the college's
  Razorpay account.
- Foreign donations need FCRA registration: INR only unless the trust has it.
- Publish a refund-on-fraud policy, a verification checklist, and any fees.
- Keep PAN and address private (receipts only); no fake urgency, no constant asking.

Sources: prosupport.gofundme.com (progress metrics, 2025 release notes); gofundme.com
(updates); kickstarter.com (campaign guide); customerhappiness.ketto.org (80G);
crowdfunding.milaap.org (verification policy); faq.milaap.org (foreign funds);
givingday.uci.edu; giveday.ucsb.edu (leaderboards); razorpay.com (80G receipts, Payment
Pages docs); incometax.gov.in (Forms 10BD/10BE); cleartax.in; developer.mozilla.org
(Intl.NumberFormat).

## 12. The College desk

**Borrow:**
- **"Today at the desk"** (Stripe's home): only the numbers that call for action, each
  with "vs last week" in words; *Reports waiting* gets the page's one red underline.
- **Reports as index cards** (Reddit mod queue, Discord AutoMod): who, what, where, how
  many reported it and why. Buttons say what happens to the content: **Take down post** /
  **Keep post, dismiss report** (Discourse's Approve/Reject confuses moderators).
- **A decision lands as a signed stamp**: TAKEN DOWN / DISMISSED, "— A. Rao, 3:14 pm",
  which is also the audit trail.
- **Reversible actions act at once, with Undo** (NN/g: confirm only what can't be undone):
  take-downs and pauses get Undo, not a dialog. Deleting a member stays behind typing
  their name, in a danger zone at the bottom, with focus starting on Cancel.
- **Members** (Linear): filters (Active / Paused), actions in a ⋯ menu, few roles each
  with one sentence of what it can do.
- **The audit log as a registry** (GitHub): one sentence per entry ("Asha R. paused
  Rahul K."), filters, and "Export these 214 entries" (exports what you filtered).
- **Settings** (Polaris two columns; NN/g, Material): a toggle takes effect immediately and
  is logged; never toggles plus a Save button. Confirm in words before switching off
  something everyone uses.

**Standout:** **the ledger**: ruled lines, dates in the margin, index cards, rubber
stamps; an empty queue gets an **ALL CLEAR** stamp. Keyboard shortcuts for busy
coordinators (T take down, D dismiss, U undo).

Sources: 925studios.co (Stripe dashboard breakdown); reddithelp.com (mod queue);
meta.discourse.org (moderation guide; the Approve/Reject confusion); discord.com
(AutoMod); linear.app/docs/members-roles; docs.github.com (security log, sessions);
nngroup.com (confirmation dialogs, toggle switches); m3.material.io (switch);
saasui.design (destructive actions).

## 13. Settings, report, 404, empty states

- **Settings:** two columns; *Sessions* like GitHub (one line per device, "Chrome on
  Android · last active 2h", Sign out each, or all others); Delete account at the bottom,
  the page's only red, with a 14-day change-your-mind period.
- **Report:** reasons as cards (Spam · Rude · Pretending to be someone · Unsafe ·
  Something else), then "A coordinator reads this within 2 days. They won't see your name."
- **404:** "This page isn't in our register." The red pen line runs along the edge and
  wanders off the corner; one blue "Back to your feed", a search box, two links.
  **500:** "Our pen ran dry; we're refilling it", with Retry and a reference code.
- **Empty states** (NN/g, Polaris, Carbon): say why it's empty, teach one thing, one
  button. An uncoloured pencil sketch (nothing has bloomed yet), one serif line, one blue
  button. "No results" repeats the search and offers Clear.

Sources: nngroup.com (empty states); carbondesignsystem.com (empty states);
untitledui.com; Polaris EmptyState docs; soliddigital.com, ramotion.com, wix.com (404s).

---

## 14. Cautions that apply everywhere

- **Words, not colour alone:** every stamp, dot and underline also says what it means.
- **Motion:** stamps landing, the plane, the ink fill and the 404 line all switch off under
  "reduce motion"; nothing loops; undo notices stay at least 10 seconds or until closed.
- **Gold is for decoration and large type only;** small gold text uses `--color-gold-small`.
- **Privacy:** maps at city level only; tagging people in photos needs consent and the
  college's sign-off; giving amounts hidden by default.
- **Decorations are hidden from screen readers** (postmarks, doodles); statuses are real text.

## 15. What I'd suggest, in order

1. The cohesion fixes (§1): a day's work, and every page looks related at once.
2. **Profile** and **People** (most visited after Home).
3. **Messages** and **Notifications** (they bring people back).
4. **Events** as invitations (then the album turn-over).
5. **Causes** with Razorpay, after the college confirms the trust's 80G/FCRA position.
6. **Ask** with the paper plane, **Batch** as a yearbook, **Groups**.
7. The **College desk** ledger and the 404.

**Decisions for you:**
- Show connection counts on profiles, or keep them quiet (Glass-style)?
- Add *Maybe* and a *waiting list* to events?
- Read receipts in messages: on by default, off, or not at all?
- The register metaphor across every page (letters, cards, ledger…): too much, or right?
- For causes: is there a college trust with 80G (and FCRA) we'd collect through?
