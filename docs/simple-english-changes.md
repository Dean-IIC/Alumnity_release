# Simple-English pass: what changed

Rumaan asked: "simplify all English: complex English, big big paragraphs need to be simplified,
so that even a kid understands." The earlier plain-English pass (docs/plain-english-changes.md)
already cut most long words. This pass aims at a 10-year-old reader: Indian students, alumni
and faculty, many reading English as a second language, mostly on a phone.

## The rules used

- Use words a 10-year-old knows: "check" not "verify" or "confirm", "about" not "regarding",
  "ask" not "request" (as a verb), "forever" not "permanently", "suggest" not "propose".
- Write sentences of 12 words or fewer where possible, and never more than 18. Put one idea in each sentence.
- Keep paragraphs to 2 short sentences at most. Longer blocks became short lines, lists or steps.
- Say what to do, in the active voice, to "you". Buttons are 1 to 3 words ("Send code", "Check code", "Save password").
- Facts, rules, limits, numbers and privacy promises are all kept. They are just said simply.
- Names kept exactly: Alumnity, HKBK College of Engineering, Affiliated to VTU, Belagavi,
  Approved by AICTE, New Delhi, Network, Ask a senior, HKBK board, Alumnity card, college desk,
  Showcase. Site terms kept: "connection request", "Log in", "your page", "the register".
- Legal pages: simple sentences and lists, with the same promises. Legal terms that can't be
  simplified stay, with a plain explanation in brackets after them. Examples: data fiduciary,
  grievance officer, Data Protection Board of India, the governing law, jurisdiction, "as it is".
- The director's letter and the committee names are the college's own words, so they are unchanged.
  A short "In short: …" line now sits above the letter on the About page. It shows only
  while the letter is the default one, so it never sums up a letter the desk has replaced.
- Not changed: code, routes, CSS classes, stored values, enum keys, audit-log action names, CSV headers,
  comments, USNs and the register.

## How it was checked

- A script listed every sentence over 12 words and every hard word in the user-facing strings.
  No user-facing sentence over 18 words is left, except in the director's letter.
- `npx tsc --noEmit` and `npx vitest run` pass. No test needed new text: every compared
  string was left alone or changed together with its comparison (see "Left as is").
- At 390px wide, these pages were opened on a dev server with a temporary database:
  /, /about, /how-it-works, /privacy, /terms, /join, /community, /developers, /committee, /login and /forgot.
  None of them scrolls sideways.

## Count by area

| Area | Strings changed |
| --- | --- |
| Public pages (landing, About, How it works, Community, Committee, Developers, Gallery, header/footer) | 54 |
| Legal pages and the desk Showcase editor | 49 |
| Join, log in, accounts, emails and API routes | 36 |
| Home (feed, app bar, role focus, report) | 37 |
| Social (posts, comments, reactions, reposts, sharing, stories, uploads, edit/delete) | 22 |
| Network (Network, Connections, Messages, Notifications, Batch) | 33 |
| Profile, your page, settings, Alumnity card | 64 |
| Ask a senior, HKBK board, events, groups | 29 |
| College desk and causes | 53 |
| **Total** | **377** |

## Fixes the lead made across areas

- `app/(member)/board/page.tsx`: the hint now names the menu button by its new label.
  "choose “Verify and add to the HKBK board”" → "choose “Add to the HKBK board”" (`components/social/post.tsx`).
- Upload errors now read the same everywhere: "That upload has expired. …" → "That upload ran out of time. Choose the file again."
  (`app/api/media/put/route.ts`, `lib/server/media.ts`) and "… Choose the photo again." (`app/api/site/put/route.ts`, `lib/server/showcase.ts`).
- `app/(member)/ask/page.tsx`: "No questions for you right now. When one matches you, …" → "… When one fits you, we'll show it here and tell you." (the same as Home).
- `app/how-it-works/page.tsx`: each step is now a list of short lines, one per `<p>`. The Ask a senior step keeps
  "Once the student has an answer, they mark the question as answered." The Connect step keeps "Start with your batch."
- `components/campus-landing.tsx`: "Mentor a junior" → "Help a junior". The text under it is now two sentences.
- "Withdraw request" is now "Cancel request" everywhere: Connections, groups and someone's page.

---

## Public pages (landing, About, How it works, Community, Committee, Developers, Gallery, header/footer)

### app/layout.tsx
- metadata description and openGraph description (both): "A place for HKBK College of Engineering students and alumni to ask questions, help each other and stay in touch." → "Students and alumni of HKBK College of Engineering help each other and stay in touch."

### app/error.tsx
- "Something went wrong on our side. It usually lasts only a moment. Please try again. If it keeps happening, write to the alumni office." → "Something went wrong on our side. Please try again in a moment." / "Still not working? Write to the alumni office." (two <p>)
- "Reference: {digest}" → "Error code: {digest}"

### app/how-it-works/page.tsx
- Every step is now short lines, one <p> each (the step text became a list of lines).
- description: "How Alumnity works: who can join, what members can do, and how your details are kept private." → "Who can join Alumnity, what you can do there, and how we keep your details private."
- intro: "A private network for the students, alumni and faculty of HKBK College of Engineering. Here's how it works." → "Only for students, alumni and teachers of HKBK College of Engineering. Here's how it works."
- Step 1 text: "Alumnity is only for people from HKBK College of Engineering. To join, you find your name in the college register. Search with your name and USN, or with your name, branch and year. If you are not in the register, you cannot join." → "Search with your name and USN, or your name, branch and joining year. Not in the register? Then you can't join." (the "only for HKBK" fact moved to the intro)
- Step 2 title: "Confirm your email, choose a password" → "Check your email, choose a password"
- Step 3 text: "Add what you do now, what you know and what you can help with. For each part of your page, you choose who can see it: everyone, your batch, your connections or only you." → "Say what you do, what you know and how you can help. Pick who sees each part: everyone, your batch, your connections or only you."
- Step 4 text: "Start with your batch. You can add a short note to a connection request. The other person can accept it or decline it. Once connected, you can message each other." → "Start with your batch. Send a connection request, with a short note if you like." / "Once they say yes, you can message each other."
- Step 5 text: "A student's question goes to a few alumni who can help with it, not to everyone. One of them takes it and replies to the student privately. When the student has an answer, they mark the question as answered." → "A student's question goes to a few alumni who can help, not to everyone." / "One of them answers the student in private." / "Once the student has an answer, they mark the question as answered."
- Step 6 text: "Home shows posts from your batch and your connections. The college posts events here. Tap “I'm going” and add them to your calendar." → "Home shows posts from your batch, your connections and the college. On an event, tap “I'm going” and add it to your calendar."
- Safety: "You can report anything to the college's alumni coordinators. They can remove it." → "You can report anything to the college desk. They can take it down."
- Safety: "Connection requests and messages are limited, so nobody can spam." → "There's a limit on connection requests and messages, so nobody can spam."

### app/about/page.tsx + lib/about-content.ts (new DIRECTOR_SUMMARY)
- New "In short" line above the director's letter (info-lead): "In short: the director is proud of HKBK's alumni and welcomes you home. He asks you to share your story with today's students." It only shows while the letter is the default one (letter.body === PAGE_DEFAULTS["director-letter"].body), so it never sums up a letter the desk has replaced. The letter itself is untouched.

### lib/about-content.ts (and the mirrored site.pages rows in the seed SQL)
- ABOUT.intro (= site.pages 'about-intro', also the About meta description): "The alumni and student network of HKBK College of Engineering, Bengaluru. It is one place for everyone who studied or taught here to find each other, help each other and stay in touch." → "Alumnity is for everyone who studied or taught at HKBK College of Engineering, Bengaluru. Find each other, help each other and stay in touch."
- Privacy title: "Private by default" → "Private from the start"
- "Your USN and email are never shown to other members. Nothing about you appears on any public page." → "Your USN and email are never shown to other members. Nothing about you is shown on any public page."
- "Every part of your page has its own setting: everyone on Alumnity, your batch, your connections, or only you." → "For each part of your page, pick who sees it. Choose everyone on Alumnity, your batch, your connections or only you."
- "Every member is checked against the college register. Members can search the register to invite people, but they only see a name, branch and year, never a USN. Messages are only between connections." → split in two points: "Only HKBK people": "Every member is checked against the college register. Messages are only between connections." / new "Safe invites": "Members can search the register to invite people. They see only a name, branch and joining year, never a USN."
- COMMUNITY.intro (= 'community-intro', Community meta description): "Who Alumnity is for, what is open to everyone, and what members get." → "Who can join, what anyone can see, and what members get."
- COMMUNITY.lead (= 'community-lead'): "Alumnity is where students and alumni of HKBK College of Engineering help each other. Students get honest interview experiences, quick answers and referrals from seniors. Alumni stay in touch with their batch and the college, and help students when they have time." → two paragraphs: "Here, students and alumni of HKBK College of Engineering help each other." / "Students get real interview stories, quick answers and referrals from seniors. Alumni keep in touch with their batch and college, and help when they can."
- Members tick: "Causes that members suggest and the college approves. Donations go through the college's account." → "Causes that members suggest and the college agrees to. Money you give goes through the college's account."
- Joining 1: "Students and alumni show they are from HKBK by finding their name in the college register. They use their name and USN, or their name, branch and joining year." → "Students and alumni find their name in the college register. They search with name and USN, or name, branch and joining year."
- Joining 3: "Everyone signs up with a personal email, so the account stays theirs after graduation." → "Everyone uses a personal email, so they keep their account after college."
- DEVELOPERS_INTRO.intro (also Developers meta description): "Alumnity was designed and built by students of HKBK College of Engineering." → "Students of HKBK College of Engineering made Alumnity."
- DEVELOPERS_INTRO.body: "Alumnity started as a student project in the Department of Computer Science and Engineering. The aim was one place where HKBK's students and alumni help each other. Seniors answer questions and share referrals, the college shares events, and everyone stays in touch with their batch." → lead: "It began as a student project in the Computer Science and Engineering department. The idea was one place where HKBK's students and alumni help each other." + new `points` rendered as a "ticks" list on app/developers/page.tsx: "Seniors answer questions and share referrals."; "The college shares its events."; "Everyone stays in touch with their batch."

