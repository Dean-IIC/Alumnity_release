import { ABOUT, COMMITTEE, COMMUNITY, DIRECTOR_MESSAGE, OFFICE_BEARERS } from "./about-content";

/*
 * The public text the college may change from its desk (kept in the database's
 * `site.pages`, lib/server/site-pages.ts). Each has words to fall back on, the ones in
 * lib/about-content.ts, used whenever its row is missing or can't be read.
 *
 * Bodies are plain text. A letter or a text: paragraphs separated by an empty line (a
 * letter's first paragraph is its greeting). A list: one "Role: Name" per line.
 */

export type PageKind = "letter" | "text" | "list";

export type SitePageDef = { slug: string; title: string; where: string; kind: PageKind };

export const SITE_PAGES = [
  { slug: "director-letter", title: "The director's message", where: "About page", kind: "letter" },
  { slug: "about-intro", title: "About: opening words", where: "About page", kind: "text" },
  { slug: "community-intro", title: "Community: opening words", where: "Community page", kind: "text" },
  { slug: "community-lead", title: "Community: first paragraph", where: "Community page", kind: "text" },
  { slug: "committee-office-bearers", title: "Committee: office bearers", where: "Committee page", kind: "list" },
  { slug: "committee-members", title: "Committee: members", where: "Committee page", kind: "list" }
] as const satisfies readonly SitePageDef[];

export type PageSlug = (typeof SITE_PAGES)[number]["slug"];

export type SitePage = { slug: PageSlug; title: string; body: string; signerName: string | null; signerRole: string | null };

export const PAGE_LIMITS = { title: 120, body: 20_000, signer: 120 } as const;

export const pageDef = (slug: string) => SITE_PAGES.find((p) => p.slug === slug);

const roster = (list: { role: string; name: string }[]) => list.map((p) => `${p.role}: ${p.name}`).join("\n");

/** The words in the code, for each page. */
export const PAGE_DEFAULTS: Record<PageSlug, SitePage> = {
  "director-letter": {
    slug: "director-letter",
    title: "The director's message",
    body: [DIRECTOR_MESSAGE.greeting, ...DIRECTOR_MESSAGE.paragraphs].join("\n\n"),
    signerName: DIRECTOR_MESSAGE.name,
    signerRole: DIRECTOR_MESSAGE.role
  },
  "about-intro": { slug: "about-intro", title: "About: opening words", body: ABOUT.intro, signerName: null, signerRole: null },
  "community-intro": { slug: "community-intro", title: "Community: opening words", body: COMMUNITY.intro, signerName: null, signerRole: null },
  "community-lead": { slug: "community-lead", title: "Community: first paragraph", body: COMMUNITY.lead, signerName: null, signerRole: null },
  "committee-office-bearers": { slug: "committee-office-bearers", title: "Committee: office bearers", body: roster(OFFICE_BEARERS), signerName: null, signerRole: null },
  "committee-members": { slug: "committee-members", title: "Committee: members", body: roster(COMMITTEE), signerName: null, signerRole: null }
};

/** Paragraphs: split on empty lines, each one's line breaks kept as spaces. */
export const paragraphsOf = (body: string) =>
  body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

/** A list's lines as roles and names ("President: Asha Rao"); a line without a colon is a role still to be announced. */
export const rosterOf = (body: string) =>
  body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(":");
      if (at < 0) return { role: line, name: "To be announced" };
      return { role: line.slice(0, at).trim(), name: line.slice(at + 1).trim() || "To be announced" };
    });
