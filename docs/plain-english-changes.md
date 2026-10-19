# Plain-English pass: what changed

Rumaan asked for "an English simplification check on the whole site". Our readers are
students, alumni, faculty and staff of HKBK College of Engineering. Many of them read
English as a second language, and most use a phone. So every word a user sees was
checked against these rules:

- Use short, common words and short sentences (20 words or fewer). Put one idea in each
  sentence, use the active voice, and speak to the reader as "you".
- Don't use idioms or literary phrases ("take it on", "a door left open", "drawn in red
  pen", "take a breather", "bring them in"). Keep the warmth.
- Buttons say what they do ("Save changes", "Delete post", "Withdraw request").
- Use one term for each idea across the site:
  - The People section is **Network**. "People you may know" stays.
  - Use "connection request", not "request to connect" or "would like to connect".
  - Use "Log in" and "Log out", not "sign in".
  - A member's profile is "your page" / "their page".
  - Say "question" for Ask a senior. Don't use "an Ask" as a noun.
  - Say "Add an event", not "Put up an event".
  - "We won't tell them" is used for block, decline and remove.
  - Say "Check your internet connection". On this site, "connection" alone means a person.
  - Say "We couldn't find that …" when something is missing, and "This post / comment /
    story is no longer available" for content that has gone.
  - Rate limits say what happened and when to try again ("You can ask up to five
    questions a day. Please try again tomorrow.").
- The official names are unchanged: HKBK College of Engineering, Affiliated to VTU,
  Belagavi, Approved by AICTE, New Delhi, Alumnity, Ask a senior, HKBK board, Alumni
  Network.
- Nothing else changed: code, routes, data values, enum keys, comments, the register,
  JSON data files, CSV headers and audit-log action names. `components/scene.tsx`,
  `components/backdrop.tsx` and `app/styles/*` were not edited.

Tests that check exact message text were updated to the new wording, and they are
still exact matches: `tests/auth.test.ts`, `tests/messages.test.ts`,
`tests/password-words.test.ts` and `tests/posts-plus.test.ts`.

## Count by area

| Area | Strings changed |
| --- | --- |
| Public pages, landing, legal, gallery | 62 |
| Join, log in, accounts, emails, API | 65 |
| Home page, app bar and menus | 63 |
| Posts, comments, reactions, stories | 92 |
| Network, connections, messages, notifications | 81 |
| Profile, settings, alumni card, uploads | 85 |
| Ask a senior, HKBK board, events, causes, groups, college desk | 193 |
| Consistency pass across areas | 27 |
| **Total** | **about 668** |

(A few strings that show up in more than one place, such as "This post is no longer
available.", are counted once per place.)

---

## Public pages, landing, legal, gallery

### app/layout.tsx
- description and openGraph description: "…to ask, guide and grow together." → "…to ask questions, help each other and stay in touch."

### app/error.tsx
- "That didn’t load." → "This page didn’t load."
- "Something went wrong on our side, usually for a moment. Try again; if it keeps happening, write to the alumni office." → "Something went wrong on our side. It usually lasts only a moment. Please try again. If it keeps happening, write to the alumni office."

### app/not-found.tsx
- "The link may be old, or a letter may be out of place. Nothing’s wrong with your account." → "The link may be old, or the address may have a typing mistake. Your account is fine."
- "Go to the start" → "Go to the home page"

### app/manifest.ts
- "HKBK College of Engineering's alumni and students, together." → "The alumni and student network of HKBK College of Engineering."

### app/about/page.tsx
- "From the director's desk · HKBK College of Engineering" → "A message from the director · HKBK College of Engineering"
- "Read the whole letter" → "Read the full message"

### app/how-it-works/page.tsx
- Title "From the register / to your first answer" → "From joining / to your first answer"
- "Here's how it goes." → "Here's how it works."
- Step 1: "Alumnity is only for HKBK College of Engineering people. You join by finding your name in the college register: your name and USN (or your name, branch and year)…" → "Alumnity is only for people from HKBK College of Engineering. To join, you find your name in the college register. Search with your name and USN, or with your name, branch and year…"
- Step 3 title "Make your page yours" → "Set up your page"
- Step 3: "Say what you do now… Every part has its own “who can see this”: …" → "Add what you do now, what you know and what you can help with. For each part of your page, you choose who can see it: everyone, your batch, your connections or only you."
- Step 5: "Students' questions go to a few alumni who fit them, never to everyone. One takes it on and writes back privately, and you mark it answered when it has been." → "A student's question goes to a few alumni who can help with it, not to everyone. One of them takes it and replies to the student privately. When the student has an answer, they mark the question as answered."
- "Block anyone: you won't see each other anywhere, and they aren't told." → "You can block anyone. You won't see each other anywhere, and we won't tell them."
- "Report anything to the college's alumni coordinators, who can take it down." → "You can report anything to the college's alumni coordinators. They can remove it."

### lib/about-content.ts (shown on /community and /developers)
- "…and give back in the time they have." → "…and help students when they have time."
- "The people directory, profiles, connections and messages" → "Network: members' pages, connections and messages"
- "Home: posts, photos, stories and what your batch is up to" → "Home: posts, photos, stories and news from your batch"
- "Causes members propose and the college approves, with gifts through the college's account" → "Causes that members suggest and the college approves. Donations go through the college's account."
- "Teachers and college staff join by an invitation from the college desk." → "…join with an invitation from the college desk."
- Developers intro: "The aim: one place where … with questions answered by seniors, referrals, events, and keeping in touch with your batch." → "The aim was one place where HKBK's students and alumni help each other. Seniors answer questions and share referrals, the college shares events, and everyone stays in touch with their batch."

### app/committee/page.tsx
- Title "The people who keep / us together" → "The alumni association / committee"
- Intro "HKBK's alumni association: its office bearers, and a representative from every department." → "The office bearers of HKBK's alumni association, and a representative from each department."

### components/site-header.tsx
- Skip link "Skip to the page" → "Skip to main content"
- aria-label "Alumnity, HKBK College of Engineering's alumni network: home" → "Alumnity, HKBK College of Engineering alumni network, home page"
- aria-label (logged in) "Alumnity, your Home" → "Alumnity, go to Home" (consistency pass)

### components/campus-landing.tsx
- "Placements, electives, higher studies: a question reaches seniors who know." → "Ask about placements, electives or higher studies. Your question goes to seniors who know."
- "Alumni say what they're happy to help with; students find them." → "Alumni say what they can help with, and students can find them."
- Kicker "Come back" → "Events"
- "Members hear first: join, and you'll get the invitation." → "Members hear about it first. Join to get the invitation."
- "Photos from HKBK's years →" → "See photos from past years →"
- "Find it, and you're in. It takes a minute." → "Find your name to join. It takes a minute."

### lib/eras.ts
- "Alumni come home" → "Alumni come back"

### components/coming-soon.tsx
- "${what} opens soon: this is an early preview of Alumnity." → "${what} is coming soon. This is an early preview of Alumnity."

### app/dev/seed/page.tsx (developer only)
- "Nobody can sign in as them." → "Nobody can log in as them."
- "Two of them will ask to connect with you" → "Two of them will send you a connection request"
- "Log in first and two of them will ask to connect with you." → "Log in first, and two of them will send you a connection request."
- "Remove them" → "Remove sample members"

### app/privacy/page.tsx (wording only; same meaning, same data)
- Register: "…from the college’s own records. It’s how we know you studied here; it’s never shown to anyone in full. Logged-in members can search it for someone’s name, to invite them: they see a name, branch and year, never a USN, and only a few searches an hour, so it can’t be copied out." → "…It comes from the college’s own records. We use it to check that you studied here. It’s never shown to anyone in full. Logged-in members can search it by name to invite someone. They see only a name, branch and year, never a USN. They can do only a few searches an hour, so nobody can copy the register."
- Email: "…to sign you in and send your codes (and, if you leave it on, one daily email when something’s waiting). Other members never see it." → "…to log you in and send your codes. If you leave daily emails turned on, we also send you one email a day when something is waiting for you. Other members never see your email address."
- Password: "…kept only as a one-way scrambled form by our login provider." → "Our login provider keeps it only in a scrambled form that can’t be turned back."
- "stories (gone after a day), messages, Asks, …" → "stories (they disappear after a day), messages, questions in Ask a senior, …"
- Running the site: "when you were last here (to the hour), the browsers you’re logged in on, and, for a day, the network addresses of recent attempts, so nobody can guess passwords or spam." → "when you last visited (to the nearest hour) and the browsers you’re logged in on. For one day, we also keep the network addresses of recent attempts (for example, attempts to log in), so that nobody can guess passwords or send spam."
- Use: "…only to run Alumnity for HKBK’s students and alumni: to verify who joins, … We don’t sell it, rent it, or use it for advertising, and there are no advertising or tracking cookies: the only cookies keep you logged in." → "…only to run Alumnity for HKBK’s students and alumni. We use it to check who joins, to show your page …, to deliver messages and notifications, to keep members safe and to handle donations. We don’t sell it, rent it or use it for advertising. There are no advertising or tracking cookies. The only cookies are the ones that keep you logged in."
- "Other members see only what you share, with whom you chose (…)." → "Other members see only what you share with them. You choose who that is: everyone, your batch, your connections, a group, or only you."
- "Messages are seen only by you and the person you’re writing to. A message reported to the college desk is seen by the desk." → "Only you and the person you’re writing to can see your messages. If a message is reported to the college desk, the desk can see it."
- "…can see members’ details, what’s been reported, and donations, to keep the site safe and account for money." → "…can see members’ details, reports and donations. They need this to keep the site safe and to keep track of money."
- "If you give to a cause, your name is shown with your gift unless you choose not to be named; the amount is shown only to you and the college." → "If you donate to a cause, your name is shown with your donation, unless you choose not to be named. Only you and the college can see the amount."
- "These handle data for us … they’re bound to protect it." → "These services handle data for us … Some of them may keep data outside India. They are bound to protect it."
- How long: "As long as you have an account. Delete your account in Settings and … go, for good. …; the desk’s audit log keeps a record that an action happened." → "We keep it as long as you have an account. If you delete your account in Settings, … are deleted for good. … The desk’s audit log also keeps a record that an action happened."
- Rights: "You can see and correct what’s on your page at any time, … to correct or erase it, to name someone to act for you, and to complain: write to …" → "At any time, you can see and correct what’s on your page, … You may ask it to correct or erase that data, name someone to act for you, or make a complaint. To do any of these, write to …"
- Security: "Everything travels encrypted. Passwords are never stored readably. … every file is served only to logged-in members who may see it. Tell … at once if you think something is wrong." → "Everything is sent in encrypted form. Passwords are never stored in a form anyone can read. … Each file is shown only to logged-in members who are allowed to see it. If you think something is wrong, tell … at once."

### app/terms/page.tsx (wording only; same obligations)
- "…your own entry in the college register; one person, one account. Don’t join as anyone else, share your account, or let anyone else use it." → "…your own entry in the college register. Each person may have only one account. Don’t join as anyone else, don’t share your account, and don’t let anyone else use it."
- "No spam, … or selling to people who didn’t ask. Job posts and referrals are welcome when they’re real." → "No spam, … or selling to people who didn’t ask for it. Real job posts and referrals are welcome."
- "The desk may take down what breaks these rules and pause or remove accounts. … If you think the desk got it wrong, …" → "The desk may remove anything that breaks these rules, and may pause or remove accounts. … If you think the desk made a mistake, …"
- "You let the college show it … Delete it, or your account, and it goes." → "You allow the college to show it … If you delete it, or delete your account, it is removed."
- "It goes live only once the college desk approves it; the desk may ask questions, decline, or close a cause." → "It is published only after the college desk approves it. The desk may ask questions, decline a cause, or close it."
- "Donations are voluntary and, once made, can’t be withdrawn, except where a payment was made in error: then write to …" → "Donations are voluntary. Once made, a donation can’t be withdrawn. The only exception is a payment made in error: in that case, write to …"
- "A donation receipt for tax purposes is available only where the college issues one; Alumnity itself doesn’t." → "…available only if the college issues one. Alumnity itself doesn’t issue receipts."
- "…offered as it is: it may sometimes be unavailable, and the college isn’t responsible for … (a job, a referral, a meeting). Use your judgement, …" → "…offered as it is. It may sometimes be unavailable. The college isn’t responsible for … (such as a job, a referral or a meeting). Use your own judgement, …"

---

## Join, log in, accounts, emails, API

### app/join/page.tsx
- description "…join in a minute: your batch, seniors who mentor, jobs and referrals." → "…join in a minute. Meet your batch, get help from seniors, and find jobs and referrals."
- "Everyone here is on the college’s own register: N students from every course since YYYY. Find your name, and you’re in." → "Everyone here is on the college register: N students from every branch since YYYY. Find your name to join."

### app/join/staff/page.tsx
- "Confirm your email, choose a password, and you're in." → "Confirm your email and choose a password to join."

### app/login/page.tsx
- "Your page in the register is waiting." → "Log in with your email and password."

### app/forgot/page.tsx
- "We’ll email you a code, and you choose a new password." → "We’ll email you a code. Then you can choose a new password."

### components/join/fields.tsx
- "Sent to {email}. It works for 15 minutes. Not there? Check spam, or ask for a new one below." → "We sent it to {email}. It works for 15 minutes. Can’t find it? Check your spam folder, or ask for a new code below."
- "At least 10 characters. A few words you’ll remember works well." → "Use at least 10 characters. A few words you can remember work well."

### components/join/forgot-form.tsx
- "The one you joined with." → "Use the email you joined with."
- "Remembered it? Log in" → "Remember your password? Log in"
- "If {email} has an account, a code is on its way to it." → "If {email} has an account, we have sent a code to it."

### components/join/login-form.tsx
- "Opening your page…" → "Logging in…"

### components/join/staff-join-form.tsx
- "Welcome, {first}. A code is on its way to {email}." → "Welcome, {first}. We have sent a code to {email}."
- "Making your account…" → "Creating your account…"

### components/join/register-book.tsx
- "Your page is in here" → "Ready to log in"
- "Signed in" / "Not signed in" → "Logged in" / "Not logged in"

### components/join/join-flow.tsx
- "Find seniors who've been where you are." → "Get help from seniors and alumni."
- "Find your batch, and help the ones after you." → "Find your batch, and help the students who came after you."
- "Bring your department's people together." → "Stay in touch with your department's students and alumni."
- "…Check your USN, and your name as it's written on your marks card." → "…Check your USN. Type your name as it is on your marks card."
- "More than one person on the register fits that. Add your USN to tell you apart." → "More than one person in the register matches these details. Add your USN so we can find you."
- "That's a lot of tries in a short time. …" → "You have tried too many times. Wait a few minutes and try again."
- "The register isn't reachable just now. Please try again in a little while." → "We can't reach the register right now. Please try again later."
- "Fill in your name, and your USN (or your branch and the year you joined)." → "Enter your name and your USN. If you don't know your USN, enter your branch and the year you joined."
- "Teachers and staff aren’t in the college register, so the college desk invites you by email. …" → "Teachers and staff are not in the college register. The college desk invites you by email instead. …"
- "Looking through the register…" → "Searching the register…"
- "{n} others from your batch are on it too." → "{n} others from your batch are on the register too." (and "1 other person …" when there is one; the old text said "1 others")
- "A personal one: your college email stops working after you graduate. …" → "Use a personal email. Your college email stops working after you graduate. …"
- Button "That’s my code" → "Confirm code"
- "Your email is confirmed. Last thing: a password, for logging in next time." → "Your email is confirmed. Last step: choose a password. You will use it to log in."
- "Making your account…" → "Creating your account…"

### lib/server/auth.ts, lib/server/auth-provider.ts
- "That’s a lot of tries in a short time. Wait a few minutes and try again." → "You have tried too many times. Wait a few minutes and try again." (both files)
- "That code isn’t right. Check the email, or ask for a new one." → "That code is wrong. Check the email we sent, or ask for a new code."
- "Joining is paused by the college for now. …" → "The college has paused joining for now. …"
- "The register isn’t reachable just now. …" → "We can’t reach the register right now. Please try again later."
- "That line in the register already has an account. …" → "This person in the register already has an account. …"
- "This joining link has expired. Please start again." → "Your joining session has expired. Please start again."
- "That entry or that email already has an account. Log in instead." → "Someone has already joined with these register details or this email. Log in instead."
- "That email and password don’t match. …" → "Wrong email or password. Check them, or reset your password."
- "This account is paused by the college. Write to the alumni office to sort it out." → "The college has paused this account. Please write to the alumni office for help." (2 places)

### lib/server/staff.ts (and the staff invitation email)
- "Someone more senior has invited them to a role above yours: only they can change or withdraw it." → "Someone with a higher role than yours invited this person. Only they can change or cancel this invitation."
- "Their name, as members will see it." → "Enter their full name, as members will see it."
- "That email already has an account: change their role in Members instead." → "That email already has an account. Change their role in Members instead."
- "That's a lot of invitations today. …" → "You have sent too many invitations today. Try again tomorrow."
- Email: "…help each other: questions answered by seniors, events, groups and staying in touch." → "…help each other. Seniors answer questions, and members join events and groups and stay in touch."
- Email: "Join with this email address; we'll send you a code…" → "Join with this email address. We'll send you a code…"
- Email footer: "If you weren't expecting this, you can ignore it: nothing happens unless you join." → "If you weren't expecting this email, you can ignore it. Nothing happens unless you join."
- "There's no open invitation for that email. Check it's the one the college wrote to, …" → "We can't find a valid invitation for that email. Check that it's the email the college wrote to, …"
- "This joining link has expired. …" → "Your joining session has expired. …"
- "This login is already tied to another member's account. The college desk can sort it out." → "This login is already linked to another member's account. Please ask the college desk for help."

### lib/server/secrets.ts (password rules)
- "That’s too long: 200 characters at most." → "That’s too long. Use 200 characters or fewer."
- "Not just numbers: add some letters." → "Don’t use only numbers. Add some letters too."
- "Use a wider mix of characters." → "Use more different characters."
- "Leave out “{word}”: it’s too easy to guess." → "Don’t use “{word}”. It’s too easy to guess."

### lib/server/http.ts
- "Something went wrong finishing that step. Please try again: it will pick up where it stopped." → "Something went wrong. Please try again. You will continue from the same step."

### lib/server/digest.ts (daily email)
- "question(s) that fit(s) you" → "question(s) you can help with"
- "Waiting for you on Alumnity: {summary}." → "New on Alumnity for you: {summary}."
- Footer "One email a day at most, only when something's waiting. Stop these: {link}" / "Turn these off in Settings." → "We send at most one email a day, and only when you have something new. To stop these emails: {link}" / "You can turn these emails off in Settings."
- Subject "Something's waiting for you on Alumnity" → "You have new notifications on Alumnity"

### app/api/alerts/unsubscribe/route.ts
- "Done: no more daily emails. …" → "Done. We won't send you daily emails any more. You can turn them back on in Settings."
- "That link doesn't work any more. Turn the emails off in Settings instead." → "This link no longer works. You can turn off the emails in Settings."

### app/api/alerts/route.ts
- "Try again in a little while." → "You have made too many changes. Try again later."
- "This browser's notifications couldn't be turned on." → "We couldn't turn on notifications for this browser."

### app/api/media/route.ts
- "That’s a lot of uploads in an hour. Try again a little later." → "You have uploaded too many files in the last hour. Try again later."

---

## Home page, app bar and menus

### app/(member)/home/page.tsx
- Shortcut "Jobs board" → "HKBK board"
- "Make your page yours" / "A photo, what you do now, what you're happy to help with" → "Complete your page" / "Add a photo, your current work and how you can help"
- "Everyone from your year who's here, and how many still aren't" → "See who from your year has joined, and who has not"
- "Questions go to the few alumni who fit them" → "We send your question to alumni who can answer it"
- "Back a cause" → "Support a cause"
- "Say you're happy to mentor: questions that fit you start reaching you" → "Offer to mentor, so students can send you their questions"
- "Put up a first announcement: it shows at the top of everyone's Home" → "Post your first announcement. It shows at the top of everyone's Home page."
- "Ask a senior something" → "Ask a senior a question"
- "Put up an event: a talk, a reunion, a department day" → "Add an event, such as a talk, a reunion or a department day"
- "Nothing from the people you follow matches. Try fewer filters, or other words." → "No posts from people you follow match. Try fewer filters or different words."
- "Nothing yet from your people" → "No posts here yet"
- "Posts from people you're connected to or follow show here. …" → "Posts from your connections and people you follow will show here. …"
- "Be one of the first: say hello, find your batch, and bring them in." → "Be one of the first to post. Say hello, find your batch and invite them."
- "← Newest" → "← Back to newest posts"
- "Coming up" → "Upcoming events"
- " · you too" → " · including you"
- aria-label "N% of the goal" → "N% of the goal raised"

### app/(member)/report/page.tsx
- Placeholder "Spam, rude, pretending to be someone, something unsafe…" → "For example: spam, rude words, a fake account, or something unsafe"
- Button "Send to the college desk" → "Send report"

### app/(member)/loading.tsx
- "Opening…" → "Loading…"

### components/home/know-everyone.tsx
- "You've reached out to everyone we'd suggest. The network grows when your batch joins: bring them in." → "We have no one else to suggest right now. Alumnity grows when your batch joins, so invite them."

### components/home/feed-filters.tsx
- "Filters on: …" → "Filters in use: …"; ", on: " → ", in use: "
- "Clear the search" → "Clear search"
- "#tag, on. Take it off" → "Remove the #tag filter"
- "Only #tag" → "Show posts with #tag"
- "Only posts from specific people: type a name" → "Show posts from specific people: type a name"

### components/app/app-bar.tsx (More menu)
- "Questions to alumni who fit them" → "Get answers from alumni who can help"
- "Jobs, internships and notices the college checked" → "Jobs, internships and notices checked by the college"
- "Give to what HKBK people care about" → "Donate to scholarships and people in need"
- "Requests, and the people you know" → "Your connections and connection requests"
- "HKBK through the years, in photos" → "Photos of HKBK over the years"
- aria-label "Alumnity, your Home" → "Alumnity, go to Home"

### components/app/post-card.tsx
- "Remove this post? It can't be brought back." → "Delete this post? You can't undo this."
- Post button "Remove" → "Delete post"; comment button "Remove" → "Delete"

### components/home/role-focus.tsx
- "{name} took it on: read their reply" → "{name} is answering. Read their reply."
- "Waiting for a senior to take it on" → "Waiting for a senior to answer"
- "Seniors happy to mentor, CSE first" → "Seniors happy to mentor (CSE first)"
- "Students' questions that fit your branch and what you know come here, a few at a time. You can stop whenever you like." → "If you mentor, we send you a few student questions that match your branch and skills. You can stop at any time."
- Button "I'm happy to mentor" → "Start mentoring" (consistency pass, to match Ask a senior)
- "Nothing waiting for you. When a question fits you, it comes here and we tell you." → "No questions for you right now. When a question matches you, it will show here and we will tell you."
- "N more from your batch aren't here yet." → "N more from your batch have not joined yet." ("has" when N is 1)
- "Nobody else from your batch is here yet (N joined HKBK with you). Bring them in:" → "No one else from your batch has joined yet (N people joined HKBK with you). Invite them:"
- "Hiring where you work?" → "Is your company hiring?"
- "Post it with #job or #internship. The college checks it and puts it on the HKBK board, where students look, and they can ask you for a referral." → "Post the opening with #job or #internship. The college checks it and adds it to the HKBK board. Students see it there and can ask you for a referral."
- "Nothing coming up from you. A guest talk by an alumnus, a reunion, a department day: alumni come back for these." → "You have no upcoming events. Alumni like to come back for guest talks, reunions and department days."
- "Put up an event" → "Add an event"
- "Students' questions that fit your department and what you know come here." → "If you agree, student questions that match your department and skills will show here."
- Button "I'm happy to answer them" → "Start answering questions" (consistency pass)
- Desk intros: "The whole site: what's waiting for the desk, how it's going, and how it's set up." → "The whole site: what needs review, this week's activity and site settings."; "What's waiting for the college desk, and how the week is going." → "What needs review at the college desk, and this week's activity."
- "Waiting for the desk" → "Waiting for review"
- "A {kind} reported: “…”" → "Reported {kind}: “…”" (a question now reads "question", not "ask"; the label map is used for display only)
- "Approve it so members can give, or say why not." → "Approve it so members can donate, or explain why not."
- "N was/were here" → "N logged in"
- "Put up an announcement" → "Post an announcement"
- "The college desk →" → "Open the college desk →"
- "The site" → "Site status"; "Lately on the desk" → "Recent desk activity"; "The audit log →" → "Open the audit log →"
- "Gathering what’s for you…" → "Loading your updates…"

---

## Posts, comments, reactions, stories

### components/social/composer.tsx
- aria-label "Who can see it" → "Who can see this post"
- "Tag it (optional)" → "Add a tag (optional)"
- aria-label "Remove" → "Remove photo or video"
- "They're mentioned in your post, and each is told (if the post is for people they're among)." → "We add their names to your post. Each person gets a notification if they can see the post."

### components/social/edit-delete.tsx
- "That didn't work: check your connection and try again." → "That didn't work. Check your internet connection and try again."
- Label "What it says" → "Text"
- Placeholder "Write something… (@ to mention)" → "Write something. Type @ to mention someone."
- "Save" → "Save changes"
- "Who it's for and its photos stay as they are. It comes off the HKBK board until the college checks it again." → "You can change the text only. Who can see the post and its photos stay the same. The post leaves the HKBK board until the college checks it again."
- "Who it's for and its photos stay as they are. It will show as edited." → "You can change the text only. Who can see the post and its photos stay the same. The post will show as edited."
- "It goes for everyone, with its reactions and comments. It can't be brought back." → "This deletes the post for everyone, with its reactions and comments. You can't undo this."
- "It goes for everyone in the group, with its comments. It can't be brought back." → "This deletes the post for everyone in the group, with its comments. You can't undo this."
- "It goes for everyone. It can't be brought back." → "This deletes the comment for everyone. You can't undo this."

### components/social/infinite-feed.tsx
- "Loading more" → "Loading more posts"
- "Couldn't load more. Try again" → "Couldn't load more posts. Try again"
- "That's every post that matches these filters." → "No more posts match these filters."
- "…Come back soon: HKBK keeps posting." → "…Come back later for new posts."

### components/social/name-mark.tsx
- "On the HKBK register" → "Verified: on the HKBK college register"

### components/social/people-picker.tsx
- "That's {max}: the most at once." → "You can choose up to {max} people."

### components/social/post-media.tsx
- "…, and N more: open the viewer" → "…, and N more. Open to see all"
- "…: open larger" → "…. Open full size"
- "Previous" / "Next" → "Previous photo" / "Next photo"

### components/social/post.tsx
- "Brought over from the old HKBK alumni website, with its date" → "Moved here from the old HKBK alumni website. It keeps its original date."
- "The college checked this post: it's on the HKBK board" → "The college checked this post. It is on the HKBK board."
- "More" (menu) → "More options"
- "Take off the HKBK board" → "Remove from the HKBK board"
- "Verify for the HKBK board" → "Verify and add to the HKBK board"
- "Why you fit" → "Why you are a good fit"
- Placeholder "…what you've built or studied that fits. …" → "…and what you have built or studied that fits. …"
- "Not connected yet? It goes as a connection request with this note. Connected? It goes to them in Messages." → "If you are not connected yet, we send this note with a connection request. If you are connected, we send it as a message."
- "Write a comment… (@ to mention)" → "Write a comment (type @ to mention someone)"

### components/social/reaction-bar.tsx
- "All reactions" → "Choose a reaction"

### components/social/repost-card.tsx
- "It may have been deleted, or it's shared with people you aren't among." → "It may have been deleted, or only some people can see it."

### components/social/repost-menu.tsx
- "Reposted. It's in the feeds of the people this post is for." → "Reposted. Everyone who can see the original post will see it in their feed."
- "Share it to your network at once" → "Share it now, without adding your own words"

### components/social/send-sheet.tsx
- "A note with it (optional)" → "Add a note (optional)"
- "Send to N" → "Send to N people"

### components/social/share-sheet.tsx
- "This post isn't for everyone, so it isn't offered to other apps. Its link opens only for people who can already see it. Use Send to pass it to a connection." → "Only some people can see this post, so you can't share it to other apps. The link works only for people who can already see the post. To share it with a connection, use Send."
- "The post's link" → "Link to this post"

### components/social/stories.tsx
- "Previous" / "Next" → "Previous story" / "Next story"
- "That didn't send: check your connection and try again." → "That didn't send. Check your internet connection and try again."
- "React ❤️" → "React with ❤️"
- "Add another" → "Add another story"
- "A line to go with it" → "Caption (optional)"; placeholder → "Add a caption (optional)"

### lib/server/posts.ts
- "That post isn't here any more." (9 places) → "This post is no longer available."
- "A repost goes on Home, not into a group." → "You can't repost into a group. Reposts go on Home."
- "A repost can't carry photos of its own." → "You can't add photos to a repost."
- "A group's posts stay in the group." (2) → "Posts in a group can't be shared outside the group."
- "Choose who it's for." → "Choose who can see your post."
- "Your batch isn't known, so this can't go to it." → "We don't know your batch yet, so you can't post to it."
- "One of those photos isn't yours to post." → "You can post only photos and videos that you uploaded."
- "That photo is already posted." → "That photo or video is already in another post."
- "That's a lot of posts in an hour. Try again a little later." → "You've posted a lot in the last hour. Try again later." (the same pattern for edits, reactions and comments)
- "Send it to up to N people at a time." → "You can send it to up to N people at a time."
- "One of them isn't here any more." → "One of these people is no longer on Alumnity."
- "You can send posts to your connections only, and X isn't one." → "You can send posts only to your connections. X is not one of your connections."
- "X can't see this post, so it can't be sent to them." → "X can't see this post, so you can't send it to them."
- "Sent to N, then: …" → "Sent to N person/people, then it stopped: …"
- "Only the one who wrote a post/comment can delete/edit it." → "Only the person who wrote this post/comment can delete/edit it."
- "That isn't a reaction." → "Choose one of the reactions shown."
- "That comment isn't here any more." → "This comment is no longer available."
- "Only a post for everyone can go on the board." → "Only posts that everyone can see can go on the HKBK board."
- Notification "On the HKBK board: … from X. You said you're looking." → "New on the HKBK board: … posted by X. You said you are looking for one."
- "That's your own post." → "You can't ask for a referral on your own post."
- "You can ask for a referral on a #job, #internship or #referral post." → "You can ask for a referral only on a post tagged #job, #internship or #referral."
- "Write a line or two about why you fit: your branch, skills, a project." → "Write a line or two about why you are a good fit, such as your branch, skills or a project."
- Message prefix "Referral, about your #tag post: " → "Referral request about your #tag post: "

### lib/server/stories.ts
- "That's already posted." → "That photo or video is already posted."
- "That's twenty stories today: the most in a day." → "You can add up to 20 stories in 24 hours. Try again later."
- "That story isn't here any more." (2) → "This story is no longer available."
- "That's your own story." → "You can't reply to your own story."
- "That isn't a reaction." → "Choose one of the reactions shown."

### lib/actions/content.ts
- "That post / comment isn't here any more." → "This post / comment is no longer available."
- "Verified: it's on the HKBK board." → "Verified. It is now on the HKBK board."
- "Taken off the board." → "Removed from the HKBK board."
- "Only your own posts can go at the top of your page." → "You can pin only your own posts to the top of your page."
- "Taken off the top of your page." → "Unpinned from the top of your page."
- "Your story is up for 24 hours." → "Your story is posted. It will show for 24 hours."
- "Story removed." → "Story deleted."
- "It's yours. Write to them below." → "You're now answering this question. Write your reply below."
- "Marked answered. Your thanks are on their Record." → "Marked as answered. Your thanks now show on their Record."
- "Cancelled. Everyone coming was told." → "Event cancelled. We have told everyone who said they were coming."

---

## Network, connections, messages, notifications

### app/(member)/people/page.tsx (Network)
- "Requests" → "Connection requests"
- "None of them is on Alumnity yet: invite them" → "None of them have joined Alumnity yet. You can invite them."
- "Years here are when people joined HKBK. Finished in {year}?" → "Years here are the year people joined HKBK. Looking for people who finished in {year}?"
- "See those who joined in …" → "See people who joined in …"
- "Nobody matches that yet. Try fewer words or another spelling, or clear the search." → "Nobody matches your search. Try fewer words or a different spelling, or clear the search."
- "You've searched the college register N times this hour, the most allowed. Members still show; you can search the register again within the hour." → "You can search the college register N times an hour, and you have reached that limit. Members still show here. Try the register again later."
- "N people joined HKBK in your batch; none of them are / M is/are here yet besides you." → "N people joined HKBK in your batch. None of them have joined Alumnity yet." / "… M of them has/have joined so far."
- "Each person who joins makes it more useful for everyone: bring your batch in." → "Alumnity gets more useful with each person who joins. Invite your batch."
- "Ask someone about their company, or for a referral: tap one to see who's there." → "Tap a company to see who works there. You can ask them about the company or for a referral."
- "Nobody else has joined yet. You'll see everyone here as they do." → "Nobody else has joined yet. New members will show here when they join."
- "From the college's own register of students… Use Filters to look through one batch. Know someone? Send them the link: they join by finding their name." → "These names come from the college's register of students… Use Filters to see one batch. Know someone here? Send them the link. They join by finding their name."
- "You've looked through N pages of the register this hour, the most allowed. …" → "You can look through N pages of the register an hour, and you have reached that limit. Try again later."

### app/(member)/connections/page.tsx
- "Waiting for you" → "Requests waiting for you"
- "Withdraw" → "Withdraw request" (consistency pass)
- "You don't see each other anywhere on Alumnity. They aren't told." → "You can't see each other anywhere on Alumnity. We won't tell them that you blocked them."

### app/(member)/messages/[id]/page.tsx
- "You can write to {first} once you're connected. Connect from their page." → "You can message {first} once you're connected. Go to their page to connect."

### app/(member)/notifications/page.tsx
- "N new since you last looked" → "N new since your last visit"
- "Nothing here yet. Connection requests, replies and answers will show up here. A good way to start: ask a senior a question, or connect with someone." → "No notifications yet. Connection requests, replies and answers will show here. To get started, ask a senior a question or connect with someone."

### app/(member)/batch/[branch]/[year]/page.tsx
- Title "A batch · Alumnity" → "Batch · Alumnity"
- Back link "Batches" → "Your batch"
- "N from your batch aren't here yet." → "N people from your batch haven't joined Alumnity yet." ("1 person … hasn't" when there is one)
- "Nobody else from your batch is here yet." → "Nobody else from your batch has joined Alumnity yet."

### components/people/people-search.tsx
- "Anything" → "Any" (matches the Branch filter)
- "Have a chat" → "Chat"; "Up for a chat" → "Happy to chat"; "Remove the filter: up for a chat" → "Remove the filter: happy to chat"

### components/people/person-card.tsx
- "Take back your request to {first}?" → "Withdraw your connection request to {first}?"
- "Waiting for them. Tap to take it back." → "Waiting for them to accept. Tap to withdraw your request."

### components/messages/message-actions.tsx
- "That didn't work: check your connection and try again." → "That didn't work. Check your internet connection and try again."
- "Couldn't copy here: select the words and copy them instead." → "Couldn't copy the text. Select it and copy it yourself."
- "What to do with this message" → "Message options"; "This chat with {name}" → "Options for your chat with {name}"
- "Its words are removed for you and {first}. …" → "The message is removed for you and {first}. You will both see “This message was deleted”."
- "It goes from your side of the chat only: {first} still has it." → "The message is removed only for you. {first} will still see it."
- "Every message in it goes from your side only: … If either of you writes again, the new messages show here." → "All messages in this chat are removed only for you. {first} will still see them. If either of you sends a new message, it will show here."

### components/messages/messenger.tsx
- "You can message your connections, and you haven't any yet." → "You can only message your connections, and you don't have any yet."
- "No connection called “{q}”." → "No connection matches “{q}”."

### components/messages/thread-view.tsx
- "That didn't send. Try again." → "Your message wasn't sent. Try again."
- "That didn't send: check your connection and try again." → "Your message wasn't sent. Check your internet connection and try again."
- "All messages" (back) → "Back to all messages"

### components/app/people-to-reach.tsx
- "Write to someone" → "Message someone"; button "Write" → "Message"
- "Once they accept, you can write to each other." → "Once they accept, you can message each other."
- "Ask a senior something" → "Ask a senior a question"
- "Your question goes to the few who fit it." → "Your question goes to a few seniors who can best answer it."
- "Say you're happy to mentor, and the ones that fit you come here." → "Say you're happy to mentor. Questions that match what you know will come to you."
- "See what's coming up" → "See upcoming events"

### components/profile/alerts-panel.tsx
- "Your alert settings didn't load. Check your connection, …" → "…Check your internet connection, then reload the page."
- "Notifications couldn't be turned on here. Try again, or in another browser." → "We couldn't turn on notifications in this browser. Try again, or use another browser."
- "Not available yet: the college is setting them up." → "Not available yet. The college is still setting this up."
- iPhone help: "…(Share → Add to Home Screen), open it from there, and turn them on in its Settings." → "…(Share → Add to Home Screen). Then open Alumnity from your home screen and turn on notifications in Settings."
- "On: new messages, requests, mentions and replies show here." → "Notifications are on. New messages, connection requests, mentions and replies will show in this browser."
- "A daily email when something's waiting for me (at most one a day)" → "Send me an email when something is waiting for me (no more than one a day)"

### lib/server/social.ts
- "That member isn’t here." / "…isn't here any more." → "We couldn’t find that member."
- "That’s the college’s own account: there’s nobody to connect with." → "This is the college’s own account. You can’t connect with it."
- "Your request is already waiting for them." → "You’ve already sent them a connection request."
- "That’s N requests today: the most in a day. Try again tomorrow." → "You’ve sent N connection requests today. That’s the daily limit. Try again tomorrow."
- Notification "{name} would like to connect." → "{name} sent you a connection request."
- "That request isn’t waiting any more." → "This connection request has already been answered or withdrawn."
- Notification "{name} accepted your request. You’re connected." → "{name} accepted your connection request. You’re now connected."
- "Write something first." → "Type a message first."
- "You can message your connections. Connect first, or use Ask a senior." → "You can only message your connections. Connect with them first, or use Ask a senior."
- "That’s a lot of messages in an hour. Take a breather and try again." → "You’ve sent too many messages in the last hour. Please wait a while and try again."
- "That message isn't here any more." → "We couldn't find that message."
- "A message can be edited for 15 minutes after it's sent." → "You can only edit a message for 15 minutes after you send it."
- "Write something, or delete the message instead." → "Type a message, or delete it instead."
- "Only the one who sent a message can delete it for everyone." → "Only the sender can delete a message for everyone."
- "That conversation isn't here." → "We couldn't find that conversation."

### lib/server/follows.ts
- "That member isn't here." → "We couldn't find that member."
- "That's a lot of following today. …" → "You've followed a lot of people today. Try again tomorrow."

### lib/actions/social.ts
- "Request sent." → "Connection request sent."
- "Sent to them in Messages." → "Sent. You can find it in Messages."
- "Declined. They aren't told." → "Declined. We won't tell them."
- "Request withdrawn." → "Connection request withdrawn."
- "Thank you. The college desk will look at it; they won't say who reported it." → "Thank you. The college desk will review it. They won't tell anyone who reported it."
- "Done. Questions that fit what you know will reach you here." → "Done. Questions that match what you know will come to you here."

### lib/actions/messages.ts
- "That member/message isn't here any more." / "That conversation isn't here." → "We couldn't find that member/message/conversation."
- "That story isn't here any more." → "This story is no longer available."

---

## Profile, settings, alumni card, uploads

### app/(member)/people/[id]/page.tsx (someone's page)
- "Withdraw" → "Withdraw request"
- "{first} would like to connect." → "{first} sent you a connection request."
- "Remove {first} from your connections? They aren't told." → "…? We won't tell them."
- "Block {first}? You won't see each other anywhere on Alumnity, and any connection ends. They aren't told." → "Block {first}? You won't see each other anywhere on Alumnity. If you are connected, the connection ends. We won't tell them."
- "· answered N Ask(s)" → "· answered N question(s) on Ask a senior"

### components/profile/activity.tsx
- "Unpin from the top" → "Unpin this post"; "Pin to the top of my page" → "Pin to the top of your page"

### components/profile/alumni-card-viewer.tsx
- "Your digital HKBK alumni card: your member number, and a code anyone can scan…" → "Your digital HKBK alumni card. It shows your member number and a QR code that anyone can scan…"
- "Turn it over" → "See the back"
- "Sharing didn't work here. …" → "Sharing did not work on this device. …"
- "Download" → "Download the front"

### components/profile/crop-tool.tsx
- "Drag to move {x}. Arrow keys move it too; plus and minus zoom." → "Drag to move {x}. You can also move it with the arrow keys, and zoom with the plus and minus keys."
- "Frame your photo" / "Place the campus drawing" / "Frame your cover" → "Adjust your photo" / "Adjust the campus drawing" / "Adjust your cover"
- "…and zoom to come closer. Your alumni card shows the square, corners and all." → "…Zoom in to make it bigger. Your alumni card shows the full square, including the corners."
- "Until you add a cover of your own, your page shows the campus from your year. Drag it to move it along the cover…" → "Until you add your own cover, your page shows a picture of the campus from your year. Drag it to move it, and zoom in to make it bigger."
- "…The cover is wider on a computer than on a phone: check both." → "…The cover is wider on a computer than on a phone, so check how it looks on both."

### components/profile/media-picker.tsx
- "Framed. It’s on your page when you save it below." → "Done. Save your changes below to show it on your page."
- "…Location details hidden in photos are removed. After choosing it, drag and zoom to frame it." → "…We remove any location details saved inside the photo. After you choose it, drag and zoom to adjust it."
- "An HTML cover arranges itself to fit the space, so there’s nothing to frame. …" → "An HTML cover fits itself to the space, so you do not need to adjust it. …"
- "…Photos and videos can be moved and zoomed to frame them. …" → "…You can move and zoom photos and videos to adjust them. …"

### components/profile/profile-editor.tsx and sections-editor.tsx
- Visibility: "My connections" / "My batch" / "Only me" → "Your connections" / "Your batch and connections" / "Only you" (the code shows "batch" parts to connections as well)
- "Just the city: never your address." → "Only your city, not your full address."
- "Only if you'd like: the stops between leaving college and now (…). Add one and your page shows your road, drawn in red pen, oldest first." → "Add the main steps between leaving college and now, such as a first job, a move to a new city or a startup. Your page shows them as a timeline, oldest first."
- "Remove the stop in {year}" / "+ Add a stop" → "Remove the step for {year}" / "+ Add a step"
- "Things you know well, with commas between them" → "Things you know well. Put a comma between each one."
- "Up to 12. These are what juniors search for." → "Add up to 12. Juniors search for these."
- "A senior to talk a decision through: a course, a project, a first job." → "A senior who can help you decide about a course, a project or a first job."
- "Alumni who hire, or know where to look, can find you." → "Alumni who hire, or who know about openings, can find you."
- "For when you apply where an alumnus works." → "For when you apply to a company where an alumnus works."
- "Answer questions, and see a student through a decision." → "Answer questions and help students make decisions."
- "When a junior’s a good fit, put them forward." → "When a junior is a good fit for a job, recommend them."
- Section "Find me" → "Your links"
- "Save my page" → "Save changes"
- "Still here" → "Current (no end year)"; "A few words (optional)" → "Short description (optional)"

### components/profile/profile-sheet.tsx
- "Ask about a decision, a project, a first job." → "Ask about a course, a project or a first job."
- "Puts a good fit forward at their company." → "Recommends good candidates at their company."
- "A senior to talk a decision through." → "A senior who can help with a decision."
- "Alumni who hire, or know where to look." → "Alumni who hire, or who know about openings."
- "When they apply where an alumnus works." → "For when they apply to a company where an alumnus works."
- "What are you up to: a project, a club, an internship? …" → "What are you doing now? A project, a club, an internship? …"
- "Not switched on. Light it when you edit your page: seniors can find you, and you hear when a job or internship goes on the HKBK board." → "Not switched on. Turn it on when you edit your page. Then seniors can find you, and we tell you when a job or internship is posted on the HKBK board."
- "Find you" / "Find them" → "Your links" / "Links"
- "Your LinkedIn, or a website." → "Add your LinkedIn or a website when you edit your page."

### components/profile/profile-strength.tsx, lib/profile-strength.ts
- "Your profile is complete" → "Your page is complete"; "What's left" → "What to add next"
- "Say what you do now / you're up to / you teach or do at HKBK" → "Add what you do now / you're doing now / you teach or do at HKBK"
- "Say what you're happy to help with / looking for" → "Choose what you're happy to help with / looking for"

### components/profile/settings-panel.tsx
- "Only you see it. You log in with it, and your codes go to it." → "Only you can see this. You use it to log in, and we send your login codes to it."
- "…Anywhere else you were logged in, you’ve been logged out." → "…We have logged you out on all your other devices."
- "Lost a phone, or logged in on a shared computer? Log out everywhere except here." → "Lost your phone, or logged in on a shared computer? Log out of all your other devices."
- "Logged out of N other place(s)." → "Logged out of N other device(s)."; "You weren’t logged in anywhere else." → "You were not logged in on any other device."
- "Log out everywhere else" → "Log out of other devices"
- "This deletes your account and your page from Alumnity for good." → "This permanently deletes your account and your page from Alumnity."

### components/profile/theme-choice.tsx
- "Cream paper, dark ink" → "Light background, dark text"
- "Dark paper, light ink: easier on the eyes at night" → "Dark background, light text. Easier on your eyes at night."
- "Light or dark, as your phone or computer is set" → "Follows the setting on your phone or computer"

### lib/profile-sections.ts
- "Courses besides HKBK: school, PU, a master's" → "Other courses: school, PU, a master's degree"
- "With or for (optional)" → "Who it was with or for (optional)"

### lib/server/settings.ts, lib/server/badges.ts
- "Events (putting up new ones)" → "Events (adding new ones)"
- "Has put up an event for HKBK" → "Has organised an event for HKBK"

### lib/client/upload.ts, lib/client/post.ts
- "The upload didn’t get through. Check your connection…" → "Your file did not upload. Check your internet connection and try again."
- "We couldn’t reach Alumnity. Check your connection…" → "…Check your internet connection and try again." (consistency pass)

### lib/server/media.ts
- "That’s too big: images can be up to N MB." → "This file is too big. Images can be up to N MB." (also for videos and HTML)
- "That file isn’t one we can use. Photos: JPEG, PNG, WebP or GIF. Videos: MP4 or WebM." → "That file isn’t one we can use. Photos must be JPEG, PNG, WebP or GIF. Videos must be MP4 or WebM."
- "Posts and stories take photos and videos." → "Posts and stories can only have photos and videos."
- "That's a lot of uploading today. Try again tomorrow." → "You’ve reached today’s upload limit. Try again tomorrow."
- "The file didn’t arrive. Try again." → "The file did not upload. Try again."

### lib/server/profile.ts
- "A link in {section} doesn’t look right." → "A link in {section} is not a valid web address. Check it and try again."
- "That LinkedIn link doesn’t look like a LinkedIn profile." → "Enter a LinkedIn profile link, such as linkedin.com/in/your-name."
- "That website link doesn’t look right." → "Your website link is not a valid web address. Check it and try again."
- "That upload isn’t yours, or has gone. Upload it again." → "We couldn't find that file. It may have been deleted. Please upload it again."

---

## Ask a senior, HKBK board, events, causes, groups, college desk

### app/(member)/ask/page.tsx
- Status "A senior is on it" → "A senior is helping"
- " · came to you: {reason}" → " · sent to you because: {reason}"
- "Your question, in a line" → "Your question, in one line"; "A few lines more" → "More details"
- Placeholder "What you've tried, what you're stuck on, what would help." → "What have you tried? Where are you stuck? What would help?"
- "Topics help it reach seniors who know them." → "Topics help your question reach seniors who know about them."
- "Send the question →" → "Send question →"
- "You're mentoring. Students' questions that fit your branch and what you know come here. Busy for a while? Pause it, and turn it back on here whenever you like." → "You are a mentor. Students' questions that match your branch and skills come here. Busy for a while? Pause mentoring. You can turn it back on here at any time."
- "Questions only reach you once you say you're happy to mentor. …" → "You get questions only after you agree to mentor. Then students' questions that match your branch and skills will come here, a few at a time. You can turn this off at any time."
- "I'm happy to mentor" → "Start mentoring"
- "Nothing waiting for you right now. When a question fits you, it comes here and we tell you." → "No questions for you right now. When a question matches you, it will appear here and we will tell you."
- "These didn't fit anyone in particular. If you can help, take one on." → "These questions did not match any one senior. If you can help, take one."
- Intros: "Your question goes to a few seniors who fit it (by branch and what they know), not to everyone. One takes it on and writes to you privately." → "Your question goes to a few seniors, not to everyone. We choose them by branch and skills. One of them takes your question and replies to you privately."
- "Ask something yourself" → "Ask your own question"; "Ask something" → "Ask a question"
- "A first question can be small: how to pick electives, what an internship is really like." → "Your first question can be a small one, like how to choose electives or what an internship is like."

### app/(member)/ask/[id]/page.tsx
- "Why it came to you" → "Why we sent it to you"
- "It's with a few seniors who fit. You'll be told when one takes it on." → "We sent your question to a few seniors who match it. We will tell you when one of them takes it."
- "Can you help? Taking it on means you'll write to {name} privately, here." → "Can you help? If you take this question, you will reply to {name} privately, on this page."
- "Take it on" → "Take this question"
- "They'll write to you here." → "They will reply to you here."
- "A line of thanks (optional; it goes on {name}'s Record)" → "A short thank-you note (optional; it is shown on {name}'s Record)"
- "Mark it answered" → "Mark as answered"
- "Close this question? Nobody can reply after." → "Close this question? No one can reply after you close it."
- "Close the question" → "Close question"

### lib/server/asks.ts
- Match reason "also CSE" → "same branch (CSE)" (for new questions)
- "Say what you'd like to ask, in a line." → "Write your question in one line."
- "Add a few lines: what you've tried, what you're stuck on." → "Add a few more details: what you have tried and where you are stuck."
- "That's five Asks today: the most in a day. Try again tomorrow." → "You can ask up to five questions a day. Please try again tomorrow."
- Notification "{name} has a question that fits you: …" → "{name} asked a question you may be able to answer: …"
- "That Ask isn't here." → "We couldn't find that question."
- "Asks are taken on by alumni and faculty." → "Only alumni and faculty can answer questions."
- "You can't take your own Ask." → "You can't answer your own question."
- "Someone has just taken this one on." → "Another senior has just taken this question."
- Notification "{name} took on your question …" → "{name} will help with your question …"
- "Only the asker and the senior who took it on can write here." → "Only the person who asked and the senior helping them can write here."
- "This Ask isn't open for replies." → "This question is closed to replies."
- "That's a lot of replies in an hour. Take a breather and try again." → "You have sent many replies in the last hour. Please wait a while and try again."
- "Only the asker can mark it answered." → "Only the person who asked can mark it as answered."
- "A senior has to take it on first." → "A senior must take this question first."

### app/(member)/board/page.tsx
- Intro "…that the college has checked. Anyone can post with a #tag; the college desk verifies the ones that belong here." → "Jobs, internships, notices and more, checked by the college. Anyone can post with a #tag. The college desk checks these posts and adds the right ones here."
- "Show posts tagged" → "Filter posts by tag"
- "…choose “Verify for the HKBK board”." → "…choose “Verify and add to the HKBK board”." (matches the menu)
- "Posting a job or a notice? Tag it, and the college desk can put it here." → "Posting a job or a notice? Add a #tag, and the college desk can add it here."
- "Not checked by the college yet. Use your judgement." → "The college has not checked these posts yet. Read them with care."

### lib/server/announcements.ts
- "Give it a title." → "Add a title."; "Say what it's about." → "Add the announcement text."

### app/(member)/events/page.tsx, events/[id]/page.tsx
- "Nothing planned yet." → "No events planned yet."
- "Put up an event" → "Add an event"; "Put it up" → "Add event"
- "Name" → "Event name"; "How many can come (optional)" → "Number of seats (optional)"; "What it's about" → "Details"
- "Put up by {name}" → "Organised by {name}"
- "Cancel this event? Everyone coming is told." → "Cancel this event? We will tell everyone who is going."
- "Cancel the event" → "Cancel event"

### lib/server/events.ts
- "Events are put up by faculty and the alumni coordinators." → "Only faculty and alumni coordinators can add events."
- "Give it a name." → "Add a name for the event."
- "Say where it is (or “Online”)." → "Add the place (or write “Online”)."
- "Choose when it starts." → "Choose the start date and time."
- "It should end after it starts." → "The end time must be after the start time."
- "Capacity should be a number of people, or left empty." → "Enter the number of seats, or leave it empty."
- "That's ten events today: the most in a day." → "You can add up to ten events a day. Please try again tomorrow."
- "That event isn't here." (2) → "We couldn't find that event."
- "It's full, sorry." → "Sorry, this event is full."
- "Only its organiser can cancel it." → "Only the organiser can cancel this event."

### app/(member)/causes/page.tsx, causes/[id]/page.tsx
- Intro "Scholarships, a classmate in need, something for the college: give to what HKBK people care about." → "Give to scholarships, a classmate in need, or a project for the college."
- "Giving opens once the college has set up payments." → "You can give once the college has set up payments."
- "Yours" → "Your causes"
- "The college desk reads every cause before it goes live, and may ask you about it. Donations go to HKBK College of Engineering's account; the college pays the cause and shows what it paid." → "The college desk reads every cause before it goes live. They may ask you about it. Donations go to the bank account of HKBK College of Engineering. The college then pays for the cause and shows what it paid."
- "Name" → "Cause name"; "…and who you are to it" → "…and how you are connected to it"; "Runs for" → "Open for"
- "Waiting for the college desk to read it. Only you and the desk can see it until then." → "The college desk has not checked this cause yet. Until then, only you and the desk can see it."
- "What was given stays on record below." → "Donations made so far are still shown below."
- "Close this cause? No more donations; what was given stays on record." → "Close this cause? No one can give after this. Past donations stay on record."
- "Close the cause" → "Close cause"
- "Approve it? It goes live for every member, and can take donations." → "Approve this cause? All members will see it and can give to it."
- "Approve: it goes live" → "Approve cause"
- "Or turn it down, saying why (its author sees this)" → "Or reject it. Say why (the person who started it will see this)"; "Turn it down" → "Reject cause"
- "What for, and to whom" → "What it was for, and who was paid"

### lib/server/causes.ts, lib/actions/causes.ts, components/causes/give.tsx
- "Give the cause a name that says what it is." → "Give the cause a clear name (at least 5 characters)."
- "Tell people about it: … and who you are to it (at least a few lines)." → "Tell the story in a few lines: who it helps, what the money is for, and how you are connected to it."
- "That photo isn't yours, or has gone. Add it again." → "We could not use that photo. Please add it again."
- "That's two causes today: the most in a day." → "You can propose up to two causes a day. Please try again tomorrow."
- "That cause isn't waiting for review." → "This cause is not waiting for review."
- "Say why, so its author knows what to change." → "Say why, so the person who started it knows what to change."
- "That cause isn't open." → "This cause is not open."
- "Only its author or the college desk can close it." → "Only the person who started it or the college desk can close it."
- "Giving isn't open yet: the college is setting up payments." → "You can't give yet. The college is still setting up payments."
- "This cause isn't taking donations." → "This cause is not taking donations now."
- "That's a lot of tries in an hour. Try again a little later." → "Too many tries in the last hour. Please try again later."
- "Razorpay didn't answer just now. …" → "Razorpay is not responding right now. Please try again in a minute."
- "…If money left your account, it will show here within a few minutes; otherwise write to the alumni office." → "…If money was taken from your account, it will show here in a few minutes. If it does not, write to the alumni office."
- "That cause hasn't raised anything." → "This cause has not raised any money."
- "That's more than is left: ₹…" → "That is more than the money left: ₹…"
- "It's live." → "Approved. The cause is now live."
- "Turned down; its author has your note." → "Rejected. The person who started it can see your note."
- "Closed. What was given stays on record." → "Cause closed. Past donations stay on record."
- "Thank you. Your gift is in." → "Thank you. We have received your donation."
- "Test payment (no money moves): …" → "Test payment (no real money is paid): …"
- "The payment didn't go through. No money was taken; you can try again." → "The payment did not go through. No money was taken. You can try again."
- "Razorpay's checkout didn't load. Check your connection…" → "…Check your internet connection and try again." (consistency pass)
- "A few words (optional, shown with your gift)" → "Message (optional, shown with your donation)"

### app/(member)/groups/page.tsx, groups/[id]/page.tsx
- Intro "Your class, your club, your city, your field: a place for people who share something." → "Groups for your class, club, city or field of work."
- "What it's for" → "What the group is about"
- "Private: people ask to join; only members can read it" → "Private: people must ask to join. Only members can read it"
- "You've asked to join: its admins will let you in" → "You asked to join. A group admin will review your request."
- "This group is private: only its members see its posts and who's in it. Ask to join, and one of its admins will let you in." → "This group is private. Only members can see its posts and its member list. Ask to join, and a group admin will review your request."
- "That's everything." → "No more posts."
- "Close {name} for good? Its posts go with it." → "Close {name} for good? Its posts will be removed too."
- "Take the group down (college desk)" → "Remove group (college desk)"
- "Let in" / "Turn away" → "Accept" / "Decline"

### lib/actions/groups.ts, lib/server/groups.ts
- "Let in." → "Request accepted."
- "Turned away. They aren't told." → "Request declined. We won't tell them."
- "They own the group now." → "They are now the owner of this group."
- "That group isn't here." → "We couldn't find that group."
- "That's three new groups today: the most in a day." → "You can create up to three groups a day. Please try again tomorrow."
- "That's a lot of groups today. Try again tomorrow." → "You have joined many groups today. Please try again tomorrow."
- "You started this group: make someone else its owner first (in Members), then leave." → "You own this group. Before you leave, make someone else the owner (in Members)."
- "That request isn't waiting any more." → "This request has already been handled."
- Notification "You're in {group}." → "You are now a member of {group}."
- "Use Leave for yourself." → "To remove yourself, use Leave the group."

### app/(member)/desk/page.tsx, desk/members/[id]/page.tsx
- "Desk sections" → "College desk sections"
- "(set by the people who run the site)" → "(set by the site's technical team)"
- "N Asks" / "N answered" → "N questions asked" / "N questions answered"
- "Their page as members see it →" → "See their page as members see it →"
- "Pause {name}? They're logged out everywhere and hidden from everyone until unpaused." → "Pause {name}? They will be logged out on all devices and hidden from everyone until you unpause them."
- "They're told when their role changes." → "We tell them when their role changes."
- "Delete for good" → "Delete permanently"; "…everything they made" → "…everything they posted"
- "This can't be undone: their page, posts, comments, messages, Asks and connections all go. Pausing is usually enough." → "This can't be undone. Their page, posts, comments, messages, questions and connections will all be deleted. Pausing the account is usually enough."

### components/desk/sections.tsx
- Stats "Happy to mentor" / "Asks" / "Asks answered" → "Mentors" / "Questions" / "Questions answered"
- "N report(s) to look at" → "N report(s) to review"
- "Totals only: no names." → "These are totals only. No names are shown."
- "Download every donation (CSV, for the accounts)" → "Download all donations (CSV, for the accounts office)"
- "Dealt with →" → "Closed reports →"; "Nothing dealt with yet." / "No open reports. All quiet." → "No closed reports yet." / "No open reports."
- "It's already gone." → "This has already been deleted."
- "Pause this member? They're logged out and hidden until unpaused." → "Pause this member? They will be logged out and hidden until you unpause them."
- Content tab "Asks" → "Questions"; search label "Containing" → "Search for" (2)
- "Take this down? Its author is told it broke the community rules." → "Take this down? We will tell the author it broke the community rules."
- "Bring back" → "Restore"
- "Nobody matches." → "No members match."
- "What it says" → "Message"; "Show it for" → "Show for"; "Announce" → "Post announcement"
- "Super administrators are set by the people who run the site, so they can't be changed here." → "Super administrators are set by the site's technical team. You can't change them here."
- Invite "Withdraw" → "Cancel invitation"
- "Set by the people who run the site, not from the desk" → "Set by the site's technical team. You can't change it from the college desk."
- "Only a super administrator can change these. You can see them." → "Only a super administrator can change these settings. You can only view them."
- "(paused ones stay readable; nothing new can be added)" → "(people can still read paused features, but cannot add anything new)"
- "Connection requests one member may send in a day" → "Connection requests each member can send per day"
- Audit table headers "Did" / "To" → "Action" / "Details"

### lib/server/desk.ts, lib/actions/desk.ts
- "That isn't here any more." → "This is no longer available."
- "That's yours." → "You can't report your own content."
- "Say briefly what's wrong, so the coordinators know what to look at." → "Say briefly what is wrong, so the alumni coordinators know what to check."
- "That's a lot of reports today. The coordinators will get to them." → "You have sent many reports today. The alumni coordinators will look at them soon."
- "That report is already dealt with." → "This report has already been handled."
- "That's already down." → "This has already been taken down."
- Notification "A note of yours was taken down … for breaking the community rules." → "Your post was taken down by the college desk because it broke the community rules."
- "Only an administrator can bring something back." → "Only an administrator can restore content."
- "That isn't taken down." → "This has not been taken down."
- "That member isn't here." (3) → "We couldn't find that member."
- "Only someone above them on the college desk can do that." → "Only someone with a higher college desk role can do that."
- "This role is set in the server's config, so it can't be changed here." → "This role is set by the site's technical team. You can't change it here."
- "You can only change the roles of people below you." → "…below you on the college desk."
- "That isn't a role." → "That role does not exist."
- "Dismissed." → "Report dismissed."
- "Paused, and logged out everywhere." → "Paused. They are logged out on all devices."
- "Taken down. Its author was told." → "Taken down. We told the author."
- "That can't be brought back." / "Brought back." → "That can't be restored." / "Restored."
- "Announced. It's at the top of everyone's Home." → "Announcement posted. It shows at the top of everyone's Home page."
- "Saved. It's in the audit log." → "Settings saved. The change is in the audit log."
- "Invited. They'll get an email with a link to join; it works for two weeks." → "Invitation sent. They will get an email with a link to join. The link works for two weeks."
- "Invitation withdrawn." → "Invitation cancelled."

---

## Consistency pass (across areas)

These changes were made after all the areas were done, so the same idea uses the same
words everywhere:

- "Check your connection" → "Check your internet connection" (`components/social/edit-delete.tsx`, `components/social/stories.tsx`, `components/causes/give.tsx`, `lib/client/post.ts`)
- "We could not find that …" → "We couldn't find that …" (`lib/server/asks.ts`, `desk.ts` ×3, `events.ts` ×2, `groups.ts`, `profile.ts`)
- "They aren't told" / "They won't be told" / "We don't tell them" → "We won't tell them" (`app/how-it-works/page.tsx`, `app/(member)/connections/page.tsx`, `lib/actions/social.ts`, `lib/actions/groups.ts`)
- "profile" → "page" where it means a member's page (`app/(member)/desk/members/[id]/page.tsx` ×2, `app/(member)/messages/[id]/page.tsx`, `lib/about-content.ts`)
- "Withdraw" → "Withdraw request" (`app/(member)/connections/page.tsx`)
- Home mentor buttons "I'm happy to mentor" / "I'm happy to answer them" → "Start mentoring" / "Start answering questions" (`components/home/role-focus.tsx`)
- Singular and plural: "1 person … hasn't joined" and "1 more … has not joined" (`app/(member)/batch/[branch]/[year]/page.tsx`, `components/home/role-focus.tsx`)
- Sample notification "… Sample would like to connect." → "… Sample sent you a connection request." (`lib/server/samples.ts`, development only)
- Logged-in header link "Alumnity, your Home" → "Alumnity, go to Home" (`components/site-header.tsx`)

---

## Left as is, needs a human

**Legal and official wording**
- `app/privacy/page.tsx`: "the college is the data fiduciary for what you share here". This is the legal term from the DPDP Act. A plain gloss could narrow its meaning.
- `app/privacy/page.tsx`: the grievance officer and Data Protection Board sentences are unchanged.
- `app/privacy/page.tsx`: the editor added "(for example, attempts to log in)" to the sentence about network addresses. The login, join and reset code does record IP addresses. This is a small clarification, but someone should confirm it is welcome in the policy.
- `app/terms/page.tsx`: "These terms are governed by the laws of India, and the courts at Bengaluru have jurisdiction." This is a legal clause.
- `app/terms/page.tsx`: the donations payout paragraph ("Every donation is paid to …, through Razorpay. … the college uses the rest for a similar purpose.") is a financial obligation.
- `app/terms/page.tsx`: "What you post stays yours." This is a statement about who owns content.
- `app/terms/page.tsx` "How we look after each other." and `app/privacy/page.tsx` "Your details, kept safe.". These headings are a little figurative, but they are clear.
- `lib/about-content.ts` DIRECTOR_MESSAGE: the director's letter is very literary ("torchbearers of HKBK’s legacy", "beacons of inspiration"). The college wrote it, so we must not edit it. The college could give a shorter, plainer version.
- `components/campus-landing.tsx` / `lib/campus.ts`: the brand line "Stay connected to where it began." is mildly figurative. The owner should decide.
- Alumni card (`components/profile/alumni-card.tsx`, `lib/server/alumni-card-image.tsx`): the printed card says "Affiliated to VTU · Approved by AICTE". This is shorter than the official "Affiliated to VTU, Belagavi / Approved by AICTE, New Delhi". It looks like a deliberate design choice. Check with the college.

**USNs**
- `components/join/register-book.tsx` and `app/api/register-check/route.ts`: after a match, the register panel shows the person their own USN. It is shown in full if they typed it, and masked (first 7 characters, then •••) if they searched by name, branch and year. Only the person themselves sees it. Please decide whether this is allowed under "never show USNs".
- `components/join/join-flow.tsx`: the USN placeholder "1HK12CS042" looks like a real USN. Check that it isn't a real student's.
- `components/people/people-search.tsx`: the placeholder "Search by name, USN, company, city or skill" invites people to type a USN. Nothing is shown back.
- `lib/about-content.ts` (DEVELOPERS.team): it holds USN values that are never shown on screen, but they are shipped in the page's code bundle.

**Words that code depends on (changing them needs code changes)**
- "Profile strength" levels ("Getting started", "Good", "Strong", "Complete") are compared with `===`.
- The language levels ("Native", "Fluent", "Conversational", "Basic") are stored data. "Conversational" may be hard for some readers.
- The Network suggestion reasons ("From your batch", "Happy to mentor", …): `person-card.tsx` compares one of them, and `tests/people.test.ts` checks them.
- `lib/server/auth.ts`: "That code has expired. Ask for a new one." / "Too many wrong codes. Ask for a new one." The staff join form matches `/expired|Too many/`.
- `lib/server/auth-provider.ts`: SAME_PASSWORD is compared with `!==` in two places.
- "To be announced" on the committee page is compared with `===`.
- `components/messages/thread-view.tsx`: "Today" is compared between messages to draw the day dividers.

**Stored data and raw values shown to staff**
- The audit-log action names ("signed out everywhere", "turned down cause", …) are database values. They still say "signed out", against the "log out" rule.
- The college desk Reports tab shows the raw `kind` and `status` values ("ask", "removed"). A label map would read better.
- On the super-admin Home, "Paused: notes, …" shows raw feature keys.
- `components/home/more-from-hkbk.tsx` shows the group kind ("open" / "private") as stored.
- The Ask routing reasons are stored with each question. Old questions still say "also CSE" instead of "same branch (CSE)".
- A cause closed after a report shows its stored note "Taken down after a report (report N)."
- The CSV headers for donations and the audit log are unchanged, because other tools may read them.

**Smaller choices left for the owner**
- "{first}'s Record" (on someone's page and on Ask a senior): a named feature. A plainer heading would be "Thanks from juniors". If you change it, change it in both places.
- `app/forgot/page.tsx` heading "It happens to everyone.": a mild idiom, kept for warmth.
- "Take down" / "Taken down" is kept as the college desk's word for removing content. Members see "Remove".
- The events labels differ between the list and the detail page ("It's full" vs "Full"). Both are clear.
- The stories sound toggle keeps the label "Sound on/off" with `aria-pressed`.
- `app/lab` and `components/lab/type-lab.tsx`: the developer-only type lab is not linked from the site. It still has "Sign in" and draft copy such as "see you through it".
