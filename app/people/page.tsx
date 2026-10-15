import type { Metadata } from "next";
import { AppPage } from "../../components/app/app-page";
import { MemberLine } from "../../components/app/member-line";
import { BRANCHES, isBranch } from "../../lib/branches";
import { searchMembers, type SearchQuery } from "../../lib/server/people";
import { requireUser } from "../../lib/server/session";

export const metadata: Metadata = { title: "People · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const RELATION_LABEL: Record<string, string> = { connected: "Connected", sent: "Request sent", received: "Wants to connect" };

type Params = { q?: string; branch?: string; year?: string; help?: string };

/** Find people: by name, what they do, where, what they know; branch, year, and what they're happy to do. */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser("/people");
  const params = await searchParams;
  const year = Number(params.year);
  const query: SearchQuery = {
    q: (params.q ?? "").slice(0, 100),
    branch: isBranch(params.branch) ? params.branch : undefined,
    year: Number.isInteger(year) && year >= 1997 && year <= 2100 ? year : undefined,
    help: params.help === "mentor" || params.help === "refer" || params.help === "talk" ? params.help : undefined
  };
  const searched = Boolean(query.q || query.branch || query.year || query.help);
  const found = await searchMembers(me, query);

  return (
    <AppPage user={me} current="people" title="People" intro="Everyone on Alumnity from HKBK. You only see what each person chose to show.">
      <form className="wf-filters" role="search" action="/people">
        <label className="field">
          <span className="field__label">Name, company, city or skill</span>
          <input name="q" defaultValue={query.q} maxLength={100} placeholder="e.g. Asha, Infosys, Pune, Python" />
        </label>
        <label className="field">
          <span className="field__label">Branch</span>
          <select name="branch" defaultValue={query.branch ?? ""}>
            <option value="">Any</option>
            {BRANCHES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Joined in</span>
          <input name="year" inputMode="numeric" pattern="[0-9]{4}" defaultValue={query.year ?? ""} placeholder="Any year" />
        </label>
        <label className="field">
          <span className="field__label">Happy to</span>
          <select name="help" defaultValue={query.help ?? ""}>
            <option value="">Anything</option>
            <option value="mentor">Mentor</option>
            <option value="refer">Refer</option>
            <option value="talk">Have a chat</option>
          </select>
        </label>
        <button className="button button--primary wf-small" type="submit">
          Search
        </button>
      </form>

      <h2>{searched ? `${found.length === 60 ? "60+" : found.length} found` : "Newest members"}</h2>
      {found.length === 0 ? (
        <p className="wf-empty">
          Nobody matches that yet. Try fewer words, or <a href="/people">clear the search</a>.
        </p>
      ) : (
        <ul className="wf-list">
          {(searched ? found : found.slice(0, 30)).map(({ member, profile, relation }) => (
            <MemberLine
              key={member.id}
              member={member}
              detail={[profile.title, profile.company && `at ${profile.company}`, profile.city && `· ${profile.city}`].filter(Boolean).join(" ")}
            >
              {RELATION_LABEL[relation] && <span className="wf-tag">{RELATION_LABEL[relation]}</span>}
              {profile.happyTo.mentor && <span className="wf-tag">Mentors</span>}
            </MemberLine>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
