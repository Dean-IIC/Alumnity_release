import type { ReactNode } from "react";
import { batchYears, ROLE_LABEL } from "../../lib/format";
import { mediaUrl } from "../../lib/media-url";
import { ERAS } from "../../lib/eras";
import type { Profile, Visibility } from "../../lib/server/profile";
import { cropStyle, sharper } from "../../lib/photo-crop";
import { Cover, type DefaultCover } from "./cover";
import { InkSeal } from "./ink-seal";
import { Journey, type Stop } from "./journey";
import type { Badge } from "../../lib/server/badges";
import { SECTION_KINDS, SECTIONS, yearsOf } from "../../lib/profile-sections";

/*
 * A member's page. It opens on their journey since HKBK (components/profile/journey.tsx):
 * the campus as it was when they joined, their seal stamped on it, and the red pen line
 * through every stop to now. Then their own words, what they're good at, and three
 * lanterns for what they're happy to do, lit when they are. Shows only what the viewer may
 * see (the server has already emptied out the rest); the owner also sees who each part is
 * shown to, and gentle prompts for what's still empty.
 */

export type SheetPerson = {
  id: number;
  name: string;
  branch: string | null;
  branchName: string | null;
  programme: string | null;
  joined: number | null;
  role: string;
};

const WHO: Record<Visibility, { label: string; icon: ReactNode }> = {
  everyone: {
    label: "Everyone on Alumnity",
    icon: <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 0c-2 2-2 11 0 13m0-13c2 2 2 11 0 13M1.8 6h12.4M1.8 10h12.4" />
  },
  connections: {
    label: "Your connections",
    icon: <path d="M5 8a3 3 0 1 0 0-.01M11 8a3 3 0 1 0 0-.01M7.5 8h1" />
  },
  batch: {
    label: "Your batch and connections",
    icon: <path d="M5.5 7a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 5.5 7Zm5.5 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM1.5 13c0-2.2 1.8-4 4-4s4 1.8 4 4m1-4c2 0 3.5 1.6 3.5 3.6" />
  },
  me: { label: "Only you", icon: <path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z" /> }
};

/** Who a part is shown to: a small icon, for the owner only. */
function ShownTo({ who }: { who?: Visibility }) {
  if (!who) return null;
  return (
    <span className="pcard__who" title={`Shown to: ${WHO[who].label}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {WHO[who].icon}
      </svg>
      <span>{WHO[who].label}</span>
    </span>
  );
}

function Card({ title, who, className = "", children }: { title: string; who?: Visibility; className?: string; children: ReactNode }) {
  return (
    <section className={`pcard ${className}`}>
      <header className="pcard__head">
        <h2>{title}</h2>
        <ShownTo who={who} />
      </header>
      {children}
    </section>
  );
}

/* The three lanterns: a sprout (mentoring), a door left open (referring), a lectern (a talk). */
const LANTERNS = [
  {
    key: "mentor",
    title: "Mentors juniors",
    note: "Ask about a course, a project or a first job.",
    art: <path d="M24 42V24m0 0c-1-8-7-12-14-12 0 8 6 12 14 12Zm0-4c1-7 6-11 13-11 0 7-6 11-13 11ZM14 42h20" />
  },
  {
    key: "refer",
    title: "Refers people",
    note: "Suggests good people for jobs at their company.",
    art: <path d="M12 42V8h20v34M12 42h26M32 8l8 4v26l-8 4M27 26h2M6 14l4 2M4 24h5M6 34l4-2" />
  },
  {
    key: "talk",
    title: "Gives talks",
    note: "A guest talk, or a session for a department.",
    art: <path d="M16 42h16M24 42V30M14 30h20l-3-8H17l-3 8Zm10-8v-6m-6-8a6 6 0 0 1 12 0M14 6a12 12 0 0 1 20 0" />
  }
] as const;

/* A student's side: what they're looking for, drawn the same way. */
const WISHES = [
  { key: "mentor", title: "Looking for a mentor", note: "A senior who can help them choose.", art: LANTERNS[0].art },
  { key: "internship", title: "Looking for an internship", note: "Alumni who hire, or who know of jobs.", art: LANTERNS[1].art },
  { key: "referral", title: "Looking for a referral", note: "An alumnus who can suggest them for a job.", art: LANTERNS[2].art }
] as const;

const STAFF = new Set(["faculty", "coordinator", "admin", "superadmin"]);

/**
 * The campus on their cover until they add their own (the editor shows it too, to frame it):
 * as it was when they joined (the latest era at or before that year); staff, who didn't
 * join as students, get the campus as it is now.
 */
export function campusCover(person: { role: string; joined: number | null }): DefaultCover {
  const staff = STAFF.has(person.role) && !person.joined;
  const era = staff ? ERAS[ERAS.length - 1] : ([...ERAS].reverse().find((e) => person.joined && e.year <= person.joined) ?? ERAS[0]);
  // Today's campus stands in for 1998 and 2016: say so, and keep a batch's own line ("The
  // biggest batch") for that batch. A 2023 student was shown 2016's.
  const today = era.photo.source === "Today's campus";
  return {
    src: era.photo.photo,
    sketch: era.photo.sketch,
    year: era.year,
    title: today && person.joined !== era.year ? "The campus you know" : era.title,
    kicker: today ? "HKBK today" : undefined
  };
}

const linkLabel = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** `underTop`: something only the owner sees, just under the top of the page (their profile strength, on /me). */
export function ProfileSheet({ person, profile, isOwner, batchSize, actions, badges = [], underTop }: { person: SheetPerson; profile: Profile; isOwner: boolean; batchSize?: number; actions?: ReactNode; badges?: Badge[]; underTop?: ReactNode }) {
  const years = person.programme === "B.Tech" ? 4 : 2;
  const graduated = person.joined && person.role !== "student" ? person.joined + years : null;
  const branch = person.branch ?? "HKBK";
  const ring = `${branch} · ${person.joined ?? ""} · HKBK CE · ${branch} · ${person.joined ?? ""} ·`;
  const now = [profile.title, profile.company && `at ${profile.company}`].filter(Boolean).join(" ");
  const v = isOwner ? profile.visibility : undefined;
  const staff = STAFF.has(person.role) && !person.joined;
  const coverFallback = campusCover(person);

  // The journey is optional: it appears once they've added a stop of their own.
  const stops: Stop[] = profile.journey.length
    ? [
        ...(person.joined ? [{ year: String(person.joined), title: "Joined HKBK" }] : []),
        ...(graduated ? [{ year: String(graduated), title: "Graduated" }] : []),
        ...profile.journey.map((m) => ({ year: String(m.year), title: m.text })),
        ...(now ? [{ year: "Now", title: now, detail: profile.city || undefined }] : [])
      ]
    : [];

  const student = person.role === "student";
  const lit = LANTERNS.filter((l) => profile.happyTo[l.key]);
  const lanterns = student ? [] : isOwner ? LANTERNS : lit;
  const wished = WISHES.filter((w) => profile.seeking[w.key]);
  const wishes = !student ? [] : isOwner ? WISHES : wished;

  return (
    <article className="profile">
      {/* The top: their cover, their photo (or their seal) over its edge, then who they are. */}
      <header className="profile__top">
        <Cover cover={profile.cover} fallback={coverFallback} name={person.name} seed={person.id} campusCrop={profile.campusCrop} />
        <div className="profile__intro">
          <div className="profile__avatar">
            {profile.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(profile.photo.id, 200 * sharper(profile.photo.crop))} alt={person.name} style={cropStyle(profile.photo.crop)} />
            ) : (
              <InkSeal name={person.name} ring={ring} seed={person.id} size={148} />
            )}
          </div>
          <div className="profile__who">
            <h1 className="profile__name">{person.name}</h1>
            {now ? (
              <p className="profile__now">{now}</p>
            ) : (
              isOwner && (
                <p className="profile__prompt">
                  {student ? "What are you doing now? A project, a club, an internship? Add it when you edit your page." : "What are you doing now? Add it when you edit your page."}
                </p>
              )
            )}
            <p className="profile__meta">
              {[person.branchName, person.joined && `Batch ${batchYears(person.joined, person.programme)}`, profile.city].filter(Boolean).join(" · ")}
            </p>
            <p className="profile__register">
              {staff ? (
                <span>
                  <span className="profile__tick" aria-hidden="true">
                    ✓
                  </span>{" "}
                  {ROLE_LABEL[person.role] ?? "Staff"} at HKBK College of Engineering
                </span>
              ) : (
              <span>
                <span className="profile__tick" aria-hidden="true">
                  ✓
                </span>{" "}
                On the college register
                {batchSize && batchSize > 1 ? ` · one of ${batchSize} in ${isOwner ? "your" : "their"} batch` : ""}
              </span>
              )}
              {v && <ShownTo who={v.now} />}
            </p>
            {badges.length > 0 && (
              <ul className="badges" aria-label="Badges">
                {badges.map((b) => (
                  <li key={b.key} className={`badge badge--${b.tone} badge--${b.key}`} title={b.detail}>
                    <BadgeIcon kind={b.key} />
                    {b.label}
                    <span className="sr-only">: {b.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {actions && <div className="profile__actions">{actions}</div>}
        </div>
      </header>
      {isOwner && underTop}

      <div className="profile__body">
        <div className="profile__main">
          {(profile.about || isOwner) && (
            <Card title={isOwner ? "In your words" : "In their words"} who={v?.about} className="pcard--words">
              {profile.about ? (
                <blockquote className="profile__about">{profile.about}</blockquote>
              ) : (
                <p className="profile__prompt">
                  {student
                    ? "Write a few lines about you. What do you study, and what do you want to do next?"
                    : staff
                      ? "Write a few lines about what you teach and research. Say how students and alumni can work with you."
                      : "Write a few lines about your work and your time at HKBK. Say what a junior could ask you."}
                </p>
              )}
            </Card>
          )}
          {(profile.skills.length > 0 || isOwner) && (
            <Card title="Good at" who={v?.skills}>
              {profile.skills.length ? (
                <ul className="profile__skills">
                  {profile.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              ) : (
                <p className="profile__prompt">
                  {student ? "What you know or are learning: languages, tools, sports, clubs. Seniors who share them can find you." : "The things juniors could ask you about. These are what they search for."}
                </p>
              )}
            </Card>
          )}
          {/* The sections they've added (Experience, Education, Projects…), each shown only if this viewer may see it. */}
          {SECTION_KINDS.filter((k) => profile.sections[k]?.length).map((kind) => (
            <Card key={kind} title={SECTIONS[kind].label} who={isOwner ? profile.sectionsVisibility[kind] : undefined} className={`pcard--section pcard--${kind}`}>
              <ul className="entries">
                {profile.sections[kind]!.map((e, i) => (
                  <li key={i} className="entry">
                    <span className="entry__mark" aria-hidden="true" />
                    <div>
                      <strong className="entry__title">{e.link ? <a href={e.link} rel="noopener noreferrer nofollow" target="_blank">{e.title}</a> : e.title}</strong>
                      {e.org && <span className="entry__org">{e.org}</span>}
                      {yearsOf(e, kind) && <span className="entry__years">{yearsOf(e, kind)}</span>}
                      {e.detail && <p className="entry__detail">{e.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {isOwner && SECTION_KINDS.every((k) => !profile.sections[k]?.length) && (
            <Card title="More about you">
              <p className="profile__prompt">
                Add more when you edit your page. For example: experience, education, projects, certificates, clubs, awards, languages.
              </p>
            </Card>
          )}
        </div>

        <div className="profile__side">
          {lanterns.length > 0 && (
            <Card title="Happy to help" who={v?.happyTo}>
              <ul className="lanterns">
                {lanterns.map((l) => {
                  const on = profile.happyTo[l.key];
                  return (
                    <li key={l.key} className={on ? "lantern lantern--lit" : "lantern"}>
                      <svg viewBox="0 0 48 48" aria-hidden="true">
                        {l.art}
                      </svg>
                      <span>
                        <b>{l.key === "refer" && profile.company && on ? `Refers people at ${profile.company}` : l.title}</b>
                        <span>{on ? l.note : "Not switched on. Edit your page to turn it on."}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {wishes.length > 0 && (
            <Card title={isOwner ? "What you're looking for" : "Looking for"} who={v?.happyTo}>
              <ul className="lanterns">
                {wishes.map((w) => {
                  const on = profile.seeking[w.key];
                  return (
                    <li key={w.key} className={on ? "lantern lantern--lit" : "lantern"}>
                      <svg viewBox="0 0 48 48" aria-hidden="true">
                        {w.art}
                      </svg>
                      <span>
                        <b>{w.title}</b>
                        <span>
                          {on
                            ? w.note
                            : w.key === "mentor"
                              ? "Not switched on. Edit your page to turn it on, so seniors can find you."
                              : "Not switched on. Turn it on when you edit your page, so seniors can find you. We'll also tell you about new jobs and internships on the HKBK board."}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {(profile.links.linkedin || profile.links.website || isOwner) && (
            <Card title={isOwner ? "Your links" : "Links"} who={v?.links}>
              {profile.links.linkedin || profile.links.website ? (
                <ul className="profile__links">
                  {profile.links.linkedin && (
                    <li>
                      <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer nofollow">
                        LinkedIn <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  )}
                  {profile.links.website && (
                    <li>
                      <a href={profile.links.website} target="_blank" rel="noopener noreferrer nofollow">
                        {linkLabel(profile.links.website)} <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="profile__prompt">Add your LinkedIn or a website when you edit your page.</p>
              )}
            </Card>
          )}
        </div>
      </div>
      {stops.length > 0 && (
        <section className="profile__since">
          <header className="pcard__head">
            <h2>Since HKBK</h2>
            <ShownTo who={v?.journey} />
          </header>
          <Journey stops={stops} />
        </section>
      )}
    </article>
  );
}

/** Each badge's small mark: a crest-star for the founders, a sprout, a heart, a calendar. */
function BadgeIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    founding: "M8 1.2l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11l-3.8 2 .7-4.3-3.1-3 4.3-.6Z",
    mentor: "M8 14V7M8 9c0-3 2-5 5.5-5C13.5 7.5 11 9 8 9Zm0 0C8 6.5 6.3 4.8 2.5 4.8 2.5 7.8 4.8 9 8 9Z",
    helped: "M8 13.5S2.2 10 2.2 6.2A2.9 2.9 0 0 1 8 4.4a2.9 2.9 0 0 1 5.8 1.8C13.8 10 8 13.5 8 13.5Z",
    host: "M3 4.5h10v8.5H3zM3 7h10M5.5 3v3M10.5 3v3"
  };
  const d = paths[kind];
  if (!d) return <span className="badge__dot" aria-hidden="true" />;
  return (
    <svg className="badge__icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
