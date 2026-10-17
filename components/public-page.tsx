import type { ReactNode } from "react";
import { BackLink } from "./back-link";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { MarginArt } from "./app/margin-art";
import { VisitorOnly } from "./visitor-only";
import "../app/styles/wire.css";
import "../app/styles/info.css";

/*
 * The information pages for visitors (About, Community, Committee, Developers, How it
 * works): the site's header, the margin drawings of each, a way back, a head like the
 * gallery's (kicker, a title with a word in gold, a line of text), the page, then the
 * other pages as cards and, for someone not yet a member, the way in.
 */

const PAGES = [
  { href: "/about", title: "About", line: "The Director's message, and how your details stay private" },
  { href: "/how-it-works", title: "How it works", line: "From finding your name in the register to your first answer from a senior" },
  { href: "/community", title: "Community", line: "Who Alumnity is for, and what members get" },
  { href: "/committee", title: "Committee", line: "The people who look after the alumni association" },
  { href: "/developers", title: "Developers", line: "The students who built it, and who guided them" }
] as const;

export type PublicSection = "about" | "community" | "committee" | "developers" | "how-it-works";

type Props = { current: PublicSection; kicker: string; title: string; gold?: string; intro?: string; children: ReactNode };

export function PublicPage({ current, kicker, title, gold, intro, children }: Props) {
  return (
    <>
      <SiteHeader current={current} />
      <div className="info-art">
        <MarginArt />
      </div>
      <main className="container info" id="main">
        <BackLink fallback="/" label="Back" />
        <header className="page-head info__head">
          <p className="kicker">{kicker}</p>
          <h1 className="page-title">
            {title}
            {gold && <span className="page-title__gold"> {gold}</span>}
          </h1>
          {intro && <p className="page-head__text">{intro}</p>}
        </header>
        <div className="info__body">{children}</div>
        <nav className="info-more" aria-labelledby="info-more">
          <h2 id="info-more">More about Alumnity</h2>
          <ul>
            {PAGES.filter((p) => p.href !== `/${current}`).map((p) => (
              <li key={p.href}>
                <a href={p.href} className="info-more__card">
                  <strong>{p.title}</strong>
                  <span>{p.line}</span>
                  <span className="info-more__arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <VisitorOnly>
          <section className="info-join" aria-labelledby="info-join">
            <div>
              <h2 id="info-join">Your name is already in the register.</h2>
              <p>Every student and graduate since 1998 is in it. Find your name to join.</p>
            </div>
            <div className="info-join__actions">
              <a className="button button--primary" href="/join">
                Join Alumnity <span aria-hidden="true">→</span>
              </a>
              <a className="button button--secondary" href="/login">
                Log in
              </a>
            </div>
          </section>
        </VisitorOnly>
      </main>
      <SiteFooter />
    </>
  );
}

/** Text as alpha 1 wrote it: "## " headings, "- " bullets, blank lines between paragraphs. */
export function Prose({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(<p key={`p${out.length}`}>{withLinks(para.join(" "))}</p>);
    if (bullets.length)
      out.push(
        <ul key={`u${out.length}`}>
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      );
    para = [];
    bullets = [];
  };
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      out.push(<h2 key={`h${out.length}`}>{line.slice(3)}</h2>);
    } else if (line.startsWith("- ")) {
      if (para.length) flush();
      bullets.push(line.slice(2));
    } else if (line.trim()) {
      if (bullets.length) flush();
      para.push(line);
    } else flush();
  }
  flush();
  return <div className="wf-prose">{out}</div>;
}

/** "see Community." becomes a link, without changing the words. */
function withLinks(text: string) {
  const m = text.match(/^(.*see )(Community)(\.?)$/);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <a href="/community">{m[2]}</a>
      {m[3]}
    </>
  );
}