### app/committee/page.tsx
- description: "The HKBK alumni association's office bearers and committee." → "The people who run the HKBK alumni association."
- intro: "The office bearers of HKBK's alumni association, and a representative from each department." → "The leaders of HKBK's alumni association, and one person from each department."
- "The association is choosing its first committee. The names will appear here as soon as the college confirms them." → "The association is choosing its first committee. You'll see the names here once the college shares them."

### components/public-page.tsx
- "From finding your name in the register to your first answer from a senior" → "From finding your name to your first answer from a senior"
- "The people who look after the alumni association" → "The people who run the alumni association"

### components/campus-landing.tsx
- "Alumnity is the alumni network of {college}. Find your batch, ask a senior, help a junior and come back for the alumni meets." → "Alumnity is the alumni network of {college}. Find your batch, ask a senior and help a junior. Come back for the alumni meets."
- "From the college's own register of students. The figures update as the register and the network grow." → "From the college's own register of students. The numbers change as the register and the network grow."
- "The next alumni meet is being planned." → "We're planning the next alumni meet."
- card title "Mentor a junior" / "Alumni say what they can help with, and students can find them." → "Help a junior" / "Alumni say what they can help with. Students can find them."

### components/site-header.tsx
- nav aria-label: "Primary navigation" → "Main links"

### components/coming-soon.tsx
- "… is coming soon. This is an early preview of Alumnity." → "… is coming soon. This is an early version of Alumnity." (the list is empty now, so not shown today)

### app/gallery/page.tsx
- description: "Photos from HKBK College of Engineering events over the years: alumni meets, job drives, sports and festivals." → "Photos from HKBK College of Engineering events: alumni meets, job drives, sports and festivals."

### lib/eras.ts (landing intro captions, and the default cover title on profiles)
- "The earliest batch on record" → "The earliest batch in the register"
- "The Army comes recruiting" → "The Army comes to hire"
- "Indian Army campus recruitment drive" → "The Indian Army hires on campus"

### supabase/migrations/20261019220002_site_seed.sql
- Swagatha about: "Engineering orientation day: the college welcomes its new first-year students." → "Welcome day for the college’s new first-year engineering students."
- Around campus about: "Yoga Day, a poster competition, mock interviews, a food carnival and a road safety show, and two films about the college." → "Yoga Day, a poster competition, practice interviews, a food carnival and a road safety show. Plus two films about the college."
- Cyber Security Conclave about: "ICSC 2025, the college’s International Cyber Security Conclave at CMA Royal, Bengaluru: talks and panels on keeping computers and data safe." → "ICSC 2025, the college’s International Cyber Security Conclave, at CMA Royal, Bengaluru. Talks on keeping computers and data safe."
- Job drives about: "The days the Indian Army and the Indian Air Force came to the college to hire students." → "The Indian Army and the Indian Air Force came to the college to hire students."
- Alumni meets about (also on the landing page): "Former students back at the college to meet each other and today’s students." → "Past students come back to meet each other and today’s students."
- Photo alt + caption: "Winners receiving their certificates" → "Winners getting their certificates"
- site.pages 'about-intro', 'community-intro', 'community-lead': same new text as lib/about-content.ts above (kept identical; community-lead has a blank line between its two paragraphs).

## Legal pages and the desk Showcase editor

### app/privacy/page.tsx
- metadata description "What Alumnity keeps about you, why, who can see it, and your rights over it." → "What Alumnity keeps about you, and why. Who can see it, and your rights."
- header "What Alumnity keeps about you, why, who can see it, and your rights over it. Last updated …" → "What we keep about you, and why. Who can see it, and your rights. Last updated …"
- draft card "Draft: the college is completing its contact details and reviewing this policy before Alumnity opens to everyone." → "Draft: the college is still adding its contact details. It will also check this policy before Alumnity opens to everyone."
- "Who we are" paragraph "Alumnity is run by … (“the college”, “we”). Under India’s Digital Personal Data Protection Act, 2023, the college is the data fiduciary for what you share here. Write to … about anything in this policy." → "Alumnity is run by … (“the college”, “we”)." / "India has a law to protect personal data. It is the Digital Personal Data Protection Act, 2023." / "Under this law, the college is the data fiduciary (the one in charge of your data) for what you share here. It decides why and how your data is used, and it must keep it safe." / "Write to … about anything in this policy."
- register item "Your entry in the college register (…). It comes from the college’s own records. We use it to check … nobody can copy the register." → heading line kept + bullets: "It comes from the college’s own records."; "We use it to check that you studied here."; "It’s never shown to anyone in full."; "Logged-in members can search it by name to invite someone."; "They see only a name, branch and year. They never see a USN."; "They can do only a few searches an hour. So nobody can copy the register."
- email item "Your email address, to log you in and send your codes. If you leave daily emails turned on, we also send you one email a day when something is waiting for you. Other members never see your email address." → "Your email address. We use it to log you in and send your codes." + bullets: "If you leave daily emails on, we send you one email a day. We send it only when something is waiting for you."; "Other members never see your email address."
- password item "Our login provider keeps it only in a scrambled form that can’t be turned back. Nobody, including the college, can read it." → "Our login service keeps it only in a scrambled form. That form can’t be turned back into your password. Nobody, not even the college, can read it."
- page item "What you put on your page: what you do now, your journey, skills, links, a photo and a cover. You choose who sees each part." → "What you put on your page. You choose who sees each part." + bullets: "What you do now"; "Your journey"; "Your skills and links"; "A photo and a cover"
- activity item "What you do here: posts, comments, reactions, stories (they disappear after a day), messages, … follows and blocks." → "What you do here:" + bullets: "Posts, comments and reactions"; "Stories (they disappear after a day)"; "Messages"; "Questions in Ask a senior"; "Groups, and events you’re going to"; "Connections, follows and blocks"
- photos item "Hidden details inside photos (such as where they were taken) are removed when you upload them." → "Photos can hold hidden details, such as where they were taken. We remove these when you upload them."
- donations item "Donations: which cause, how much, when, and the payment’s reference from Razorpay. Your card, UPI or bank details go to Razorpay, never to us." → "Donations: which cause, how much, and when. Also the payment’s reference from Razorpay." + bullet "Your card, UPI or bank details go to Razorpay, never to us."
- "Running the site safely: when you last visited (to the nearest hour) and the browsers you’re logged in on. For one day, we also keep the network addresses of recent attempts (for example, attempts to log in), so that nobody can guess passwords or send spam. If you turn on notifications, we also keep your browser’s notification address." → "Keeping the site safe:" + bullets: "When you last visited (to the nearest hour)."; "The browsers you’re logged in on."; "The network addresses of recent tries, such as tries to log in. We keep these for one day. This is so nobody can guess passwords or send spam."; "If you turn on notifications: your browser’s notification address."
- "We use all this only to run Alumnity … We use it to check who joins, to show your page …, to deliver messages and notifications, to keep members safe and to handle donations. We don’t sell it, rent it or use it for advertising. There are no advertising or tracking cookies. The only cookies are the ones that keep you logged in." → "We use all this only to run Alumnity for HKBK’s students and alumni. We use it to:" + bullets "check who joins"; "show your page and what you share to the people you chose"; "deliver messages and notifications"; "keep members safe"; "handle donations." / "We don’t sell it, rent it or use it for advertising." / "There are no advertising or tracking cookies (small files sites save in your browser). The only cookies are the ones that keep you logged in."
- "Other members see only what you share with them. You choose who that is: everyone, … or only you. People who aren’t members see nothing." → "Other members see only what you share with them. You choose who: everyone, your batch, your connections, a group, or only you." / "People who aren’t members see nothing."
- "If a message is reported to the college desk, the desk can see it." → "If someone reports a message to the college desk, the desk can see it."
- "The college desk (the alumni office’s coordinators and administrators) can see members’ details, reports and donations. They need this to keep the site safe and to keep track of money. Everything they do is recorded in an audit log." → "The college desk can see members’ details, reports and donations. The desk is the alumni office’s coordinators and administrators." / "The desk needs this to keep the site safe and keep track of money." / "Everything the desk does is saved in an audit log (a list of its actions)."
- "If you donate to a cause, your name is shown with your donation, unless you choose not to be named. Only you and the college can see the amount." → "If you donate to a cause, your name is shown with your donation. You can choose not to be named." / "Only you and the college can see how much you gave."
- services paragraph "These services handle data for us, only to run Alumnity: Supabase (…), Vercel (…), Razorpay (payments), our email provider (the daily email), and your browser maker’s notification service (…). Some of them may keep data outside India. They are bound to protect it." → "These services handle data for us, only to run Alumnity:" + bullets "Supabase: the database, login and file storage"; "Vercel: the website’s servers"; "Razorpay: payments"; "Our email service: the daily email"; "Your browser maker’s notification service, if you turn notifications on." / "Some of them may keep data outside India. They must protect it."
- "How long" paragraph "We keep it as long as you have an account. If you delete your account in Settings, your page, posts, … are deleted for good. A record that a donation was made (without your name) is kept as long as the law requires the college to keep its accounts. The desk’s audit log also keeps a record that an action happened." → "We keep it as long as you have an account." / "You can delete your account in Settings. Then all of this is deleted for good:" + bullets "your page"; "your posts and comments"; "your messages"; "your uploads"; "everything else of yours." / "These records stay:" + bullets "A record that a donation was made, without your name. The law says how long the college must keep its accounts. This record stays that long."; "The desk’s audit log keeps a record that an action happened."
- "Your rights" paragraph "At any time, you can see and correct … You may also ask the college for a summary … name someone to act for you, or make a complaint. To do any of these, write to …. The grievance officer is …. If you aren’t satisfied with the answer, you can go to the Data Protection Board of India." → "At any time, you can:" + bullets "see and correct what’s on your page"; "choose who sees it"; "turn off emails and notifications"; "delete your account." / "You may also:" + bullets "ask the college for a summary of what it holds about you"; "ask it to correct or erase (delete) that data"; "name someone to act for you"; "make a complaint." / "To do any of these, write to …." / (when set) "The grievance officer (the person who deals with complaints about your data) is …." / "Not happy with the answer? You can go to the Data Protection Board of India. (The government set it up under this law to hear complaints.)"
- "If you’re a student under 18, please wait until you turn 18 to join." → "If you’re a student under 18, please wait until you’re 18 to join."
- heading "Keeping it secure" → "Keeping it safe"
- security paragraph "Everything is sent in encrypted form. Passwords are never stored … Uploads are checked. Each file is shown only to logged-in members who are allowed to see it. If you think something is wrong, tell … at once." → bullets "Everything is sent encrypted (locked, so nobody else can read it on the way)."; "Passwords are never stored in a form anyone can read."; "Only the site’s own server can reach the database."; "We check uploads."; "Each file is shown only to logged-in members allowed to see it." / "If you think something is wrong, tell … right away."
- "If this policy changes in a way that matters, we’ll tell members on Alumnity before it applies." → "If we make an important change to this policy, we’ll tell members on Alumnity. We’ll do it before the change starts."

