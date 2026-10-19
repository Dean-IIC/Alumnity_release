import { memo, type CSSProperties, type ReactNode } from "react";

/*
 * Inside the site, each page stands on its own picture: flat blue, made of layered waves in
 * many blues that slowly come and go, with soft shadows between them, and gold on it: soft
 * orbs, fine rings and arcs, and thin lines that follow the waves. Calm and grown-up, like
 * good print: few shapes, all curved (nothing sharp to snag the eye), one idea per page,
 * chosen for what its shapes make people feel (shape psychology):
 *
 *   an orb, half sunk       warmth and welcome: a sun rising, or setting into the sea
 *   rings, overlapping      belonging, people joined to people
 *   arcs, one inside another  a gateway, years passing through: the college's arch
 *   a line that rises        growth and progress (jobs, the board)
 *   ripples                  something reaching you (notifications)
 *   level lines              steadiness (settings, the desk)
 *
 * Each layer is its own element, so the waves drift on the graphics card without
 * repainting the page; nothing moves for anyone who prefers less motion.
 */

export type SceneName =
  | "home"
  | "people"
  | "connections"
  | "batch"
  | "groups"
  | "messages"
  | "notifications"
  | "events"
  | "board"
  | "ask"
  | "profile"
  | "gallery"
  | "causes"
  | "steady";

/** The blues, from deepest to lightest, and the golds. */
const BLUE = ["#1a52b3", "#1f5fc4", "#2a6ad3", "#3479df", "#4489e8", "#5a9bf0"] as const;
const GOLD = { core: "#ffd978", edge: "#e2a62e", line: "#f3c65a" } as const;

const W = 1600;
const H = 1000;

type Wave = {
  /** Where its crest line sits (0 top … 1 bottom) and how tall its swells are. */
  at: number;
  amp: number;
  /** Swell length, and where along it the wave starts. */
  length: number;
  shift: number;
  /** Fills down to the bottom, or up to the top. */
  side: "bottom" | "top";
  tone: number;
  /** Seconds for one come-and-go, and how far it travels. */
  drift: number;
  reach: number;
};

/** Gold on the picture. `behind: n` puts it under wave n (a sun setting into the sea). */
type Shape = { behind?: number } & (
  | { kind: "orb"; x: number; y: number; r: number }
  | { kind: "ring"; x: number; y: number; r: number; width: number; fade?: number }
  | { kind: "arc"; x: number; y: number; r: number; from: number; to: number; width: number; fade?: number }
  | { kind: "ripple"; x: number; y: number; r: number; rings: number; gap: number }
  | { kind: "line"; wave: Omit<Wave, "side" | "tone" | "drift" | "reach">; width: number; fade?: number }
);

type Scene = { waves: Wave[]; shapes: Shape[] };

/** A smooth swell across the picture: the open line, or closed off to the top or bottom. */
function swell({ at, amp, length, shift }: Pick<Wave, "at" | "amp" | "length" | "shift">): string {
  const y = at * H;
  const start = -400 - shift * length;
  let d = `M ${start} ${y} Q ${start + length / 4} ${y - amp} ${start + length / 2} ${y}`;
  for (let x = start + length / 2; x < W + 400; x += length / 2) d += ` T ${x + length / 2} ${y}`;
  return d;
}

function wavePath(wave: Wave): string {
  const edge = wave.side === "bottom" ? H + 40 : -40;
  return `${swell(wave)} L ${W + 400 + wave.length} ${edge} L ${-400 - wave.shift * wave.length} ${edge} Z`;
}

const w = (at: number, amp: number, length: number, shift: number, side: Wave["side"], tone: number, drift: number, reach = 60): Wave => ({ at, amp, length, shift, side, tone, drift, reach });
const line = (at: number, amp: number, length: number, shift: number, width = 2.5, fade = 0.7): Shape => ({ kind: "line", wave: { at, amp, length, shift }, width, fade });

