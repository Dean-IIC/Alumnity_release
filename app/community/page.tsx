import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";
import { COMMUNITY } from "../../lib/about-content";
import { paragraphsOf } from "../../lib/site-pages";
import { sitePages } from "../../lib/server/site-pages";

// The opening words are the college's to change from its desk (site.pages).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { "community-intro": intro } = await sitePages("community-intro");
  return { title: "Community · Alumnity", description: intro.body };
}

const Ticks = ({ items }: { items: readonly string[] }) => (
  <ul className="ticks">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

/** Who Alumnity is for, what's open to everyone, and what members get. */
export default async function CommunityPage() {
  const { "community-intro": intro, "community-lead": lead } = await sitePages("community-intro", "community-lead");
  return (
    <PublicPage current="community" kicker="Community" title="The alumni" gold="community" intro={intro.body}>
      {paragraphsOf(lead.body).map((t, i) => (
        <p key={i} className="info-lead">
          {t}
        </p>
      ))}
      <div className="info-split">
        <section className="info-card" aria-labelledby="open">
          <p className="info-card__tag">Anyone</p>
          <h2 id="open">Open to everyone</h2>
          <Ticks items={COMMUNITY.open} />
        </section>
        <section className="info-card info-card--members" aria-labelledby="members">
          <p className="info-card__tag">Members</p>
          <h2 id="members">For members</h2>
          <Ticks items={COMMUNITY.members} />
        </section>
      </div>
      <section aria-labelledby="joining">
        <h2 id="joining" className="info__h2">
          Who can join
        </h2>
        <ol className="info-points info-points--steps">
          {COMMUNITY.joining.map((t, i) => (
            <li key={t} className="info-point">
              <span className="info-point__mark" aria-hidden="true">
                {i + 1}
              </span>
              <p>{t}</p>
            </li>
          ))}
        </ol>
      </section>
    </PublicPage>
  );
}