### app/terms/page.tsx
- metadata description "The rules of Alumnity: who can join, how to treat each other, causes and donations." → "Alumnity’s rules: who can join, how to treat each other, causes and donations."
- header "By joining Alumnity you agree to these terms and to the privacy policy." → "When you join Alumnity, you agree to these terms and the privacy policy."
- draft card "Draft: the college is reviewing these terms before Alumnity opens to everyone." → "Draft: the college will check these terms before Alumnity opens to everyone."
- "Who it's for" paragraph "Alumnity is …’s network for its students, alumni and faculty, aged 18 or over. You join with … Don’t join as anyone else, don’t share your account, and don’t let anyone else use it." → bullets "Alumnity is …’s network for its students, alumni and faculty."; "You must be 18 or over."; "You join with your own entry in the college register."; "Each person may have only one account."; "Don’t join as anyone else."; "Don’t share your account, and don’t let anyone else use it."
- "Respect privacy: don’t share other people’s personal details, messages or photos without their agreement." → "Respect privacy. Don’t share other people’s personal details, messages or photos unless they agree."
- "No spam, scams, chain messages, or selling to people who didn’t ask for it. Real job posts and referrals are welcome." → "No spam, scams or chain messages. Don’t try to sell to people who didn’t ask for it." / "Real job posts and referrals are welcome."
- "Post only what you have the right to post, and nothing illegal." → "Post only what you have the right to post. Never post anything illegal (against the law)."
- desk paragraph "Anyone can report something to the college desk. The desk may remove anything …, and may pause or remove accounts. Everything the desk does is recorded in an audit log. If you think the desk made a mistake, write to …." → "Anyone can report something to the college desk." / "The desk may remove anything that breaks these rules. It may also pause or remove accounts." / "Everything the desk does is saved in an audit log (a list of its actions). If you think the desk made a mistake, write to …."
- "What you post stays yours. You allow the college to show it on Alumnity to the people you shared it with, for as long as you keep it there. If you delete it, or delete your account, it is removed." → "What you post stays yours (you still own it)." / "You allow the college to show it on Alumnity. It is shown to the people you shared it with." / "This lasts as long as you keep it there. If you delete it, or delete your account, it is removed."
- "Anyone may propose a cause. It is published only after the college desk approves it. The desk may ask questions, decline a cause, or close it." → "Anyone may suggest a cause (something to raise money for). It goes on Alumnity only after the college desk approves it." / "The desk may ask questions, say no to a cause, or close it."
- "Tell the truth about a cause: who it helps and what the money is for. A misleading cause will be closed." → "Tell the truth about a cause. Say who it helps and what the money is for." / "A cause that misleads people will be closed."
- payout clause "Every donation is paid to …, through Razorpay. The college pays it out for the cause and records each payout on the cause’s page. If a cause closes before all its money is used, the college uses the rest for a similar purpose." → "Every donation is paid to …, through Razorpay. So the money goes to the college first." / "The college pays it out for the cause (it uses the money for that cause). It lists each payout on the cause’s page." / "A cause may close before all its money is used. Then the college uses the rest for a similar purpose."
- "Donations are voluntary. Once made, a donation can’t be withdrawn. The only exception is a payment made in error: in that case, write to …." → "Donations are voluntary (you choose to give; nobody has to). Once you donate, you can’t take it back." / "The only exception is a payment made by mistake. If that happens, write to …."
- "A donation receipt for tax purposes is available only if the college issues one. Alumnity itself doesn’t issue receipts." → "You can get a tax receipt for a donation only if the college gives one. Alumnity itself doesn’t give receipts."
- "The site itself" paragraph "We work to keep Alumnity running and safe, but it’s offered as it is. It may sometimes be unavailable. The college isn’t responsible for what members post, or for arrangements members make between themselves (such as a job, a referral or a meeting). Use your own judgement, and report anything that seems wrong." → bullets "We work to keep Alumnity running and safe."; "But it’s offered “as it is” (we can’t promise it will always work perfectly)."; "Sometimes you may not be able to use it."; "The college isn’t responsible for what members post."; "It also isn’t responsible for what members arrange between themselves. For example, a job, a referral or a meeting."; "Use your own good sense. Report anything that seems wrong."
- "If these terms change in a way that matters, we’ll tell members before it applies. These terms are governed by the laws of India, and the courts at Bengaluru have jurisdiction." → "If we make an important change to these terms, we’ll tell members. We’ll do it before the change starts." / "These terms are governed by the laws of India (Indian law applies to them)." / "The courts at Bengaluru have jurisdiction (they can hear any legal case about these terms)."

### lib/server/showcase.ts
- "Write the date as year-month-day (2025-09-30), year-month (2025-09) or just the year." → "Write the date like 2025-09-30, 2025-09 or just 2025."
- "That upload has expired. Choose the photo again." → "That upload ran out of time. Choose the photo again." (same wording another agent used in lib/server/media.ts)

### app/api/site/put/route.ts
- "That upload has expired." → "That upload ran out of time."

### components/desk/showcase.tsx
- "Year-month-day, or just the year. Albums go newest first." → "Like 2026-12-14, or just 2026. Newest albums come first."
- "It comes off the gallery at once, and can't be brought back." → "It comes off the gallery right away. You can't get it back."
- "To take it off the gallery for now, untick “Show on the gallery” above instead." → "To hide it for now, untick “Show on the gallery” above instead."
- "The album and its N photos come off the gallery and can't be brought back." → "The album and its N photos come off the gallery. You can't get them back."

### components/desk/page-editor.tsx
- 'One person a line: the role, a colon, then the name. For example "President: Asha Rao". Leave out the name to show "To be announced".' → 'One person on each line. Write the role, a colon, then the name, like "President: Asha Rao". Leave out the name to show "To be announced".'

### components/desk/photo-upload.tsx
- "JPEG, PNG or WebP, up to 20 MB each. You can choose several at once. They are added at the end of the album." → "JPEG, PNG or WebP, up to 20 MB each. You can pick more than one. New photos go at the end."

## Join, log in, accounts, emails and API routes

### app/join/page.tsx
- openGraph description: "Find your name in the college register and join in a minute. Meet your batch, get help from seniors, and find jobs and referrals." → "Find your name in the college register. Join in a minute. Meet your batch, get help from seniors, and find jobs and referrals."
- page intro: "Everyone here is on the college register: N students from every branch since 1998. Find your name to join." → "Everyone here is on the college register. It has N students from every branch since 1998. Find your name to join." (the count sentence still shows only when there is a count)

### app/join/staff/page.tsx
- "The college desk has invited you. Confirm your email and choose a password to join." → "The college desk has invited you. Get a code by email, then choose a password."

### components/join/join-flow.tsx
- "Find your batch, and help the students who came after you." → "Find your batch. Help the students who came after you."
- "More than one person in the register matches these details. Add your USN so we can find you." → "More than one person in the register has these details. Add your USN so we can find you."
- "Enter your name and your USN. If you don't know your USN, enter your branch and the year you joined." → "Enter your name and your USN. No USN? Enter your branch and the year you joined."
- "Teachers and staff are not in the college register. The college desk invites you by email instead. Check your inbox, or ask the alumni office." → two paragraphs (same join__note class): "Teachers and staff are not on the college register. The college desk invites you by email." / "Look in your inbox, or ask the alumni office."
- button "Find me in the register" → "Find my name"
- "Use a personal email. Your college email stops working after you graduate. We’ll send a code to check that it’s yours." → "Use a personal email. College emails stop working after you graduate." (the code step comes right after, and the button says "Send code")
- button "Send me a code" → "Send code"
- button "Confirm code" → "Check code"
- "Your email is confirmed. Last step: choose a password. You will use it to log in." → "Your code is right. Now choose a password to log in with."
- "By joining, you agree to the terms and the privacy policy, and confirm you’re 18 or over." → "By joining, you agree to the terms and the privacy policy. You also say you’re 18 or over."

### components/join/forgot-form.tsx
- button "Send me a code" → "Send code"
- button "Save my new password" → "Save password"

### components/join/staff-join-form.tsx
- button "Send me a code" → "Send code"
- (code, not text) the check `/expired|Too many/` → `/too old|Too many/` to match the new code-expiry message in lib/server/auth.ts. Behaviour unchanged.

### lib/server/auth.ts
- "That code has expired. Ask for a new one." → "That code is too old. Ask for a new one." (compared by the staff join form: updated in the same go)
- "We couldn’t find that entry in the register." → "We couldn’t find you in the register."
- "This person in the register already has an account. Log in, or reset your password if you’ve forgotten it." → "This name on the register already has an account. Log in, or reset your password."
- "Your joining session has expired. Please start again." → "Your time to join ran out. Please start again."
- "Someone has already joined with these register details or this email. Log in instead." → "Someone already joined with these details or this email. Log in instead."
- "This reset has expired. Please start again." → "This reset didn’t work. Please start again." (this fires when the code was for a different login, so "didn't work" is more true than "expired")

### lib/server/auth-provider.ts
- "We couldn’t send a code to that address." → "We couldn’t send a code to that email."

