import { cleanTag } from "./tags";

/*
 * Narrowing Home's feed: by #tag, by who wrote it (alumni, students, faculty, the college),
 * by named people, and by words. The filters live in the address (?tag=job,internship
 * &role=alumnus&from=12,34&q=hiring) so a filtered feed can be shared, and back and forward
 * work. Shared by the server (which reads them, never trusting them) and the page's filter
 * bar (which writes them).
 */

/** Who wrote it. "college": coordinators, administrators, and the college's own account. */
export const ROLE_FILTERS = [
  ["alumnus", "Alumni"],
  ["student", "Students"],
  ["faculty", "Faculty"],
  ["college", "College"]
] as const;
export type RoleFilter = (typeof ROLE_FILTERS)[number][0];

export const MAX_FILTER_TAGS = 5;
export const MAX_FILTER_AUTHORS = 10;
/** Longest search, in characters, and most words in it. */
export const QUERY_LIMIT = 100;
export const QUERY_WORDS = 6;

export type FeedFilters = { tags: string[]; roles: RoleFilter[]; authors: number[]; q: string };

export const NO_FILTERS: FeedFilters = { tags: [], roles: [], authors: [], q: "" };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

/** Every value of a parameter, split at commas (?tag=a,b and ?tag=a&tag=b both work). */
function values(params: Params, key: string): string[] {
  const raw = params instanceof URLSearchParams ? params.getAll(key) : ([] as string[]).concat(params[key] ?? []);
  return raw.flatMap((v) => String(v).split(",")).map((v) => v.trim()).filter(Boolean).slice(0, 40);
}

/** The filters in an address, cleaned and capped: anything that isn't one is left out. */
export function readFeedFilters(params: Params): FeedFilters {
  const tags = [...new Set(values(params, "tag").map((t) => cleanTag(t.replace(/^#/, ""))).filter((t): t is string => t !== null))].slice(0, MAX_FILTER_TAGS);
  const roles = [...new Set(values(params, "role"))].filter((r): r is RoleFilter => ROLE_FILTERS.some(([v]) => v === r));
  const authors = [...new Set(values(params, "from").map(Number))].filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, MAX_FILTER_AUTHORS);
  const q = cleanQuery(([] as string[]).concat(params instanceof URLSearchParams ? params.get("q") ?? [] : params.q ?? [])[0] ?? "");
  return { tags, roles, authors, q };
}

/** A search as typed, made safe to keep: one line, trimmed, not too long. */
export const cleanQuery = (q: unknown) => (typeof q === "string" ? q.replace(/\s+/g, " ").trim().slice(0, QUERY_LIMIT) : "");

/** How many filters are on (the words count as one). */
export const filterCount = (f: FeedFilters) => f.tags.length + f.roles.length + f.authors.length + (f.q ? 1 : 0);

/** The filters as address parameters, in a fixed order ("" when there are none). */
export function filterQuery(f: FeedFilters): string {
  const p = new URLSearchParams();
  if (f.tags.length) p.set("tag", f.tags.join(","));
  if (f.roles.length) p.set("role", f.roles.join(","));
  if (f.authors.length) p.set("from", f.authors.join(","));
  if (f.q) p.set("q", f.q);
  // Commas read better than %2C, and are safe in a query string.
  return p.toString().replace(/%2C/g, ",");
}

/** Home with these filters (and the view: Following, From HKBK, From members; and a page further down, if given). */
export function feedHref(f: FeedFilters, { view, before }: { view?: "all" | "following" | "college" | "members"; before?: number } = {}): string {
  const parts = [view && view !== "all" ? `view=${view}` : "", filterQuery(f), before ? `before=${before}` : ""].filter(Boolean);
  return parts.length ? `/home?${parts.join("&")}` : "/home";
}

/** Home filtered to one #tag, opened at the feed (past the stories and the composer): where a post's tags lead. */
export const tagHref = (tag: string) => `/home?tag=${encodeURIComponent(tag)}#feed`;
