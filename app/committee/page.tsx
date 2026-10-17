import type { Metadata } from "next";
import { initialsOf } from "../../components/profile/ink-seal";
import { PublicPage } from "../../components/public-page";
import { COMMITTEE, OFFICE_BEARERS } from "../../lib/about-content";

export const metadata: Metadata = { title: "Committee · Alumnity", description: "The HKBK alumni association's office bearers and committee." };

const TBA = "To be announced";

const Roster = ({ list }: { list: { role: string; name: string }[] }) => (
  <ul className="roster">
    {list.map((p) => {
      const named = p.name !== TBA;
      return (
        <li key={p.role} className={`roster__item ${named ? "" : "roster__item--open"}`}>
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
export default function CommitteePage() {
  const waiting = [...OFFICE_BEARERS, ...COMMITTEE].every((p) => p.name === TBA);
  return (
    <PublicPage current="committee" kicker="Committee" title="The people who keep" gold="us together" intro="HKBK's alumni association: its office bearers, and a representative from every department.">
      {waiting && (
        <p className="info-note">
          The association is choosing its first committee. The names will appear here as soon as the college confirms them.
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
