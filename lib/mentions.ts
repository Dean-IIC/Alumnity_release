/*
 * @mentions in posts and comments. The composer writes a mention as `@[Asha Rao](12)`;
 * stored text keeps that form, and pages turn it into a link to the member. Shared by
 * the server (which checks every mention) and the pages (which only ever render the
 * name as text and the id as a number, so a mention can't carry anything else).
 */

export const MENTION = /@\[([^\]\n]{1,80})\]\((\d{1,10})\)/g;

export type Piece = { text: string } | { mention: { name: string; id: number } };

/** Text split into plain pieces and mentions, for rendering. */
export function pieces(body: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION)) {
    if (m.index! > last) out.push({ text: body.slice(last, m.index) });
    out.push({ mention: { name: m[1], id: Number(m[2]) } });
    last = m.index! + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}

/** The ids mentioned, each once. */
export const mentionedIds = (body: string) => [...new Set([...body.matchAll(MENTION)].map((m) => Number(m[2])))];

/** Text with every mention written out as plain "@Name" (for previews and notifications). */
export const plainText = (body: string) => body.replace(MENTION, (_, name: string) => `@${name}`);
