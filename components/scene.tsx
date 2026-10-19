import { memo, type CSSProperties, type ReactNode } from "react";

/*
 * Inside the site, each page stands on its own picture: flat, layered waves in many blues
 * that slowly come and go, with soft shadows between them, and a scene drawn on them in
 * silhouette: Bengaluru and HKBK in the college's colours (blues, gold, with hints of green
 * and red). All shapes are soft: curves, rounded rectangles, rounded triangles. One idea per
 * page, chosen for what it makes people feel:
 *
 *   Home           sunrise behind Vidhana Soudha        a new day, here, together
 *   Network        stars joined, soft green rain        people joined to people
 *   Connections    a bridge between two hills           two people meeting
 *   Your batch     caps tossed over the college arch    the day you all finished
 *   Groups         a grove of rain trees                many, growing together
 *   Messages       two boats on the water               a conversation across a distance
 *   Notifications  a lighthouse                         something reaching you
 *   Events         a pavilion with lights strung        somewhere to be, something on
 *   The board      a skyline rising to the right        careers, progress
 *   Ask a senior   steps rising to the sun              the way, shown by those who went first
 *   A profile      one tree on its own hill             one person, their own story
 *   The gallery    the Lalbagh glass house              light, and things kept to look at
 *   Causes         two suns, held close                 warmth given and received
 *   Settings       calm hills, level lines              steadiness
 *
 * Each picture comes in three versions (a phone, a tablet, a computer), each drawn for its
 * own shape of screen, so nothing is stretched or cropped awkwardly. Only the one that fits
 * is shown. Each wave is its own element, so it drifts on the graphics card; nothing moves
 * for anyone who prefers less motion, or on a phone.
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

/* ---------- Colours ---------- */

/** Blues, deepest to lightest. */
const B = ["#123f8f", "#1a52b3", "#1f5fc4", "#2a6ad3", "#3479df", "#4489e8", "#5a9bf0", "#7fb3f5"] as const;
const GOLD = { core: "#ffd978", edge: "#e2a62e", line: "#f3c65a", light: "#ffe680" } as const;
const GREEN = ["#17795a", "#1f9a6c", "#38b886", "#7ef0b4"] as const;
const RED = ["#d9474f", "#f07167"] as const;

/* ---------- The shapes ---------- */

type Swell = { at: number; amp: number; length: number; shift: number };

type Shape =
  | { kind: "orb"; x: number; y: number; r: number }
  | { kind: "circle"; x: number; y: number; r: number; fill: string; fade?: number }
  | { kind: "ring"; x: number; y: number; r: number; width: number; stroke?: string; fade?: number }
  | { kind: "arc"; x: number; y: number; r: number; from: number; to: number; width: number; stroke?: string; fade?: number }
  | { kind: "ripple"; x: number; y: number; r: number; rings: number; gap: number }
  | { kind: "line"; swell: Swell; width: number; fade?: number }
  | { kind: "block"; x: number; y: number; w: number; h: number; round: number; fill?: string; outline?: number; stroke?: string; turn?: number; fade?: number }
  | { kind: "peak"; x: number; y: number; w: number; h: number; fill: string; round?: number; fade?: number; turn?: number }
  | { kind: "dome"; x: number; y: number; r: number; fill: string }
  | { kind: "path"; d: string; fill?: string; stroke?: string; width?: number; fade?: number }
  | { kind: "stars"; x: number; y: number; w: number; h: number; count: number; seed: number; size?: number }
  | { kind: "rain"; x: number; y: number; w: number; h: number; count: number; seed: number }
  | { kind: "lights"; x1: number; x2: number; y: number; sag: number; count: number; size?: number };

/** A wave that drifts: where its crest sits (0 top … 1 bottom), its swells, its colour. */
type Wave = Swell & { side: "bottom" | "top"; fill: string; drift: number; reach: number };

/** A picture: waves and drawings, in the order they're laid down (first is furthest back). */
type Layer = { wave: Wave } | { art: Shape[] };
/** `lift` raises the drawings (not the waves) by that much: a tablet's scene sits higher. */
type Version = { w: number; h: number; layers: Layer[]; lift?: number };
type Scene = { phone: Version; tablet: Version; computer: Version };

const wave = (at: number, amp: number, length: number, shift: number, side: Wave["side"], fill: string, drift = 26, reach = 60): Layer => ({
  wave: { at, amp, length, shift, side, fill, drift, reach }
});
const art = (...shapes: (Shape | Shape[])[]): Layer => ({ art: shapes.flat() });

/** A smooth swell across a picture `width` wide and `height` tall. */
function swell({ at, amp, length, shift }: Swell, width: number, height: number): string {
  const y = at * height;
  const start = -width * 0.3 - shift * length;
  let d = `M ${start} ${y} Q ${start + length / 4} ${y - amp} ${start + length / 2} ${y}`;
  for (let x = start + length / 2; x < width * 1.3; x += length / 2) d += ` T ${x + length / 2} ${y}`;
  return d;
}

