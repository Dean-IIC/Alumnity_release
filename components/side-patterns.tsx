import type { CSSProperties } from "react";

/*
 * Hand-drawn margin patterns: a vine with leaves and tendrils, a wave along the edge,
 * a few flowers, sparkles and dots. They grow in from both sides of the screen.
 * Each mark draws itself as `--p` (0 → 1, set on the parent) passes its `--d` delay.
 */

type Mark = { d: string; tone: "red" | "blue" | "gold"; delay: number };

const MARKS: Mark[] = [
  { d: "M18 -20C40 90 0 170 24 270S50 440 20 540 0 720 30 930", tone: "blue", delay: 0 },
  { d: "M60 920C10 800 150 740 96 610S20 420 120 330 210 160 110 70 60 -10 90 -40", tone: "red", delay: 0.05 },
  { d: "M96 610c50 -6 82 30 62 66c-14 26 -48 20 -46 -4c2 -18 26 -18 28 -4", tone: "red", delay: 0.35 },
  { d: "M120 330c-46 -20 -70 10 -60 40c8 22 36 22 40 4c3 -14 -14 -20 -22 -10", tone: "red", delay: 0.45 },
  { d: "M110 70c44 10 64 46 40 70c-18 18 -44 4 -36 -16", tone: "red", delay: 0.55 },
  { d: "M200 480c-10 -26 20 -26 10 0c26 -8 26 22 0 10c8 26 -22 26 -10 0c-26 8 -26 -22 0 -10z", tone: "gold", delay: 0.5 },
  { d: "M168 150c-8 -20 16 -20 8 0c20 -6 20 17 0 8c6 20 -17 20 -8 0c-20 6 -20 -17 0 -8z", tone: "gold", delay: 0.6 },
  { d: "M240 640c0 -20 30 -20 30 0c0 30 -46 30 -46 0c0 -40 62 -40 62 0", tone: "blue", delay: 0.55 },
  { d: "M230 230v-20M220 220h20", tone: "gold", delay: 0.7 },
  { d: "M182 806v-16M174 798h16", tone: "gold", delay: 0.72 },
  { d: "M262 400v-12M256 394h12", tone: "red", delay: 0.75 }
];

const LEAVES: [number, number, number][] = [
  [80, 760, -40],
  [118, 690, 20],
  [70, 520, -30],
  [104, 440, 35],
  [150, 250, -20],
  [128, 180, 30],
  [96, 30, -35]
];

const DOTS: [number, number, number][] = [
  [150, 560, 3.5],
  [176, 590, 2.5],
  [60, 380, 3],
  [210, 330, 2.5],
  [46, 120, 3],
  [220, 760, 3],
  [250, 520, 2]
];

function PatternColumn({ side }: { side: "left" | "right" }) {
  return (
    <svg className={`side-pattern side-pattern--${side}`} viewBox="0 0 300 900" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
      {MARKS.map((mark, i) => (
        <path className={`side-pattern__mark side-pattern__mark--${mark.tone}`} d={mark.d} key={i} pathLength={1} style={{ "--d": mark.delay } as CSSProperties} />
      ))}
      {LEAVES.map(([x, y, angle], i) => (
        <path
          className="side-pattern__mark side-pattern__mark--gold"
          d="M0 0c18 -22 52 -24 70 -6c-20 20 -52 22 -70 6zM0 0l58 -8"
          key={`leaf-${i}`}
          pathLength={1}
          transform={`translate(${x} ${y}) rotate(${angle})`}
          style={{ "--d": 0.25 + i * 0.07 } as CSSProperties}
        />
      ))}
      {DOTS.map(([x, y, r], i) => (
        <circle className="side-pattern__dot" cx={x} cy={y} r={r} key={`dot-${i}`} style={{ "--d": 0.6 + i * 0.04 } as CSSProperties} />
      ))}
    </svg>
  );
}

export function SidePatterns({ className = "" }: { className?: string }) {
  return (
    <div className={`side-patterns ${className}`} aria-hidden="true">
      <PatternColumn side="left" />
      <PatternColumn side="right" />
    </div>
  );
}
