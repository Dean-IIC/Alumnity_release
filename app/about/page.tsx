import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";
import { ABOUT, DIRECTOR_MESSAGE } from "../../lib/about-content";

export const metadata: Metadata = { title: "About · Alumnity", description: ABOUT.intro };

/** The Director's message (the college's own words), then how Alumnity keeps people's details private. */
export default function AboutPage() {
  return (
    <PublicPage current="about" kicker="About" title="About" gold="Alumnity" intro={ABOUT.intro}>
      <article className="letter" aria-labelledby="director">
        <p className="letter__from">From the {DIRECTOR_MESSAGE.role.toLowerCase()}'s desk · HKBK College of Engineering</p>
        <h2 id="director" className="letter__greeting">
          {DIRECTOR_MESSAGE.greeting}
        </h2>
        {DIRECTOR_MESSAGE.paragraphs.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <footer className="letter__sign">
          <strong>{DIRECTOR_MESSAGE.name}</strong>
          <span>{DIRECTOR_MESSAGE.role}, HKBK College of Engineering</span>
        </footer>
      </article>

      <section aria-labelledby="privacy">
        <h2 id="privacy" className="info__h2">
          Your privacy
        </h2>
        <ul className="info-points">
          {ABOUT.privacy.map((p, i) => (
            <li key={p.title} className="info-point">
              <span className="info-point__mark" aria-hidden="true">
                {i + 1}
              </span>
              <strong>{p.title}</strong>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
        <p className="info__aside">
          The details are in the <a href="/privacy">privacy policy</a>.
        </p>
      </section>
    </PublicPage>
  );
}
