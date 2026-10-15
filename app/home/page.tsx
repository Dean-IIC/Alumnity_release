import type { Metadata } from "next";
import { ActionForm } from "../../components/app/action-form";
import { AppPage } from "../../components/app/app-page";
import { initialsOf } from "../../components/profile/ink-seal";
import { Avatar } from "../../components/social/avatar";
import { Composer } from "../../components/social/composer";
import { Icon } from "../../components/social/icons";
import { Post } from "../../components/social/post";
import { StoriesBar, type ReelData } from "../../components/social/stories";
import { connectAction } from "../../lib/actions/social";
import { batchLabel, timeAgo } from "../../lib/format";
import { activeAnnouncements } from "../../lib/server/announcements";
import { asksFor, isSenior } from "../../lib/server/asks";
import { eventsFor } from "../../lib/server/events";
import { followCounts } from "../../lib/server/follows";
import { batchmates, relationsOf } from "../../lib/server/people";
import { feedFor, type FeedScope } from "../../lib/server/posts";
import { photoIdsOf, profileOf } from "../../lib/server/profile";
import { requireUser } from "../../lib/server/session";
import { PAUSED, settings } from "../../lib/server/settings";
import { connectionCount, unreadNotifications } from "../../lib/server/social";
import { storyBar } from "../../lib/server/stories";

