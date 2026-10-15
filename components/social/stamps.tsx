import type { Reaction } from "../../lib/server/posts";

/*
 * Reactions as ink stamps, not emoji: each a small round stamp in one of the college's
 * inks, drawn with the same pen as the rest of Alumnity.
 */

export const REACTION_LABEL: Record<Reaction, string> = {
  cheer: "Cheer",
  proud: "Proud",
  congrats: "Congrats",
  insightful: "Insightful",
  support: "Support"
};

const DRAWING: Record<Reaction, React.ReactNode> = {
  // A burst: cheering someone on.
  cheer: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9 18 18M18 6l-2.1 2.1M8.1 15.9 6 18" />
    </>
  ),
  // A medal on its ribbon.
  proud: (
    <>
      <path d="M8.5 3.5 11 9M15.5 3.5 13 9" />
      <circle cx="12" cy="14.5" r="5" />
      <path d="m12 12 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" />
    </>
  ),
  // A party popper and its confetti.
  congrats: (
    <>
      <path d="M4.5 19.5 9 8l7 7z" />
      <path d="M13 4.5c.6 1.2.2 2.4-.8 3M19.5 11c-1.2-.6-2.4-.2-3 .8M16.5 4.5l.4 1.3M20 7.5l-1.3.3" />
    </>
  ),
  // A lamp lit: that taught me something.
  insightful: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.7 1 .7 1.6v.4h5v-.4c0-.6.2-1.2.7-1.6A5.5 5.5 0 0 0 12 3.5z" />
    </>
  ),
  // A heart held up.
  support: <path d="M12 19.5s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.3c0 4.9-7 9.2-7 9.2z" />
};

export function Stamp({ kind, size = 20, className = "" }: { kind: Reaction; size?: number; className?: string }) {
  return (
    <svg className={`stamp stamp--${kind} ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g className="stamp__ink">{DRAWING[kind]}</g>
    </svg>
  );
}