function wavePath(wv: Wave, width: number, height: number): string {
  const edge = wv.side === "bottom" ? height + 40 : -40;
  return `${swell(wv, width, height)} L ${width * 1.3 + wv.length} ${edge} L ${-width * 0.3 - wv.shift * wv.length} ${edge} Z`;
}

/** A small seeded random: the same picture on every visit. */
function seeded(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 2 ** 32;
  };
}

/** A triangle (point up) with its corners rounded off. */
function roundedTriangle(x: number, y: number, w: number, h: number, r = 14): string {
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

/* ---------- Silhouettes, drawn from rounded parts ---------- */

/** Vidhana Soudha: a long building on its plinth, a columned porch, the great dome and two small ones. */
function vidhanaSoudha(x: number, base: number, s: number, fill: string, lit: string): Shape[] {
  const body = 110 * s;
  const top = base - 26 * s - body;
  const columns = Array.from({ length: 6 }, (_, i): Shape => ({ kind: "block", x: x - 75 * s + i * 30 * s, y: base - 26 * s - 66 * s, w: 9 * s, h: 104 * s, round: 4 * s, fill: lit, fade: 0.55 }));
  return [
    { kind: "block", x, y: base - 13 * s, w: 560 * s, h: 26 * s, round: 8 * s, fill },
    { kind: "block", x, y: base - 26 * s - body / 2, w: 480 * s, h: body, round: 10 * s, fill },
    { kind: "block", x, y: base - 26 * s - 70 * s, w: 210 * s, h: 150 * s, round: 8 * s, fill },
    ...columns,
    { kind: "peak", x, y: top - 4 * s, w: 230 * s, h: 44 * s, fill, round: 10 * s },
    { kind: "block", x, y: top - 34 * s, w: 130 * s, h: 64 * s, round: 10 * s, fill },
    { kind: "dome", x, y: top - 64 * s, r: 72 * s, fill },
    { kind: "block", x, y: top - 150 * s, w: 6 * s, h: 34 * s, round: 3 * s, fill },
    { kind: "circle", x, y: top - 170 * s, r: 7 * s, fill: GOLD.core },
    { kind: "dome", x: x - 200 * s, y: top, r: 30 * s, fill },
    { kind: "dome", x: x + 200 * s, y: top, r: 30 * s, fill },
    // A few windows lit gold, one warm red.
    ...[-170, -130, 130, 170].map((dx, i): Shape => ({ kind: "block", x: x + dx * s, y: base - 26 * s - 60 * s, w: 16 * s, h: 26 * s, round: 8 * s, fill: i === 2 ? RED[1] : GOLD.light, fade: 0.75 }))
  ];
}

/** A rain tree: a trunk, and a wide crown of overlapping rounds in greens. */
function tree(x: number, base: number, s: number, shade = 0): Shape[] {
  const g = (i: number) => GREEN[Math.min(2, i + shade)];
  return [
    { kind: "block", x, y: base - 50 * s, w: 18 * s, h: 100 * s, round: 8 * s, fill: B[0] },
    { kind: "circle", x: x - 55 * s, y: base - 120 * s, r: 52 * s, fill: g(0) },
    { kind: "circle", x: x + 55 * s, y: base - 118 * s, r: 56 * s, fill: g(0) },
    { kind: "circle", x, y: base - 150 * s, r: 70 * s, fill: g(1) },
    { kind: "circle", x: x - 25 * s, y: base - 170 * s, r: 34 * s, fill: g(2), fade: 0.8 }
  ];
}

/** A tower with a rounded top and a few lit windows. */
function tower(x: number, base: number, w: number, h: number, fill: string, seed: number): Shape[] {
  const rand = seeded(seed);
  const windows: Shape[] = [];
  for (let row = 0; row < Math.floor(h / 46); row++)
    for (let col = 0; col < 2; col++)
      if (rand() < 0.4) windows.push({ kind: "block", x: x - w / 4 + (col * w) / 2, y: base - 30 - row * 46, w: w / 5, h: 18, round: 5, fill: rand() < 0.15 ? RED[1] : GOLD.light, fade: 0.8 });
  return [{ kind: "block", x, y: base - h / 2, w, h, round: Math.min(18, w / 3), fill }, ...windows];
}

/** A graduation cap in mid-air: its board, its crown, and the tassel. */
function cap(x: number, y: number, s: number, turn: number, fill: string, tassel: string): Shape[] {
  return [
    { kind: "block", x, y: y + 22 * s, w: 70 * s, h: 34 * s, round: 10 * s, fill, turn },
    { kind: "block", x, y, w: 120 * s, h: 120 * s, round: 14 * s, fill, turn: turn + 45 },
    { kind: "path", d: `M ${x} ${y} Q ${x + 40 * s} ${y + 10 * s} ${x + 46 * s} ${y + 52 * s}`, stroke: tassel, width: 4 * s, fade: 0.95 },
    { kind: "circle", x: x + 46 * s, y: y + 56 * s, r: 7 * s, fill: tassel }
  ];
}

/** The Lalbagh glass house: an arched hall of glass, its frame in gold. */
function glassHouse(x: number, base: number, s: number): Shape[] {
  const w = 300 * s;
  const h = 200 * s;
  const ribs = Array.from({ length: 7 }, (_, i): Shape => {
    const t = (i + 1) / 8;
    const rx = x - w / 2 + w * t;
    const ry = base - h * Math.sqrt(1 - (2 * t - 1) ** 2);
    return { kind: "path", d: `M ${rx} ${base} L ${rx} ${ry}`, stroke: GOLD.line, width: 2 * s, fade: 0.6 };
  });
  const hall = `M ${x - w / 2} ${base} A ${w / 2} ${h} 0 0 1 ${x + w / 2} ${base} Z`;
  const wingL = `M ${x - w / 2 - 150 * s} ${base} A ${100 * s} ${110 * s} 0 0 1 ${x - w / 2 + 50 * s} ${base} Z`;
  const wingR = `M ${x + w / 2 - 50 * s} ${base} A ${100 * s} ${110 * s} 0 0 1 ${x + w / 2 + 150 * s} ${base} Z`;
  return [
    { kind: "path", d: wingL, fill: B[7], fade: 0.35 },
    { kind: "path", d: wingR, fill: B[7], fade: 0.35 },
    { kind: "path", d: hall, fill: B[7], fade: 0.42 },
    ...ribs,
    { kind: "path", d: hall, stroke: GOLD.line, width: 3 * s, fade: 0.85 },
    { kind: "path", d: wingL, stroke: GOLD.line, width: 2 * s, fade: 0.6 },
    { kind: "path", d: wingR, stroke: GOLD.line, width: 2 * s, fade: 0.6 },
    { kind: "block", x, y: base + 8 * s, w: w + 340 * s, h: 16 * s, round: 8 * s, fill: B[1] }
  ];
}

/** A lighthouse on a rock, its light reaching out. */
function lighthouse(x: number, base: number, s: number): Shape[] {
  return [
    { kind: "peak", x: x - 260 * s, y: base - 252 * s, w: 90 * s, h: 520 * s, fill: GOLD.core, fade: 0.16, turn: -90 },
    { kind: "circle", x, y: base + 30 * s, r: 120 * s, fill: B[0] },
    { kind: "path", d: `M ${x - 40 * s} ${base - 20 * s} L ${x - 26 * s} ${base - 230 * s} Q ${x} ${base - 240 * s} ${x + 26 * s} ${base - 230 * s} L ${x + 40 * s} ${base - 20 * s} Z`, fill: "#f4f7fb" },
    { kind: "block", x, y: base - 150 * s, w: 76 * s, h: 22 * s, round: 8 * s, fill: RED[0] },
    { kind: "block", x, y: base - 80 * s, w: 82 * s, h: 22 * s, round: 8 * s, fill: RED[0] },
    { kind: "block", x, y: base - 252 * s, w: 46 * s, h: 34 * s, round: 10 * s, fill: GOLD.core },
    { kind: "dome", x, y: base - 268 * s, r: 30 * s, fill: B[0] }
  ];
}

/** A boat with a rounded hull and a soft sail. */
function boat(x: number, base: number, s: number, sail: string, facing: 1 | -1): Shape[] {
  return [
    { kind: "path", d: `M ${x - 80 * s} ${base - 20 * s} Q ${x} ${base + 30 * s} ${x + 80 * s} ${base - 20 * s} Z`, fill: B[0] },
    { kind: "block", x, y: base - 90 * s, w: 6 * s, h: 140 * s, round: 3 * s, fill: B[0] },
    { kind: "peak", x: x + facing * 34 * s, y: base - 32 * s, w: 70 * s, h: 120 * s, fill: sail, round: 12 * s }
  ];
}

/** Two hills and an arched bridge between them. */
function bridge(x: number, base: number, s: number): Shape[] {
  const span = 260 * s;
  const deck = base - 150 * s;
  const hangers = Array.from({ length: 7 }, (_, i): Shape => {
    const t = (i + 1) / 8;
    const hx = x - span / 2 + span * t;
    const hy = deck - 110 * s * 4 * t * (1 - t);
    return { kind: "path", d: `M ${hx} ${deck} L ${hx} ${hy}`, stroke: GOLD.line, width: 2 * s, fade: 0.7 };
  });
  return [
    { kind: "circle", x: x - span / 2 - 140 * s, y: base + 60 * s, r: 260 * s, fill: GREEN[0] },
    { kind: "circle", x: x + span / 2 + 140 * s, y: base + 80 * s, r: 260 * s, fill: GREEN[1] },
    { kind: "block", x, y: deck, w: span + 120 * s, h: 14 * s, round: 7 * s, fill: B[0] },
    { kind: "path", d: `M ${x - span / 2} ${deck} Q ${x} ${deck - 220 * s} ${x + span / 2} ${deck}`, stroke: GOLD.line, width: 7 * s },
    ...hangers
  ];
}

/** A pavilion: a rounded roof on four pillars, a stage, and a warm light inside. */
function pavilion(x: number, base: number, s: number): Shape[] {
  return [
    { kind: "peak", x, y: base - 10 * s, w: 300 * s, h: 360 * s, fill: GOLD.core, fade: 0.14 },
    { kind: "peak", x, y: base - 380 * s, w: 520 * s, h: 150 * s, fill: B[0] },
    ...[-190, -65, 65, 190].map((dx): Shape => ({ kind: "block", x: x + dx * s, y: base - 200 * s, w: 38 * s, h: 330 * s, round: 14 * s, fill: B[0] })),
    { kind: "block", x, y: base - 368 * s, w: 500 * s, h: 26 * s, round: 10 * s, fill: B[1] },
    { kind: "block", x, y: base - 368 * s, w: 500 * s, h: 26 * s, round: 10 * s, outline: 2.5 * s, fade: 0.8 },
    { kind: "block", x, y: base - 10 * s, w: 560 * s, h: 44 * s, round: 14 * s, fill: B[0] },
    { kind: "lights", x1: x - 270 * s, x2: x + 270 * s, y: base - 340 * s, sag: 50 * s, count: 9, size: s }
  ];
}

/*
 * A tablet and a phone see the top of the page most (the cards cover the rest), so their
 * pictures stand on a horizon there: a deeper blue band behind the page's title (white
 * words read well on it), with the scene standing on its edge, to the right of the title.
 */
const horizon = (at: number, fill = B[1]): Layer => wave(at, 0.018 * 900, 0.4 * 900, 0.3, "top", fill, 34, 30);

/* ---------- The pictures ---------- */

const C = { w: 1600, h: 1000 };
const T = { w: 1000, h: 1300, lift: 60 };
const P = { w: 420, h: 900 };

const SCENES: Record<SceneName, Scene> = {
  home: {
    computer: {
      ...C,
      layers: [
        wave(0.12, 36, 820, 0.3, "top", B[1], 34),
        art({ kind: "orb", x: 1330, y: 560, r: 200 }, { kind: "arc", x: 1330, y: 560, r: 270, from: 200, to: 340, width: 3, fade: 0.7 }, { kind: "arc", x: 1330, y: 560, r: 330, from: 210, to: 330, width: 2, fade: 0.4 }),
        art(vidhanaSoudha(1330, 760, 0.9, B[0], GOLD.light), tree(980, 770, 0.8, 0), tree(1660, 770, 0.9, 1)),
        wave(0.74, 40, 700, 0.5, "bottom", B[4], 20, 80),
        wave(0.86, 32, 560, 0.2, "bottom", B[2], 31)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 840, y: 250, r: 110 }), art(vidhanaSoudha(780, 392, 0.55, B[0], GOLD.light), tree(1000, 396, 0.5, 1)), wave(0.95, 22, 480, 0.3, "bottom", B[4], 26)] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "orb", x: 360, y: 200, r: 56 }), art(vidhanaSoudha(330, 326, 0.3, B[0], GOLD.light))] }
  },

  people: {
    computer: {
      ...C,
      layers: [
        wave(0.16, 40, 900, 0.1, "top", B[1], 33, 70),
        art({ kind: "rain", x: 0, y: 120, w: 1600, h: 640, count: 70, seed: 11 }),
        wave(0.7, 44, 760, 0.3, "bottom", B[4], 24),
        wave(0.82, 30, 620, 0.7, "bottom", B[2], 29),
        art({ kind: "stars", x: 1180, y: 170, w: 400, h: 520, count: 14, seed: 7 }, { kind: "stars", x: 20, y: 260, w: 220, h: 420, count: 8, seed: 3 })
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "rain", x: 0, y: 0, w: 1000, h: 380, count: 40, seed: 12 }), art({ kind: "stars", x: 620, y: 60, w: 360, h: 300, count: 11, seed: 5 }), wave(0.95, 22, 480, 0.3, "bottom", B[4], 26)] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "rain", x: 0, y: 0, w: 420, h: 320, count: 24, seed: 13 }), art({ kind: "stars", x: 230, y: 60, w: 180, h: 240, count: 7, seed: 9, size: 0.8 })] }
  },

  connections: {
    computer: { ...C, layers: [art(bridge(1330, 760, 1)), wave(0.8, 32, 600, 0.1, "bottom", B[4], 22, 80), wave(0.9, 24, 520, 0.5, "bottom", B[2], 28)] },
    tablet: { ...T, layers: [horizon(0.254), art(bridge(830, 392, 0.42))] },
    phone: { ...P, layers: [horizon(0.36), art(bridge(330, 326, 0.3))] }
  },

  batch: {
    computer: {
      ...C,
      layers: [
        art(
          { kind: "arc", x: 1360, y: 860, r: 330, from: 180, to: 360, width: 5, fade: 0.85 },
          { kind: "arc", x: 1360, y: 860, r: 260, from: 180, to: 360, width: 3, fade: 0.6 },
          cap(1250, 300, 1, -18, B[0], GOLD.core),
          cap(1460, 220, 0.8, 22, B[0], RED[1]),
          cap(1540, 420, 0.7, -8, B[1], GOLD.core),
          { kind: "circle", x: 1370, y: 380, r: 6, fill: GOLD.light },
          { kind: "circle", x: 1180, y: 460, r: 5, fill: GOLD.light }
        ),
        wave(0.8, 36, 700, 0.2, "bottom", B[4], 25),
        wave(0.9, 26, 520, 0.6, "bottom", B[2], 30)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "arc", x: 800, y: 392, r: 170, from: 180, to: 360, width: 4, fade: 0.85 }, cap(760, 180, 0.6, -14, B[0], GOLD.core), cap(900, 120, 0.45, 20, B[0], RED[1]))] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "arc", x: 340, y: 326, r: 80, from: 180, to: 360, width: 3, fade: 0.85 }, cap(320, 150, 0.36, -14, B[0], GOLD.core), cap(390, 100, 0.28, 20, B[0], RED[1]))] }
  },

  groups: {
    computer: {
      ...C,
      layers: [
        wave(0.1, 30, 700, 0.6, "top", B[1], 35),
        art({ kind: "orb", x: 1450, y: 330, r: 90 }),
        art(tree(1200, 780, 1, 0), tree(1420, 790, 1.2, 1), tree(1590, 780, 0.9, 0), tree(150, 800, 0.9, 1)),
        wave(0.8, 34, 640, 0.5, "bottom", B[4], 28),
        wave(0.9, 26, 520, 0.2, "bottom", B[2], 23)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 900, y: 180, r: 70 }), art(tree(720, 396, 0.7, 0), tree(860, 400, 0.85, 1), tree(980, 396, 0.6, 0))] },
    phone: { ...P, layers: [horizon(0.36), art(tree(300, 330, 0.38, 0), tree(370, 332, 0.46, 1))] }
  },

  messages: {
    computer: {
      ...C,
      layers: [
        wave(0.14, 26, 1000, 0.5, "top", B[1], 36),
        art({ kind: "orb", x: 1340, y: 380, r: 90 }, { kind: "line", swell: { at: 0.58, amp: 14, length: 900, shift: 0.2 }, width: 2, fade: 0.5 }),
        art(boat(1180, 700, 1, "#f4f7fb", 1), boat(1500, 712, 0.85, RED[1], -1)),
        wave(0.72, 30, 1000, 0.1, "bottom", B[4], 30),
        wave(0.86, 22, 820, 0.4, "bottom", B[2], 24, 80)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 880, y: 200, r: 70 }), art(boat(700, 392, 0.6, "#f4f7fb", 1), boat(880, 396, 0.5, RED[1], -1))] },
    phone: { ...P, layers: [horizon(0.36), art(boat(290, 326, 0.3, "#f4f7fb", 1), boat(375, 328, 0.26, RED[1], -1))] }
  },

  notifications: {
    computer: { ...C, layers: [art({ kind: "ripple", x: 1430, y: 360, r: 60, rings: 3, gap: 60 }), art(lighthouse(1430, 760, 1)), wave(0.8, 34, 760, 0.3, "bottom", B[4], 26), wave(0.9, 24, 560, 0.7, "bottom", B[2], 21, 80)] },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "ripple", x: 860, y: 230, r: 40, rings: 3, gap: 40 }), art(lighthouse(860, 392, 0.55))] },
    phone: { ...P, layers: [horizon(0.36), art(lighthouse(360, 326, 0.3))] }
  },

  events: {
    computer: {
      ...C,
      layers: [art(pavilion(1360, 790, 1), { kind: "lights", x1: -20, x2: 420, y: 150, sag: 70, count: 7 }), wave(0.84, 30, 780, 0.2, "bottom", B[4], 24), wave(0.92, 22, 600, 0.5, "bottom", B[2], 29)]
    },
    tablet: { ...T, layers: [horizon(0.254), art(pavilion(800, 392, 0.55))] },
    phone: { ...P, layers: [horizon(0.36), art(pavilion(335, 326, 0.26), { kind: "lights", x1: -10, x2: 240, y: 40, sag: 30, count: 6, size: 0.6 })] }
  },

  board: {
    computer: {
      ...C,
      layers: [
        art({ kind: "orb", x: 1520, y: 250, r: 80 }),
        art(tower(1140, 790, 70, 220, B[1], 1), tower(1230, 790, 80, 300, B[0], 2), tower(1330, 790, 70, 380, B[1], 3), tower(1430, 790, 90, 470, B[0], 4), tower(1540, 790, 76, 540, B[1], 5)),
        wave(0.8, 30, 700, 0.1, "bottom", B[4], 25),
        wave(0.9, 22, 520, 0.6, "bottom", B[2], 21, 80)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 930, y: 120, r: 50 }), art(tower(700, 392, 48, 150, B[1], 6), tower(770, 392, 56, 210, B[0], 7), tower(850, 392, 52, 270, B[1], 8), tower(930, 392, 60, 330, B[0], 9))] },
    phone: { ...P, layers: [horizon(0.36), art(tower(300, 326, 28, 90, B[1], 9), tower(340, 326, 32, 130, B[0], 10), tower(385, 326, 30, 170, B[1], 11))] }
  },

  ask: {
    computer: {
      ...C,
      layers: [
        art(
          { kind: "orb", x: 1600, y: 0, r: 240 },
          { kind: "arc", x: 1600, y: 0, r: 320, from: 90, to: 180, width: 3, fade: 0.75 },
          { kind: "arc", x: 1600, y: 0, r: 400, from: 95, to: 175, width: 2, fade: 0.5 },
          { kind: "arc", x: 1600, y: 0, r: 480, from: 100, to: 170, width: 1.5, fade: 0.3 },
          { kind: "block", x: 1150, y: 760, w: 170, h: 46, round: 14, outline: 3, fade: 0.85 },
          { kind: "block", x: 1290, y: 680, w: 170, h: 46, round: 14, outline: 3, fade: 0.7 },
          { kind: "block", x: 1430, y: 600, w: 170, h: 46, round: 14, outline: 3, fade: 0.55 },
          { kind: "stars", x: 60, y: 300, w: 240, h: 300, count: 6, seed: 21 }
        ),
        wave(0.8, 36, 820, 0.4, "bottom", B[4], 27),
        wave(0.9, 26, 640, 0.1, "bottom", B[2], 23)
      ]
    },
    tablet: { ...T, layers: [art({ kind: "orb", x: 1000, y: 0, r: 220 }, { kind: "arc", x: 1000, y: 0, r: 300, from: 90, to: 180, width: 3, fade: 0.7 }, { kind: "arc", x: 1000, y: 0, r: 370, from: 95, to: 175, width: 2, fade: 0.45 }), wave(0.95, 22, 480, 0.3, "bottom", B[4], 27)] },
    phone: { ...P, layers: [art({ kind: "orb", x: 420, y: 0, r: 120 }, { kind: "arc", x: 420, y: 0, r: 165, from: 90, to: 180, width: 2.5, fade: 0.7 }, { kind: "arc", x: 420, y: 0, r: 205, from: 95, to: 175, width: 1.5, fade: 0.45 })] }
  },

  profile: {
    computer: {
      ...C,
      layers: [
        art({ kind: "orb", x: 1400, y: 300, r: 110 }, { kind: "ring", x: 1400, y: 300, r: 160, width: 2, fade: 0.45 }),
        art({ kind: "circle", x: 1300, y: 1160, r: 520, fill: GREEN[0] }, tree(1300, 680, 1.1, 1)),
        wave(0.84, 30, 900, 0.6, "bottom", B[4], 26),
        wave(0.93, 22, 700, 0.2, "bottom", B[2], 32)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 900, y: 170, r: 70 }), art({ kind: "circle", x: 820, y: 700, r: 330, fill: GREEN[0] }, tree(820, 382, 0.7, 1))] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "orb", x: 380, y: 130, r: 44 }), art({ kind: "circle", x: 340, y: 560, r: 250, fill: GREEN[0] }, tree(340, 318, 0.36, 1))] }
  },

  gallery: {
    computer: {
      ...C,
      layers: [
        art({ kind: "orb", x: 1450, y: 300, r: 90 }),
        art(glassHouse(1320, 760, 1), tree(1580, 760, 0.6, 1)),
        wave(0.82, 30, 740, 0.3, "bottom", B[4], 26),
        wave(0.92, 22, 560, 0.7, "bottom", B[2], 22)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 920, y: 160, r: 60 }), art(glassHouse(780, 392, 0.55))] },
    phone: { ...P, layers: [horizon(0.36), art(glassHouse(320, 326, 0.3))] }
  },

  causes: {
    computer: {
      ...C,
      layers: [
        art({ kind: "orb", x: 1330, y: 440, r: 120 }, { kind: "circle", x: 1460, y: 440, r: 120, fill: RED[1], fade: 0.85 }, { kind: "ring", x: 1395, y: 440, r: 220, width: 2, fade: 0.5 }),
        wave(0.74, 46, 820, 0.2, "bottom", B[4], 25),
        wave(0.86, 32, 620, 0.5, "bottom", B[2], 30)
      ]
    },
    tablet: { ...T, layers: [art({ kind: "orb", x: 760, y: 220, r: 100 }, { kind: "circle", x: 870, y: 220, r: 100, fill: RED[1], fade: 0.85 }), wave(0.95, 22, 480, 0.3, "bottom", B[4], 25)] },
    phone: { ...P, layers: [art({ kind: "orb", x: 340, y: 140, r: 56 }, { kind: "circle", x: 395, y: 150, r: 50, fill: RED[1], fade: 0.85 })] }
  },

  steady: {
    computer: {
      ...C,
      layers: [
        art({ kind: "orb", x: 1450, y: 320, r: 70 }, { kind: "line", swell: { at: 0.3, amp: 8, length: 1400, shift: 0.1 }, width: 2.5, fade: 0.5 }),
        art({ kind: "circle", x: 1250, y: 1300, r: 600, fill: GREEN[0] }, { kind: "circle", x: 300, y: 1350, r: 620, fill: GREEN[1], fade: 0.9 }),
        wave(0.86, 14, 1200, 0.2, "bottom", B[4], 34),
        wave(0.94, 10, 900, 0.1, "bottom", B[2], 26)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "circle", x: 800, y: 760, r: 400, fill: GREEN[0] }, { kind: "orb", x: 880, y: 180, r: 60 })] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "circle", x: 330, y: 610, r: 300, fill: GREEN[0] }, { kind: "orb", x: 370, y: 150, r: 40 })] }
  }
};

