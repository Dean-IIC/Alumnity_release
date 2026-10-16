import type { ReactNode } from "react";
import { BackLink } from "./back-link";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import "../app/styles/wire.css";

/*
 * The visitors' information pages (About, Community, Committee, Developers): the site's
 * header, a way back, the page, and links to the others.
 */

const PAGES = [
  { href: "/about", title: "About" },
  { href: "/community", title: "Community" },
  { href: "/committee", title: "Committee" },
  { href: "/developers", title: "Developers" },
  { href: "/how-it-works", title: "How it works" }
] as const;

export type PublicSection = "about" | "community" | "committee" | "developers" | "how-it-works";

export function PublicPage({ current, title, intro, children }: { current: PublicSection; title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader current={current} />
      <main className="wf container public-page" id="main">
        <BackLink fallback="/" label="Back" />
        <header className="wf-head">
          <h1>{title}</h1>
          {intro && <p className="wf-muted">{intro}</p>}
        </header>
        {children}
        <nav className="public-page__more" aria-label="More about Alumnity">
          {PAGES.filter((p) => p.href !== `/${current}`).map((p) => (
            <a key={p.href} href={p.href}>
              {p.title}
            </a>
          ))}
          <a href="/join">Join Alumnity →</a>
        </nav>
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
