import type { Metadata } from "next";
import Link from "next/link";
import { ABOUT_LINKS } from "../../../lib/footer-links";
import { Suspense } from "react";
import { ActionForm } from "../../../components/app/action-form";
import { AppPage } from "../../../components/app/app-page";
import { initialsOf } from "../../../components/profile/ink-seal";
import { Avatar } from "../../../components/social/avatar";
import { Composer } from "../../../components/social/composer";
import { ProfileStrength } from "../../../components/profile/profile-strength";
import { profileStrength } from "../../../lib/profile-strength";
import { KnowEveryone } from "../../../components/home/know-everyone";
import { FocusWaiting, RoleFocus } from "../../../components/home/role-focus";
import { Icon } from "../../../components/social/icons";
import { InfiniteFeed } from "../../../components/social/infinite-feed";
import { Post } from "../../../components/social/post";
import { StoriesBar, type ReelData } from "../../../components/social/stories";
import { connectAction, mentorAction } from "../../../lib/actions/social";
import { firstName, batchLabel, rupees, timeAgo } from "../../../lib/format";
import { activeAnnouncements } from "../../../lib/server/announcements";
import { askCount } from "../../../lib/server/asks";
import { deskBeginnings } from "../../../lib/server/home";
import { isModerator } from "../../../lib/server/roles";
import { eventsFor, organisedCount } from "../../../lib/server/events";
import { followCounts } from "../../../lib/server/follows";
import { liveCauses } from "../../../lib/server/causes";
import { groupsFor } from "../../../lib/server/groups";
import { FeedFilterBar } from "../../../components/home/feed-filters";
import { feedHref, filterCount, filterQuery, NO_FILTERS, readFeedFilters } from "../../../lib/feed-filters";
import { WORK_TAGS } from "../../../lib/tags";
import type { User } from "../../../lib/server/auth";
import { batchmates, blockIds, membersByIds, peopleToMeet, relationsOf } from "../../../lib/server/people";
import { feedFor, popularTags, type FeedScope } from "../../../lib/server/posts";
import { photoIdsOf, profileOf } from "../../../lib/server/profile";
import { requireUser } from "../../../lib/server/session";
import { PAUSED, settings } from "../../../lib/server/settings";
import { connectionCount } from "../../../lib/server/social";
import { storyBar } from "../../../lib/server/stories";

