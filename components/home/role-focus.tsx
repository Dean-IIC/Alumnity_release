import Link from "next/link";
import { mentorAction } from "../../lib/actions/social";
import type { User } from "../../lib/server/auth";
import { asksFor, type Ask } from "../../lib/server/asks";
import { plainText } from "../../lib/mentions";
import { feedFor } from "../../lib/server/posts";
import { TAG } from "../../lib/tags";
import { batchLabel, firstName, rupees, timeAgo, when } from "../../lib/format";
import { departmentCounts, mentorsFor, myUpcomingEvents, newestAlumni, studentsSeeking, weekInNumbers } from "../../lib/server/home";
import { auditLog, reports, stats } from "../../lib/server/desk";
import { photoIdsOf, profileOf } from "../../lib/server/profile";
import { batchCount } from "../../lib/server/register";
import { batchmates } from "../../lib/server/people";
import { isModerator, isSuperAdmin } from "../../lib/server/roles";
import { settings } from "../../lib/server/settings";
import { ActionForm } from "../app/action-form";
import { Invite } from "../app/invite";
import { Avatar } from "../social/avatar";
import { Icon } from "../social/icons";

/*
 * The top of Home, made for who's reading it. A student comes for help: asking a senior,
 * finding mentors. An alumnus can give it: questions waiting for them, students looking
 * for a mentor or an internship, their batch. A teacher looks after a department: its
 * people, their events. The college desk sees what's waiting for it; a super
 * administrator, the site's state too. The feed (everyone's) follows underneath.
 */

const hour = () => Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
const greeting = () => (hour() < 12 ? "Good morning" : hour() < 17 ? "Good afternoon" : "Good evening");

const SEEKING_LABEL = { mentor: "a mentor", internship: "an internship", referral: "a referral" } as const;
/** What a report is about, in words ("ask" is a question). */
const KIND_WORD: Record<string, string> = { ask: "question" };

function Head({ me, line }: { me: User; line: string }) {
  return (
    <header className="focus__head">
      <h2>
        {greeting()}, {firstName(me.name)}.
      </h2>
      <p>{line}</p>
    </header>
  );
}

function People({ list, photos, note }: { list: { member: User; note?: string }[]; photos: Map<number, string>; note?: string }) {
  return (
    <ul className="focus__people">
      {list.map(({ member, note: line }) => (
        <li key={member.id}>
          <Link href={`/people/${member.id}`} className="focus__person">
            <Avatar name={member.name} photoId={photos.get(member.id)} size={48} />
            <span>
              <strong>{member.name}</strong>
              <small>{line ?? batchLabel(member)}</small>
            </span>
          </Link>
        </li>
      ))}
      {note && <li className="focus__note">{note}</li>}
    </ul>
  );
}

function AskLine({ ask }: { ask: Ask }) {
  return (
    <li>
      <Link href={`/ask/${ask.id}`} className="focus__ask">
        <strong>{ask.title}</strong>
        <small>
          {ask.author.name} · {batchLabel(ask.author)} · {timeAgo(ask.createdAt)}
          {ask.reason ? ` · ${ask.reason}` : ""}
        </small>
      </Link>
    </li>
  );
}

// ---------- A student ----------

