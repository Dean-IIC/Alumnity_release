import type { Metadata } from "next";
import { initialsOf } from "../../components/profile/ink-seal";
import { PublicPage } from "../../components/public-page";
import { rosterOf } from "../../lib/site-pages";
import { sitePages } from "../../lib/server/site-pages";

export const metadata: Metadata = { title: "Committee · Alumnity", description: "The people who run the HKBK alumni association." };

// The names are the college's to fill in from its desk (site.pages).
export const dynamic = "force-dynamic";

const TBA = "To be announced";
const isNamed = (name: string) => name.trim().toLowerCase() !== TBA.toLowerCase();

const Roster = ({ list }: { list: { role: string; name: string }[] }) => (
  <ul className="roster">
    {list.map((p, i) => {
      const named = isNamed(p.name);
      return (
        <li key={`${i}-${p.role}`} className={`roster__item ${named ? "" : "roster__item--open"}`}>
          <span className="seal" aria-hidden="true">
            {named ? initialsOf(p.name) : "·"}
          </span>
          <span className="roster__who">
            <span className="roster__role">{p.role}</span>
            <strong>{named ? p.name : "To be announced"}</strong>
          </span>
        </li>
      );
    })}
  </ul>
);

/** The alumni association's office bearers and committee (names to be confirmed by the college). */
export default async function CommitteePage() {
  const pages = await sitePages("committee-office-bearers", "committee-members");
  const OFFICE_BEARERS = rosterOf(pages["committee-office-bearers"].body);
  const COMMITTEE = rosterOf(pages["committee-members"].body);
  const waiting = [...OFFICE_BEARERS, ...COMMITTEE].every((p) => !isNamed(p.name));
  return (
    <PublicPage current="committee" kicker="Committee" title="The alumni association" gold="committee" intro="The leaders of HKBK's alumni association, and one person from each department.">
      {waiting && (
        <p className="info-note">
          The association is choosing its first committee. You&apos;ll see the names here once the college shares them.
        </p>
      )}
      <section>
        <h2 className="info__h2">Office bearers</h2>
        <Roster list={OFFICE_BEARERS} />
      </section>
      <section>
        <h2 className="info__h2">The committee</h2>
        <Roster list={COMMITTEE} />
      </section>
    </PublicPage>
  );
}
