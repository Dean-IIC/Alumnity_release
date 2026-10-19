import Link from "next/link";
import { ALBUMS } from "../lib/gallery";
import { BRANCHES } from "../lib/branches";
import { COLLEGE, LEADERS } from "../lib/college";
import { upcomingForEveryone } from "../lib/server/events";
import { memberCount } from "../lib/server/people";
import { registerByYear, registerFacts } from "../lib/server/register";
import { AlumnityIntro } from "./alumnity-intro";
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
  { icon: "ask", title: "Ask a senior", text: "Placements, electives, higher studies: a question reaches seniors who know.", href: "/how-it-works" },
  { icon: "people", title: "Mentor a junior", text: "Alumni say what they're happy to help with; students find them.", href: "/how-it-works" },
  { icon: "briefcase", title: "HKBK board", text: "Jobs, internships and referrals, checked by the college.", href: "/how-it-works" }
];

const HERO = ALBUMS.find((a) => a.slug.startsWith("graduation")) ?? ALBUMS[0];
const MEETS = ALBUMS.find((a) => a.slug === "alumni-meets");

const fmt = (n: number) => n.toLocaleString("en-IN");
const branchName = (code: string) => BRANCHES.find(([c]) => c === code)?.[1] ?? code;

export async function CampusLanding() {
  const [facts, years, members, events] = await Promise.all([registerFacts(), registerByYear(), memberCount(), upcomingForEveryone(3)]);
  const batches = facts ? facts.to - facts.from + 1 : 0;
  const stats: { icon: IconName; n: string; label: string }[] = [
    { icon: "everyone", n: fmt(facts?.count ?? 0), label: "Students and alumni on the register" },
    { icon: "batch", n: fmt(batches), label: facts ? `Batches, ${facts.from} to ${facts.to}` : "Batches" },
    { icon: "group", n: fmt(facts?.branches.length ?? 0), label: "Branches and programmes" },
    { icon: "people", n: fmt(members), label: "Members on the network" }
  ];
  const top = Math.max(1, ...years.map((y) => y.n));
  const branches = (facts?.branches ?? []).slice(0, 8);
  const widest = Math.max(1, ...branches.map((b) => b.count));

  return (
    <div className="landing force-light">
      <AlumnityIntro year={new Date().getFullYear()} />
      <SiteHeader landing />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="lp-hero" aria-labelledby="lp-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lp-hero__photo" src={HERO.cover.src} alt="" width={HERO.cover.width} height={HERO.cover.height} fetchPriority="high" />
          <div className="lp-hero__inner container">
            <p className="lp-tag">Alumnity · HKBK Alumni Network</p>
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
                <strong>{s.n}</strong>
                <small>{s.label}</small>
              </span>
            </div>
          ))}
        </section>
        <p className="lp-stats__note container">From the college&apos;s own register of students. The figures update as the register and the network grow.</p>

        {/* ---------- What it's for ---------- */}
        <section className="lp-section container" aria-labelledby="lp-for">
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
          <section className="lp-section lp-section--tint" aria-labelledby="lp-growth">
            <div className="container">
              <p className="lp-kicker">The register</p>
              <h2 id="lp-growth">HKBK&apos;s students, batch by batch</h2>
              <div className="lp-charts">
                <figure className="lp-card lp-chart">
                  <figcaption>
                    <strong>Students by the year they joined</strong>
                    <small>
                      {years[0].year} to {years[years.length - 1].year}
                    </small>
                  </figcaption>
                  <div className="lp-bars" role="img" aria-label={`Students by joining year: ${years.map((y) => `${y.year}, ${y.n}`).join("; ")}`}>
                    {years.map((y) => (
                      <span key={y.year} className="lp-bars__bar" style={{ height: `${Math.max(4, (y.n / top) * 100)}%` }} title={`${y.year}: ${fmt(y.n)}`}>
                        <span className="sr-only">
                          {y.year}: {y.n}
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
                    {branches.map((b) => (
                      <li key={b.code}>
                        <span className="lp-hbars__label">{branchName(b.code)}</span>
                        <span className="lp-hbars__track">
                          <span className="lp-hbars__fill" style={{ width: `${(b.count / widest) * 100}%` }} />
                        </span>
                        <span className="lp-hbars__n">{fmt(b.count)}</span>
                      </li>
                    ))}
                  </ul>
                </figure>
              </div>
            </div>
          </section>
        )}

        {/* ---------- Alumni meets and events ---------- */}
        <section className="lp-section container" aria-labelledby="lp-events">
          <p className="lp-kicker">Come back</p>
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
                    <small>Members hear first: join, and you&apos;ll get the invitation.</small>
                  </span>
                </div>
              )}
              <Link className="lp-link" href="/gallery">
                Photos from HKBK&apos;s years <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Leadership ---------- */}
        <section className="lp-section lp-section--tint" aria-labelledby="lp-leaders">
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
        <section className="lp-cta container" aria-labelledby="lp-cta">
          <div>
            <h2 id="lp-cta">Studied at HKBK? Your name is already on the register.</h2>
            <p>Find it, and you&apos;re in. It takes a minute.</p>
          </div>
          <Link className="lp-btn lp-btn--gold" href="/join">
            Find your name <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
