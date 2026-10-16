import type { Metadata } from "next";
import { Prose, PublicPage } from "../../components/public-page";
import { ABOUT, DIRECTOR_MESSAGE } from "../../lib/about-content";

export const metadata: Metadata = { title: "About · Alumnity", description: ABOUT.intro };

/** What Alumnity is, and the Director's message (the college's own words). */
export default function AboutPage() {
  return (
    <PublicPage current="about" title="About Alumnity" intro={ABOUT.intro}>
      <Prose text={ABOUT.privacy} />
      <article className="director wf-card" aria-labelledby="director">
        <h2 id="director">A message from the {DIRECTOR_MESSAGE.role}</h2>
        <div className="wf-prose">
          <p>
            <strong>{DIRECTOR_MESSAGE.greeting}</strong>
          </p>
          {DIRECTOR_MESSAGE.paragraphs.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
        <footer className="director__sign">
          <strong>{DIRECTOR_MESSAGE.name}</strong>
          <span>{DIRECTOR_MESSAGE.role}</span>
        </footer>
      </article>
    </PublicPage>
  );
}
