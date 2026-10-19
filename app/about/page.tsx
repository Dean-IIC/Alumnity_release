import Link from "next/link";
import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";
import { Letter } from "../../components/site/letter";
import { ABOUT, DIRECTOR_SUMMARY } from "../../lib/about-content";
import { PAGE_DEFAULTS } from "../../lib/site-pages";
import { sitePages } from "../../lib/server/site-pages";

// The letter and the opening words are the college's to change from its desk (site.pages).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { "about-intro": intro } = await sitePages("about-intro");
  return { title: "About · Alumnity", description: intro.body };
}

/** The Director's message (the college's own words), then how Alumnity keeps people's details private. */
export default async function AboutPage() {
  const { "about-intro": intro, "director-letter": letter } = await sitePages("about-intro", "director-letter");
  return (
    <PublicPage current="about" kicker="About" title="About" gold="Alumnity" intro={intro.body}>
      {/* A short summary, only while the letter is the one it sums up (the desk can change the letter). */}
      {letter.body === PAGE_DEFAULTS["director-letter"].body && <p className="info-lead">{DIRECTOR_SUMMARY}</p>}
      <Letter body={letter.body} signerName={letter.signerName} signerRole={letter.signerRole} />

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
          The details are in the <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </PublicPage>
  );
}
