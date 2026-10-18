/*
 * #tags in posts. A post is a post: what makes one a job, an internship or a notice is the
 * tag its writer gave it (#job, #internship…), typed or picked in the composer. Shared by
 * the server (which files the tags) and the pages (which turn them into links to the board).
 */

/** A tag: # then a letter, then letters, digits or hyphens (2 to 30 in all). Not inside a word or an address. */
export const TAG = /(^|[^\w&/#])#([a-z][a-z0-9-]{1,29})(?![\w-])/gi;

/** The tags the composer offers, and the board's filters (any other tag still works). */
export const SUGGESTED_TAGS = [
  ["job", "Job"],
  ["internship", "Internship"],
  ["referral", "Referral"],
  ["event", "Event"],
  ["notice", "Notice"],
  ["scholarship", "Scholarship"]
] as const;

/** Tags that are about work: on these, someone can ask the writer for a referral. */
export const WORK_TAGS = ["job", "internship", "referral"];

/** A post's tags, lower-cased, each once, at most five. */
export function tagsIn(body: string): string[] {
  return [...new Set([...body.matchAll(TAG)].map((m) => m[2].toLowerCase()))].slice(0, 5);
}

export type TagPiece = { text: string } | { tag: string; shown: string };

/** Text split into plain pieces and #tags, for rendering. */
export function tagPieces(text: string): TagPiece[] {
  const out: TagPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const start = m.index! + m[1].length;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ tag: m[2].toLowerCase(), shown: `#${m[2]}` });
    last = start + m[2].length + 1;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** A tag from an address (?tag=…), or null if it isn't one. */
export const cleanTag = (value: unknown) => (typeof value === "string" && /^[a-z][a-z0-9-]{1,29}$/i.test(value) ? value.toLowerCase() : null);
