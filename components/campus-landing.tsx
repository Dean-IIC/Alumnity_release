import Link from "next/link";
import type { CSSProperties } from "react";
import { BRANCHES } from "../lib/branches";
import { COLLEGE, LEADERS } from "../lib/college";
import { upcomingForEveryone } from "../lib/server/events";
import { memberCount } from "../lib/server/people";
import { registerByYear, registerFacts } from "../lib/server/register";
import { galleryAlbums } from "../lib/server/showcase";
import { LandingIntro } from "./landing-intro";
import { CountUp, InView, RevealOnScroll } from "./landing/in-view";
import { Icon, type IconName } from "./social/icons";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/*
 * The front page of HKBK's alumni network, in the college site's style (hkbkce.in): a navy
 * hero over a photo of HKBK people, the network in big numbers, charts from the college's
 * own register, what alumni and students come here for, alumni meets, and the college's
 * leadership. Every number is read from the database, not written here.
 */

const WHAT_FOR: { icon: IconName; title: string; text: string; href: string }[] = [
  { icon: "batch", title: "Find your batch", text: "Everyone from your year and branch, on the college's own register.", href: "/join" },
  { icon: "ask", title: "Ask a senior", text: "Ask about placements, electives or higher studies. Your question goes to seniors who know.", href: "/how-it-works" },
  { icon: "people", title: "Mentor a junior", text: "Alumni say what they can help with, and students can find them.", href: "/how-it-works" },
  { icon: "briefcase", title: "HKBK board", text: "Jobs, internships and referrals, checked by the college.", href: "/how-it-works" }
];

const fmt = (n: number) => n.toLocaleString("en-IN");
const branchName = (code: string) => BRANCHES.find(([c]) => c === code)?.[1] ?? code;

