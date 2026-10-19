import Link from "next/link";
import type { Metadata } from "next";
import { photoIdsOf } from "../../../lib/server/profile";
import { AppPage } from "../../../components/app/app-page";
import { BRANCHES, isBranch } from "../../../lib/branches";
import { Invite } from "../../../components/app/invite";
import { MemberCard, RegisterCard, RequestCard } from "../../../components/people/person-card";
import { PeopleSearch } from "../../../components/people/people-search";
import { peopleHref, type PeopleQuery } from "../../../lib/people-href";
import { batchmates, memberCount, whereAlumniWork } from "../../../lib/server/people";
import { findPeople, suggestPeople, waitingForYou, type PersonCard } from "../../../lib/server/people-search";
import { batchCount, browseRegister, REGISTER_PAGES, REGISTER_SEARCHES, registerFacts } from "../../../lib/server/register";
import { requireUser } from "../../../lib/server/session";
import "../../styles/people-plus.css";

export const metadata: Metadata = { title: "Network · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = { q?: string; branch?: string; year?: string; help?: string; page?: string };

/**
 * Finding people, the way Instagram and LinkedIn do it: one search bar (searching as you
 * type), requests waiting for you first, and everyone as a card with the next thing to do
 * on it. People on the college register who haven't joined appear among the results,
 * marked "Not on Alumnity yet", with a way to invite them.
 */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser("/people");
  const params = await searchParams;
  const year = Number(params.year);
  const query: PeopleQuery = {
    q: (params.q ?? "").slice(0, 100).trim(),
    branch: isBranch(params.branch) ? params.branch : undefined,
    year: Number.isInteger(year) && year >= 1997 && year <= 2100 ? year : undefined,
    help: params.help === "mentor" || params.help === "refer" || params.help === "talk" ? params.help : undefined
  };
  const searched = Boolean(query.q || query.branch || query.year || query.help);
  const page = Number(params.page) || 1;
  const [waiting, results, suggestions, companies, college, browse] = await Promise.all([
    waitingForYou(me),
    // Members, and (for a name or USN typed) people on the register who haven't joined, in one list.
    findPeople(me, query),
    searched ? Promise.resolve([]) : suggestPeople(me, 8),
    searched ? Promise.resolve([]) : whereAlumniWork(me),
    query.q ? Promise.resolve(null) : registerFacts(),
    // No name typed: the register to look through, a page at a time (by branch and year if chosen).
    query.q ? Promise.resolve(null) : browseRegister(me, { branch: query.branch, year: query.year, page })
  ]);

  // Not searching: people you may know, then the newest members not already suggested.
  const suggested = new Set(suggestions.map((s) => s.member.id));
  const newest = searched ? [] : results.cards.filter((c) => c.kind === "member" && !suggested.has(c.member.id)).slice(0, 12);
  const memberIds = [
    ...waiting.requests.map((r) => r.member.id),
    ...suggestions.map((s) => s.member.id),
    ...(searched ? results.cards : newest).flatMap((c) => (c.kind === "member" ? [c.member.id] : []))
  ];
  const photos = await photoIdsOf(memberIds.slice(0, 120));

  // A young network: who's here so far, and how many from your batch aren't yet.
  const memberCards = results.cards.filter((c) => c.kind === "member").length;
  const quiet = !searched && memberCards < 5;
  const [members, onRegister, mates] = quiet
    ? await Promise.all([memberCount(), me.branch && me.joined ? batchCount(me.branch, me.joined, me.programme ?? "B.Tech") : Promise.resolve(0), batchmates(me)])
    : [0, 0, []];
  const myBatch = me.branch && me.joined && isBranch(me.branch) ? { branch: me.branch, year: me.joined } : undefined;
  const registerShown = results.cards.length - memberCards;

  return (
    <AppPage user={me} current="people" title="Network" intro="Classmates, seniors and mentors from HKBK. You only see what each person chose to show.">
      <PeopleSearch query={query} branches={BRANCHES} myBatch={myBatch} />

      {/* Requests first, as on Instagram: someone asked to connect, so answer them here. */}
      {waiting.total > 0 && (
        <section className="people-section people-requests" aria-labelledby="requests">
          <div className="people-section__head">
            <h2 id="requests">
              Connection requests <span className="people-badge">{waiting.total}</span>
            </h2>
            {waiting.total > waiting.requests.length && <Link href="/connections#waiting">See all {waiting.total}</Link>}
          </div>
          <ul className="request-strip">
            {waiting.requests.map((r) => (
              <RequestCard key={r.member.id} member={r.member} note={r.note} createdAt={r.createdAt} photoId={photos.get(r.member.id)} />
            ))}
          </ul>
        </section>
      )}

      {searched ? (
        <section className="people-section" aria-labelledby="results">
          <div className="people-section__head">
            {/* Everyone shown is counted: members and those on the register together. */}
            <h2 id="results" aria-live="polite">
              {results.count === 0 ? "Nobody found" : `${results.count}${results.more ? "+" : ""} ${results.count === 1 ? "person" : "people"} found`}
            </h2>
            {registerShown > 0 && (
              <span className="people-section__note">
                {registerShown === results.count ? "None of them have joined Alumnity yet. You can invite them." : `${registerShown} not on Alumnity yet`}
              </span>
            )}
          </div>
          {/* Many say their batch by the year they finished: point them to the year they joined. */}
          {query.year && query.year - 4 >= 1997 && (
            <p className="people-section__note">
              Years here are the year people joined HKBK. Looking for people who finished in {query.year}?{" "}
              <Link href={peopleHref({ ...query, year: query.year - 4 })}>See people who joined in {query.year - 4}</Link>
            </p>
          )}
          {results.count === 0 ? (
            <p className="people-empty">
              Nobody matches your search. Try fewer words or a different spelling, or <Link href={peopleHref({})}>clear the search</Link>.
            </p>
          ) : (
            <Cards cards={results.cards} photos={photos} />
          )}
          {results.registerLimited && (
            <p className="wf-note">
              You can search the college register {REGISTER_SEARCHES} times an hour, and you have reached that limit. Members still show here. Try the register again later.
            </p>
          )}
        </section>
      ) : (
        <>
          {quiet && (
            <section className="wf-card" aria-labelledby="young">
              <h2 id="young">You&apos;re one of the first {members === 1 ? "member" : `${members} members`}</h2>
              <p className="wf-muted">
                Alumnity has only just opened, so there aren&apos;t many people to find yet.
                {onRegister > 0 &&
                  ` ${onRegister} people joined HKBK in your batch. ${mates.length === 0 ? "None of them have joined Alumnity yet." : `${mates.length} of them ${mates.length === 1 ? "has" : "have"} joined so far.`}`}{" "}
                Alumnity gets more useful with each person who joins. Invite your batch.
              </p>
              <Invite text="I'm on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:" />
            </section>
          )}

          {suggestions.length > 0 && (
            <section className="people-section" aria-labelledby="may-know">
              <div className="people-section__head">
                <h2 id="may-know">People you may know</h2>
                <span className="people-section__note">Your batch, your branch, and seniors happy to mentor</span>
              </div>
              <ul className="people-grid">
                {suggestions.map((s) => (
                  <MemberCard
                    key={s.member.id}
                    member={s.member}
                    profile={s.profile}
                    relation={s.relation}
                    following={s.following}
                    reason={s.reason}
                    photoId={photos.get(s.member.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          {companies.length > 0 && (
            <section className="where-work" aria-labelledby="where-work">
              <h2 id="where-work">Where HKBK alumni work</h2>
              <p className="wf-muted">Tap a company to see who works there. You can ask them about the company or for a referral.</p>
              <ul className="where-work__list">
                {companies.map((c) => (
                  <li key={c.company}>
                    <Link href={peopleHref({ q: c.company })}>
                      {c.company} <span className="where-work__n">{c.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {newest.length > 0 ? (
            <section className="people-section" aria-labelledby="newest">
              <div className="people-section__head">
                <h2 id="newest">New on Alumnity</h2>
              </div>
              <Cards cards={newest} photos={photos} />
            </section>
          ) : (
            suggestions.length === 0 && <p className="people-empty">Nobody else has joined yet. New members will show here when they join.</p>
          )}

          {/* Only members are listed until a name is typed, so it said where the rest of HKBK is. */}
          {college && (
            <p className="people-register-note">
              <strong>{college.count.toLocaleString("en-IN")} people</strong> are on HKBK&apos;s register ({college.from}–{college.to}). Type a name or USN above to find
              anyone, or <a href="#register-all">look through everyone who hasn&apos;t joined yet</a>.
            </p>
          )}
        </>
      )}

      {browse && (
        <section className="people-section register-all" id="register-all" aria-labelledby="register-all-title">
          <div className="people-section__head">
            <h2 id="register-all-title">
              Everyone on HKBK&apos;s register <span className="h-count">· {browse.total.toLocaleString("en-IN")} not on Alumnity yet</span>
            </h2>
          </div>
          <p className="wf-muted">
            These names come from the college&apos;s register of students{query.branch || query.year ? ", for the branch and year you chose above" : ""}. Use Filters to see one batch.
            Know someone here? Send them the link. They join by finding their name.
          </p>
          {browse.limited ? (
            <p className="wf-note">You can look through {REGISTER_PAGES} pages of the register an hour, and you have reached that limit. Try again later.</p>
          ) : (
            <ul className="people-grid">
              {browse.people.map((p, i) => (
                <RegisterCard key={`${p.name}-${p.joined}-${i}`} person={p} />
              ))}
            </ul>
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
        </section>
      )}
    </AppPage>
  );
}

/** A grid of people: members and register people alike, each as a card. */
function Cards({ cards, photos }: { cards: PersonCard[]; photos: Map<number, string> }) {
  return (
    <ul className="people-grid">
      {cards.map((c, i) =>
        c.kind === "member" ? (
          <MemberCard key={`m-${c.member.id}`} member={c.member} profile={c.profile} relation={c.relation} following={c.following} photoId={photos.get(c.member.id)} />
        ) : (
          <RegisterCard key={`r-${c.person.name}-${c.person.joined}-${i}`} person={c.person} />
        )
      )}
    </ul>
  );
}

/** The same choices of branch and year, another page of the register. */
function pageHref(query: { branch?: string; year?: number; help?: PeopleQuery["help"] }, page: number) {
  const p = new URLSearchParams();
  if (query.branch) p.set("branch", query.branch);
  if (query.year) p.set("year", String(query.year));
  if (query.help) p.set("help", query.help);
  p.set("page", String(page));
  return `/people?${p}#register-all`;
}
