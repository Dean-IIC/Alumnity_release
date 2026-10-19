import { memo, type CSSProperties } from "react";

/*
 * Inside the site, each page stands on its own picture: flat blue, made of layered waves in
 * many blues that slowly come and go, with soft shadows between them, and big soft yellow
 * spheres and pills. Flat and soft, no outlines. Each page's picture is its own, chosen by
 * what its shapes make people feel (shape psychology):
 *
 *   circles and spheres  warmth, community, belonging: nothing to snag on
 *   pills                friendly and easy-going: a circle stretched into a step forward
 *   waves                calm, flow, things that come and go (people, news, years)
 *   arches               a gateway, achievement: the college's own arch
 *   rising steps         growth and progress (jobs, the board)
 *   ripples              something reaching you (notifications)
 *   level bands          steadiness (settings, the desk)
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

/** The blues, from deepest to lightest, and the yellows. */
const BLUE = ["#1a52b3", "#1f5fc4", "#2a6ad3", "#3479df", "#4489e8", "#5a9bf0"] as const;
const YELLOW = { sun: "#ffd23f", deep: "#ffc21a", light: "#ffe27a" } as const;
const ACCENT = { coral: "#ff6b6b", mint: "#3ddc97" } as const;

const W = 1600;
const H = 1000;

type Wave = {
  /** Where its crest line sits (0 top … 1 bottom) and how tall its swells are. */
  at: number;
  amp: number;
  /** Swell length, and where along it the wave starts. */
  length: number;
  shift: number;
  /** Fills down to the bottom ("up") or up to the top ("down"). */
  side: "bottom" | "top";
  tone: number;
  /** Seconds for one come-and-go, and how far it travels. */
  drift: number;
  reach: number;
};

type Shape =
  | { kind: "sphere"; x: number; y: number; r: number; tone?: keyof typeof YELLOW; behind?: number }
  | { kind: "pill"; x: number; y: number; w: number; h: number; turn: number; tone?: keyof typeof YELLOW | keyof typeof ACCENT; behind?: number }
  | { kind: "arch"; x: number; y: number; r: number; thick: number; tone?: keyof typeof YELLOW; behind?: number }
  | { kind: "ripple"; x: number; y: number; r: number; rings: number; behind?: number };

type Scene = { waves: Wave[]; shapes: Shape[] };

/** A smooth swell from one side of the picture to the other, closed off at the top or bottom. */
function wavePath({ at, amp, length, shift, side }: Wave): string {
  const y = at * H;
  const start = -400 - shift * length;
  let d = `M ${start} ${y} Q ${start + length / 4} ${y - amp} ${start + length / 2} ${y}`;
  for (let x = start + length / 2; x < W + 400; x += length / 2) d += ` T ${x + length / 2} ${y}`;
  const edge = side === "bottom" ? H + 40 : -40;
  return `${d} L ${W + 400 + length} ${edge} L ${start} ${edge} Z`;
}

const w = (at: number, amp: number, length: number, shift: number, side: Wave["side"], tone: number, drift: number, reach = 60): Wave => ({ at, amp, length, shift, side, tone, drift, reach });