export async function CampusLanding() {
  const [facts, years, members, events, albums] = await Promise.all([registerFacts(), registerByYear(), memberCount(), upcomingForEveryone(3), galleryAlbums()]);
  // From the college's gallery (lib/server/showcase.ts): the graduation album's cover, and the alumni meets.
  const HERO = albums.find((a) => a.slug.startsWith("graduation")) ?? albums[0];
  const MEETS = albums.find((a) => a.slug === "alumni-meets");
  const batches = facts ? facts.to - facts.from + 1 : 0;
  const stats: { icon: IconName; n: number; label: string }[] = [
    { icon: "everyone", n: facts?.count ?? 0, label: "Students and alumni on the register" },
    { icon: "batch", n: batches, label: facts ? `Batches, ${facts.from} to ${facts.to}` : "Batches" },
    { icon: "group", n: facts?.branches.length ?? 0, label: "Branches and programmes" },
    { icon: "people", n: members, label: "Members on the network" }
  ];
  const top = Math.max(1, ...years.map((y) => y.n));
  const branches = (facts?.branches ?? []).slice(0, 8);
  const widest = Math.max(1, ...branches.map((b) => b.count));

  return (
    <div className="landing force-light">
      <LandingIntro />
      {/* The intro opens over this from the centre, and floats its wordmark into the header. */}
      <div className="landing-ui" data-reveal-root>
      <SiteHeader landing />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="lp-hero" aria-labelledby="lp-title">
          {HERO && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="lp-hero__photo" src={HERO.cover.src} alt="" width={HERO.cover.width} height={HERO.cover.height} fetchPriority="high" />
          )}
          <div className="lp-hero__inner container">
            <p className="lp-tag">Alumnity · HKBK alumni network</p>
            <h1 id="lp-title">
              Stay connected to <span>where it began.</span>
            </h1>
            <p className="lp-hero__text">
              Alumnity is the alumni network of {COLLEGE.name}. Find your batch, ask a senior, help a junior and come back for the alumni meets.
            </p>
            <div className="lp-hero__actions">
              <Link className="lp-btn lp-btn--gold" href="/join">
                Join the network <span aria-hidden="true">→</span>
              </Link>
              <Link className="lp-btn lp-btn--ghost" href="/login">
                Log in
              </Link>
            </div>
            <p className="lp-hero__motto">&ldquo;{COLLEGE.motto}&rdquo;</p>
          </div>
        </section>

        {/* ---------- The network in numbers ---------- */}
        <section className="lp-stats container" aria-label="The network in numbers">
          {stats.map((s) => (
            <div key={s.label} className="lp-stat">
              <span className="lp-stat__icon" aria-hidden="true">
                <Icon name={s.icon} size={22} />
              </span>
              <span>
                <strong>
                  <CountUp value={s.n} />
                </strong>
                <small>{s.label}</small>
              </span>
            </div>
          ))}
        </section>
        <p className="lp-stats__note container">From the college&apos;s own register of students. The figures update as the register and the network grow.</p>

        {/* ---------- What it's for ---------- */}
        <section data-reveal className="lp-section container" aria-labelledby="lp-for">
          <p className="lp-kicker">Why join</p>
          <h2 id="lp-for">One place for every HKBK batch</h2>
          <ul className="lp-for">
            {WHAT_FOR.map((w) => (
              <li key={w.title}>
                <Link href={w.href} className="lp-card lp-for__item">
                  <span className="lp-for__icon" aria-hidden="true">
                    <Icon name={w.icon} size={24} />
                  </span>
                  <strong>{w.title}</strong>
                  <span>{w.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Charts from the register ---------- */}
        {years.length > 0 && (
          <section data-reveal className="lp-section lp-section--tint" aria-labelledby="lp-growth">
            <div className="container">
              <p className="lp-kicker">The register</p>
              <h2 id="lp-growth">HKBK&apos;s students, batch by batch</h2>
              <InView className="lp-charts">
                <figure className="lp-card lp-chart">
                  <figcaption>
                    <strong>Students by the year they joined</strong>
                    <small>
                      {years[0].year} to {years[years.length - 1].year}
                    </small>
                  </figcaption>
                  <div className="lp-bars" role="img" aria-label={`Students by joining year: ${years.map((y) => `${y.year}, ${y.n}`).join("; ")}`}>
                    {years.map((y, i) => (
                      // The whole column answers the pointer, so a short year is as easy to read as a tall one;
                      // near either end its bubble opens inwards rather than off the chart.
                      <span key={y.year} className="lp-bars__col" data-edge={i < years.length / 4 ? "start" : i >= (years.length * 3) / 4 ? "end" : undefined} tabIndex={0}>
                        <span className="lp-bars__bar" style={{ height: `${Math.max(4, (y.n / top) * 100)}%`, "--i": i } as CSSProperties} data-tip={`${y.year} · ${fmt(y.n)} students`}>
                          <span className="sr-only">
                            {y.year}: {y.n}
                          </span>
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="lp-bars__axis" aria-hidden="true">
                    <span>{years[0].year}</span>
                    <span>{years[Math.floor(years.length / 2)].year}</span>
                    <span>{years[years.length - 1].year}</span>
                  </div>
                </figure>
                <figure className="lp-card lp-chart">
                  <figcaption>
                    <strong>By branch</strong>
                    <small>Everyone on the register</small>
                  </figcaption>
                  <ul className="lp-hbars">
                    {branches.map((b, i) => (
                      <li key={b.code} style={{ "--i": i } as CSSProperties}>
                        <span className="lp-hbars__label">{branchName(b.code)}</span>
                        <span className="lp-hbars__track">
                          <span className="lp-hbars__fill" style={{ width: `${(b.count / widest) * 100}%` }} />
                        </span>
                        <span className="lp-hbars__n">{fmt(b.count)}</span>
                      </li>
                    ))}
                  </ul>
                </figure>
              </InView>
            </div>
          </section>
        )}

        {/* ---------- Alumni meets and events ---------- */}
        <section data-reveal className="lp-section container" aria-labelledby="lp-events">
          <p className="lp-kicker">Events</p>
          <h2 id="lp-events">Alumni meets and events</h2>
          <div className="lp-events">
            {MEETS && (
              <Link href={`/gallery/${MEETS.slug}`} className="lp-card lp-meet">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MEETS.cover.src} alt={MEETS.cover.alt} width={MEETS.cover.width} height={MEETS.cover.height} loading="lazy" />
                <span className="lp-meet__text">
                  <small>From the album · {MEETS.when}</small>
                  <strong>{MEETS.title}</strong>
                  <span>{MEETS.description}</span>
                </span>
              </Link>
            )}
            <div className="lp-upcoming">
              {events.length ? (
                events.map((e) => {
                  const d = new Date(e.startsAt);
                  return (
                    <div key={e.id} className="lp-card lp-event">
                      <span className="lp-date" aria-hidden="true">
                        <small>{d.toLocaleString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</small>
                        <strong>{d.toLocaleString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</strong>
                      </span>
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {d.toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
                          {e.place ? ` · ${e.place}` : ""}
                        </small>
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="lp-card lp-event lp-event--none">
                  <span>
                    <strong>The next alumni meet is being planned.</strong>
                    <small>Members hear about it first. Join to get the invitation.</small>
                  </span>
                </div>
              )}
              <Link className="lp-link" href="/gallery">
                See photos from past years <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Leadership ---------- */}
        <section data-reveal className="lp-section lp-section--tint" aria-labelledby="lp-leaders">
          <div className="container">
            <p className="lp-kicker">The college</p>
            <h2 id="lp-leaders">Leadership</h2>
            <ul className="lp-leaders">
              {LEADERS.map((l) => (
                <li key={l.name} className="lp-card lp-leader">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.photo} alt={`Photo of ${l.name}`} width={411} height={494} loading="lazy" />
                  <span>
                    <strong>{l.name}</strong>
                    <small>{l.role}</small>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      Read the message <span aria-hidden="true">↗</span>
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Join ---------- */}
        <section data-reveal className="lp-cta container" aria-labelledby="lp-cta">
          <div>
            <h2 id="lp-cta">Studied at HKBK? Your name is already on the register.</h2>
            <p>Find your name to join. It takes a minute.</p>
          </div>
          <Link className="lp-btn lp-btn--gold" href="/join">
            Find your name <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <SiteFooter />
      <RevealOnScroll />
      </div>
    </div>
  );
}