### lib/server/staff.ts
- invitation email lines: "Alumnity is where HKBK's students and alumni help each other. Seniors answer questions, and members join events and groups and stay in touch." → "On Alumnity, HKBK's students and alumni help each other." / "Seniors answer questions. Members join events and groups, and stay in touch."
- invitation email lines: "Join with this email address. We'll send you a code to confirm it. The invitation works for two weeks." → "To join, use this email address. We'll send you a code to check it." / "This invitation works for two weeks."
- invitation email footer: "If you weren't expecting this email, you can ignore it. Nothing happens unless you join." → "Not expecting this email? You can ignore it. Nothing happens unless you join."
- "We can't find a valid invitation for that email. Check that it's the email the college wrote to, or ask the alumni office to invite you again." → "We can't find a working invitation for that email. Use the email the college wrote to. Or ask the alumni office to invite you again."
- "Your joining session has expired. Please start again." → "Your time to join ran out. Please start again."
- "This login is already linked to another member's account. Please ask the college desk for help." → "This login already belongs to another member. Please ask the college desk for help."

### lib/server/digest.ts
- email footer: "We send at most one email a day, and only when you have something new. …" → "We send at most one email a day. We only send it when you have something new. …" (the stop link / Settings part is unchanged)

### components/profile/alerts-panel.tsx
- "Notifications are blocked for Alumnity in this browser. Allow them in the browser's site settings, then try again." → "This browser is blocking notifications from Alumnity. Allow them in the browser's settings, then try again."
- "On an iPhone, first add Alumnity to your home screen (Share → Add to Home Screen). Then open Alumnity from your home screen and turn on notifications in Settings." → "On an iPhone, first tap Share → Add to Home Screen. Then open Alumnity from your home screen and turn this on."
- checkbox: "Send me an email when something is waiting for me (no more than one a day)" → "Email me when something new is waiting (at most one email a day)"

### lib/server/http.ts
- "Something went wrong. Please try again. You will continue from the same step." → "Something went wrong. Please try again. You won't have to start over."

### lib/server/secrets.ts
- "Use more different characters." → "Use more different letters, numbers or symbols."

### app/api/media/put/route.ts
- "That upload has expired." → "That upload took too long. Choose the file again." (matches the wording style of lib/server/media.ts, which is outside my files)

## Home (feed, app bar, role focus, report)

### app/(member)/home/page.tsx
- "Add a photo, your current work and how you can help" → "Add a photo, your job and how you can help"
- "See who from your year has joined, and who has not" → "See who from your year is here, and who isn't"
- "Your class, your club, your city, your field" → "For your class, club, city or work"
- "Scholarships and people in need, checked by the college" → "Scholarships and people in need. The college checks each one."
- "Offer to mentor, so students can send you their questions" → "Offer to mentor, so students can ask you questions"
- "Invite the teachers and staff who'll use Alumnity" → "Invite teachers and staff to Alumnity"
- "Post your first announcement. It shows at the top of everyone's Home page." → "Post your first announcement. Everyone sees it at the top of Home."
- "Add an event, such as a talk, a reunion or a department day" → "Add an event, like a talk or a reunion"
- "Your class, your club, your city: find a group, or start one." → "Find a group for your class, club or city. Or start one."
- "Try fewer filters or different words." → "Try fewer filters or other words."
- "Posts from your connections and people you follow will show here. Find your batch, or follow seniors you admire." → "Posts from your connections and people you follow show here. Find your batch, or follow some seniors."
- "Be one of the first to post. Say hello, find your batch and invite them." → "Be one of the first to post. Say hello, then find your batch and invite them."
- "That's everything." → "You've seen every post."

### app/(member)/report/page.tsx
- "The college's alumni coordinators will look at it. They won't tell anyone who reported it." → "The college's alumni team will look at it. They won't tell anyone it was you."

### components/app/app-bar.tsx
- "Donate to scholarships and people in need" → "Give to scholarships and people in need"

### components/app/people-to-reach.tsx
- "Your question goes to a few seniors who can best answer it." → "We send your question to a few seniors who can answer it."
- "Say you're happy to mentor. Questions that match what you know will come to you." → "Say you'll mentor. You'll get questions about what you know."

### components/home/know-everyone.tsx
- "We have no one else to suggest right now. Alumnity grows when your batch joins, so invite them." → "We have no one else to show you right now. Invite your batch to join."

### components/home/role-focus.tsx
- "Ask a senior who has been in your place. Ask about electives, projects, placements or life after college." → "Seniors were students here too. Ask them about subjects, projects, placements or life after college."
- "Jobs and internships the college has checked" → "Jobs and internships checked by the college"
- "A few minutes of your time can really help a junior. Here you can see who needs help, and who from your batch has joined." → "A few minutes of your time can really help a junior. See who needs help, and who from your batch is here."
- "If you mentor, we send you a few student questions that match your branch and skills. You can stop at any time." → "Start mentoring and we'll send you a few student questions. They fit your branch and skills, and you can stop any time."
- "No questions for you right now. When a question matches you, it will show here and we will tell you." → "No questions for you right now. When one fits you, we'll show it here and tell you."
- "No one else from your batch has joined yet (N people joined HKBK with you). Invite them:" → "No one else from your batch is here yet. N people joined HKBK with you. Invite them:"
- "Post the opening with #job or #internship. The college checks it and adds it to the HKBK board. Students see it there and can ask you for a referral." → two paragraphs: "Post the job with #job or #internship. The college checks it and puts it on the HKBK board." / "Students see it there and can ask you for a referral." (+ the existing "Write a post" link)
- "You have no upcoming events. Alumni like to come back for guest talks, reunions and department days." → "You have no events coming up. Alumni like to come back for talks, reunions and department days."
- "If you agree, student questions that match your department and skills will show here." → "Turn this on to see student questions that fit your department and skills."
- Button "Start answering questions" → "Start answering"
- "The whole site: what needs review, this week's activity and site settings." → "The whole site: what to check, this week's numbers and site settings."
- "What needs review at the college desk, and this week's activity." → "What the college desk needs to check, and this week's numbers."
- "Waiting for review" → "Waiting to be checked"
- "N cause(s) to review" → "N cause(s) to check"
- "Approve it so members can donate, or explain why not." → "Approve it so members can give, or say why not."
- "Nothing waiting. No reports, no causes to review." → "Nothing waiting. No reports and no causes to check."

### components/home/feed-filters.tsx
- placeholder "From specific people" → "Type a name"
- aria-label "Show posts from specific people: type a name" → "Type a name to see that person's posts"

### lib/format.ts
- timeAgo "`${h} h ago`" → "`${h} hour ago`" / "`${h} hours ago`" (e.g. "3 h ago" → "3 hours ago"). Grepped app/components/lib/tests: nothing compares or asserts this output. "Today"/"yesterday"/"just now" not touched.

## Social (posts, comments, reactions, reposts, sharing, stories, uploads, edit/delete)

### lib/server/posts.ts
- "Only the college desk can verify posts." → "Only the college desk can check posts for the HKBK board."
- "The college verified your post. It's on the HKBK board now." (notification text) → "The college checked your post. It's on the HKBK board now."
- "You can ask for a referral only on a post tagged #job, #internship or #referral." → "You can ask for a referral only on #job, #internship or #referral posts."
- "Write a line or two about why you are a good fit, such as your branch, skills or a project." → "Say in a line or two why you're a good fit. For example, your branch, skills or a project."
- `Referral request about your #${tag} post: ` (start of the referral note/message) → `Asking for a referral for your #${tag} post: `

### lib/actions/content.ts
- "Verified. It is now on the HKBK board." → "Done. It's on the HKBK board now."

### lib/server/media.ts
- "That file isn’t one we can use. Photos must be JPEG, PNG, WebP or GIF. Videos must be MP4 or WebM." → "That file isn’t one we can use. Use a JPEG, PNG, WebP or GIF photo, or an MP4 or WebM video."  (kept "isn’t one we can use": tests/media.test.ts matches it)
- "Your photo needs to be an image (JPEG, PNG, WebP or GIF)." → "Your photo must be a JPEG, PNG, WebP or GIF file."
- "That upload has expired. Choose the file again." (2 places) → "That upload ran out of time. Choose the file again."

### components/social/edit-delete.tsx
- "You can change the text only. Who can see the post and its photos stay the same. The post leaves the HKBK board until the college checks it again." → "You can change the words, but not the photos or who can see it. It leaves the HKBK board until the college checks it again."
- "You can change the text only. Who can see the post and its photos stay the same. The post will show as edited." → "You can change the words, but not the photos or who can see it. The post will show as edited."

### components/social/post.tsx
- "From the old HKBK alumni portal" → "From the old HKBK alumni website"
- "✓ Verified by HKBK" (badge) → "✓ Checked by HKBK"
- "Verify and add to the HKBK board" (desk button) → "Add to the HKBK board"
- placeholder "Your branch and year, and what you have built or studied that fits. Keep it short." → "Your branch and year. What you've built or studied that fits. Keep it short."
- hint "If you are not connected yet, we send this note with a connection request. If you are connected, we send it as a message." → "Not connected yet? We send it with a connection request. Connected? We send it as a message."

### components/social/name-mark.tsx
- aria-label "Verified: on the HKBK college register" → "On the HKBK college register"
- title "Verified: on the HKBK college register" → "On the HKBK college register"

### components/social/share-sheet.tsx
- "Only some people can see this post, so you can't share it to other apps. The link works only for people who can already see the post. To share it with a connection, use Send." → two <p className="sheet__note">: "Only some people can see this post. You can't share it to other apps." / "The link works only for them. To send it to a connection, use Send."

### components/social/repost-menu.tsx
- "Reposted. Everyone who can see the original post will see it in their feed." → "Reposted. Everyone who can see the post will see it in their feed."