/* ---------- Drawing ---------- */

const point = (x: number, y: number, r: number, deg: number) => [x + r * Math.cos((deg * Math.PI) / 180), y + r * Math.sin((deg * Math.PI) / 180)] as const;

function ShapeArt({ s, glow, width, height }: { s: Shape; glow: string; width: number; height: number }) {
  switch (s.kind) {
    case "orb":
      return <circle cx={s.x} cy={s.y} r={s.r} fill={`url(#${glow})`} />;
    case "circle":
      return <circle cx={s.x} cy={s.y} r={s.r} fill={s.fill} opacity={s.fade ?? 1} />;
    case "ring":
      return <circle cx={s.x} cy={s.y} r={s.r} fill="none" stroke={s.stroke ?? GOLD.line} strokeWidth={s.width} opacity={s.fade ?? 0.8} />;
    case "arc": {
      const [x1, y1] = point(s.x, s.y, s.r, s.from);
      const [x2, y2] = point(s.x, s.y, s.r, s.to);
      return <path d={`M ${x1} ${y1} A ${s.r} ${s.r} 0 ${s.to - s.from > 180 ? 1 : 0} 1 ${x2} ${y2}`} fill="none" stroke={s.stroke ?? GOLD.line} strokeWidth={s.width} strokeLinecap="round" opacity={s.fade ?? 0.8} />;
    }
    case "ripple":
      return (
        <g fill="none" stroke={GOLD.line}>
          {Array.from({ length: s.rings }, (_, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r + (i + 1) * s.gap} strokeWidth={3 - i * 0.5} opacity={0.7 - i * 0.18} />
          ))}
        </g>
      );
    case "line":
      return <path d={swell(s.swell, width, height)} fill="none" stroke={GOLD.line} strokeWidth={s.width} strokeLinecap="round" opacity={s.fade ?? 0.7} />;
    case "block":
      return (
        <rect
          x={s.x - s.w / 2}
          y={s.y - s.h / 2}
          width={s.w}
          height={s.h}
          rx={s.round}
          fill={s.outline ? "none" : (s.fill ?? B[0])}
          stroke={s.outline ? (s.stroke ?? GOLD.line) : "none"}
          strokeWidth={s.outline}
          opacity={s.fade ?? 1}
          transform={s.turn ? `rotate(${s.turn} ${s.x} ${s.y})` : undefined}
        />
      );
    case "peak":
      return <path d={roundedTriangle(s.x, s.y, s.w, s.h, s.round)} fill={s.fill} opacity={s.fade ?? 1} transform={s.turn ? `rotate(${s.turn} ${s.x} ${s.y})` : undefined} />;
    case "dome":
      return <path d={`M ${s.x - s.r} ${s.y} A ${s.r} ${s.r} 0 0 1 ${s.x + s.r} ${s.y} Z`} fill={s.fill} />;
    case "path":
      return <path d={s.d} fill={s.fill ?? "none"} stroke={s.stroke ?? "none"} strokeWidth={s.width} strokeLinecap="round" opacity={s.fade ?? 1} />;
    case "stars": {
      const rand = seeded(s.seed);
      const k = s.size ?? 1;
      const pts = Array.from({ length: s.count }, () => [s.x + rand() * s.w, s.y + rand() * s.h, (3 + rand() * 4) * k] as const);
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
          {links.map(([a, b], n) => (
            <line key={n} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={GOLD.core} strokeWidth={2 * k} opacity={0.75} strokeLinecap="round" />
          ))}
          {pts.map(([x, y, r], n) => (
            <g key={n}>
              <circle cx={x} cy={y} r={r * 2.6} fill={GOLD.core} opacity={0.18} />
              <circle cx={x} cy={y} r={r} fill={GOLD.light} />
            </g>
          ))}
        </g>
      );
    }
    case "rain": {
      const rand = seeded(s.seed);
      return (
        <g stroke={GREEN[3]} strokeLinecap="round">
          {Array.from({ length: s.count }, (_, n) => {
            const x = s.x + rand() * s.w;
            const y = s.y + rand() * s.h;
            const len = 40 + rand() * 90;
            return <line key={n} x1={x} y1={y} x2={x - len * 0.18} y2={y + len} strokeWidth={1.5 + rand() * 1.5} opacity={0.25 + rand() * 0.4} />;
          })}
        </g>
      );
    }
    case "lights": {
      const k = s.size ?? 1;
      const at = (t: number) => [s.x1 + (s.x2 - s.x1) * t, s.y + s.sag * 4 * t * (1 - t)] as const;
      return (
        <g>
          <path d={`M ${s.x1} ${s.y} Q ${(s.x1 + s.x2) / 2} ${s.y + s.sag * 2} ${s.x2} ${s.y}`} fill="none" stroke={GOLD.line} strokeWidth={1.5} opacity={0.6} />
          {Array.from({ length: s.count }, (_, n) => {
            const [x, y] = at((n + 1) / (s.count + 1));
            const warm = n % 4 === 2;
            return (
              <g key={n}>
                <circle cx={x} cy={y + 8 * k} r={14 * k} fill={warm ? RED[1] : GOLD.core} opacity={0.22} />
                <circle cx={x} cy={y + 8 * k} r={6 * k} fill={warm ? RED[1] : GOLD.light} />
              </g>
            );
          })}
        </g>
      );
    }
  }
}