async function StudentFocus({ me }: { me: User }) {
  const [mentors, { mine }, openings] = await Promise.all([mentorsFor(me, 4), asksFor(me), feedFor(me, { verified: true, tag: ["job", "internship"], limit: 3 })]);
  const photos = await photoIdsOf(mentors.map((m) => m.member.id));
  const live = mine.filter((a) => a.status === "open" || a.status === "taken").slice(0, 3);
  return (
    <section className="sheet focus focus--student" aria-label="For you">
      <Head me={me} line="Seniors were students here too. Ask them about subjects, projects, placements or life after college." />
      <form className="focus__ask-start" action="/ask">
        <label className="sr-only" htmlFor="focus-ask">
          Your question for a senior
        </label>
        <Icon name="ask" size={22} />
        <input id="focus-ask" name="title" maxLength={140} placeholder="Ask a senior: how did you prepare for placements?" autoComplete="off" />
        <button className="button button--primary wf-small" type="submit">
          Ask
        </button>
      </form>
      {live.length > 0 && (
        <>
          <h3>Your questions</h3>
          <ul className="focus__asks">
            {live.map((a) => (
              <li key={a.id}>
                <Link href={`/ask/${a.id}`} className="focus__ask">
                  <strong>{a.title}</strong>
                  <small>{a.status === "taken" && a.taker ? `${a.taker.name} is answering. Read their reply.` : "Waiting for a senior to answer"}</small>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {openings.length > 0 && (
        <>
          <h3>Jobs and internships checked by the college</h3>
          <ul className="focus__asks">
            {openings.map((o) => (
              <li key={o.id}>
                <Link href={`/notes/${o.id}`} className="focus__ask">
                  <strong>{firstLine(o.body)}</strong>
                  <small>
                    {o.tags.includes("internship") ? "Internship" : "Job"} · from {o.author.name}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="wf-inline-link" href="/board?tag=job">
            All jobs and internships on the board
          </Link>
        </>
      )}
      {mentors.length > 0 && (
        <>
          <h3>Seniors happy to mentor{me.branch ? ` (${me.branch} first)` : ""}</h3>
          <People
            list={mentors.map((m) => ({ member: m.member, note: [m.profile.title, m.profile.company && `at ${m.profile.company}`].filter(Boolean).join(" ") || batchLabel(m.member) }))}
            photos={photos}
          />
        </>
      )}
    </section>
  );
}

/** The start of a post, for a one-line list: mentions as names, #tags left out. */
const firstLine = (body: string) => {
  const line = plainText(body).replace(TAG, "$1").replace(/\s+/g, " ").trim();
  return line.length > 90 ? `${line.slice(0, 90).replace(/\s+\S*$/, "")}…` : line || "A post";
};

// ---------- An alumnus ----------

async function AlumnusFocus({ me }: { me: User }) {
  const [{ forMe, taken }, profile, seeking, mates, onRegister] = await Promise.all([
    asksFor(me),
    profileOf(me.id),
    studentsSeeking(me, 3),
    batchmates(me),
    me.branch && me.joined ? batchCount(me.branch, me.joined, me.programme ?? "B.Tech") : Promise.resolve(0)
  ]);
  const photos = await photoIdsOf([...seeking.map((s) => s.member.id), ...mates.slice(0, 4).map((u) => u.id)]);
  const missing = Math.max(0, onRegister - mates.length - 1);
  return (
    <section className="sheet focus focus--alumnus" aria-label="For you">
      <Head me={me} line="A few minutes of your time can really help a junior. See who needs help, and who from your batch is here." />
      <h3>Questions for you</h3>
      {!profile.happyTo.mentor ? (
        <div className="focus__switch">
          <p>Start mentoring and we'll send you a few student questions. They fit your branch and skills, and you can stop any time.</p>
          <ActionForm action={mentorAction}>
            <button className="button button--primary wf-small" type="submit">
              Start mentoring
            </button>
          </ActionForm>
        </div>
      ) : forMe.length || taken.length ? (
        <ul className="focus__asks">
          {[...taken.filter((a) => a.status === "taken"), ...forMe].slice(0, 3).map((a) => (
            <AskLine key={a.id} ask={a} />
          ))}
        </ul>
      ) : (
        <p className="focus__quiet">No questions for you right now. When one fits you, we'll show it here and tell you.</p>
      )}
      {seeking.length > 0 && (
        <>
          <h3>Students looking for help</h3>
          <People
            list={seeking.map((s) => ({
              member: s.member,
              note: `Looking for ${(Object.keys(SEEKING_LABEL) as (keyof typeof SEEKING_LABEL)[]).filter((k) => s.profile.seeking[k]).map((k) => SEEKING_LABEL[k]).join(", ")} · ${batchLabel(s.member)}`
            }))}
            photos={photos}
          />
        </>
      )}
      {me.branch && me.joined && (
        <>
          <h3>Your batch</h3>
          {mates.length > 0 ? (
            <People list={mates.slice(0, 4).map((u) => ({ member: u }))} photos={photos} note={missing ? `${missing} more from your batch ${missing === 1 ? "has" : "have"} not joined yet.` : undefined} />
          ) : (
            <p className="focus__quiet">No one else from your batch is here yet.{onRegister ? ` ${onRegister} people joined HKBK with you.` : ""} Invite them:</p>
          )}
          {missing > 0 && <Invite text="I'm on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:" />}
        </>
      )}
      <h3>Is your company hiring?</h3>
      <p className="focus__quiet">Post the job with #job or #internship. The college checks it and puts it on the HKBK board.</p>
      <p className="focus__quiet">
        Students see it there and can ask you for a referral.{" "}
        {/* A plain link: the composer opens on the address's #compose, which a page swap wouldn't change. */}
        <a className="wf-inline-link" href="#compose">
          Write a post
        </a>
      </p>
    </section>
  );
}

// ---------- A teacher ----------

async function TeacherFocus({ me }: { me: User }) {
  const [dept, events, { forMe }, profile, seeking, alumni] = await Promise.all([
    departmentCounts(me.branch),
    myUpcomingEvents(me),
    asksFor(me),
    profileOf(me.id),
    studentsSeeking(me, 3),
    newestAlumni(me, me.branch, 4)
  ]);
  const photos = await photoIdsOf([...seeking.map((s) => s.member.id), ...alumni.map((u) => u.id)]);
  return (
    <section className="sheet focus focus--teacher" aria-label="For you">
      <Head me={me} line={me.branchName ? `${me.branchName}: your students and alumni, and what's coming up.` : "Your students and alumni, and what's coming up."} />
      {dept && (
        <div className="focus__numbers">
          <span>
            <strong>{dept.students}</strong> {dept.students === 1 ? "student" : "students"}
          </span>
          <span>
            <strong>{dept.alumni}</strong> {dept.alumni === 1 ? "alumnus" : "alumni"}
          </span>
          <span>
            <strong>{dept.newThisWeek}</strong> joined this week
          </span>
        </div>
      )}
      <h3>Your events</h3>
      {events.length ? (
        <ul className="focus__asks">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="focus__ask">
                <strong>{e.title}</strong>
                <small>
                  {when(e.startsAt)} · {e.going} going{e.capacity ? ` of ${e.capacity}` : ""}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="focus__quiet">You have no events coming up. Alumni like to come back for talks, reunions and department days.</p>
      )}
      <Link className="button button--secondary wf-small" href="/events?new=1#new-event">
        Add an event
      </Link>
      <h3>Questions for you</h3>
      {!profile.happyTo.mentor ? (
        <div className="focus__switch">
          <p>Turn this on to see student questions that fit your department and skills.</p>
          <ActionForm action={mentorAction}>
            <button className="button button--primary wf-small" type="submit">
              Start answering
            </button>
          </ActionForm>
        </div>
      ) : forMe.length ? (
        <ul className="focus__asks">
          {forMe.slice(0, 3).map((a) => (
            <AskLine key={a.id} ask={a} />
          ))}
        </ul>
      ) : (
        <p className="focus__quiet">Nothing waiting for you right now.</p>
      )}
      {seeking.length > 0 && (
        <>
          <h3>Students looking for help</h3>
          <People
            list={seeking.map((s) => ({
              member: s.member,
              note: `Looking for ${(Object.keys(SEEKING_LABEL) as (keyof typeof SEEKING_LABEL)[]).filter((k) => s.profile.seeking[k]).map((k) => SEEKING_LABEL[k]).join(", ")}`
            }))}
            photos={photos}
          />
        </>
      )}
      {alumni.length > 0 && (
        <>
          <h3>Alumni who've just joined{me.branch ? ` from ${me.branch}` : ""}</h3>
          <People list={alumni.map((u) => ({ member: u }))} photos={photos} />
        </>
      )}
    </section>
  );
}

// ---------- The college desk (coordinators, administrators, super administrators) ----------

async function DeskFocus({ me }: { me: User }) {
  const superAdmin = isSuperAdmin(me);
  const [s, open, week, site, log] = await Promise.all([
    stats(me),
    reports(me, "open"),
    weekInNumbers(),
    superAdmin ? settings() : Promise.resolve(null),
    superAdmin ? auditLog(me, { limit: 5 }) : Promise.resolve([])
  ]);
  if (!s) return null;
  const paused = site ? (Object.entries(site.features) as [string, boolean][]).filter(([, on]) => !on).map(([k]) => k) : [];
  return (
    <section className={`sheet focus focus--desk ${superAdmin ? "focus--super" : ""}`} aria-label="The college desk">
      <Head
        me={me}
        line={superAdmin ? "The whole site: what to check, this week's numbers and site settings." : "What the college desk needs to check, and this week's numbers."}
      />
      <h3>Waiting to be checked</h3>
      {open.length || s.causesWaiting ? (
        <ul className="focus__asks">
          {open.slice(0, 3).map((r) => (
            <li key={r.id}>
              <Link href="/desk?tab=reports" className="focus__ask">
                <strong>
                  Reported {KIND_WORD[r.kind] ?? r.kind}: “{r.reason.slice(0, 80)}”
                </strong>
                <small>{timeAgo(r.createdAt)}</small>
              </Link>
            </li>
          ))}
          {open.length > 3 && (
            <li className="focus__note">
              <Link href="/desk?tab=reports">{open.length - 3} more reports →</Link>
            </li>
          )}
          {s.causesWaiting > 0 && (
            <li>
              <Link href="/causes" className="focus__ask">
                <strong>
                  {s.causesWaiting} cause{s.causesWaiting === 1 ? "" : "s"} to check
                </strong>
                <small>Approve it so members can give, or say why not.</small>
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <p className="focus__quiet">Nothing waiting. No reports and no causes to check.</p>
      )}
      <h3>This week</h3>
      <div className="focus__numbers">
        <span>
          <strong>{week.joined}</strong> joined
        </span>
        <span>
          <strong>{s.signedInThisWeek}</strong> logged in
        </span>
        <span>
          <strong>{week.posts}</strong> {week.posts === 1 ? "post" : "posts"}
        </span>
        <span>
          <strong>{week.asks}</strong> {week.asks === 1 ? "question" : "questions"}, {week.answered} answered
        </span>
      </div>
      <div className="wf-actions focus__actions">
        <Link className="button button--secondary wf-small" href="/desk?tab=announcements">
          Post an announcement
        </Link>
        <Link className="button button--secondary wf-small" href="/desk?tab=team">
          Invite staff
        </Link>
        <Link className="button button--secondary wf-small" href="/desk?tab=members">
          Members
        </Link>
        <Link className="button button--secondary wf-small" href="/desk">
          Open the college desk →
        </Link>
      </div>
      {superAdmin && site && (
        <>
          <h3>Site status</h3>
          <ul className="focus__state">
            <li className={site.joiningOpen ? "on" : "off"}>{site.joiningOpen ? "Joining is open" : "Joining is closed"}</li>
            <li className={paused.length ? "off" : "on"}>{paused.length ? `Paused: ${paused.join(", ")}` : "Every feature is on"}</li>
            <li className="on">
              {s.members} members · {rupees(s.raised)} given to causes
            </li>
          </ul>
          {log.length > 0 && (
            <>
              <h3>Recent desk activity</h3>
              <ul className="focus__log">
                {log.map((e) => (
                  <li key={e.id}>
                    <span>{e.actor}</span> {e.action}: <span className="focus__log-subject">{e.detail || e.subject}</span> · {timeAgo(e.createdAt)}
                  </li>
                ))}
              </ul>
              <Link href="/desk?tab=audit">Open the audit log →</Link>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** While the rest is fetched: the greeting at once, so Home never opens on nothing. */
export function FocusWaiting({ me }: { me: User }) {
  return (
    <section className="sheet focus focus--waiting" aria-label="For you" aria-busy="true">
      <Head me={me} line="Loading your updates…" />
    </section>
  );
}

/** Who's reading decides what Home leads with. */
export async function RoleFocus({ me }: { me: User }) {
  if (isModerator(me)) return <DeskFocus me={me} />;
  if (me.role === "student") return <StudentFocus me={me} />;
  if (me.role === "faculty") return <TeacherFocus me={me} />;
  return <AlumnusFocus me={me} />;
}