### components/social/stamps.tsx
- Reaction label "Insightful" → "Useful" (display label only; the stored key stays `insightful`. Lead: revert if the owner wants to keep LinkedIn's word.)

## Network (Network, Connections, Messages, Notifications, Batch)

### app/(member)/people/page.tsx
- "Nobody matches your search. Try fewer words or a different spelling, or clear the search." → "Nobody matches your search. Try fewer words or another spelling. Or clear the search."
- "You can search the college register {N} times an hour, and you have reached that limit. Members still show here. Try the register again later." → "You can search the college register {N} times an hour. You've used them all. Members still show here. Try the register again later." (number kept)
- "Alumnity has only just opened, so there aren't many people to find yet. {N} people joined HKBK in your batch. None of them have joined Alumnity yet. Alumnity gets more useful with each person who joins. Invite your batch." (one paragraph) → three short <p className="wf-muted">: "Alumnity is new, so there aren't many people here yet." / "{N} people joined HKBK in your batch. None of them have joined Alumnity yet." (or "{n} of them has/have joined so far.") / "Alumnity gets better with each person who joins. Invite your batch."
- "… are on HKBK's register (from–to). Type a name or USN above to find anyone, or look through everyone who hasn't joined yet." → "… Type a name or USN above to find anyone. Or look through everyone who hasn't joined yet."
- "These names come from the college's register of students[, for the branch and year you chose above]. Use Filters to see one batch. Know someone here? Send them the link. They join by finding their name." → two <p className="wf-muted">: "These names come from the college register[, for the branch and year you chose]. Use Filters to see one batch." / "Know someone here? Send them the link. They join by finding their name."
- "You can look through {N} pages of the register an hour, and you have reached that limit. Try again later." → "You can look at {N} pages of the register an hour. You've used them all. Try again later." (number kept)

### components/people/person-card.tsx
- "Withdraw your connection request to {first}?" → "Take back your connection request to {first}?" (confirm dialog)
- "Waiting for them to accept. Tap to withdraw your request." → "Waiting for them to accept. Tap to take back your request." (title)

### components/people/people-search.tsx
- "Any year, e.g. 2012" → "Any year, like 2012" (placeholder)

### app/(member)/connections/page.tsx
- "Connections can message each other and see what's shared with connections. Followers only see your posts in their Following feed." → "Connections can message you and see what you share with connections. Followers only see your posts, in their Following feed."
- "You don't follow anyone yet. Follow someone from Network to see their posts in your Following feed." → "You don't follow anyone yet. Follow people from Network. Their posts then show in your Following feed."
- "Withdraw request" → "Cancel request" (button)
- "You can't see each other anywhere on Alumnity. We won't tell them that you blocked them." → "You can't see each other anywhere on Alumnity. We won't tell them."

### app/(member)/notifications/page.tsx
- "No notifications yet. Connection requests, replies and answers will show here. To get started, ask a senior a question or connect with someone." → "No notifications yet. Connection requests, replies and answers will show here." / new <p className="wf-muted">: "To start, ask a senior a question or connect with someone."

### app/(member)/messages/[id]/page.tsx
- "You can message {first} once you're connected." → "You can message {first} after you connect." (link "Go to their page to connect" kept)

### components/messages/messenger.tsx
- "No conversations or connections match “x”. You can message your connections. Find “x” in Network and send a connection request." → "No chats or connections match “x”. You can only message connections. Find “x” in Network and ask to connect."
- "Send a private message to a connection. To message someone new, connect with them first, or use Ask a senior." → two <p>: "Send a private message to a connection." / "Someone new? Connect with them first, or use Ask a senior."
- "You can only message your connections, and you don't have any yet. Find people to connect with, or ask a senior." → two <p className="dm-picker__note">: "You can only message your connections. You don't have any yet." / "Find people to connect with, or ask a senior."

### components/messages/message-actions.tsx
- "View {first}'s profile" → "See {first}'s page"
- "The message is removed for you and {first}. You will both see "This message was deleted"." → "This deletes it for you and {first}. You will both see "This message was deleted"."
- "The message is removed only for you. {first} will still see it." → "This deletes it only for you. {first} will still see it."
- "All messages in this chat are removed only for you. {first} will still see them. If either of you sends a new message, it will show here." → "This deletes every message here, but only for you. {first} will still see them. New messages from either of you will show here."

### components/messages/thread-view.tsx
- "View profile" (2 places: header pill and intro pill) → "See their page"
- "Story no longer available" → "This story is gone"

### lib/server/social.ts
- "You’ve sent {daily} connection requests today. That’s the daily limit. Try again tomorrow." → "You’ve sent {daily} connection requests today. That’s the most for one day. Try again tomorrow." (number kept)
- "This connection request has already been answered or withdrawn." → "This connection request was already answered or taken back."
- "You’ve sent too many messages in the last hour. Please wait a while and try again." → "You’ve sent too many messages in the last hour. Wait a while, then try again."
- "A reaction can't be edited." → "You can't edit a reaction."

### lib/actions/social.ts
- "Connection request withdrawn." → "Connection request cancelled."
- "Connection removed." → "Connection removed. We won't tell them." (true: removeConnection sends no notification; matches the confirm on people/[id])
- "Blocked. You won't see each other anywhere on Alumnity." → "Blocked. You won't see each other anywhere on Alumnity. We won't tell them." (true: block sends no notification)
- "Thank you. The college desk will review it. They won't tell anyone who reported it." → "Thank you. The college desk will look at it. They won't tell anyone it was you."

## Profile, your page, settings, Alumnity card

### app/(member)/me/edit/page.tsx
- "Everything here is optional. For each part, choose who can see it." → "You can skip any part. For each part, choose who can see it."

### app/(member)/people/[id]/page.tsx
- "A note with your request (optional)" → "Add a note (you can skip this)"
- "Withdraw request" → "Cancel request"
- "Thanks from people {first} helped through Ask a senior." → "Thanks from people {first} helped on Ask a senior."

### components/profile/activity.tsx
- "Your posts will show here. Share something from Home, then pin your best one to the top." → "Your posts will show here. Post from Home, then pin your best one to the top."

### components/profile/alumni-card-viewer.tsx
- "Your digital Alumnity card. It shows your member number and a QR code that anyone can scan to find you on Alumnity. Show it at college events, or keep it on your phone." → "It shows your member number and a QR code. Anyone can scan the code to find you on Alumnity." / "Show it at college events, or keep it on your phone." (now two <p>, same .acard-promo__text p style)

### components/profile/alumni-card.tsx
- "Scan to verify" → "Scan to check" (back of the card on the page)

### lib/server/alumni-card-image.tsx
- "Scan to verify" → "Scan to check" (back of the downloaded PNG; kept the same as the page card. College lines, motto, "Affiliated to VTU · Approved by AICTE" untouched)

### lib/alumni-card.ts (card design names: aria-label/title only; keys unchanged)
- "Navy" → "Navy blue"
- "Crimson" → "Red"
- "Emerald" → "Green"
- "Royal" → "Purple"
- "Midnight" → "Black"
- "Sunset" → "Orange"

### components/profile/crop-tool.tsx
- aria-label "Drag to move {x}. You can also move it with the arrow keys, and zoom with the plus and minus keys." → "Drag to move {x}. The arrow keys move it too. The plus and minus keys zoom."
- "Adjust your photo" → "Move and zoom your photo" (sheet title)
- "Adjust the campus drawing" → "Move and zoom the campus" (sheet title)
- "Adjust your cover" → "Move and zoom your cover" (sheet title)
- "Drag the photo to move it inside the circle. Zoom in to make it bigger. Your Alumnity card shows the full square, including the corners." → "Drag the photo to move it in the circle. Zoom in to make it bigger." / "Your Alumnity card shows the whole square, corners too." (two .sheet__note lines)
- "Until you add your own cover, your page shows a picture of the campus from your year. Drag it to move it, and zoom in to make it bigger." → "Your page shows the campus from your year until you add a cover." / "Drag it to move it. Zoom in to make it bigger."
- "Drag to choose which part of your cover shows. Zoom in to make it bigger. The cover is wider on a computer than on a phone, so check how it looks on both." → "Drag to choose which part of your cover shows. Zoom in to make it bigger." / "The cover is wider on a computer than on a phone. Check both."

### components/profile/media-picker.tsx
- "A campus photo from your year shows here until you add a cover" → "A campus photo from your year shows here for now"
- aria-label "Adjust your photo" → "Move and zoom your photo"
- aria-label "Adjust the campus drawing" → "Move and zoom the campus"
- aria-label "Adjust your cover" → "Move and zoom your cover"
- button "Adjust" / "Adjust the campus" → "Move and zoom"
- "JPEG, PNG, WebP or GIF, up to 5 MB. We remove any location details saved inside the photo. After you choose it, drag and zoom to adjust it." → lines: "JPEG, PNG, WebP or GIF, up to 5 MB." / "We remove any hidden details of where the photo was taken." / "Then drag and zoom to fit it."
- "An HTML cover fits itself to the space, so you do not need to adjust it. It runs in a safe, closed box and cannot load anything from the internet. Put any pictures or fonts inside the file." → lines: "An HTML cover fits itself. You don't need to move or zoom it." / "It runs in a safe, closed box. It can't load anything from the internet." / "So put any pictures or fonts inside the file."
- "You can add a photo (up to 5 MB), a short video (up to 25 MB, played without sound) or an HTML file (up to 1 MB). You can move and zoom photos and videos to adjust them. An HTML file runs …" → lines: "Photo: up to 5 MB." / "Short video: up to 25 MB. It plays with no sound." / "HTML file: up to 1 MB." / "You can move and zoom a photo or a video." / "An HTML file runs in a safe, closed box. It can't load anything from the internet." / "So put any pictures or fonts inside the file."
  (lines are joined with <br /> inside the one existing .field__hint span; .picker is a spaced grid, so separate spans would look gappy)

### components/profile/profile-editor.tsx
- "Your journey since HKBK (optional)" → "Your journey since HKBK" (the page intro now says "You can skip any part")
- "Add the main steps between leaving college and now, such as a first job, a move to a new city or a startup. Your page shows them as a timeline, oldest first." → "Add the big steps since you left college. For example, a first job, a new city or a startup." / "Your page shows them in order, oldest first." (two .join__fine)
- "A senior who can help you decide about a course, a project or a first job." → "A senior who helps you choose a course, a project or a first job."
- "Alumni who hire, or who know about openings, can find you." → "Alumni who hire, or who know of jobs, can find you."
- "For when you apply to a company where an alumnus works." → "An alumnus suggests you for a job at their company."
- "Answer questions and help students make decisions." → "Answer questions and help students choose well."
- "When a junior is a good fit for a job, recommend them." → "Suggest a junior for a job that fits them."
- "A guest lecture or a session for a department." → "A guest talk or a session for a department."

### components/profile/profile-sheet.tsx
- "Recommends good candidates at their company." → "Suggests good people for jobs at their company."
- "A guest lecture, or a session for a department." → "A guest talk, or a session for a department."
- "A senior who can help with a decision." → "A senior who can help them choose."
- "Alumni who hire, or who know about openings." → "Alumni who hire, or who know of jobs."
- "For when they apply to a company where an alumnus works." → "An alumnus who can suggest them for a job."
- "A few lines about you: what you're studying, what you'd like to do after HKBK, what you'd ask a senior." → "Write a few lines about you. What do you study, and what do you want to do next?"
- "A few lines about you: what you teach, what you research, how students and alumni can work with you." → "Write a few lines about what you teach and research. Say how students and alumni can work with you."
- "A few lines about you: what you work on, what you loved at HKBK, what a junior could ask you." → "Write a few lines about your work and your time at HKBK. Say what a junior could ask you."
- "Add sections when you edit your page: experience, education, projects, certificates, clubs, awards and languages." → "Add more when you edit your page. For example: experience, education, projects, certificates, clubs, awards, languages."
- "Not switched on. Turn it on when you edit your page. Then seniors can find you, and we tell you when a job or internship is posted on the HKBK board." → "Not switched on. Turn it on when you edit your page, so seniors can find you. We'll also tell you about new jobs and internships on the HKBK board."

### components/profile/sections-editor.tsx
- "Current (no end year)" → "Still doing this (no end year)"
- "Link (optional)" → "Link (you can skip this)"
- "Short description (optional)" → "A few words about it (you can skip this)"

### lib/profile-sections.ts (display labels only; section keys unchanged)
- "Company or organisation" → "Company or group"
- "Who it was with or for (optional)" → "Who it was with or for (you can skip this)"
- "Certifications" → "Certificates"
- "Clubs and organisations" → "Clubs and groups"
- "Club or organisation" → "Club or group"
- "Honours and awards" → "Awards and prizes"

### lib/server/profile.ts (save errors)
- "A link in {section} is not a valid web address. Check it and try again." → "A link in {section} doesn't look right. Check it and try again."
- "Enter a LinkedIn profile link, such as linkedin.com/in/your-name." → "Use your LinkedIn link, like linkedin.com/in/your-name."
- "Your website link is not a valid web address. Check it and try again." → "Your website link doesn't look right. Check it and try again."
- "We couldn't find that file. It may have been deleted. Please upload it again." → "We couldn't find that file. Please upload it again."

### components/profile/settings-panel.tsx
- "Your password has been changed. We have logged you out on all your other devices." → "Your password is changed. We logged you out on all your other devices."
- "This permanently deletes your account and your page from Alumnity. Your name stays in the college register, so you can join again later if you want." → "This deletes your account and your page from Alumnity forever. You can’t undo it." / "Your name stays in the college register, so you can join again later." (two .join__fine)
- "Type DELETE (in capitals) to confirm." → "Type DELETE in capital letters first."
- "Type DELETE to confirm" (label) → "Type DELETE to be sure"
  (the code still checks for exactly "DELETE"; log-out-everywhere texts unchanged)

## Ask a senior, HKBK board, events, groups

### app/(member)/ask/page.tsx
- "More details (needed, so a senior can really help)" → "More details (a senior needs these to help you)"
- "Topics (optional, separated by commas)" → "Topics (optional, with commas between them)"
- "Topics help your question reach seniors who know about them." → "Topics help the right seniors find your question."
- "You are a mentor. Students' questions that match your branch and skills come here. Busy for a while? Pause mentoring. You can turn it back on here at any time." → "You are a mentor. Questions that match your branch and skills come here. Busy? Pause it, and turn it back on any time."
- "You get questions only after you agree to mentor. Then students' questions that match your branch and skills will come here, a few at a time. You can turn this off at any time." → "Questions come to you only if you agree to mentor. Then questions that match you come here, a few at a time. You can turn it off any time."
- "No questions for you right now. When a question matches you, it will appear here and we will tell you." → "No questions for you right now. When one matches you, we'll show it here and tell you."
- "These questions did not match any one senior. If you can help, take one." → "These questions didn't match any one senior. Can you help? Take one."
- (senior intro) "Students ask questions here. Each question goes to a few seniors from the same branch who know the topic. If you take one, you reply to the student privately." → "Each question goes to a few seniors who match its branch or topic. Take one, and you reply just to that student."
- (student intro) "Your question goes to a few seniors, not to everyone. We choose them by branch and skills. One of them takes your question and replies to you privately." → "Only a few seniors who match your branch or topic get your question. One of them takes it and replies just to you."
- "You haven't asked anything yet. Your first question can be a small one, like how to choose electives or what an internship is like." → "You haven't asked anything yet. Start small: how to pick electives, or what an internship is like."

### app/(member)/ask/[id]/page.tsx
- "We sent your question to a few seniors who match it. We will tell you when one of them takes it." → "We sent your question to a few seniors who match it. We'll tell you when one of them takes it."
- "Can you help? If you take this question, you will reply to {first} privately, on this page." → "Can you help? Take it, and you reply to {first} here, just between you two."
- "A short thank-you note (optional; it is shown on {first}'s Record)" → "A short thank-you (optional). It shows on {first}'s Record." ("{first}'s Record" kept exactly)
- confirm "Close this question? No one can reply after you close it." → "Close this question? No one can reply after that."

### app/(member)/board/page.tsx
- intro "Jobs, internships, notices and more, checked by the college. Anyone can post with a #tag. The college desk checks these posts and adds the right ones here." → "Jobs, internships, notices and more, checked by the college. Add a #tag to your post, and the college desk may add it here."

### app/(member)/groups/[id]/page.tsx
- "You asked to join. A group admin will review your request." → "You asked to join. A group admin will look at it."
- button "Withdraw request" → "Cancel request" (same as the connections page agent chose)
- "This group is private. Only members can see its posts and its member list. Ask to join, and a group admin will review your request." → two lines: "This group is private. Only members can see its posts and members." / "Ask to join, and a group admin will look at it." (second line is a wf-muted <p>; wrapped in a fragment)
- confirm "Close {name} for good? Its posts will be removed too." → "Close {name} forever? This removes its posts too."

### lib/server/asks.ts
- "Add a few more details: what you have tried and where you are stuck." → "Add more details. What did you try? Where are you stuck?"
- notification "{name} asked a question you may be able to answer: “{title}”" → "{name} asked a question you may know about: “{title}”"
- "Only the person who asked and the senior helping them can write here." → "Only the person who asked and their senior can write here."
- "This question is closed to replies." → "This question is closed. No more replies."
- "You have sent many replies in the last hour. Please wait a while and try again." → "You sent a lot of replies in the last hour. Please wait and try again later."

### lib/server/groups.ts
- "Choose whether it's open or private." → "Choose open or private."
- "You can create up to three groups a day. Please try again tomorrow." → "You can start up to three groups a day. Please try again tomorrow."
- "This request has already been handled." → "Someone has already answered this."

### lib/actions/groups.ts
- "Request accepted." → "Accepted. They're in the group now."
- "Request declined. We won't tell them." → "Declined. We won't tell them."

## College desk and causes

### app/(member)/causes/page.tsx
- "Give to scholarships, a classmate in need, or a project for the college." → "Give to a scholarship, a classmate in need, or a college project."
- "You can give once the college has set up payments. You can propose a cause now." → "You can give once the college sets up payments. You can suggest a cause now."
- "Goal … · proposed {timeAgo}" → "Goal … · suggested {timeAgo}"
- "No causes yet. Propose the first one below." → "No causes yet. Suggest the first one below."
- "Propose a cause" (fold summary) → "Suggest a cause"
- "The college desk reads every cause before it goes live. They may ask you about it. Donations go to the bank account of HKBK College of Engineering. The college then pays for the cause and shows what it paid." → bullets: "The college desk reads every cause before it goes live. They may ask you about it."; "All money goes to the bank account of HKBK College of Engineering."; "The college then pays for the cause. It shows here what it paid."
- "The story: who it helps, what the money is for, and how you are connected to it" → "The story: who it helps, what the money is for, and how you're linked to it"

### app/(member)/causes/[id]/page.tsx
- "… Donations made so far are still shown below." → "… Money given so far is still shown below."
- "You can give once the college has set up payments." → "You can give once the college sets up payments."
- "College desk: review" → "College desk: check this cause"
- "Or reject it. Say why (the person who started it will see this)" → "Or reject it and say why. The person who started it will see this."

### components/causes/give.tsx
- "Razorpay's checkout didn't load. Check your internet connection and try again." → "The Razorpay payment window didn't load. Check your internet connection and try again."
- "Paid securely through Razorpay to HKBK College of Engineering. Only you and the college see how much you gave." → "You pay safely through Razorpay to HKBK College of Engineering. Only you and the college see how much you gave."
- "The payment did not go through. No money was taken. You can try again." → "The payment didn't go through. No money was taken. You can try again."

### lib/server/causes.ts
- "Tell the story in a few lines: who it helps, what the money is for, and how you are connected to it." → "Tell the story in a few lines. Say who it helps and what the money is for. Say how you're linked to it."
- "We could not use that photo. Please add it again." → "We couldn't use that photo. Please add it again."
- "You can propose up to two causes a day. Please try again tomorrow." → "You can suggest up to two causes a day. Please try again tomorrow."
- "This cause is not waiting for review." → "This cause isn't waiting to be checked."
- "We couldn't confirm that payment. If money was taken from your account, it will show here in a few minutes. If it does not, write to the alumni office." → "We couldn't check that payment. If money left your account, it will show here in a few minutes. If not, write to the alumni office."

### lib/actions/causes.ts
- "Thank you. We have received your donation." → "Thank you. We got your donation."

### app/(member)/desk/page.tsx
- "Logged in as {role}. Everything done here is written to the audit log." → "You're logged in as {role}. Everything you do here goes in the audit log."

### app/(member)/desk/members/[id]/page.tsx
- "They're at your level or above on the college desk, so you can't change anything here." → "They're at your level or higher on the college desk. You can't change anything here."
- "Pause {name}? They will be logged out on all devices and hidden from everyone until you unpause them." → "Pause {name}? They'll be logged out on all devices. Nobody will see them until you unpause them."
- "Delete permanently" (heading) → "Delete forever"
- "This can't be undone. Their page, posts, comments, messages, questions and connections will all be deleted. Pausing the account is usually enough." → "This can't be undone. Their page, posts, comments, messages, questions and connections will all be deleted." / separate line: "Pausing the account is usually enough."
- "Type their name to confirm: {name}" → "To delete, type their name: {name}"
- "Delete permanently" (button) → "Delete forever"

### components/desk/sections.tsx
- "Causes to review" (stat) → "Causes to check"
- "{n} report(s) to review" → "{n} report(s) to check"
- "{n} cause(s) to review" → "{n} cause(s) to check"
- "No reports and no causes to review. You can invite staff from the Team tab, or post an announcement from the Announcements tab." → "No reports or causes to check. You can invite staff in the Team tab, or post in the Announcements tab."
- Report kind tag showed the raw stored kind ("ask", "member", …) → display label via new REPORT_KIND map ("Question", "Member", "Post", "Comment", "Message", "Group", "Cause"). Stored kinds unchanged.
- Report status tag showed the raw stored status ("removed"/"dismissed") → display label: "Dismissed", or "Paused" (member) / "Closed" (cause) / "Taken down" (others). Stored statuses unchanged.
- "Super administrators are set by the site's technical team. You can't change them here. A super administrator can make someone an administrator. An administrator can make someone a coordinator. To give a role to someone already on Alumnity, open their name in Members." → bullets: "Only the site's technical team can set super administrators. You can't change them here."; "A super administrator can make someone an administrator."; "An administrator can make someone a coordinator."; "Someone already on Alumnity? Open their name in Members to give them a role."
- "Teachers and college staff are not in the college register, so they join by invitation. They get an email with a link. They confirm their email with a code, and choose a password." → "Teachers and college staff aren't in the college register. They join by invitation:" / steps: "They get an email with a link."; "They check their email with a code."; "They choose a password."
- "Send the invitation" → "Send invitation"
- "expired" (invite state) → "link ran out"
- "(people can still read paused features, but cannot add anything new)" → "(when one is off, people can still read it but can't add new things)"

### lib/server/desk.ts
- "You can't report your own content." → "You can't report yourself or anything you made."
- "Say briefly what is wrong, so the alumni coordinators know what to check." → "Say in a few words what's wrong. It helps the alumni coordinators check."
- "Your {kind} was taken down by the college desk because it broke the community rules." (notification) → "The college desk took down your {kind}. It broke the community rules."
- "Only an administrator can restore content." → "Only an administrator can bring this back."
- "A closed question can't be reopened." → "A closed question can't be opened again."
- "You can only change the roles of people below you on the college desk." → "You can only change roles for people below you on the college desk."
- "Type their name exactly (“{name}”) to confirm." → "Type their name exactly as shown: “{name}”."

### lib/server/fresh-start.ts (operator script printout; every fact kept)
- "Fresh start stopped; nothing was changed:" → "Fresh start stopped. Nothing was changed:"
- "{from} has a several-column key into {to} ({n} rows affected): handle it by hand." → "{from} has a key of several columns into {to} ({n} rows). Fix it by hand."
- "{from}.{col} can't be null, and {n} of its rows point at … . A kept row is never deleted, so nothing was done." → "{from}.{col} can't be null. {n} of its rows point at … . Kept rows are never deleted, so nothing was done."
- "(none of them is an administrator: run make-test-accounts afterwards, or the desk has nobody)" → "(None of them is an administrator. Run make-test-accounts after this, or nobody can use the college desk.)"
- "Stored files: couldn't be listed (see above); all of the bucket's files would be deleted." → "Stored files: couldn't list them (see above). Every file in the bucket would be deleted."
- "IT WOULD STOP, CHANGING NOTHING:" → "IT WOULD STOP AND CHANGE NOTHING:"
- "failed (harmless leftovers: no member row points at them)" → "failed (left behind, but harmless: no member row points at them)"
- "failed (harmless leftovers: nothing points at them)" → "failed (left behind, but harmless: nothing points at them)"

---

## Left as is

### Public pages (landing, About, How it works, Community, Committee, Developers, Gallery, header/footer)

- lib/about-content.ts / seed 'director-letter': the director's letter (college's own words).
- lib/about-content.ts / seed: committee rosters and "To be announced" (compared in app/committee/page.tsx and lib/site-pages.ts rosterOf).
- lib/site-pages.ts SITE_PAGES titles ("Committee: office bearers", "Community: first paragraph", ...): stored in site.pages.title and shown only on the desk.
- app/committee/page.tsx: "alumni association" / "Office bearers" heading: the body's own name and its office titles.
- lib/college.ts: "Chairman, HKBK Group of Institutions", "Affiliated to VTU, Belagavi", "Approved by AICTE, New Delhi", motto: official titles/facts.
- components/public-page.tsx: "Every student and graduate since 1998 is in it." (fact: register starts with the 1998 joining batch).
- components/growing-campus-intro.tsx: "Skip intro", "Don’t play the intro next time" (asserted in tests/campus.test.ts); "engineering students since 1998" (fact).
- lib/campus.ts WELCOME_COPY "Join now"/"Log in" (asserted in tests/campus.test.ts).
- lib/eras.ts photo source "Today's campus" (compared in components/profile/profile-sheet.tsx).
- Seed part titles "Indian Air Force", "Indian Army", "Films about the college", "Alumni stories" and caption "The class of 2025 throw their caps in the air" (asserted in tests/gallery.test.ts).
- Seed "Fifty-seven final-year AIML students cleaned up the grounds of the government school in Nagawara." (14 words, plain already).
- lib/gallery.ts SOURCES lines, album card "View album", lightbox labels: already short and plain.
- app/not-found.tsx, app/manifest.ts, components/site-footer.tsx, lib/footer-links.ts: already plain.

