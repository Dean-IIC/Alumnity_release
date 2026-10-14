import { useId } from "react";

/*
 * A member's seal, in place of a photo (only 3% of the college's records have one): their
 * initials in the middle, their branch and batch around the ring, in blue ink. Each is
 * pressed at its own angle and with its own unevenness of ink, so no two are the same.
 */

/** "Abdul Nishad A B" → "AN": the first letters of the first two real words (initials skipped). */
export function initialsOf(name: string) {
  const words = name.split(/\s+/).filter((w) => w.replace(/\./g, "").length > 1);
  return (words.length ? words : name.split(/\s+/))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function InkSeal({ name, ring, seed, size = 132 }: { name: string; ring: string; seed: number; size?: number }) {
  const id = useId().replace(/:/g, "");
  const angle = ((seed * 37) % 24) - 12;
  return (
    <svg className="ink-seal" width={size} height={size} viewBox="0 0 140 140" aria-hidden="true" style={{ transform: `rotate(${angle}deg)` }}>
      <defs>
        {/* Uneven ink: the edges wobble and thin a little, differently for every seal. */}
        <filter id={`${id}-ink`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed % 97} result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.6" />
        </filter>
        <path id={`${id}-ring`} d="M70 70m-50 0a50 50 0 1 1 100 0a50 50 0 1 1 -100 0" />
      </defs>
      <g filter={`url(#${id}-ink)`}>
        <circle className="ink-seal__edge" cx="70" cy="70" r="64" />
        <circle className="ink-seal__inner" cx="70" cy="70" r="38" />
        <text className="ink-seal__ring">
          <textPath href={`#${id}-ring`} startOffset="1%">
            {ring}
          </textPath>
        </text>
        <text className="ink-seal__initials" x="70" y="83" textAnchor="middle">
          {initialsOf(name)}
        </text>
      </g>
    </svg>
  );
}