function Svg({ children, className, width, height, style }: { children: ReactNode; className: string; width: number; height: number; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function VersionArt({ version, id, size }: { version: Version; id: string; size: keyof Scene }) {
  const { w, h, layers } = version;
  return (
    <div className={`scene__version scene__version--${size}`}>
      {layers.map((layer, i) =>
        "wave" in layer ? (
          <Svg
            key={i}
            className={`scene__wave scene__wave--${layer.wave.side}`}
            width={w}
            height={h}
            style={{ "--drift": `${layer.wave.drift}s`, "--reach": `${layer.wave.reach}px`, "--delay": `${-i * 7}s` } as CSSProperties}
          >
            <path d={wavePath(layer.wave, w, h)} fill={layer.wave.fill} />
          </Svg>
        ) : (
          <Svg key={i} className="scene__shapes" width={w} height={h}>
            <defs>
              {/* The suns' soft light: brighter at the heart, a deeper gold at the rim. */}
              <radialGradient id={`${id}-${i}`} cx="38%" cy="34%" r="70%">
                <stop offset="0%" stopColor={GOLD.core} />
                <stop offset="100%" stopColor={GOLD.edge} />
              </radialGradient>
            </defs>
            <g transform={version.lift ? `translate(0 ${-version.lift})` : undefined}>
              {layer.art.map((s, k) => (
                <ShapeArt key={k} s={s} glow={`${id}-${i}`} width={w} height={h} />
              ))}
            </g>
          </Svg>
        )
      )}
    </div>
  );
}

export const Scene = memo(function Scene({ name }: { name: SceneName }) {
  const scene = SCENES[name];
  return (
    <div className="scene" data-scene={name}>
      {(["computer", "tablet", "phone"] as const).map((size) => (
        <VersionArt key={size} version={scene[size]} id={`glow-${name}-${size}`} size={size} />
      ))}
    </div>
  );
});