/** Each page's picture. Shapes with `behind: n` sit under wave n (a sun setting into the sea). */
const SCENES: Record<SceneName, Scene> = {
  // Home: a sun rising over the sea, a few pills drifting: a warm, open welcome.
  home: {
    waves: [w(0.62, 50, 900, 0.1, "bottom", 3, 26), w(0.72, 40, 700, 0.5, "bottom", 4, 20, 80), w(0.84, 34, 560, 0.2, "bottom", 1, 31), w(0.12, 36, 820, 0.3, "top", 1, 34)],
    shapes: [
      { kind: "sphere", x: 1360, y: 640, r: 210, behind: 1 },
      { kind: "pill", x: 170, y: 760, w: 220, h: 64, turn: -18, tone: "deep" },
      { kind: "pill", x: 1460, y: 260, w: 150, h: 46, turn: 24, tone: "light" },
      { kind: "sphere", x: 120, y: 420, r: 46, tone: "light" },
      { kind: "pill", x: 330, y: 880, w: 90, h: 28, turn: 8, tone: "coral" }
    ]
  },
  // People: many spheres of different sizes, near each other: a crowd that belongs together.
  people: {
    waves: [w(0.7, 44, 760, 0.3, "bottom", 3, 24), w(0.82, 30, 620, 0.7, "bottom", 1, 29), w(0.16, 40, 900, 0.1, "top", 1, 33, 70)],
    shapes: [
      { kind: "sphere", x: 1380, y: 330, r: 150 },
      { kind: "sphere", x: 1500, y: 520, r: 80, tone: "light" },
      { kind: "sphere", x: 1250, y: 560, r: 56, tone: "deep" },
      { kind: "sphere", x: 160, y: 640, r: 120, behind: 0 },
      { kind: "sphere", x: 300, y: 760, r: 60, tone: "light" },
      { kind: "pill", x: 120, y: 300, w: 120, h: 36, turn: -12, tone: "mint" }
    ]
  },
  // Connections: two spheres overlapping: two people meeting.
  connections: {
    waves: [w(0.68, 46, 820, 0.4, "bottom", 2, 27), w(0.8, 32, 600, 0.1, "bottom", 4, 22, 80)],
    shapes: [
      { kind: "sphere", x: 1300, y: 420, r: 170, tone: "deep" },
      { kind: "sphere", x: 1480, y: 520, r: 150, tone: "light" },
      { kind: "pill", x: 200, y: 780, w: 200, h: 56, turn: -10 }
    ]
  },
  // Your batch: arches inside arches, like the college's gate and the years rolling through it.
  batch: {
    waves: [w(0.76, 36, 700, 0.2, "bottom", 3, 25), w(0.88, 26, 520, 0.6, "bottom", 1, 30)],
    shapes: [
      { kind: "arch", x: 1360, y: 820, r: 330, thick: 54, tone: "deep", behind: 0 },
      { kind: "arch", x: 1360, y: 820, r: 230, thick: 46, behind: 0 },
      { kind: "arch", x: 1360, y: 820, r: 140, thick: 40, tone: "light", behind: 0 },
      { kind: "sphere", x: 180, y: 360, r: 70, tone: "light" }
    ]
  },
  // Groups: a cluster of spheres, close but each its own: circles of friends.
  groups: {
    waves: [w(0.66, 50, 880, 0.2, "bottom", 4, 23), w(0.8, 34, 640, 0.5, "bottom", 2, 28), w(0.1, 30, 700, 0.6, "top", 1, 35)],
    shapes: [
      { kind: "sphere", x: 1330, y: 360, r: 120 },
      { kind: "sphere", x: 1480, y: 330, r: 90, tone: "deep" },
      { kind: "sphere", x: 1410, y: 500, r: 100, tone: "light" },
      { kind: "sphere", x: 220, y: 820, r: 140, behind: 1 },
      { kind: "pill", x: 140, y: 380, w: 110, h: 34, turn: 20, tone: "coral" }
    ]
  },
  // Messages: rounded pills like speech going back and forth, over gentle, long waves.
  messages: {
    waves: [w(0.74, 30, 1000, 0.1, "bottom", 3, 30), w(0.86, 22, 820, 0.4, "bottom", 4, 24, 80), w(0.14, 26, 1000, 0.5, "top", 1, 36)],
    shapes: [
      { kind: "pill", x: 1340, y: 300, w: 300, h: 90, turn: 0, tone: "sun" },
      { kind: "pill", x: 1440, y: 430, w: 230, h: 76, turn: 0, tone: "light" },
      { kind: "pill", x: 1320, y: 550, w: 180, h: 64, turn: 0, tone: "deep" },
      { kind: "pill", x: 200, y: 760, w: 220, h: 70, turn: 0, tone: "light" },
      { kind: "sphere", x: 120, y: 330, r: 34, tone: "sun" }
    ]
  },
  // Notifications: ripples spreading from a point: something reaching you.
  notifications: {
    waves: [w(0.78, 34, 760, 0.3, "bottom", 2, 26), w(0.9, 24, 560, 0.7, "bottom", 4, 21, 80)],
    shapes: [
      { kind: "ripple", x: 1420, y: 260, r: 90, rings: 4 },
      { kind: "sphere", x: 1420, y: 260, r: 70 },
      { kind: "pill", x: 200, y: 700, w: 160, h: 48, turn: -20, tone: "deep" }
    ]
  },
  // Events: an arch to walk through, and pills scattered like confetti: a day to celebrate.
  events: {
    waves: [w(0.72, 44, 780, 0.2, "bottom", 3, 24), w(0.84, 30, 600, 0.5, "bottom", 1, 29)],
    shapes: [
      { kind: "arch", x: 1380, y: 760, r: 240, thick: 70, behind: 0 },
      { kind: "pill", x: 1180, y: 250, w: 90, h: 26, turn: 35, tone: "coral" },
      { kind: "pill", x: 1500, y: 200, w: 110, h: 30, turn: -25 },
      { kind: "pill", x: 1300, y: 360, w: 70, h: 22, turn: 60, tone: "mint" },
      { kind: "pill", x: 160, y: 300, w: 100, h: 28, turn: -40, tone: "light" },
      { kind: "pill", x: 260, y: 820, w: 130, h: 34, turn: 15, tone: "deep" }
    ]
  },
  // The board: pills climbing like steps, and waves rising to the right: progress.
  board: {
    waves: [w(0.78, 40, 700, 0.1, "bottom", 2, 25), w(0.88, 28, 520, 0.6, "bottom", 4, 21, 80)],
    shapes: [
      { kind: "pill", x: 1180, y: 640, w: 200, h: 56, turn: -20 },
      { kind: "pill", x: 1330, y: 500, w: 200, h: 56, turn: -20, tone: "light" },
      { kind: "pill", x: 1480, y: 360, w: 200, h: 56, turn: -20, tone: "deep" },
      { kind: "sphere", x: 1530, y: 190, r: 60, tone: "sun" },
      { kind: "sphere", x: 160, y: 760, r: 90, behind: 0 }
    ]
  },
  // Ask a senior: a sun at the corner, its light in long pills: an answer arriving.
  ask: {
    waves: [w(0.74, 42, 820, 0.4, "bottom", 3, 27), w(0.86, 30, 640, 0.1, "bottom", 1, 23)],
    shapes: [
      { kind: "sphere", x: 1600, y: 0, r: 260 },
      { kind: "pill", x: 1240, y: 300, w: 240, h: 34, turn: -32, tone: "light" },
      { kind: "pill", x: 1360, y: 420, w: 220, h: 34, turn: -52, tone: "light" },
      { kind: "pill", x: 1520, y: 470, w: 200, h: 34, turn: -76, tone: "light" },
      { kind: "sphere", x: 180, y: 780, r: 80, tone: "deep" }
    ]
  },
  // A profile: one long wave like a life's path, and a single big sphere: one person.
  profile: {
    waves: [w(0.66, 70, 1300, 0.2, "bottom", 4, 32), w(0.8, 40, 900, 0.6, "bottom", 2, 26)],
    shapes: [
      { kind: "sphere", x: 1380, y: 320, r: 180 },
      { kind: "sphere", x: 1460, y: 270, r: 60, tone: "light" },
      { kind: "pill", x: 180, y: 820, w: 180, h: 52, turn: 12, tone: "deep" }
    ]
  },
  // The gallery: pills tilted like photos laid on a table.
  gallery: {
    waves: [w(0.76, 38, 740, 0.3, "bottom", 3, 26), w(0.88, 26, 560, 0.7, "bottom", 1, 22)],
    shapes: [
      { kind: "pill", x: 1300, y: 340, w: 220, h: 150, turn: -8, tone: "light" },
      { kind: "pill", x: 1440, y: 420, w: 220, h: 150, turn: 10 },
      { kind: "pill", x: 200, y: 760, w: 180, h: 120, turn: -14, tone: "deep" }
    ]
  },
  // Causes: two spheres held close, warmth given and received.
  causes: {
    waves: [w(0.7, 46, 820, 0.2, "bottom", 4, 25), w(0.82, 32, 620, 0.5, "bottom", 2, 30)],
    shapes: [
      { kind: "sphere", x: 1340, y: 420, r: 140, tone: "deep", behind: 0 },
      { kind: "sphere", x: 1470, y: 420, r: 140, behind: 0 },
      { kind: "pill", x: 1405, y: 200, w: 80, h: 26, turn: 0, tone: "coral" },
      { kind: "sphere", x: 160, y: 380, r: 50, tone: "light" }
    ]
  },
  // Settings and the desk: level bands, a calm sea: steadiness.
  steady: {
    waves: [w(0.72, 16, 1200, 0.2, "bottom", 3, 34), w(0.82, 12, 1000, 0.5, "bottom", 4, 30, 40), w(0.92, 10, 900, 0.1, "bottom", 1, 26)],
    shapes: [
      { kind: "pill", x: 1380, y: 300, w: 320, h: 70, turn: 0, tone: "light" },
      { kind: "sphere", x: 1530, y: 300, r: 70 }
    ]
  }
};