/** Each page's picture. */
const SCENES: Record<SceneName, Scene> = {
  // Home: a sun rising out of the sea, its light in two fine arcs: a warm welcome.
  home: {
    waves: [w(0.62, 50, 900, 0.1, "bottom", 3, 26), w(0.72, 40, 700, 0.5, "bottom", 4, 20, 80), w(0.84, 34, 560, 0.2, "bottom", 1, 31), w(0.12, 36, 820, 0.3, "top", 1, 34)],
    shapes: [
      { kind: "orb", x: 1340, y: 640, r: 190, behind: 1 },
      { kind: "arc", x: 1340, y: 640, r: 260, from: 200, to: 340, width: 3, fade: 0.75, behind: 1 },
      { kind: "arc", x: 1340, y: 640, r: 320, from: 210, to: 330, width: 2, fade: 0.45, behind: 1 },
      line(0.9, 26, 640, 0.35, 2, 0.5)
    ]
  },
  // Network: rings that overlap, people joined to people.
  people: {
    waves: [w(0.7, 44, 760, 0.3, "bottom", 3, 24), w(0.82, 30, 620, 0.7, "bottom", 1, 29), w(0.16, 40, 900, 0.1, "top", 1, 33, 70)],
    shapes: [
      { kind: "ring", x: 1330, y: 360, r: 130, width: 3, fade: 0.85 },
      { kind: "ring", x: 1450, y: 430, r: 110, width: 3, fade: 0.7 },
      { kind: "ring", x: 1350, y: 500, r: 90, width: 3, fade: 0.55 },
      { kind: "orb", x: 1395, y: 430, r: 34 },
      { kind: "orb", x: 170, y: 700, r: 120, behind: 0 }
    ]
  },
  // Connections: two rings meeting, the space they share in gold.
  connections: {
    waves: [w(0.68, 46, 820, 0.4, "bottom", 2, 27), w(0.8, 32, 600, 0.1, "bottom", 4, 22, 80)],
    shapes: [
      { kind: "ring", x: 1300, y: 420, r: 150, width: 3.5, fade: 0.85 },
      { kind: "ring", x: 1480, y: 420, r: 150, width: 3.5, fade: 0.85 },
      { kind: "orb", x: 1390, y: 420, r: 46 },
      line(0.88, 22, 700, 0.2, 2, 0.45)
    ]
  },
  // Your batch: arcs inside arcs, the college's gate and the years rolling through it.
  batch: {
    waves: [w(0.76, 36, 700, 0.2, "bottom", 3, 25), w(0.88, 26, 520, 0.6, "bottom", 1, 30)],
    shapes: [
      { kind: "arc", x: 1360, y: 820, r: 330, from: 180, to: 360, width: 4, fade: 0.85, behind: 0 },
      { kind: "arc", x: 1360, y: 820, r: 260, from: 180, to: 360, width: 3, fade: 0.65, behind: 0 },
      { kind: "arc", x: 1360, y: 820, r: 190, from: 180, to: 360, width: 2.5, fade: 0.5, behind: 0 },
      { kind: "orb", x: 1360, y: 820, r: 110, behind: 0 }
    ]
  },
  // Groups: circles of different sizes gathered close, each its own.
  groups: {
    waves: [w(0.66, 50, 880, 0.2, "bottom", 4, 23), w(0.8, 34, 640, 0.5, "bottom", 2, 28), w(0.1, 30, 700, 0.6, "top", 1, 35)],
    shapes: [
      { kind: "ring", x: 1320, y: 380, r: 110, width: 3, fade: 0.8 },
      { kind: "ring", x: 1470, y: 340, r: 80, width: 3, fade: 0.65 },
      { kind: "orb", x: 1430, y: 500, r: 70 },
      { kind: "orb", x: 210, y: 820, r: 130, behind: 1 }
    ]
  },
  // Messages: long fine lines riding the waves, like a conversation going back and forth.
  messages: {
    waves: [w(0.74, 30, 1000, 0.1, "bottom", 3, 30), w(0.86, 22, 820, 0.4, "bottom", 4, 24, 80), w(0.14, 26, 1000, 0.5, "top", 1, 36)],
    shapes: [
      line(0.3, 34, 900, 0.1, 3, 0.8),
      line(0.36, 30, 900, 0.6, 2, 0.5),
      line(0.42, 26, 900, 0.35, 1.5, 0.35),
      { kind: "orb", x: 1420, y: 300, r: 60 }
    ]
  },
  // Notifications: ripples spreading from a point: something reaching you.
  notifications: {
    waves: [w(0.78, 34, 760, 0.3, "bottom", 2, 26), w(0.9, 24, 560, 0.7, "bottom", 4, 21, 80)],
    shapes: [
      { kind: "ripple", x: 1420, y: 280, r: 70, rings: 4, gap: 52 },
      { kind: "orb", x: 1420, y: 280, r: 56 }
    ]
  },
  // Events: a tall arch to walk through, a sun beyond it: a day to look forward to.
  events: {
    waves: [w(0.72, 44, 780, 0.2, "bottom", 3, 24), w(0.84, 30, 600, 0.5, "bottom", 1, 29)],
    shapes: [
      { kind: "orb", x: 1440, y: 600, r: 100, behind: 0 },
      { kind: "arc", x: 1380, y: 760, r: 250, from: 180, to: 360, width: 5, fade: 0.9, behind: 0 },
      { kind: "arc", x: 1380, y: 760, r: 300, from: 195, to: 345, width: 2, fade: 0.45, behind: 0 }
    ]
  },
  // The board: a line climbing gently to the right, ending in a sun: progress.
  board: {
    waves: [w(0.78, 40, 700, 0.1, "bottom", 2, 25), w(0.88, 28, 520, 0.6, "bottom", 4, 21, 80)],
    shapes: [
      { kind: "arc", x: 1700, y: 1300, r: 900, from: 205, to: 262, width: 4, fade: 0.85 },
      { kind: "arc", x: 1700, y: 1300, r: 960, from: 210, to: 258, width: 2, fade: 0.45 },
      { kind: "orb", x: 1580, y: 420, r: 64 }
    ]
  },
  // Ask a senior: a sun in the corner, its light reaching out in arcs: an answer arriving.
  ask: {
    waves: [w(0.74, 42, 820, 0.4, "bottom", 3, 27), w(0.86, 30, 640, 0.1, "bottom", 1, 23)],
    shapes: [
      { kind: "orb", x: 1600, y: 0, r: 240 },
      { kind: "arc", x: 1600, y: 0, r: 320, from: 90, to: 180, width: 3, fade: 0.75 },
      { kind: "arc", x: 1600, y: 0, r: 400, from: 95, to: 175, width: 2, fade: 0.5 },
      { kind: "arc", x: 1600, y: 0, r: 480, from: 100, to: 170, width: 1.5, fade: 0.3 }
    ]
  },
  // A profile: one long line like a life's path, and a single orb: one person.
  profile: {
    waves: [w(0.66, 70, 1300, 0.2, "bottom", 4, 32), w(0.8, 40, 900, 0.6, "bottom", 2, 26)],
    shapes: [
      { kind: "orb", x: 1380, y: 320, r: 150 },
      { kind: "ring", x: 1380, y: 320, r: 200, width: 2, fade: 0.5 },
      line(0.55, 60, 1300, 0.2, 2.5, 0.6)
    ]
  },
  // The gallery: rings like light caught by a lens.
  gallery: {
    waves: [w(0.76, 38, 740, 0.3, "bottom", 3, 26), w(0.88, 26, 560, 0.7, "bottom", 1, 22)],
    shapes: [
      { kind: "ring", x: 1380, y: 380, r: 160, width: 3, fade: 0.8 },
      { kind: "ring", x: 1380, y: 380, r: 110, width: 2, fade: 0.55 },
      { kind: "orb", x: 1380, y: 380, r: 60 }
    ]
  },
  // Causes: two orbs held close, warmth given and received.
  causes: {
    waves: [w(0.7, 46, 820, 0.2, "bottom", 4, 25), w(0.82, 32, 620, 0.5, "bottom", 2, 30)],
    shapes: [
      { kind: "orb", x: 1330, y: 440, r: 120, behind: 0 },
      { kind: "orb", x: 1460, y: 440, r: 120, behind: 0 },
      { kind: "ring", x: 1395, y: 440, r: 220, width: 2, fade: 0.5, behind: 0 }
    ]
  },
  // Settings and the desk: level lines over a calm sea: steadiness.
  steady: {
    waves: [w(0.72, 16, 1200, 0.2, "bottom", 3, 34), w(0.82, 12, 1000, 0.5, "bottom", 4, 30, 40), w(0.92, 10, 900, 0.1, "bottom", 1, 26)],
    shapes: [line(0.3, 8, 1400, 0.1, 2.5, 0.6), line(0.34, 8, 1400, 0.5, 1.5, 0.4), { kind: "orb", x: 1450, y: 300, r: 70 }]
  }
};

