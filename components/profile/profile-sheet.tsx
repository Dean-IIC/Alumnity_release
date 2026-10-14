import type { ReactNode } from "react";
import { mediaUrl } from "../../lib/media-url";
import { ERAS } from "../../lib/eras";
import type { Profile, Visibility } from "../../lib/server/profile";
import { Cover } from "./cover";
import { InkSeal } from "./ink-seal";
import { Journey, type Stop } from "./journey";

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
    note: "Ask about a decision, a project, a first job.",
    art: <path d="M24 42V24m0 0c-1-8-7-12-14-12 0 8 6 12 14 12Zm0-4c1-7 6-11 13-11 0 7-6 11-13 11ZM14 42h20" />
  },
  {
    key: "refer",
    title: "Refers people",
    note: "Puts a good fit forward at their company.",
    art: <path d="M12 42V8h20v34M12 42h26M32 8l8 4v26l-8 4M27 26h2M6 14l4 2M4 24h5M6 34l4-2" />
  },
  {
    key: "talk",
    title: "Gives talks",
    note: "A guest lecture, or a session for a department.",
    art: <path d="M16 42h16M24 42V30M14 30h20l-3-8H17l-3 8Zm10-8v-6m-6-8a6 6 0 0 1 12 0M14 6a12 12 0 0 1 20 0" />
  }
] as const;

const linkLabel = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function ProfileSheet({ person, profile, isOwner, batchSize, actions }: { person: SheetPerson; profile: Profile; isOwner: boolean; batchSize?: number; actions?: ReactNode }) {
  const years = person.programme === "B.Tech" ? 4 : 2;
  const graduated = person.joined && person.role !== "student" ? person.joined + years : null;
  const branch = person.branch ?? "HKBK";
  const ring = `${branch} · ${person.joined ?? ""} · HKBK CE · ${branch} · ${person.joined ?? ""} ·`;
  const now = [profile.title, profile.company && `at ${profile.company}`].filter(Boolean).join(" ");
  const v = isOwner ? profile.visibility : undefined;

  // The campus as it was when they joined: the latest era at or before that year.
  const era = [...ERAS].reverse().find((e) => person.joined && e.year <= person.joined) ?? ERAS[0];

  // The journey is optional: it appears once they've added a stop of their own.
  const stops: Stop[] = profile.journey.length
    ? [
        ...(person.joined ? [{ year: String(person.joined), title: "Joined HKBK" }] : []),
        ...(graduated ? [{ year: String(graduated), title: "Graduated" }] : []),
        ...profile.journey.map((m) => ({ year: String(m.year), title: m.text })),
        ...(now ? [{ year: "Now", title: now, detail: profile.city || undefined }] : [])
      ]
    : [];

  const lit = LANTERNS.filter((l) => profile.happyTo[l.key]);
  const lanterns = isOwner ? LANTERNS : lit;

  return (
    <article className="profile">
      {/* The top: their cover, their photo (or their seal) over its edge, then who they are. */}
      <header className="profile__top">
        <Cover cover={profile.cover} fallback={{ src: era.photo.photo, sketch: era.photo.sketch, year: era.year, title: era.title }} name={person.name} seed={person.id} />
        <div className="profile__intro">
          <div className="profile__avatar">
            {profile.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(profile.photo.id)} alt={person.name} />
            ) : (
              <InkSeal name={person.name} ring={ring} seed={person.id} size={148} />
            )}
          </div>
          <div className="profile__who">
            <h1 className="profile__name">{person.name}</h1>
            {now ? (
              <p className="profile__now">{now}</p>
            ) : (
              isOwner && <p className="profile__prompt">What are you doing now? Add it when you edit your page.</p>
            )}
            <p className="profile__meta">
              {[person.branchName, graduated ? `Batch of ${graduated}` : person.joined && `Joined ${person.joined}`, profile.city].filter(Boolean).join(" · ")}
            </p>
            <p className="profile__register">
              <span aria-hidden="true">✓</span> On the college register
              {batchSize && batchSize > 1 ? ` · one of ${batchSize} in ${isOwner ? "your" : "their"} batch` : ""}
              {v && <ShownTo who={v.now} />}
            </p>
          </div>
          {actions && <div className="profile__actions">{actions}</div>}
        </div>
      </header>

      <div className="profile__body">
        <div className="profile__main">
          {(profile.about || isOwner) && (
            <Card title={isOwner ? "In your words" : "In their words"} who={v?.about} className="pcard--words">
              {profile.about ? (
                <blockquote className="profile__about">{profile.about}</blockquote>
              ) : (
                <p className="profile__prompt">A few lines about you: what you work on, what you loved at HKBK, what a junior could ask you.</p>
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
                <p className="profile__prompt">The things juniors could ask you about. These are what they search for.</p>
              )}
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
                        <span>{on ? l.note : "Not switched on. Edit your page to light it."}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {(profile.links.linkedin || profile.links.website || isOwner) && (
            <Card title={isOwner ? "Find you" : "Find them"} who={v?.links}>
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
                <p className="profile__prompt">Your LinkedIn, or a website.</p>
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