### Legal pages and the desk Showcase editor

- lib/legal.ts: no user-facing wording to change. There is no policy/consent version string. `fiduciary: "HKBK College of Engineering, Bengaluru"` is a name; `updated: "16 October 2026"` is a date. The "Last updated" date was NOT bumped (the lead/college can decide whether a wording-only change needs a new date).
- app/privacy/page.tsx, app/terms/page.tsx: fallback contact "the alumni office (address to be added)": already simple.
- app/privacy/page.tsx: "name someone to act for you": kept word for word. Under the DPDP Act this right (nominating someone) is really for death or inability, but adding that limit would change the promise; the college's legal reviewer may want to word it.
- app/privacy/page.tsx: no anchor ids existed on sections and nothing links to /privacy#… or /terms#…; section headings kept except "Keeping it secure" → "Keeping it safe".
- components/desk/page-editor.tsx: the "To be announced" inside the help text is kept exactly (it names the text the committee page shows, which is compared in code).
- lib/server/showcase.ts: "Only the college desk can do that.", "That album is gone.", "That photo is gone.", "Choose a photo first.", "This photo is too big. Photos can be up to 20 MB.", "That's a lot of photos for one hour. Try again later.", "That file isn't a photo we can use. Use a JPEG, PNG or WebP photo.", "The photo did not upload. Try again.", "More photos": already short and simple.
- lib/actions/showcase.ts: "Album saved.", "Saved.", "This photo is now the cover.", "Photo deleted.", "Saved. The page shows the new words now.": already simple.
- components/desk/confirm-delete.tsx, app/api/site/photos/route.ts: no wording needing change ("Choose a photo first." already simple).
- Audit-log action names in lib/server/showcase.ts ("made an album", "changed a photo's words", etc.): not touched (tests assert them).

