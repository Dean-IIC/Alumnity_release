import type { Metadata } from "next";
import { Prose, PublicPage } from "../../components/public-page";
import { ABOUT, DIRECTOR_MESSAGE } from "../../lib/about-content";

export const metadata: Metadata = { title: "About · Alumnity", description: ABOUT.intro };

/** The Director's message (the college's own words), then how Alumnity keeps people's details private. */
export default function AboutPage() {
  return (
    <PublicPage current="about" title="About Alumnity" intro={ABOUT.intro}>
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
      <Prose text={ABOUT.privacy} />
    </PublicPage>
  );
}