export const metadata: Metadata = { title: "Home · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE = 15;

/** Every place on Alumnity, for Home's shortcuts (and the chips on a phone). */
const SHORTCUTS = [
  { href: "/groups", label: "Groups", icon: "group" },
  { href: "/batch", label: "Your batch", icon: "batch" },
  { href: "/ask", label: "Ask a senior", icon: "ask" },
  { href: "/board", label: "Jobs board", icon: "briefcase" },
  { href: "/events", label: "Events", icon: "event" },
  { href: "/causes", label: "Causes", icon: "heart" },
  { href: "/connections", label: "Connections", icon: "connections" },
  { href: "/people", label: "Network", icon: "people" }
] as const;

/** Where to begin, when the feed is quiet. */
const WELCOME = [
  { href: "/me/edit", label: "Make your page yours", note: "A photo, what you do now, what you're happy to help with", icon: "you" },
  { href: "/batch", label: "Find your batch", note: "Everyone from your year who's here, and how many still aren't", icon: "batch" },
  { href: "/groups", label: "Join or start a group", note: "Your class, your club, your city, your field", icon: "group" },
  { href: "/ask", label: "Ask a senior", note: "Questions go to the few alumni who fit them", icon: "ask" },
  { href: "/causes", label: "Back a cause", note: "Scholarships and people in need, checked by the college", icon: "heart" }
] as const;

/** The people a filter names, as the filter bar shows them: never anyone blocked either way. */
async function filterPeople(me: User, ids: number[]): Promise<{ id: number; name: string }[]> {
  if (!ids.length) return [];
  const [members, blocks] = await Promise.all([membersByIds(ids), blockIds(me.id)]);
  return ids.flatMap((id) => {
    const m = members.get(id);
    return m && !blocks.has(id) ? [{ id, name: m.name }] : [];
  });
}

/** Home: stories, a word from the college, what your people are sharing, and a few people and events worth a look. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser("/home");
  const params = await searchParams;
  const beforeParam = Number(params.before);
  const before = Number.isSafeInteger(beforeParam) && beforeParam > 0 ? beforeParam : undefined;
  const scope: FeedScope = params.view === "following" ? "following" : "all";
  // The feed's filters (?tag=job&role=alumnus&from=12,34&q=…), cleaned and capped.
  const filters = readFeedFilters(params);
  const filtered = filterCount(filters) > 0;
  const filterParams = filterQuery(filters);

  const [profile, posts, reels, mates, relationTo, { upcoming }, announcements, site, connections, follows, groups, causes, others, topTags, chosenPeople] = await Promise.all([
    profileOf(me.id),
    feedFor(me, { limit: PAGE, before, scope, ...filters }),
    storyBar(me),
    batchmates(me),
    relationsOf(me.id),
    eventsFor(me),
    activeAnnouncements(),
    settings(),
    connectionCount(me.id),
    followCounts(me.id),
    groupsFor(me),
    liveCauses(me, 2),
    peopleToMeet(me, 6),
    popularTags(me),
    filterPeople(me, filters.authors)
  ]);
  // The topic chips: what's being tagged lately, then the work tags; ten at most.
  const topics = [...new Set([...topTags, ...WORK_TAGS])].slice(0, 10);
  // People to meet: your batch first; on a young site, anyone from your branch, then anyone.
  const batch = mates.filter((u) => relationTo(u.id) === "none").slice(0, 4);
  const suggestions = batch.length ? batch : others.slice(0, 4);
  const myGroups = groups.mine.filter((g) => g.my?.status === "member").slice(0, 5);
  const quiet = posts.length === 0 && !before && !filtered;
  const notesOn = site.features.notes;

  const photos = await photoIdsOf([
    me.id,
    ...posts.flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)]),
    ...reels.map((r) => r.author.id),
    ...suggestions.map((s) => s.id)
  ]);
  const first = (name: string) => firstName(name);
  const reelData: ReelData[] = reels.map((r) => ({
    author: { id: r.author.id, name: r.author.name, first: first(r.author.name), photoId: photos.get(r.author.id) ?? null, initials: initialsOf(r.author.name) },
    stories: r.stories.map((s) => ({ id: s.id, mediaId: s.mediaId, kind: s.kind, caption: s.caption, ago: timeAgo(s.createdAt) })),
    allSeen: r.allSeen,
    mine: r.mine,
    // Replies and reactions are messages, so only between connections.
    canReply: !r.mine && relationTo(r.author.id) === "connected"
  }));
  const meFace = { id: me.id, name: me.name, first: first(me.name), photoId: photos.get(me.id) ?? null, initials: initialsOf(me.name) };
  const now = [profile.title, profile.company && `at ${profile.company}`].filter(Boolean).join(" ");

  // Getting started, for who they are: a student wants help; an alumnus can give it; staff run things.
  // Filling in their page is one step of it, shown as their profile strength (from the page
  // already loaded) rather than as list items of its own, so nothing is asked twice.
  const staff = me.role !== "student" && me.role !== "alumnus";
  const strength = profileStrength(me, profile);
  const pageFull = strength.percent >= 100;
  const [asked, organised] = await Promise.all([me.role === "student" ? askCount(me.id) : Promise.resolve(0), staff ? organisedCount(me.id) : Promise.resolve(0)]);
  const mentorStep = { done: profile.happyTo.mentor, text: "Say you're happy to mentor: questions that fit you start reaching you", href: "/ask", mentor: true };
  const groupStep = { done: groups.mine.length > 0, text: "Join a group, or start one", href: "/groups" };
  const desk = isModerator(me);
  const { invited, announced } = desk ? await deskBeginnings() : { invited: 0, announced: 0 };
  const steps: { done: boolean; text: string; href: string; mentor?: boolean }[] = desk
    ? [
        { done: invited > 0, text: "Invite the teachers and staff who'll use Alumnity", href: "/desk?tab=team" },
        { done: announced > 0, text: "Put up a first announcement: it shows at the top of everyone's Home", href: "/desk?tab=announcements" },
        mentorStep
      ]
    : me.role === "student"
      ? [
          { done: connections > 0, text: "Connect with someone from your batch", href: "/batch" },
          { done: asked > 0, text: "Ask a senior something", href: "/ask" }
        ]
      : staff
        ? [
            { done: organised > 0, text: "Put up an event: a talk, a reunion, a department day", href: "/events" },
            mentorStep,
            groupStep
          ]
        : [
            { done: connections > 0, text: "Connect with someone from your batch", href: "/batch" },
            mentorStep,
            groupStep
          ];
  const stepsLeft = steps.filter((s) => !s.done).length;
  // "Say you're happy to mentor" is in the list (one tap); the strength doesn't suggest it as well.
  const saidInSteps = steps.some((s) => s.mentor && !s.done) ? ["happyTo"] : [];

  return (
    <AppPage user={me} current="home" bare>
      <div className="feed-layout feed-layout--home">
        {/* ----- You ----- */}
        <aside className="feed-layout__side feed-layout__side--left" aria-label="You">
          <section className="sheet me-card">
            <div className="me-card__band" />
            <Link href="/me" className="me-card__face" aria-hidden="true" tabIndex={-1}>
              <Avatar name={me.name} photoId={photos.get(me.id)} size={64} />
            </Link>
            <Link href="/me" className="me-card__name">
              {me.name}
            </Link>
            <span className="me-card__line">{now || batchLabel(me)}</span>
            {now && <span className="me-card__line">{batchLabel(me)}</span>}
            <div className="me-card__counts">
              <Link href="/connections">
                <strong>{connections}</strong> {connections === 1 ? "connection" : "connections"}
              </Link>
              {/* To the list of who follows you (it used to open your own page, which lists nobody). */}
              <Link href="/connections#followers">
                <strong>{follows.followers}</strong> {follows.followers === 1 ? "follower" : "followers"}
              </Link>
            </div>
          </section>
          <nav className="sheet side-links" aria-label="Shortcuts">
            {SHORTCUTS.map((s) => (
              <Link key={s.href} href={s.href}>
                <Icon name={s.icon} size={20} /> {s.label}
              </Link>
            ))}
          </nav>
          <section className="sheet side-box" aria-labelledby="your-groups">
            <h2 id="your-groups">Your groups</h2>
            {myGroups.length ? (
              <ul className="side-box__list">
                {myGroups.map((g) => (
                  <li key={g.id}>
                    <Link className="side-group" href={`/groups/${g.id}`}>
                      <span className="side-group__mark" aria-hidden="true">
                        {g.name.slice(0, 1).toUpperCase()}
                      </span>
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="side-box__note">Your class, your club, your city: find a group, or start one.</p>
            )}
            <Link className="side-box__more" href="/groups">
              {myGroups.length ? "All groups" : "Find groups"} →
            </Link>
          </section>
        </aside>

        {/* ----- The feed ----- */}
        <div className="feed-layout__main">
          <h1 className="sr-only">Home</h1>
          <StoriesBar reels={reelData} me={meFace} />
          <nav className="explore-chips" aria-label="Explore">
            {SHORTCUTS.map((s) => (
              <Link key={s.href} href={s.href} className="explore-chips__chip">
                <Icon name={s.icon} size={18} /> {s.label}
              </Link>
            ))}
          </nav>

          {announcements.map((a) => (
            <section key={a.id} className="sheet notice" aria-label="From the college">
              <span className="notice__pin" aria-hidden="true" />
              <div>
                <small>From the college</small>
                <strong>{a.title}</strong>
                <p>{a.body}</p>
              </div>
            </section>
          ))}

          {/* Writing a post, first, as LinkedIn has it: below the greeting and "Getting started" it
              was under a laptop's first screen, and a blind test took "Add a story" for it. */}
          {notesOn ? (
            <Composer firstName={first(me.name)} hasBatch={Boolean(me.branch && me.joined)} avatar={<Avatar name={me.name} photoId={photos.get(me.id)} size={44} />} />
          ) : (
            <p className="sheet side-box">{PAUSED}</p>
          )}

          {/* Fetched alongside the rest of Home, not before it. */}
          {/* Filtering, the reader is looking for posts: the greeting and the steps can wait. */}
          {!before && !filtered && (
            <Suspense fallback={<FocusWaiting me={me} />}>
              <RoleFocus me={me} />
            </Suspense>
          )}

          {(stepsLeft > 0 || !pageFull) && !before && !filtered && (
            <section className="sheet side-box" aria-labelledby="steps">
              {/* A full page counts as one of the steps; until then its strength shows here, above the rest. */}
              <h2 id="steps">
                Getting started{" "}
                <span className="h-count">
                  · {steps.length - stepsLeft + (pageFull ? 1 : 0)} of {steps.length + 1}
                </span>
              </h2>
              {!pageFull && <ProfileStrength strength={strength} show={2} skip={saidInSteps} heading="h3" className="strength--inline" />}
              <ul className="wf-checklist">
                {steps.map((s) => (
                  <li key={s.text} className={s.done ? "done" : ""}>
                    {s.done ? (
                      s.text
                    ) : s.mentor ? (
                      <ActionForm action={mentorAction} className="steps__inline">
                        <button type="submit" className="steps__button">
                          {s.text}
                        </button>
                      </ActionForm>
                    ) : (
                      <a href={s.href}>{s.text}</a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}


          <nav className="feed-tabs" aria-label="Which posts">
            <Link href={feedHref(filters)} aria-current={scope === "all" ? "page" : undefined}>
              Everyone
            </Link>
            <Link href={feedHref(filters, { view: "following" })} aria-current={scope === "following" ? "page" : undefined}>
              Following
            </Link>
          </nav>

          <FeedFilterBar filters={filters} view={scope} topics={topics} people={chosenPeople} />

          {filtered && posts.length === 0 && !before ? (
            <section className="sheet post-filters-empty" aria-labelledby="no-match">
              <h2 id="no-match">No posts match these filters</h2>
              <p>
                {scope === "following" ? "Nothing from the people you follow matches. " : ""}Try fewer filters, or other words.
              </p>
              <Link className="post-filters__reset" href={feedHref(NO_FILTERS, { view: scope })}>
                Clear filters
              </Link>
            </section>
          ) : quiet ? (
            <section className="sheet side-box welcome-card" aria-labelledby="welcome">
              <h2 id="welcome">{scope === "following" ? "Nothing yet from your people" : "Alumnity is just getting started"}</h2>
              <p className="side-box__note">
                {scope === "following"
                  ? "Posts from people you're connected to or follow show here. Find your batch, or follow seniors you admire."
                  : "Be one of the first: say hello, find your batch, and bring them in."}
              </p>
              <ul className="welcome-card__steps">
                {WELCOME.map((w) => (
                  <li key={w.href}>
                    <a href={w.href}>
                      <Icon name={w.icon} size={22} />
                      <span>
                        <strong>{w.label}</strong>
                        <small>{w.note}</small>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : posts.length === 0 ? (
            <p className="sheet side-box wf-muted">That's everything.</p>
          ) : (
            posts.map((p) => <Post key={p.id} post={p} photos={photos} me={me} />)
          )}

          {before && (
            <p className="feed-more">
              <a href={feedHref(filters, { view: scope })}>← Newest</a>
            </p>
          )}
          {/* It never just stops: older posts, then "More from HKBK", as the reader scrolls (a
              filtered feed ends with its last match). Keyed, so new filters start it afresh. */}
          <InfiniteFeed
            key={`${scope}|${filterParams}|${before ?? ""}`}
            scope={scope}
            filters={filterParams}
            empty={posts.length === 0}
            next={posts.length === PAGE ? posts[posts.length - 1].createdAt : null}
          />
        </div>

        {/* ----- Around you ----- */}
        <aside className="feed-layout__side feed-layout__side--right" aria-label="Around you">
          {upcoming.length > 0 && (
            <section className="sheet side-box">
              <h2>Coming up</h2>
              <ul className="side-box__list">
                {upcoming.slice(0, 3).map((e) => {
                  const d = new Date(e.startsAt);
                  return (
                    <li key={e.id} className="side-event">
                      <span className="side-event__date" aria-hidden="true">
                        <span>{d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span>
                        <strong>{d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</strong>
                      </span>
                      <div>
                        <Link href={`/events/${e.id}`}>{e.title}</Link>
                        <p>
                          {e.going} going{e.imGoing ? " · you too" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {causes.length > 0 && (
            <section className="sheet side-box" aria-labelledby="home-causes">
              <h2 id="home-causes">Causes</h2>
              <ul className="side-box__list">
                {causes.map((c) => (
                  <li key={c.id} className="side-cause">
                    <Link href={`/causes/${c.id}`}>{c.title}</Link>
                    <span className="cause-bar" role="img" aria-label={`${Math.min(100, Math.round((c.raised / c.goal) * 100))}% of the goal`}>
                      <span style={{ width: `${Math.min(100, Math.round((c.raised / c.goal) * 100))}%` }} />
                    </span>
                    <small>
                      {rupees(c.raised)} of {rupees(c.goal)} · {c.supporters} {c.supporters === 1 ? "supporter" : "supporters"}
                    </small>
                  </li>
                ))}
              </ul>
              <Link className="side-box__more" href="/causes">
                All causes →
              </Link>
            </section>
          )}
          {suggestions.length === 0 ? (
            <KnowEveryone />
          ) : (
            <section className="sheet side-box">
              <h2>{batch.length ? "From your batch" : "People you may know"}</h2>
              <ul className="side-box__list">
                {suggestions.map((u) => (
                  <li key={u.id} className="side-person">
                    <Avatar name={u.name} photoId={photos.get(u.id)} size={40} />
                    <span className="side-person__who">
                      <Link href={`/people/${u.id}`}>{u.name}</Link>
                      <span>{batchLabel(u)}</span>
                    </span>
                    <ActionForm action={connectAction} showDone={false}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="pill-button" type="submit">
                        <Icon name="plus" size={14} /> Connect
                      </button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {groups.discover.length > 0 && (
            <section className="sheet side-box" aria-labelledby="home-groups">
              <h2 id="home-groups">Groups to join</h2>
              <ul className="side-box__list">
                {groups.discover.slice(0, 3).map((g) => (
                  <li key={g.id}>
                    <Link className="side-group" href={`/groups/${g.id}`}>
                      <span className="side-group__mark" aria-hidden="true">
                        {g.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        {g.name}
                        <small>
                          {g.members} {g.members === 1 ? "member" : "members"} · {g.kind === "open" ? "open" : "private"}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* Home has no footer (its feed keeps going), so the pages about Alumnity are here, as on LinkedIn. */}
          <nav className="sheet side-box side-about" aria-label="About Alumnity">
            <ul>
              {ABOUT_LINKS.map(([href, label]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
            <p>Alumnity · for students and alumni of HKBK College of Engineering</p>
          </nav>
        </aside>
      </div>
    </AppPage>
  );
}
