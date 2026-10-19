/*
 * People's addresses, shared by the page (a server component) and its search bar (a client
 * one): a search as a /people link, with empty values left out.
 */

export type PeopleQuery = { q: string; branch?: string; year?: number; help?: "mentor" | "refer" | "talk" };

/** The address for a search. The register's page number is dropped: a new search starts at page 1. */
export function peopleHref(query: Partial<PeopleQuery>, hash = ""): string {
  const p = new URLSearchParams();
  if (query.q?.trim()) p.set("q", query.q.trim());
  if (query.branch) p.set("branch", query.branch);
  if (query.year) p.set("year", String(query.year));
  if (query.help) p.set("help", query.help);
  const s = p.toString();
  return `/people${s ? `?${s}` : ""}${hash}`;
}