const fill = (tone?: string) => (tone && tone in ACCENT ? ACCENT[tone as keyof typeof ACCENT] : YELLOW[(tone as keyof typeof YELLOW) ?? "sun"] ?? YELLOW.sun);

function ShapeArt({ s }: { s: Shape }) {
  switch (s.kind) {
    case "sphere": {
      const main = fill(s.tone);
      // Flat, with one soft lighter disc towards the top left: a sphere, still flat.
      return (
        <g>
          <circle cx={s.x} cy={s.y} r={s.r} fill={main} />
          <circle cx={s.x - s.r * 0.28} cy={s.y - s.r * 0.3} r={s.r * 0.55} fill="#ffffff" opacity={0.18} />
        </g>
      );
    }
    case "pill":
      return <rect x={s.x - s.w / 2} y={s.y - s.h / 2} width={s.w} height={s.h} rx={Math.min(s.w, s.h) / 2} fill={fill(s.tone)} transform={`rotate(${s.turn} ${s.x} ${s.y})`} />;
    case "arch":
      return <path d={`M ${s.x - s.r} ${s.y} A ${s.r} ${s.r} 0 0 1 ${s.x + s.r} ${s.y}`} fill="none" stroke={fill(s.tone)} strokeWidth={s.thick} strokeLinecap="round" />;
    case "ripple":
      return (
        <g fill="none" stroke={YELLOW.light}>
          {Array.from({ length: s.rings }, (_, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r + (i + 1) * 46} strokeWidth={14 - i * 3} opacity={0.75 - i * 0.16} />
          ))}
        </g>
      );
  }
}

