import type { Metadata } from "next";
import { initialsOf } from "../../components/profile/ink-seal";
import { PublicPage } from "../../components/public-page";
import { DEVELOPERS, DEVELOPERS_INTRO } from "../../lib/about-content";

export const metadata: Metadata = { title: "Developers · Alumnity", description: DEVELOPERS_INTRO.intro };

/** The students who built Alumnity, and the faculty member who guided them. */
export default function DevelopersPage() {
  return (
    <PublicPage current="developers" kicker="Developers" title="Made at" gold="HKBK" intro={DEVELOPERS_INTRO.intro}>
      <p className="info-lead">{DEVELOPERS_INTRO.body}</p>
      <ul className="ticks">
        {DEVELOPERS_INTRO.points.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <section>
        <h2 className="info__h2">The team</h2>
        <ul className="people-cards">
          {DEVELOPERS.team.map((d) => (
            <li key={d.usn} className="people-card people-card--dev">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="people-card__photo" src={`/assets/developers/${d.usn.toLowerCase()}.webp`} alt={d.name} width={160} height={160} loading="lazy" />
              <strong>{d.name}</strong>
              <span>{DEVELOPERS.department}</span>
              <span className="badge badge--gold badge--founding">
                <svg className="badge__icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M8 1.2l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11l-3.8 2 .7-4.3-3.1-3 4.3-.6Z" />
                </svg>
                Developer
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="info__h2">Guided by</h2>
        <div className="people-card people-card--guide">
          <span className="seal seal--large seal--gold" aria-hidden="true">
            {initialsOf(DEVELOPERS.guide.name.replace(/^(Dr|Prof)\.?\s*/, ""))}
          </span>
          <div>
            <strong>{DEVELOPERS.guide.name}</strong>
            {DEVELOPERS.guide.roles.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