export const metadata: Metadata = { title: "Home · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE = 15;

/** Home: stories, a word from the college, what your people are sharing, and a few people and events worth a look. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ before?: string; view?: string }> }) {
  const me = await requireUser("/home");
  const params = await searchParams;
  const beforeParam = Number(params.before);
  const before = Number.isSafeInteger(beforeParam) && beforeParam > 0 ? beforeParam : undefined;
  const scope: FeedScope = params.view === "following" ? "following" : "all";

  const [profile, posts, reels, mates, relationTo, { upcoming }, asks, announcements, site, connections, follows, unread] = await Promise.all([
    profileOf(me.id),
    feedFor(me, { limit: PAGE, before, scope }),
    storyBar(me),
    batchmates(me),
    relationsOf(me.id),
    eventsFor(me),
    isSenior(me) ? asksFor(me).then((a) => a.forMe) : Promise.resolve([]),
    activeAnnouncements(),
    settings(),
    connectionCount(me.id),
    followCounts(me.id),
    unreadNotifications(me.id)
  ]);
  const suggestions = mates.filter((u) => relationTo(u.id) === "none").slice(0, 4);
  const notesOn = site.features.notes;

  const photos = await photoIdsOf([me.id, ...posts.flatMap((p) => [p.author.id, ...p.comments.map((c) => c.author.id)]), ...reels.map((r) => r.author.id), ...suggestions.map((s) => s.id)]);
  const first = (name: string) => name.split(" ")[0];
  const reelData: ReelData[] = reels.map((r) => ({
    author: { id: r.author.id, name: r.author.name, first: first(r.author.name), photoId: photos.get(r.author.id) ?? null, initials: initialsOf(r.author.name) },
    stories: r.stories.map((s) => ({ id: s.id, mediaId: s.mediaId, kind: s.kind, caption: s.caption, ago: timeAgo(s.createdAt) })),
    allSeen: r.allSeen,
    mine: r.mine
  }));
  const meFace = { id: me.id, name: me.name, first: first(me.name), photoId: photos.get(me.id) ?? null, initials: initialsOf(me.name) };
  const now = [profile.title, profile.company && `at ${profile.company}`].filter(Boolean).join(" ");

  const steps = [
    { done: Boolean(profile.title || profile.about || profile.skills.length || profile.photo), text: "Add a photo and what you do now", href: "/me/edit" },
    { done: connections > 0, text: "Connect with someone from your batch", href: "/batch" },
    isSenior(me) ? { done: profile.happyTo.mentor, text: "Say you're happy to mentor", href: "/me/edit" } : { done: false, text: "Ask a senior something", href: "/ask" }
  ];
  const stepsLeft = steps.filter((s) => !s.done).length;

  return (
    <AppPage user={me} current="home" bare>
      <div className="feed-layout">
        {/* ----- You ----- */}
        <aside className="feed-layout__side feed-layout__side--left" aria-label="You">
          <section className="sheet me-card">
            <div className="me-card__band" />
            <a href="/me" className="me-card__face" aria-hidden="true" tabIndex={-1}>
              <Avatar name={me.name} photoId={photos.get(me.id)} size={64} />
            </a>
            <a href="/me" className="me-card__name">
              {me.name}
            </a>
            <span className="me-card__line">{now || batchLabel(me)}</span>
            {now && <span className="me-card__line">{batchLabel(me)}</span>}
            <div className="me-card__counts">
              <a href="/connections">
                <strong>{connections}</strong> connections
              </a>
              <a href="/me">
                <strong>{follows.followers}</strong> followers
              </a>
            </div>
          </section>
          <nav className="sheet side-links" aria-label="Shortcuts">
            <a href="/batch">
              <Icon name="batch" size={20} /> Your batch
            </a>
            <a href="/ask">
              <Icon name="ask" size={20} /> Ask a senior
            </a>
            <a href="/events">
              <Icon name="event" size={20} /> Events
            </a>
            <a href="/notifications">
              <Icon name="bell" size={20} /> Notifications
              {unread > 0 && <span className="wf-count">{unread}</span>}
            </a>
          </nav>
        </aside>

        {/* ----- The feed ----- */}
        <div className="feed-layout__main">
          <h1 className="sr-only">Home</h1>
          <StoriesBar reels={reelData} me={meFace} />

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

          {stepsLeft > 0 && !before && (
            <section className="sheet side-box" aria-labelledby="steps">
              <h2 id="steps">
                Getting started · {steps.length - stepsLeft} of {steps.length}
              </h2>
              <ul className="wf-checklist">
                {steps.map((s) => (
                  <li key={s.text} className={s.done ? "done" : ""}>
                    {s.done ? s.text : <a href={s.href}>{s.text}</a>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {asks.length > 0 && !before && (
            <a className="sheet notice" href="/ask">
              <span className="notice__pin" aria-hidden="true" style={{ background: "var(--color-blue)" }} />
              <div>
                <small>Ask a senior</small>
                <strong>
                  {asks.length === 1 ? "A student's question is" : `${asks.length} students' questions are`} waiting for you
                </strong>
                <p>They fit what you know. Take one on →</p>
              </div>
            </a>
          )}

          {notesOn ? (
            <Composer firstName={first(me.name)} hasBatch={Boolean(me.branch && me.joined)} avatar={<Avatar name={me.name} photoId={photos.get(me.id)} size={44} />} />
          ) : (
            <p className="sheet side-box">{PAUSED}</p>
          )}

          <nav className="feed-tabs" aria-label="Which posts">
            <a href="/home" aria-current={scope === "all" ? "page" : undefined}>
              Everyone
            </a>
            <a href="/home?view=following" aria-current={scope === "following" ? "page" : undefined}>
              Following
            </a>
            <a className="feed-tabs__bell" href="/notifications" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
              <Icon name="bell" size={22} />
              {unread > 0 && (
                <span className="wf-count" aria-hidden="true">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </a>
          </nav>

          {posts.length === 0 ? (
            <p className="sheet side-box wf-muted">
              {before
                ? "That's everything."
                : scope === "following"
                  ? "Nothing yet from the people you're connected to or follow. Find people from your batch, or follow seniors you admire."
                  : "Nothing here yet. Share the first post."}
            </p>
          ) : (
            posts.map((p) => <Post key={p.id} post={p} photos={photos} me={me} />)
          )}

          <div className="feed-more">
            {before ? <a href={scope === "following" ? "/home?view=following" : "/home"}>← Newest</a> : <span />}
            {posts.length === PAGE && <a href={`/home?${scope === "following" ? "view=following&" : ""}before=${posts[posts.length - 1].createdAt}`}>Older posts →</a>}
          </div>
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
                        <a href={`/events/${e.id}`}>{e.title}</a>
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
          {suggestions.length > 0 && (
            <section className="sheet side-box">
              <h2>From your batch</h2>
              <ul className="side-box__list">
                {suggestions.map((u) => (
                  <li key={u.id} className="side-person">
                    <Avatar name={u.name} photoId={photos.get(u.id)} size={40} />
                    <span className="side-person__who">
                      <a href={`/people/${u.id}`}>{u.name}</a>
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
        </aside>
      </div>
    </AppPage>
  );
}
