import type { Metadata } from "next";
import { AppPage } from "../../components/app/app-page";
import { MemberLine } from "../../components/app/member-line";
import { BRANCHES, isBranch } from "../../lib/branches";
import { Invite } from "../../components/app/invite";
import { batchmates, memberCount, searchMembers, type SearchQuery } from "../../lib/server/people";
import { batchCount } from "../../lib/server/register";
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
  // A young network: who's here so far, and how many from your batch aren't yet.
  const quiet = !searched && found.length < 5;
  const [members, onRegister, mates] = quiet
    ? await Promise.all([memberCount(), me.branch && me.joined ? batchCount(me.branch, me.joined, me.programme ?? "B.Tech") : Promise.resolve(0), batchmates(me)])
    : [0, 0, []];

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

      {quiet && (
        <section className="wf-card" aria-labelledby="young">
          <h2 id="young">You're one of the first {members === 1 ? "member" : `${members} members`}</h2>
          <p className="wf-muted">
            Alumnity has only just opened, so there aren't many people to find yet.
            {onRegister > 0 &&
              ` ${onRegister} people joined HKBK in your batch; ${mates.length === 0 ? "none of them are" : `${mates.length} ${mates.length === 1 ? "is" : "are"}`} here yet besides you.`}{" "}
            Each person who joins makes it more useful for everyone: bring your batch in.
          </p>
          <Invite text="I'm on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:" />
        </section>
      )}

      <h2>{searched ? `${found.length === 60 ? "60+" : found.length} found` : "Newest members"}</h2>
      {found.length === 0 && !searched ? (
        <p className="wf-empty">Nobody else has joined yet. You'll see everyone here as they do.</p>
      ) : found.length === 0 ? (
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
