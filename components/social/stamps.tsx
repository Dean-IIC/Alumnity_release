import type { Reaction } from "../../lib/server/posts";

/*
 * Reactions as bright, filled icons, not emoji: each in its own colours, bold enough to
 * read at a glance. "Not reacted yet" keeps a pencil outline (the cheer star, unfilled).
 */

export const REACTION_LABEL: Record<Reaction, string> = {
  cheer: "Cheer",
  proud: "Proud",
  congrats: "Congrats",
  insightful: "Insightful",
  support: "Support"
};

const ART: Record<Reaction, React.ReactNode> = {
  // A gold star bursting, two red sparks.
  cheer: (
    <>
      <path fill="#ffb400" stroke="#d97706" strokeWidth="0.8" strokeLinejoin="round" d="M12 2.6l2.3 5.2 5.6.5-4.3 3.7 1.3 5.5L12 14.6l-4.9 2.9 1.3-5.5-4.3-3.7 5.6-.5z" />
      <circle cx="20" cy="18.5" r="1.4" fill="#e0242f" />
      <circle cx="4.2" cy="18.6" r="1.1" fill="#e0242f" />
      <path stroke="#e0242f" strokeWidth="1.4" strokeLinecap="round" d="M12 19.2v2.3" />
    </>
  ),
  // A gold medal on a red and blue ribbon.
  proud: (
    <>
      <path fill="#e0242f" d="M6.5 2.2h4.2l2.2 6.4H8.7z" />
      <path fill="#1d63c9" d="M13.3 2.2h4.2l-2.4 6.4h-4.2z" />
      <circle cx="12" cy="15" r="5.6" fill="#ffb400" stroke="#c86400" strokeWidth="1" />
      <path fill="#fff7d6" d="M12 11.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" />
    </>
  ),
  // A violet party popper and its confetti.
  congrats: (
    <>
      <path fill="#7c3aed" d="M3 21l5.2-12.6 7.4 7.4z" />
      <path fill="#ffb400" d="M5.1 15.9l1.5-3.6 2.2 2.2.1 2.4zM3.9 18.8l.8-1.8 1.9 1.9-1.9.8z" />
      <circle cx="16.5" cy="4.5" r="1.5" fill="#e0242f" />
      <circle cx="20.2" cy="9.3" r="1.3" fill="#16a34a" />
      <circle cx="13.2" cy="6.6" r="1" fill="#1d63c9" />
      <path stroke="#ffb400" strokeWidth="1.6" strokeLinecap="round" fill="none" d="M18.6 3.2l.6 1.6M21 6l-1.6.4M13.6 2.6c.8 1.4.4 2.6-.6 3.2" />
    </>
  ),
  // A glowing yellow bulb: that taught me something.
  insightful: (
    <>
      <path stroke="#ffb400" strokeWidth="1.5" strokeLinecap="round" d="M12 1.6v1.8M4.4 4.7l1.3 1.3M19.6 4.7l-1.3 1.3M2.5 11h1.8M19.7 11h1.8" />
      <path fill="#ffd23f" stroke="#d97706" strokeWidth="1" d="M12 5.2a5.6 5.6 0 0 0-3.3 10.1c.5.4.8 1 .8 1.6v.6h5v-.6c0-.6.3-1.2.8-1.6A5.6 5.6 0 0 0 12 5.2z" />
      <rect x="9.5" y="18.4" width="5" height="2.2" rx="0.8" fill="#475569" />
      <path fill="#fff" fillOpacity="0.7" d="M10 8.4a3 3 0 0 1 2.2-1.2c.4 0 .5.6.1.7a2 2 0 0 0-1.5.9c-.3.4-.9 0-.8-.4z" />
    </>
  ),
  // A red heart.
  support: (
    <>
      <path fill="#e0245e" d="M12 20.6s-8.2-4.9-8.2-10.7A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.2 2.7c0 5.8-8.2 10.7-8.2 10.7z" />
      <path fill="#fff" fillOpacity="0.55" d="M7.3 8.5a2.6 2.6 0 0 1 2.4-1c.5.1.4.8-.1.8a1.8 1.8 0 0 0-1.6.8c-.3.4-.9 0-.7-.6z" />
    </>
  )
};

/** Not reacted yet: the cheer star in pencil. */
const BLANK = <path d="M12 2.6l2.3 5.2 5.6.5-4.3 3.7 1.3 5.5L12 14.6l-4.9 2.9 1.3-5.5-4.3-3.7 5.6-.5z" />;

export function Stamp({ kind, size = 24, className = "" }: { kind: Reaction; size?: number; className?: string }) {
  const blank = className.includes("stamp--blank");
  return (
    <svg className={`stamp stamp--${kind} ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {blank ? <g className="stamp__ink">{BLANK}</g> : <g className="stamp__art">{ART[kind]}</g>}
    </svg>
  );
}
