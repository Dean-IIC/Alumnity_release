import type { Metadata } from "next";
import { PublicPage } from "../../components/public-page";
import { COMMITTEE, OFFICE_BEARERS } from "../../lib/about-content";

export const metadata: Metadata = { title: "Committee · Alumnity", description: "The HKBK alumni association's office bearers and committee." };

const People = ({ list }: { list: { role: string; name: string }[] }) => (
  <ul className="committee">
    {list.map((p) => (
      <li key={p.role} className="wf-card">
        <span className="committee__role">{p.role}</span>
        <strong>{p.name}</strong>
      </li>
    ))}
  </ul>
);

/** The alumni association's office bearers and committee (names to be confirmed by the college). */
export default function CommitteePage() {
  return (
    <PublicPage current="committee" title="Committee" intro="The people who look after HKBK's alumni association.">
      <h2>Office bearers</h2>
      <People list={OFFICE_BEARERS} />
      <h2>Committee</h2>
      <People list={COMMITTEE} />
    </PublicPage>
  );
}