/** A point on a circle, for arcs (degrees, clockwise from the right, as SVG measures). */
const at = (x: number, y: number, r: number, deg: number) => [x + r * Math.cos((deg * Math.PI) / 180), y + r * Math.sin((deg * Math.PI) / 180)] as const;

function ShapeArt({ s, glow }: { s: Shape; glow: string }) {
  switch (s.kind) {
    case "orb":
      return <circle cx={s.x} cy={s.y} r={s.r} fill={`url(#${glow})`} />;
    case "ring":
      return <circle cx={s.x} cy={s.y} r={s.r} fill="none" stroke={GOLD.line} strokeWidth={s.width} opacity={s.fade ?? 0.8} />;
    case "arc": {
      const [x1, y1] = at(s.x, s.y, s.r, s.from);
      const [x2, y2] = at(s.x, s.y, s.r, s.to);
      const large = s.to - s.from > 180 ? 1 : 0;
      return <path d={`M ${x1} ${y1} A ${s.r} ${s.r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={GOLD.line} strokeWidth={s.width} strokeLinecap="round" opacity={s.fade ?? 0.8} />;
    }
    case "ripple":
      return (
        <g fill="none" stroke={GOLD.line}>
          {Array.from({ length: s.rings }, (_, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r + (i + 1) * s.gap} strokeWidth={3 - i * 0.5} opacity={0.75 - i * 0.16} />
          ))}
        </g>
      );
    case "line":
      return <path d={swell(s.wave)} fill="none" stroke={GOLD.line} strokeWidth={s.width} strokeLinecap="round" opacity={s.fade ?? 0.7} />;
  }
}

/** One full-size layer of the picture: its own element, so it can drift by itself. */
function Layer({ children, className, style }: { children: ReactNode; className: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** The orbs' soft light: brighter at the heart, a deeper gold at the rim. */
function Glow({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={id} cx="38%" cy="34%" r="70%">
        <stop offset="0%" stopColor={GOLD.core} />
        <stop offset="100%" stopColor={GOLD.edge} />
      </radialGradient>
    </defs>
  );
}

function Shapes({ list, id, className }: { list: Shape[]; id: string; className: string }) {
  return (
    <Layer className={className}>
      <Glow id={id} />
      {list.map((s, k) => (
        <ShapeArt key={k} s={s} glow={id} />
      ))}
    </Layer>
  );
}

export const Scene = memo(function Scene({ name }: { name: SceneName }) {
  const { waves, shapes } = SCENES[name];
  const free = shapes.filter((s) => s.behind === undefined);
  return (
    <div className="scene" data-scene={name}>
      {waves.map((wave, i) => {
        const under = shapes.filter((s) => s.behind === i);
        return (
          <div key={i} className="scene__depth">
            {/* What sits under this wave: drawn just before it. */}
            {under.length > 0 && <Shapes list={under} id={`glow-${name}-${i}`} className="scene__shapes" />}
            <Layer
              className={`scene__wave scene__wave--${wave.side}`}
              style={{ "--drift": `${wave.drift}s`, "--reach": `${wave.reach}px`, "--delay": `${-i * 7}s` } as CSSProperties}
            >
              <path d={wavePath(wave)} fill={BLUE[wave.tone]} />
            </Layer>
          </div>
        );
      })}
      {free.length > 0 && <Shapes list={free} id={`glow-${name}-front`} className="scene__shapes scene__shapes--front" />}
    </div>
  );
});
