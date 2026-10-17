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
      <h2 className="info__h2">The team</h2>
      <ul className="people-cards">
        {DEVELOPERS.team.map((d) => (
          <li key={d.usn} className="people-card">
            <span className="seal seal--large" aria-hidden="true">
              {initialsOf(d.name)}
            </span>
            <strong>{d.name}</strong>
            <span>{DEVELOPERS.department}</span>
          </li>
        ))}
      </ul>
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
    </PublicPage>
  );
}
