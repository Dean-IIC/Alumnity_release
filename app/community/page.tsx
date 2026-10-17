import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";
import { COMMUNITY } from "../../lib/about-content";

export const metadata: Metadata = { title: "Community · Alumnity", description: COMMUNITY.intro };

const Ticks = ({ items }: { items: readonly string[] }) => (
  <ul className="ticks">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

/** Who Alumnity is for, what's open to everyone, and what members get. */
export default function CommunityPage() {
  return (
    <PublicPage current="community" kicker="Community" title="The alumni" gold="community" intro={COMMUNITY.intro}>
      <p className="info-lead">{COMMUNITY.lead}</p>
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
