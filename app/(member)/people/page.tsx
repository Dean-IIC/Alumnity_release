import Link from "next/link";
import type { Metadata } from "next";
import { photoIdsOf } from "../../../lib/server/profile";
import { AppPage } from "../../../components/app/app-page";
import { MemberLine } from "../../../components/app/member-line";
import { BRANCHES, isBranch } from "../../../lib/branches";
import { Invite } from "../../../components/app/invite";
import { batchmates, memberCount, searchMembers, whereAlumniWork, type SearchQuery } from "../../../lib/server/people";
import { batchCount, browseRegister, REGISTER_PAGES, REGISTER_SEARCHES, registerFacts, searchRegister, type NotYetJoined } from "../../../lib/server/register";
import { Avatar } from "../../../components/social/avatar";
import { batchLabel } from "../../../lib/format";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "People · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const RELATION_LABEL: Record<string, string> = { connected: "Connected", sent: "Request sent", received: "Wants to connect" };

type Params = { q?: string; branch?: string; year?: string; help?: string; page?: string };

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
  // Members, and (for a name or USN typed) people on the college register who haven't joined yet.
  const page = Number(params.page) || 1;
  const [found, register, companies, college, browse] = await Promise.all([
    searchMembers(me, query),
    query.q ? searchRegister(me, { q: query.q, branch: query.branch, year: query.year }) : Promise.resolve({ people: [], limited: false }),
    searched ? Promise.resolve([]) : whereAlumniWork(me),
    query.q ? Promise.resolve(null) : registerFacts(),
    // No name typed: the register to look through, a page at a time (by branch and year if chosen).
    query.q ? Promise.resolve(null) : browseRegister(me, { branch: query.branch, year: query.year, page })
  ]);
  const photos = await photoIdsOf(found.slice(0, 60).map((f) => f.member.id));
  // A young network: who's here so far, and how many from your batch aren't yet.
  const quiet = !searched && found.length < 5;
  const [members, onRegister, mates] = quiet
    ? await Promise.all([memberCount(), me.branch && me.joined ? batchCount(me.branch, me.joined, me.programme ?? "B.Tech") : Promise.resolve(0), batchmates(me)])
    : [0, 0, []];

  return (
    <AppPage user={me} current="people" title="People" intro="Everyone on Alumnity from HKBK. You only see what each person chose to show.">
      <form className="wf-filters wf-filters--people" role="search" aria-label="Find people" action="/people">
        <label className="field">
          <span className="field__label">Name, USN, company, city or skill</span>
          <input name="q" defaultValue={query.q} maxLength={100} placeholder="e.g. Asha, 1HK12CS042, Infosys, Python" />
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
          <input name="year" inputMode="numeric" pattern="[0-9]{4}" defaultValue={query.year ?? ""} placeholder="Any" />
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

      {/* Only members are listed until a name is typed (the register isn't a list to browse),
          so the page looked empty of real people: "is the data missing?" It says it's here. */}
      {college && (
        <p className="people-register-note">
          <strong>{college.count.toLocaleString("en-IN")} people</strong> from HKBK&apos;s register, {college.from}–{college.to}, are here: those who have joined Alumnity first,
          then <a href="#register-all">everyone on the register</a>. Type a name or USN above to find someone.
        </p>
      )}

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

      {companies.length > 0 && (
        <section className="where-work" aria-labelledby="where-work">
          <h2 id="where-work">Where HKBK alumni work</h2>
          <p className="wf-muted">Ask someone about their company, or for a referral: tap one to see who's there.</p>
          <ul className="where-work__list">
            {companies.map((c) => (
              <li key={c.company}>
                <Link href={`/people?q=${encodeURIComponent(c.company)}`}>
                  {c.company} <span className="where-work__n">{c.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>{searched ? `${found.length === 60 ? "60+" : found.length} found` : "Newest members"}</h2>
      {found.length === 0 && !searched ? (
        <p className="wf-empty">Nobody else has joined yet. You'll see everyone here as they do.</p>
      ) : found.length === 0 ? (
        <p className="wf-empty">
          {register.people.length ? "No member matches that yet: see the college register below." : <>Nobody matches that yet. Try fewer words, or <Link href="/people">clear the search</Link>.</>}
        </p>
      ) : (
        <ul className="wf-list">
          {(searched ? found : found.slice(0, 30)).map(({ member, profile, relation }) => (
            <MemberLine
              key={member.id}
              member={member}
              photoId={photos.get(member.id)}
              detail={[profile.title, profile.company && `at ${profile.company}`, profile.city && `· ${profile.city}`].filter(Boolean).join(" ")}
            >
              {RELATION_LABEL[relation] && <span className={`wf-tag ${relation === "connected" ? "wf-tag--ok" : ""}`}>{RELATION_LABEL[relation]}</span>}
              {profile.happyTo.mentor && <span className="wf-tag">Mentors</span>}
            </MemberLine>
          ))}
        </ul>
      )}
      {register.people.length > 0 && (
        <section className="register-found" aria-labelledby="register-found">
          <h2 id="register-found">On the college register, not on Alumnity yet</h2>
          <p className="wf-muted">From HKBK's own register of students. Know them? Send them the link. They can join by finding their name in the register.</p>
          <RegisterList people={register.people} />
          <Invite text="I found your name on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:" />
        </section>
      )}
      {browse && (
        <section className="register-found" id="register-all" aria-labelledby="register-all-title">
          <h2 id="register-all-title">
            Everyone on HKBK&apos;s register <span className="h-count">· {browse.total.toLocaleString("en-IN")} not on Alumnity yet</span>
          </h2>
          <p className="wf-muted">
            From the college&apos;s own register of students{query.branch || query.year ? ", with the branch and year chosen above" : ""}. Choose a branch or year above to look through one batch. Know someone? Send them the link: they join by finding their name.
          </p>
          {browse.limited ? (
            <p className="wf-note">That&apos;s {REGISTER_PAGES} pages of the register this hour, the most at a time. It comes back within the hour.</p>
          ) : (
            <RegisterList people={browse.people} />
          )}
          {browse.pages > 1 && (
            <nav className="register-pages" aria-label="Pages of the register">
              {browse.page > 1 ? <Link href={pageHref(query, browse.page - 1)}>← Previous</Link> : <span />}
              <span>
                Page {browse.page} of {browse.pages}
              </span>
              {browse.page < browse.pages ? <Link href={pageHref(query, browse.page + 1)}>Next →</Link> : <span />}
            </nav>
          )}
          <Invite text="I found your name on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:" />
        </section>
      )}
      {register.limited && (
        <p className="wf-note">
          That's {REGISTER_SEARCHES} searches of the college register this hour, the most at a time. Members still show; the register's names come back within the hour.
        </p>
      )}
    </AppPage>
  );
}

/** A page of the register: name, batch, and that they haven't joined. Never a USN. */
function RegisterList({ people }: { people: NotYetJoined[] }) {
  return (
    <ul className="wf-list">
      {people.map((p, i) => (
        <li key={`${p.name}-${p.joined}-${i}`} className="wf-member wf-member--face">
          <span className="wf-member__face" aria-hidden="true">
            <Avatar name={p.name} size={44} />
          </span>
          <div className="wf-member__who">
            <strong className="wf-member__name wf-member__name--plain">{p.name}</strong>
            <span className="wf-muted">
              {batchLabel({ branch: p.branch, joined: p.joined, programme: p.programme })}
              {p.programme !== "B.Tech" ? ` · ${p.programme}` : ""}
            </span>
          </div>
          <div className="wf-actions">
            <span className="wf-tag wf-tag--waiting">Not on Alumnity yet</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The same choices of branch and year, another page of the register. */
function pageHref(query: { branch?: string; year?: number }, page: number) {
  const p = new URLSearchParams();
  if (query.branch) p.set("branch", query.branch);
  if (query.year) p.set("year", String(query.year));
  p.set("page", String(page));
  return `/people?${p}#register-all`;
}