### Join, log in, accounts, emails and API routes

- lib/server/auth.ts: "Too many wrong codes. Ask for a new one.": matched by the staff join form (/Too many/) and tests/auth.test.ts (/Too many/). Already simple.
- lib/server/auth.ts: SLOW_DOWN "You have tried too many times. Wait a few minutes and try again.": tests/auth.test.ts matches /tried too many times/. Already simple.
- lib/server/auth.ts: "The college has paused this account. Please write to the alumni office for help.": tests/auth.test.ts matches /paused/. Already simple. Same for "The college has paused joining for now. Please try again later."
- lib/server/auth-provider.ts: SAME_PASSWORD "That’s your current password. Choose a new one.": compared with !== in auth.ts and staff.ts, and toBe(SAME_PASSWORD) in tests. Already simple.
- lib/server/auth-provider.ts: "That password can’t be used: …": tests/password-words.test.ts asserts it exactly.
- lib/server/secrets.ts: "Don’t use “x”. It’s too easy to guess.": tests/password-words.test.ts asserts it exactly. Already simple.
- components/join/join-flow.tsx: USN placeholder "1HK12CS042": it has the shape of a real HKBK USN (1HK + year + branch + number). I am not sure it isn't a real person's USN, and I can't check the register from here. It is also the USN used in tests/alumni-card.test.ts. Suggest the lead decide, for example "1HK00XX000" or "e.g. 1HK…". Not changed.
- components/join/register-book.tsx: status chips ("Ready to search", "1 record found", "Not found", "Check & try again") and "Welcome back" / "Checking": short already; "Checking" and "Welcome back" are asserted in tests/register-scan.test.tsx.
- components/join/fields.tsx: code hint "We sent it to {email}. It works for 15 minutes. Can’t find it? Check your spam folder, or ask for a new code below." and password hint: already short sentences.
- app/api/alerts/unsubscribe/route.ts: "Done. We won't send you daily emails any more. You can turn them back on in Settings." and "This link no longer works. You can turn off the emails in Settings.": already short.
- app/api/** "Not found", "Not allowed", "Not JSON", health/cron/razorpay webhook messages: not seen by members (machines and admins only).
- lib/server/storage.ts, lib/server/db.ts, lib/server/local-auth.ts, lib/server/dev-only.ts, lib/server/test-accounts.ts: only developer errors / dev-only text. Not changed.
- lib/server/digest.ts summary words ("connection request(s)", "new job or internship on the HKBK board"): established terms, short. tests/alerts.test.ts asserts "1 conversation with new messages".

### Home (feed, app bar, role focus, report)

- components/app/app-bar.tsx: menu labels "Home", "Network", "Groups", "Messages", "Notifications", "More", "You", "Ask a senior", "HKBK board", "Events", "Causes", "Your batch", "Connections", "Gallery", "College desk": already 1-3 words; protected names kept exactly.
- app/(member)/home/page.tsx: heading "Getting started": short and clear. (Note: "Getting started" is also a compared profile-strength level in lib/profile-strength.ts / components/profile/profile-strength.tsx; the Home heading is separate, but I left it to avoid confusion.)
- lib/format.ts: ROLE_LABEL ("Administrator", "Super administrator", "Alumni coordinator"): role names used across the desk, profile sheet and lib/alumni-card.ts; not mine to rename.
- lib/format.ts: "just now", "min ago", "yesterday": already simple.
- lib/feed-filters.ts ROLE_FILTERS labels ("Alumni", "Students", "Faculty", "College") and lib/tags.ts SUGGESTED_TAGS labels: already simple; keys are URL params/stored tags, untouched.
- components/home/role-focus.tsx: Invite text "I'm on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:": a WhatsApp message the member sends; already short.
- components/home/role-focus.tsx: "Open the audit log →": "audit log" is the desk tab's name.
- components/app/welcome-back.tsx: "Welcome back, <name>." unchanged (tests/register-scan.test.tsx asserts "Welcome back" elsewhere).
- lib/actions/common.ts "Please log in again.", lib/server/home.ts, lib/actions/feed.tsx, lib/theme.ts, lib/branches.ts, components/app/margin-art.tsx, pulse.tsx, menu-closer.tsx, nav-link.tsx, action-form.tsx, member-line.tsx, report-button.tsx, post-card.tsx, invite.tsx, more-from-hkbk.tsx, app/(member)/layout.tsx, loading.tsx, notes/[id], openings, admin: no user-facing text that needed changing (only comments, SQL or already-simple labels).

### Social (posts, comments, reactions, reposts, sharing, stories, uploads, edit/delete)

- lib/video.ts: "Not a link: …" / "Not a YouTube, Instagram, Facebook or LinkedIn video link: …": developer/build-time errors, and tests/video.test.ts matches them.
- lib/server/posts.ts, lib/actions/content.ts, lib/server/stories.ts: "This post is no longer available." / "This comment is no longer available." / "This story is no longer available.": already plain; tests/posts-plus.test.ts asserts the post one exactly.
- lib/server/media.ts: "This file is too big. …" messages: already plain; tests/media.test.ts matches /too big/.
- lib/server/stories.ts / components/social/stories.tsx: story reply and reaction strings: already plain; message texts like "Reacted ❤️ to your story" live outside my files and are asserted in tests/social.test.ts.
- lib/actions/content.ts: "You can pin only your own posts to the top of your page." (13 words, clear), "Marked as answered. Your thanks now show on their Record." ("Record" is a feature name), ask/event messages: already plain.
- components/social/composer.tsx, reaction-bar.tsx, send-sheet.tsx, people-picker.tsx, repost-card.tsx, infinite-feed.tsx, post-media.tsx, sheet.tsx, mention-input.tsx: already short and plain; no change needed.
- lib/client/*.ts, lib/mentions.ts, lib/post-limits.ts, lib/media-url.ts: no user text needing change.

### Network (Network, Connections, Messages, Notifications, Batch)

- lib/server/people-search.ts: suggestion reasons "From your batch", "Happy to mentor", "From your branch", "New on Alumnity": compared in components/people/person-card.tsx and tests/people.test.ts; already simple.
- lib/chat-format.ts: "Today", "Yesterday" (dayLabel; "Today" is also used in thread-view.tsx for the optimistic message's day divider), and previewOf strings "You deleted a message", "Message deleted", "You: …", "You replied to their story: …": asserted in tests and already simple.
- lib/server/social.ts: notification texts "{name} sent you a connection request.", "{name} accepted your connection request. You’re now connected.", "New message from {first}.", "{first} replied to your story.": already short and simple; may be asserted in tests.
- lib/actions/messages.ts: "This story is no longer available.": kept the same as lib/server/stories.ts (not my file), which returns the same text from the same story viewer. See "Outside my files".
- components/people/person-card.tsx: RegisterCard invite text "{first}, I found your name on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:": 13 words, a message the member sends, already plain.
- app/(member)/people/page.tsx: "Tap a company to see who works there. You can ask them about the company or for a referral.": short; "referral" is the site's word (the "Can refer" chip).
- app/(member)/batch/[branch]/[year]/page.tsx: no changes needed (labels already short: "Request sent", "Wants to connect", "Nobody from this batch has joined yet.").
- "Decline" / "Accept" buttons and "Decline {first}'s request" aria-labels: already short and clear.
- lib/server/follows.ts, inbox.ts, people.ts, people-href.ts, people-pick.ts: user-facing strings already simple ("You've followed a lot of people today. Try again tomorrow.", "{name} started following you.").

### Profile, your page, settings, Alumnity card

- lib/profile-strength.ts: levels "Getting started" / "Good" / "Strong" / "Complete": compared with === in components/profile/profile-strength.tsx and asserted in tests. Tips ("Add a photo", "Add your city", "Write a few lines about you", …) are already short and say what to do.
- lib/profile-sections.ts: language levels "Native" / "Fluent" / "Conversational" / "Basic": stored values used as the <option> text, and there's no separate label map. ("Conversational" is a hard word; a label map would be needed to change it.)
- lib/server/badges.ts: "Founding member", "Helped a junior", "Helped 5 juniors", "Helped 10 juniors", "Mentor", "Event host" and their details: asserted in tests/badges.test.ts, and already simple.
- components/profile/alumni-card.tsx: "Verified Alumnity card" (badge on someone's page): "verified" is well known from social-media ticks, and "Checked Alumnity card" reads oddly.
- app/(member)/people/[id]/page.tsx: "{first} sent you a connection request.": the site's own term. "Decline" kept next to "Accept" (a standard pair).
- components/profile/settings-panel.tsx: "Lost your phone, or logged in on a shared computer? Log out of all your other devices.", "Log out of other devices", "Only you can see this. You use it to log in, and we send your login codes to it.": already short and clear.
- lib/server/settings.ts: PAUSED and FEATURE_LABEL: already short (the labels are desk-only).
- lib/journey.ts, lib/photo-crop.ts, lib/server/alumni-card.ts, components/profile/journey.tsx, cover.tsx, ink-seal.tsx, sticky-name.tsx, strength-bar.tsx, theme-choice.tsx: nothing user-facing that needed changing.
- Code comments that still say "Adjust" (media-picker.tsx header) were left alone: comments are for developers.

### Ask a senior, HKBK board, events, groups

- lib/server/asks.ts: routing reasons "knows …", "same branch (…)", "a connection", "happy to mentor": stored in ask_routes.reason, shown as-is.
- app/(member)/ask/page.tsx: " · sent to you because: {reason}" and STATUS labels ("Waiting for a senior", "A senior is helping", "Answered", "Closed"): already simple.
- app/(member)/ask/page.tsx: "Students' questions…", "You can ask up to five questions a day. Please try again tomorrow." (asks.ts): already simple; number kept.
- (Done by the lead: app/(member)/board/page.tsx now quotes the new menu label "Add to the HKBK board".)
- app/(member)/groups/page.tsx, events pages, events ICS route, lib/server/events.ts, lib/server/announcements.ts: text already short and plain; nothing changed. ICS PRODID/format untouched.
- Group kinds "open"/"private" (stored values) and KIND_LABEL "Open"/"Private": unchanged.

### College desk and causes

- lib/server/causes.ts: all amount/limit messages ("Set a goal between …", "Give between … at a time.", "That is more than the money left: …", "Too many tries in the last hour…", "Razorpay is not responding right now…"): already short and exact; payment facts untouched.
- lib/server/causes.ts + lib/server/desk.ts: audit action names ("approved cause", "turned down cause", "closed cause", "recorded payout", "removed", "dismissed report", "changed role", "deleted member", "changed settings") and audit detail strings ("daily requests … → …", "joining opened/closed"): stored values.
- lib/server/desk.ts: "Taken down after a report (report {id})." : stored as the cause's review_note; left so stored notes stay consistent.
- lib/server/desk.ts: "Daily connection requests should be between 1 and 200.": already short; keeps the "connection requests" term.
- lib/server/causes.ts donationsCsv / lib/server/desk.ts auditCsv: CSV headers unchanged ("paid_at,cause,donor,…", "when,who,did,to,detail").
- app/(member)/causes/page.tsx: "Send it to the college desk" button: kept (says exactly where it goes; "college desk" must stay whole).
- "donation(s)" kept in several messages: a common word for Indian readers, and tied to Razorpay/receipts wording.
- lib/actions/desk.ts: all toasts already short ("Taken down.", "Paused. They are logged out on all devices.", "Invitation sent. … The link works for two weeks."); unchanged. "invitation" kept because the staff join pages use "your invitation".
- lib/server/razorpay.ts: its thrown errors ("Razorpay isn't set up.", "Razorpay order failed (…)") never reach users (startDonation catches them and shows its own message); unchanged.
- lib/server/roles.ts: no user-facing strings.
- components/causes/photo-field.tsx: already simple.
- app/(member)/desk/audit.csv/route.ts, donations.csv/route.ts: only "Not found" and file names; unchanged.

### Needs a decision from the owner or the college

- **Seed text on a database that already has it.** `supabase/migrations/20261019220002_site_seed.sql`
  runs only once: it checks for the seed 'showcase-2026-10'. A database that was seeded before this change
  keeps the old album text and the old site.pages rows ('about-intro', 'community-intro', 'community-lead').
  So the About and Community pages there still show the old words. The college desk can edit them, or
  a new migration can update each row whose body still equals the old text. Fresh databases get the new text.
- **Privacy, "name someone to act for you".** This is kept word for word. Under the DPDP Act, this right is
  for when you die or can't act for yourself. A legal reviewer may want to say that.
- **Privacy and terms, "Last updated".** `lib/legal.ts` still says "16 October 2026". Only the wording changed,
  not what is promised. The college can decide whether to change the date.
- **Reactions.** The "Insightful" reaction label is now "Useful". The stored key `insightful` is unchanged.
  Change the label back if LinkedIn's word is wanted.
- **USN placeholder.** "1HK12CS042" in `components/join/join-flow.tsx` has the shape of a real HKBK USN.
  Check that it isn't a real student's, or change it to something like "1HK00XX000".
- **Language level "Conversational".** This is a stored value and is also the text shown in the list. Making it simpler
  needs a label map.
