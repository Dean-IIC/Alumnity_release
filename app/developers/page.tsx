import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";
import { DEVELOPERS, DEVELOPERS_INTRO } from "../../lib/about-content";

export const metadata: Metadata = { title: "Developers · Alumnity", description: DEVELOPERS_INTRO.intro };

/** The students who built Alumnity, and the faculty member who guided them. */
export default function DevelopersPage() {
  return (
    <PublicPage current="developers" title="Developers" intro={DEVELOPERS_INTRO.intro}>
      <div className="wf-prose">
        <p>{DEVELOPERS_INTRO.body}</p>
      </div>
      <h2>The team</h2>
      <ul className="committee">
        {DEVELOPERS.team.map((d) => (
          <li key={d.usn} className="wf-card">
            <strong>{d.name}</strong>
            <span className="committee__role">{DEVELOPERS.department}</span>
          </li>
        ))}
      </ul>
      <h2>Guided by</h2>
      <div className="wf-card committee__guide">
        <strong>{DEVELOPERS.guide.name}</strong>
        {DEVELOPERS.guide.roles.map((r) => (
          <span key={r} className="committee__role">
            {r}
          </span>
        ))}
      </div>
    </PublicPage>
  );
}