/** One full-size layer of the picture: its own element, so it can drift by itself. */
function Layer({ children, className, style }: { children: React.ReactNode; className: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const Scene = memo(function Scene({ name }: { name: SceneName }) {
  const { waves, shapes } = SCENES[name];
  const free = shapes.filter((s) => s.behind === undefined);
  return (
    <div className="scene" data-scene={name}>
      {waves.map((wave, i) => (
        <div key={i} className="scene__depth">
          {/* Shapes that sit under this wave: drawn just before it. */}
          {shapes.some((s) => s.behind === i) && (
            <Layer className="scene__shapes">
              {shapes.filter((s) => s.behind === i).map((s, k) => (
                <ShapeArt key={k} s={s} />
              ))}
            </Layer>
          )}
          <Layer
            className={`scene__wave scene__wave--${wave.side}`}
            style={{ "--drift": `${wave.drift}s`, "--reach": `${wave.reach}px`, "--delay": `${-i * 7}s` } as CSSProperties}
          >
            <path d={wavePath(wave)} fill={BLUE[wave.tone]} />
          </Layer>
        </div>
      ))}
      <Layer className="scene__shapes scene__shapes--front">
        {free.map((s, k) => (
          <ShapeArt key={k} s={s} />
        ))}
      </Layer>
    </div>
  );
});
