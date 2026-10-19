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
 *   stars, joined            a network: people joined to people
 *   a pavilion, lights       an occasion: somewhere to be, something on
 *   steps                    the way up, shown by those who went first
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
  /** A rounded rectangle: a step, a pillar, a stage. Filled in a blue, or outlined in gold. */
  | { kind: "block"; x: number; y: number; w: number; h: number; round: number; tone?: number; outline?: number; turn?: number; fade?: number }
  /** A triangle with rounded corners: a roof, a beam of light. */
  | { kind: "peak"; x: number; y: number; w: number; h: number; tone?: number; gold?: boolean; fade?: number }
  /** Stars joined by fine lines, scattered over a box: people joined to people. */
  | { kind: "stars"; x: number; y: number; w: number; h: number; count: number; seed: number }
  /** Fine slanting streaks of green, like light rain over the sea. */
  | { kind: "rain"; x: number; y: number; w: number; h: number; count: number; seed: number }
  /** Lights strung on a line that dips between two points: something on tonight. */
  | { kind: "lights"; x1: number; x2: number; y: number; sag: number; count: number }
);

const GREEN = "#7ef0b4";

/** A small seeded random: the same picture on every visit. */
function seeded(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 2 ** 32;
  };
}

/** A triangle (point up) with its three corners rounded off. */
function roundedTriangle(x: number, y: number, w: number, h: number, r = 18): string {
  const pts = [
    [x, y - h],
    [x + w / 2, y],
    [x - w / 2, y]
  ];
  const towards = (a: number[], b: number[], d: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len];
  };
  let d = "";
  pts.forEach((p, i) => {
    const a = towards(p, pts[(i + 2) % 3], r);
    const b = towards(p, pts[(i + 1) % 3], r);
    d += `${i === 0 ? "M" : "L"} ${a[0]} ${a[1]} Q ${p[0]} ${p[1]} ${b[0]} ${b[1]} `;
  });
  return `${d}Z`;
}

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
  // Network: bright stars joined by fine lines (people joined to people), soft green rain
  // falling into the sea.
  people: {
    waves: [w(0.7, 44, 760, 0.3, "bottom", 3, 24), w(0.82, 30, 620, 0.7, "bottom", 1, 29), w(0.16, 40, 900, 0.1, "top", 1, 33, 70)],
    shapes: [
      { kind: "rain", x: 0, y: 120, w: 1600, h: 640, count: 70, seed: 11, behind: 0 },
      { kind: "stars", x: 1180, y: 170, w: 400, h: 520, count: 14, seed: 7 },
      { kind: "stars", x: 20, y: 260, w: 220, h: 420, count: 8, seed: 3 }
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
  // Events: a pavilion (a roof, pillars, a stage) with lights strung across it and a beam
  // of light from above: something is on, and you are invited.
  events: {
    waves: [w(0.8, 34, 780, 0.2, "bottom", 3, 24), w(0.9, 24, 600, 0.5, "bottom", 1, 29)],
    shapes: [
      { kind: "peak", x: 1360, y: 780, w: 300, h: 360, gold: true, fade: 0.14, behind: 0 },
      { kind: "peak", x: 1360, y: 400, w: 520, h: 150, tone: 0, behind: 0 },
      { kind: "block", x: 1170, y: 590, w: 38, h: 330, round: 14, tone: 0, behind: 0 },
      { kind: "block", x: 1295, y: 590, w: 38, h: 330, round: 14, tone: 0, behind: 0 },
      { kind: "block", x: 1425, y: 590, w: 38, h: 330, round: 14, tone: 0, behind: 0 },
      { kind: "block", x: 1550, y: 590, w: 38, h: 330, round: 14, tone: 0, behind: 0 },
      { kind: "block", x: 1360, y: 412, w: 500, h: 26, round: 10, tone: 1, behind: 0 },
      { kind: "block", x: 1360, y: 412, w: 500, h: 26, round: 10, outline: 2.5, fade: 0.8, behind: 0 },
      { kind: "block", x: 1360, y: 770, w: 560, h: 44, round: 14, tone: 0, behind: 0 },
      { kind: "lights", x1: 1090, x2: 1630, y: 440, sag: 50, count: 9, behind: 0 },
      { kind: "lights", x1: -20, x2: 420, y: 150, sag: 70, count: 7 }
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
  // Ask a senior: a sun in the corner, its light reaching out in arcs, and steps rising
  // towards it: an answer from someone who went this way first.
  ask: {
    waves: [w(0.74, 42, 820, 0.4, "bottom", 3, 27), w(0.86, 30, 640, 0.1, "bottom", 1, 23)],
    shapes: [
      { kind: "orb", x: 1600, y: 0, r: 240 },
      { kind: "arc", x: 1600, y: 0, r: 320, from: 90, to: 180, width: 3, fade: 0.75 },
      { kind: "arc", x: 1600, y: 0, r: 400, from: 95, to: 175, width: 2, fade: 0.5 },
      { kind: "arc", x: 1600, y: 0, r: 480, from: 100, to: 170, width: 1.5, fade: 0.3 },
      // Steps up towards the light: those who went before, and the way they found.
      { kind: "block", x: 1150, y: 760, w: 170, h: 46, round: 14, outline: 3, fade: 0.85 },
      { kind: "block", x: 1290, y: 680, w: 170, h: 46, round: 14, outline: 3, fade: 0.7 },
      { kind: "block", x: 1430, y: 600, w: 170, h: 46, round: 14, outline: 3, fade: 0.55 },
      { kind: "stars", x: 60, y: 300, w: 240, h: 300, count: 6, seed: 21 }
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
    case "block":
      return (
        <rect
          x={s.x - s.w / 2}
          y={s.y - s.h / 2}
          width={s.w}
          height={s.h}
          rx={s.round}
          fill={s.outline ? "none" : BLUE[s.tone ?? 0]}
          stroke={s.outline ? GOLD.line : "none"}
          strokeWidth={s.outline}
          opacity={s.fade ?? 1}
          transform={s.turn ? `rotate(${s.turn} ${s.x} ${s.y})` : undefined}
        />
      );
    case "peak":
      return <path d={roundedTriangle(s.x, s.y, s.w, s.h)} fill={s.gold ? GOLD.core : BLUE[s.tone ?? 0]} opacity={s.fade ?? 1} />;
    case "stars": {
      const rand = seeded(s.seed);
      const pts = Array.from({ length: s.count }, () => [s.x + rand() * s.w, s.y + rand() * s.h, 3 + rand() * 4] as const);
      // Each star joined to its nearest one or two: a loose web, not a tangle.
      const links: [number, number][] = [];
      pts.forEach((p, i) => {
        const near = pts
          .map((q, j) => [j, Math.hypot(q[0] - p[0], q[1] - p[1])] as const)
          .filter(([j]) => j !== i)
          .sort((a, b) => a[1] - b[1])
          .slice(0, i % 3 === 0 ? 2 : 1);
        for (const [j] of near) if (!links.some(([a, b]) => (a === j && b === i) || (a === i && b === j))) links.push([i, j]);
      });
      return (
        <g>
          {links.map(([a, b], k) => (
            <line key={k} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={GOLD.core} strokeWidth={2} opacity={0.75} strokeLinecap="round" />
          ))}
          {pts.map(([x, y, r], k) => (
            <g key={k}>
              <circle cx={x} cy={y} r={r * 2.6} fill={GOLD.core} opacity={0.18} />
              <circle cx={x} cy={y} r={r} fill="#ffe680" />
            </g>
          ))}
        </g>
      );
    }
    case "rain": {
      const rand = seeded(s.seed);
      return (
        <g stroke={GREEN} strokeLinecap="round">
          {Array.from({ length: s.count }, (_, k) => {
            const x = s.x + rand() * s.w;
            const y = s.y + rand() * s.h;
            const len = 40 + rand() * 90;
            return <line key={k} x1={x} y1={y} x2={x - len * 0.18} y2={y + len} strokeWidth={1.5 + rand() * 1.5} opacity={0.25 + rand() * 0.4} />;
          })}
        </g>
      );
    }
    case "lights": {
      const point = (t: number) => [s.x1 + (s.x2 - s.x1) * t, s.y + s.sag * 4 * t * (1 - t)] as const;
      return (
        <g>
          <path d={`M ${s.x1} ${s.y} Q ${(s.x1 + s.x2) / 2} ${s.y + s.sag * 2} ${s.x2} ${s.y}`} fill="none" stroke={GOLD.line} strokeWidth={1.5} opacity={0.6} />
          {Array.from({ length: s.count }, (_, k) => {
            const [x, y] = point((k + 1) / (s.count + 1));
            return (
              <g key={k}>
                <circle cx={x} cy={y + 8} r={14} fill={GOLD.core} opacity={0.22} />
                <circle cx={x} cy={y + 8} r={6} fill="#ffe680" />
              </g>
            );
          })}
        </g>
      );
    }
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
