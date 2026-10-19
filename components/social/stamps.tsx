import type { Reaction } from "../../lib/server/posts";

/*
 * Reactions as LinkedIn draws them: each a small filled circle in its own colour with a
 * white glyph, so they read at a glance and stack neatly in the counts row. The stored
 * names are older than the labels (no data was moved): cheer is Like, congrats is
 * Celebrate, proud is Love. "Not reacted yet" is the thumbs-up in pencil.
 */

export const REACTION_LABEL: Record<Reaction, string> = {
  cheer: "Like",
  congrats: "Celebrate",
  support: "Support",
  proud: "Love",
  insightful: "Insightful"
};

/** The order they're offered in, as on LinkedIn. */
export const REACTION_ORDER: Reaction[] = ["cheer", "congrats", "support", "proud", "insightful"];

/** Each badge's colour (its label in the bar takes a deeper shade of it, in posts-plus.css). */
export const REACTION_COLOUR: Record<Reaction, string> = {
  cheer: "#0a66c2",
  congrats: "#16a34a",
  support: "#7c3aed",
  proud: "#e0242f",
  insightful: "#e8a200"
};

/** The clapping hands' outline: the badge's green a shade deeper, so the two hands read as two. */
const CLAP_EDGE = "#15803d";

const THUMB = "M9.8 10.9l2.7-4.5c.35-.6 1.1-.75 1.65-.35.5.37.65 1.02.42 1.6l-.78 2.15h3.15c.95 0 1.62.9 1.38 1.82l-1.13 4.6c-.2.75-.86 1.28-1.63 1.28H9.8z";

const GLYPH: Record<Reaction, React.ReactNode> = {
  // A thumbs-up.
  cheer: (
    <>
      <rect x="6.2" y="10.8" width="2.7" height="7.4" rx="0.7" fill="#fff" />
      <path fill="#fff" d={THUMB} />
    </>
  ),
  // Two hands clapping, with a little burst above.
  congrats: (
    <>
      <rect x="6.9" y="8" width="4.8" height="9.2" rx="2.4" transform="rotate(-22 9.3 12.6)" fill="#fff" />
      <rect x="11.2" y="8.6" width="4.8" height="9.2" rx="2.4" transform="rotate(14 13.6 13.2)" fill="#fff" stroke={CLAP_EDGE} strokeWidth="0.9" />
      <path stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" d="M12.6 4.2v1.5M15.9 5.1l-.8 1.2M9.5 5.1l.8 1.2" />
    </>
  ),
  // A hand holding up a pink heart.
  support: (
    <>
      <path fill="#f9a8d4" stroke="#fff" strokeWidth="0.8" d="M12 12.2s-3.3-2-3.3-4.3a1.8 1.8 0 0 1 3.3-1 1.8 1.8 0 0 1 3.3 1c0 2.3-3.3 4.3-3.3 4.3z" />
      <path fill="#fff" d="M5.4 14.3h2.3l2.4 1.4h3.4a1 1 0 0 1 0 2h-2.7v.2h3.3l3-2.1a1.05 1.05 0 0 1 1.3 1.6l-3.4 2.9H9.1l-3.7-1.5z" />
    </>
  ),
  // A heart.
  proud: <path fill="#fff" d="M12 18.4s-5.7-3.4-5.7-7.4a3.05 3.05 0 0 1 5.7-1.6 3.05 3.05 0 0 1 5.7 1.6c0 4-5.7 7.4-5.7 7.4z" />,
  // A lightbulb.
  insightful: (
    <>
      <path fill="#fff" d="M12 5a4.7 4.7 0 0 0-2.8 8.5c.45.35.75.85.75 1.4v.7h4.1v-.7c0-.55.3-1.05.75-1.4A4.7 4.7 0 0 0 12 5z" />
      <rect x="9.95" y="16.3" width="4.1" height="1.3" rx="0.65" fill="#fff" />
      <rect x="10.6" y="18.1" width="2.8" height="1.2" rx="0.6" fill="#fff" />
    </>
  )
};

/** Not reacted yet: the thumbs-up in pencil. */
const BLANK = <path d="M7.2 11h2.4v7.6H7.2zM9.6 11l2.9-4.9c.4-.6 1.2-.8 1.8-.4.6.4.8 1.1.5 1.8L14 10h3.4c1 0 1.7.9 1.5 1.9l-1.2 5.2c-.2.8-.9 1.4-1.7 1.4H9.6" />;

export function Stamp({ kind, size = 24, className = "" }: { kind: Reaction; size?: number; className?: string }) {
  const blank = className.includes("stamp--blank");
  return (
    <svg className={`stamp stamp--${kind} ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {blank ? (
        <g className="stamp__ink">{BLANK}</g>
      ) : (
        <g className="stamp__art">
          <circle cx="12" cy="12" r="12" fill={REACTION_COLOUR[kind]} />
          {GLYPH[kind]}
        </g>
      )}
    </svg>
  );
}
