import { memo, type CSSProperties, type ReactNode } from "react";

/*
 * Inside the site, each page stands on its own picture: flat, layered waves in many blues
 * that slowly come and go, with soft shadows between them, and on them, in gold and blue,
 * a simple sign of what the page is for (the kind of sign everyone reads at once, like a
 * person on a door). Soft shapes only: curves, rounded rectangles, rounded triangles.
 *
 *   Home           a sun rising out of the sea      a new day, everything in one place
 *   Network        stars joined, soft green rain    people joined to people
 *   Connections    two people, a link between       you and someone you know
 *   Your batch     a crowd, a few in gold           you, among your batch
 *   Groups         small huddles, each in a ring    people who share something
 *   Messages       speech bubbles                   talking
 *   Notifications  rings going out                  something reaching you
 *   Events         a pavilion with lights           somewhere to be, something on
 *   The board      notices pinned up                jobs and notices
 *   Ask a senior   steps rising to the sun          the way, shown by those who went first
 *   A profile      one person in a ring             you
 *   The gallery    photos laid out                  photos
 *   Causes         a heart                          giving
 *   Settings       switches                         your settings
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
  | "steady"
  | "beach";

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
  | { kind: "line"; swell: Swell; width: number; fade?: number; stroke?: string }
  | { kind: "block"; x: number; y: number; w: number; h: number; round: number; fill?: string; outline?: number; stroke?: string; turn?: number; fade?: number }
  | { kind: "peak"; x: number; y: number; w: number; h: number; fill: string; round?: number; fade?: number; turn?: number }
  | { kind: "dome"; x: number; y: number; r: number; fill: string }
  | { kind: "path"; d: string; fill?: string; stroke?: string; width?: number; fade?: number; transform?: string }
  | { kind: "text"; x: number; y: number; size: number; fill: string; text: string }
  | { kind: "sparkle"; x: number; y: number; r: number; fill: string; fade?: number }
  | { kind: "gear"; x: number; y: number; r: number; teeth: number; fill: string; hub: string }
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

/* ---------- Signs, drawn from rounded parts ---------- */

/** A person, as on a sign: a round head over rounded shoulders (an upside-down U). */
function person(x: number, base: number, s: number, fill: string): Shape[] {
  const w = 54 * s;
  const h = 46 * s;
  return [
    { kind: "path", d: `M ${x - w / 2} ${base} V ${base - h + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${base - h + w / 2} V ${base} Z`, fill },
    { kind: "circle", x, y: base - h - 20 * s, r: 16 * s, fill }
  ];
}

/**
 * A crowd: rows of people melded together, the back rows smaller and deeper blue, and a few
 * in gold in the middle: you and yours, among everyone.
 */
function crowd(x0: number, x1: number, base: number, s: number, seed: number, gold = 3): Shape[] {
  const rand = seeded(seed);
  const rows = [
    { scale: 0.7, lift: 70, tone: B[1] },
    { scale: 0.85, lift: 36, tone: B[2] },
    { scale: 1, lift: 0, tone: B[0] }
  ];
  const out: Shape[] = [];
  const middle = (x0 + x1) / 2;
  rows.forEach((row, r) => {
    const step = 46 * s * row.scale;
    const golds = new Set<number>();
    const count = Math.floor((x1 - x0) / step);
    // A few gold ones near the middle of the front two rows.
    if (r > 0) for (let g = 0; g < (r === 2 ? gold : gold - 1); g++) golds.add(Math.floor(count / 2 - 1 + g * 1.4 + (rand() - 0.5) * 2));
    for (let i = 0; i <= count; i++) {
      const x = x0 + i * step + (r % 2 ? step / 2 : 0) + (rand() - 0.5) * 6 * s;
      const near = 1 - Math.min(1, Math.abs(x - middle) / ((x1 - x0) / 2));
      out.push(...person(x, base - row.lift * s, s * row.scale * (0.92 + rand() * 0.16), golds.has(i) ? GOLD.core : row.tone));
      void near;
    }
  });
  return out;
}

/** A speech bubble: a rounded box with a little tail, filled or drawn in gold. */
function bubble(x: number, y: number, w: number, h: number, fill: string | null, tail: "left" | "right"): Shape[] {
  const tx = tail === "left" ? x - w / 2 + 34 : x + w / 2 - 34;
  const dir = tail === "left" ? -1 : 1;
  const tailPath = `M ${tx - 14} ${y + h / 2 - 4} Q ${tx + dir * 6} ${y + h / 2 + 18} ${tx + dir * 26} ${y + h / 2 + 30} Q ${tx + dir * 10} ${y + h / 2 + 12} ${tx + 14} ${y + h / 2 - 4} Z`;
  return fill
    ? [
        { kind: "block", x, y, w, h, round: h / 2.4, fill },
        { kind: "path", d: tailPath, fill },
        ...[-1, 0, 1].map((k): Shape => ({ kind: "circle", x: x + k * 26, y, r: 7, fill: GOLD.light, fade: 0.9 }))
      ]
    : [
        { kind: "block", x, y, w, h, round: h / 2.4, outline: 3, fade: 0.85 },
        { kind: "path", d: tailPath, stroke: GOLD.line, width: 3, fade: 0.85 },
        ...[-0.25, 0.05].map((k): Shape => ({ kind: "block", x: x + k * w * 0.6, y: y - 10 + (k > 0 ? 20 : 0), w: w * 0.5, h: 8, round: 4, fill: GOLD.line, fade: 0.6 }))
      ];
}

/** A notice pinned up: a paper, a few lines of writing, a pin. */
function notice(x: number, y: number, w: number, h: number, turn: number, pin: string): Shape[] {
  const lines = [0.2, 0.38, 0.56].map((t, i): Shape => ({ kind: "block", x: x - w * 0.08 * (i % 2), y: y - h / 2 + h * t + 14, w: w * (i === 1 ? 0.62 : 0.72), h: 9, round: 4.5, fill: B[5], turn }));
  return [
    { kind: "block", x: x + 6, y: y + 8, w, h, round: 12, fill: B[0], fade: 0.5, turn },
    { kind: "block", x, y, w, h, round: 12, fill: "#eaf2fd", turn },
    ...lines,
    { kind: "circle", x, y: y - h / 2 + 10, r: 11, fill: pin }
  ];
}

/** A photo in its frame: a little sun and hills inside. */
function frame(x: number, y: number, w: number, h: number, turn: number): Shape[] {
  return [
    { kind: "block", x, y, w, h, round: 14, fill: "#eaf2fd", turn },
    { kind: "block", x, y: y - 6, w: w - 28, h: h - 46, round: 8, fill: B[5], turn },
    { kind: "peak", x: x - w * 0.12, y: y + h / 2 - 30, w: w * 0.5, h: h * 0.4, fill: B[1], round: 10, turn },
    { kind: "peak", x: x + w * 0.16, y: y + h / 2 - 30, w: w * 0.4, h: h * 0.3, fill: GREEN[1], round: 10, turn },
    { kind: "circle", x: x + w * 0.22, y: y - h * 0.18, r: h * 0.09, fill: GOLD.core }
  ];
}

/** A heart, soft at every edge. */
function heart(x: number, y: number, s: number, fill: string): Shape {
  return {
    kind: "path",
    d: `M ${x} ${y + 70 * s} C ${x - 20 * s} ${y + 50 * s} ${x - 90 * s} ${y + 10 * s} ${x - 90 * s} ${y - 30 * s} C ${x - 90 * s} ${y - 70 * s} ${x - 40 * s} ${y - 85 * s} ${x} ${y - 45 * s} C ${x + 40 * s} ${y - 85 * s} ${x + 90 * s} ${y - 70 * s} ${x + 90 * s} ${y - 30 * s} C ${x + 90 * s} ${y + 10 * s} ${x + 20 * s} ${y + 50 * s} ${x} ${y + 70 * s} Z`,
    fill
  };
}

/** A switch, on or off. */
function toggle(x: number, y: number, s: number, on: boolean): Shape[] {
  return [
    { kind: "block", x, y, w: 120 * s, h: 56 * s, round: 28 * s, fill: on ? GOLD.core : B[1] },
    { kind: "circle", x: x + (on ? 32 : -32) * s, y, r: 22 * s, fill: "#ffffff" }
  ];
}

/**
 * A crowd as an animator draws one: not every person, but a mass of heads and shoulders
 * melded into one shape, and in front of it a few people drawn properly, some in gold.
 */
function crowdMass(x0: number, x1: number, base: number, s: number, fill: string, seed: number, rise = 0): Shape[] {
  const rand = seeded(seed);
  const head = 15 * s;
  const out: Shape[] = [{ kind: "block", x: (x0 + x1) / 2, y: base - 30 * s - rise, w: x1 - x0, h: 70 * s, round: 30 * s, fill }];
  for (let x = x0 + head; x < x1 - head * 0.5; x += head * (2 + rand() * 0.8)) {
    const lift = rise + (rand() - 0.5) * 12 * s;
    out.push({ kind: "circle", x: x + head * 0.9, y: base - 58 * s - lift, r: head * (1.6 + rand() * 0.3), fill });
    out.push({ kind: "circle", x, y: base - 92 * s - lift, r: head * (0.95 + rand() * 0.2), fill });
  }
  return out;
}

/** A jigsaw piece (100 across before scaling): a knob on its right, or a socket on its left. */
const PIECE_KNOB = "M 10 0 H 90 Q 100 0 100 10 V 35 A 15 15 0 0 1 100 65 V 90 Q 100 100 90 100 H 10 Q 0 100 0 90 V 10 Q 0 0 10 0 Z";
const PIECE_SOCKET = "M 10 0 H 90 Q 100 0 100 10 V 90 Q 100 100 90 100 H 10 Q 0 100 0 90 V 65 A 15 15 0 0 0 0 35 V 10 Q 0 0 10 0 Z";
function puzzle(x: number, y: number, s: number): Shape[] {
  const at = (dx: number, turn: number) => `translate(${x + dx * s} ${y}) rotate(${turn}) scale(${s}) translate(-50 -50)`;
  return [
    { kind: "path", d: PIECE_KNOB, fill: B[0], transform: at(-62, -4) },
    { kind: "path", d: PIECE_SOCKET, fill: GOLD.core, transform: at(70, 5) },
    { kind: "sparkle", x: x + 4 * s, y: y - 70 * s, r: 14 * s, fill: GOLD.light },
    { kind: "sparkle", x: x + 14 * s, y: y + 62 * s, r: 9 * s, fill: "#ffffff", fade: 0.8 }
  ];
}

/** A round table seen from above, people seated around it, one in gold. */
function roundTable(x: number, y: number, s: number, seats = 7): Shape[] {
  const out: Shape[] = [
    { kind: "circle", x, y, r: 120 * s, fill: B[1] },
    { kind: "ring", x, y, r: 120 * s, width: 3 * s, fade: 0.8 },
    { kind: "ring", x, y, r: 26 * s, width: 2.5 * s, fade: 0.7 },
    { kind: "circle", x: x - 40 * s, y: y + 30 * s, r: 9 * s, fill: "#eaf2fd", fade: 0.85 },
    { kind: "circle", x: x + 50 * s, y: y - 20 * s, r: 9 * s, fill: "#eaf2fd", fade: 0.85 }
  ];
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
    const cx = x + Math.cos(a) * 158 * s;
    const cy = y + Math.sin(a) * 158 * s;
    const fill = i === 2 ? GOLD.core : B[0];
    out.push({ kind: "block", x: x + Math.cos(a) * 176 * s, y: y + Math.sin(a) * 176 * s, w: 62 * s, h: 30 * s, round: 15 * s, fill, turn: (a * 180) / Math.PI + 90 });
    out.push({ kind: "circle", x: cx, y: cy, r: 17 * s, fill });
  }
  return out;
}

/** Your card: a member's card, a little turned, with you on it and a gold star. */
function idCard(x: number, y: number, s: number): Shape[] {
  const turn = -7;
  const t = (dx: number, dy: number) => {
    const a = (turn * Math.PI) / 180;
    return [x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a)] as const;
  };
  const [ax, ay] = t(-95, 10);
  const [sx, sy] = t(150, -105);
  return [
    { kind: "block", x: x + 26 * s, y: y + 22 * s, w: 360 * s, h: 230 * s, round: 22 * s, fill: B[0], fade: 0.55, turn: 4 },
    { kind: "block", x, y, w: 360 * s, h: 230 * s, round: 22 * s, fill: "#eaf2fd", turn },
    { kind: "block", ...pt(t(0, -88)), w: 360 * s, h: 54 * s, round: 22 * s, fill: B[1], turn },
    { kind: "circle", x: ax, y: ay, r: 58 * s, fill: B[5] },
    ...person(ax, ay + 50 * s, 0.95 * s, GOLD.core),
    ...[-14, 18, 50].map((dy, i): Shape => ({ kind: "block", ...pt(t(70, dy)), w: (i === 1 ? 120 : 150) * s, h: 14 * s, round: 7 * s, fill: B[5], turn })),
    { kind: "sparkle", x: sx, y: sy, r: 28 * s, fill: GOLD.core }
  ];
}
const pt = ([x, y]: readonly [number, number]) => ({ x, y });

/** A coin in gold, the rupee on it. */
function coin(x: number, y: number, s: number): Shape[] {
  return [
    { kind: "orb", x, y, r: 54 * s },
    { kind: "ring", x, y, r: 42 * s, width: 3 * s, stroke: GOLD.edge, fade: 0.9 },
    { kind: "text", x, y: y + 2 * s, size: 50 * s, fill: "#b9791a", text: "₹" }
  ];
}

/** A squiggly line, as a cartoonist draws movement: from (x, y) along `angle`. */
function squiggle(x: number, y: number, angle: number, length: number, amp: number, stroke: string, width: number): Shape {
  const a = (angle * Math.PI) / 180;
  const n = 4;
  let d = `M ${x} ${y}`;
  for (let i = 1; i <= n; i++) {
    const t0 = ((i - 0.5) / n) * length;
    const t1 = (i / n) * length;
    const off = (i % 2 ? 1 : -1) * amp;
    const cx = x + Math.cos(a) * t0 - Math.sin(a) * off;
    const cy = y + Math.sin(a) * t0 + Math.cos(a) * off;
    d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${(x + Math.cos(a) * t1).toFixed(1)} ${(y + Math.sin(a) * t1).toFixed(1)}`;
  }
  return { kind: "path", d, stroke, width };
}

/** A heart with its three lines of movement on its outer side. */
function beatingHeart(x: number, y: number, s: number, fill: string, side: 1 | -1): Shape[] {
  return [
    heart(x, y, s, fill),
    squiggle(x + side * 112 * s, y - 70 * s, side > 0 ? -30 : 210, 70 * s, 6 * s, RED[1], 5 * s),
    squiggle(x + side * 124 * s, y - 10 * s, side > 0 ? 0 : 180, 74 * s, 6 * s, RED[0], 5 * s),
    squiggle(x + side * 108 * s, y + 52 * s, side > 0 ? 30 : 150, 66 * s, 6 * s, "#b3262e", 5 * s)
  ];
}

/** A program's window, a gear behind it, and its switches popping out of it. */
function settingsWindow(x: number, y: number, s: number): Shape[] {
  return [
    { kind: "gear", x: x + 150 * s, y: y - 150 * s, r: 92 * s, teeth: 10, fill: "#9aa7b8", hub: "#6f7d91" },
    { kind: "gear", x: x - 190 * s, y: y + 120 * s, r: 48 * s, teeth: 8, fill: "#b5c0ce", hub: "#8a97a9" },
    { kind: "block", x: x + 14 * s, y: y + 16 * s, w: 360 * s, h: 260 * s, round: 18 * s, fill: B[0], fade: 0.5 },
    { kind: "block", x, y, w: 360 * s, h: 260 * s, round: 18 * s, fill: "#eaf2fd" },
    { kind: "block", x, y: y - 106 * s, w: 360 * s, h: 48 * s, round: 18 * s, fill: B[1] },
    { kind: "circle", x: x - 150 * s, y: y - 106 * s, r: 8 * s, fill: RED[1] },
    { kind: "circle", x: x - 124 * s, y: y - 106 * s, r: 8 * s, fill: GOLD.core },
    { kind: "circle", x: x - 98 * s, y: y - 106 * s, r: 8 * s, fill: GREEN[2] },
    ...[-40, 20, 80].map((dy): Shape => ({ kind: "block", x: x - 70 * s, y: y + dy * s, w: 150 * s, h: 14 * s, round: 7 * s, fill: B[5] })),
    // The switches stand out past the window's edge, larger, as if lifting off it.
    ...toggle(x + 150 * s, y - 40 * s, 1.15 * s, true),
    ...toggle(x + 190 * s, y + 20 * s, 1.15 * s, false),
    ...toggle(x + 150 * s, y + 80 * s, 1.15 * s, true)
  ];
}

/** A pavilion: a rounded roof on four pillars, a stage, and a warm light inside. */
function pavilion(x: number, base: number, s: number): Shape[] {
  return [
    { kind: "peak", x, y: base, w: 300 * s, h: 360 * s, fill: GOLD.core, fade: 0.14 },
    { kind: "peak", x, y: base - 380 * s, w: 520 * s, h: 150 * s, fill: B[1] },
    ...[-190, -65, 65, 190].map((dx): Shape => ({ kind: "block", x: x + dx * s, y: base - 190 * s, w: 38 * s, h: 330 * s, round: 14 * s, fill: B[1] })),
    { kind: "block", x, y: base - 368 * s, w: 500 * s, h: 26 * s, round: 10 * s, fill: B[2] },
    { kind: "block", x, y: base - 368 * s, w: 500 * s, h: 26 * s, round: 10 * s, outline: 2.5 * s, fade: 0.8 },
    { kind: "block", x, y: base - 10 * s, w: 560 * s, h: 44 * s, round: 14 * s, fill: B[1] },
    { kind: "lights", x1: x - 270 * s, x2: x + 270 * s, y: base - 340 * s, sag: 50 * s, count: 9, size: s }
  ];
}

/*
 * A tablet and a phone see the top of the page most (the cards cover the rest), so their
 * pictures stand on a horizon there: a deeper blue band behind the page's title (white
 * words read well on it), with the picture on its edge, to the right of the title.
 */
const horizon = (at: number, fill = B[1]): Layer => wave(at, 0.018 * 900, 0.4 * 900, 0.3, "top", fill, 34, 30);

/* ---------- The pictures ---------- */

const C = { w: 1600, h: 1000 };
const T = { w: 1000, h: 1300, lift: 60 };
const P = { w: 420, h: 900 };

/** The sun in the corner with its arcs, and steps rising to it (Ask a senior). */
const sunCorner = (x: number, r: number): Shape[] => [
  { kind: "orb", x, y: 0, r },
  { kind: "arc", x, y: 0, r: r * 1.33, from: 90, to: 180, width: 3, fade: 0.75 },
  { kind: "arc", x, y: 0, r: r * 1.66, from: 95, to: 175, width: 2, fade: 0.5 },
  { kind: "arc", x, y: 0, r: r * 2, from: 100, to: 170, width: 1.5, fade: 0.3 }
];

/** Sand, light to deep: tan into orange. */
const SAND = ["#f6d3a0", "#efbd82", "#e6a465", "#d98a4c"] as const;
/** Foam where the sea meets the sand. */
const foam = (at: number, length: number, shift: number, width = 3): Shape => ({ kind: "line", swell: { at, amp: 10, length, shift }, width, fade: 0.55, stroke: "#ffffff" });

const SCENES: Record<SceneName, Scene> = {
  // Network, the other way: a night beach. Sand in layers of tan and orange, then the sea,
  // then the sky, and in it bright stars joined by fine lines: people joined to people.
  beach: {
    computer: {
      ...C,
      layers: [
        wave(0.36, 30, 1100, 0.2, "top", B[2], 40, 30),
        wave(0.24, 26, 1300, 0.6, "top", B[1], 46, 30),
        wave(0.12, 20, 1500, 0.1, "top", B[0], 52, 30),
        art({ kind: "stars", x: 1100, y: 40, w: 480, h: 320, count: 15, seed: 7 }, { kind: "stars", x: 20, y: 60, w: 260, h: 260, count: 8, seed: 3 }, { kind: "orb", x: 1480, y: 120, r: 38 }),
        wave(0.66, 18, 900, 0.3, "bottom", B[6], 30, 40),
        wave(0.72, 20, 760, 0.7, "bottom", B[5], 26, 50),
        wave(0.78, 22, 640, 0.1, "bottom", B[4], 22, 60),
        art(foam(0.845, 700, 0.4)),
        wave(0.85, 20, 700, 0.4, "bottom", SAND[0], 0, 0),
        wave(0.9, 20, 820, 0.8, "bottom", SAND[1], 0, 0),
        wave(0.945, 16, 900, 0.2, "bottom", SAND[2], 0, 0),
        wave(0.98, 12, 1000, 0.6, "bottom", SAND[3], 0, 0)
      ]
    },
    tablet: {
      ...T,
      layers: [
        wave(0.26, 24, 900, 0.6, "top", B[1], 46, 30),
        wave(0.14, 20, 1100, 0.1, "top", B[0], 52, 30),
        art({ kind: "stars", x: 600, y: 80, w: 380, h: 260, count: 11, seed: 5 }),
        wave(0.8, 18, 700, 0.3, "bottom", B[5], 26, 40),
        wave(0.85, 20, 600, 0.7, "bottom", B[4], 22, 50),
        wave(0.9, 18, 640, 0.4, "bottom", SAND[0], 0, 0),
        wave(0.95, 16, 760, 0.8, "bottom", SAND[2], 0, 0)
      ]
    },
    phone: {
      ...P,
      layers: [
        wave(0.3, 14, 420, 0.6, "top", B[1], 46, 20),
        wave(0.18, 12, 520, 0.1, "top", B[0], 52, 20),
        art({ kind: "stars", x: 220, y: 50, w: 190, h: 200, count: 7, seed: 9, size: 0.8 }),
        wave(0.9, 10, 320, 0.3, "bottom", B[5], 26, 20),
        wave(0.94, 10, 300, 0.4, "bottom", SAND[0], 0, 0),
        wave(0.98, 8, 340, 0.8, "bottom", SAND[2], 0, 0)
      ]
    }
  },

  // Home: a sun rising out of the sea: a new day, everything in one place.
  home: {
    computer: {
      ...C,
      layers: [
        wave(0.12, 36, 820, 0.3, "top", B[2], 34),
        art({ kind: "orb", x: 1340, y: 640, r: 190 }, { kind: "arc", x: 1340, y: 640, r: 260, from: 200, to: 340, width: 3, fade: 0.75 }, { kind: "arc", x: 1340, y: 640, r: 320, from: 210, to: 330, width: 2, fade: 0.45 }),
        wave(0.62, 50, 900, 0.1, "bottom", B[4], 26),
        wave(0.72, 40, 700, 0.5, "bottom", B[5], 20, 80),
        wave(0.84, 34, 560, 0.2, "bottom", B[2], 31)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "orb", x: 840, y: 330, r: 110 }, { kind: "arc", x: 840, y: 330, r: 150, from: 200, to: 340, width: 3, fade: 0.6 }), wave(0.95, 22, 480, 0.3, "bottom", B[4], 26)] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "orb", x: 350, y: 300, r: 60 }, { kind: "arc", x: 350, y: 300, r: 84, from: 200, to: 340, width: 2.5, fade: 0.6 })] }
  },

  // Network (mam's choice), with the stars as the focus: one bright constellation on the
  // right third, a few sparkles, and the rain softer behind them.
  people: {
    computer: {
      ...C,
      layers: [
        wave(0.16, 40, 900, 0.1, "top", B[2], 33, 70),
        art({ kind: "rain", x: 0, y: 120, w: 1600, h: 640, count: 34, seed: 11 }),
        wave(0.74, 44, 760, 0.3, "bottom", B[4], 24),
        wave(0.86, 30, 620, 0.7, "bottom", B[2], 29),
        art(
          { kind: "stars", x: 1150, y: 130, w: 420, h: 480, count: 13, seed: 7, size: 1.9 },
          { kind: "sparkle", x: 1300, y: 210, r: 26, fill: GOLD.light },
          { kind: "sparkle", x: 1520, y: 460, r: 18, fill: "#ffffff", fade: 0.9 },
          { kind: "sparkle", x: 1210, y: 520, r: 12, fill: GOLD.light },
          { kind: "stars", x: 30, y: 300, w: 200, h: 300, count: 6, seed: 3, size: 1.1 }
        )
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "rain", x: 0, y: 0, w: 1000, h: 380, count: 22, seed: 12 }), art({ kind: "stars", x: 600, y: 70, w: 380, h: 290, count: 10, seed: 5, size: 1.5 }, { kind: "sparkle", x: 700, y: 120, r: 18, fill: GOLD.light }), wave(0.95, 22, 480, 0.3, "bottom", B[4], 26)] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "rain", x: 0, y: 0, w: 420, h: 320, count: 14, seed: 13 }), art({ kind: "stars", x: 220, y: 50, w: 190, h: 250, count: 7, seed: 9, size: 1.1 }, { kind: "sparkle", x: 260, y: 90, r: 12, fill: GOLD.light })] }
  },

  // Connections: two pieces about to fit together.
  connections: {
    computer: { ...C, layers: [art(puzzle(1465, 420, 1.15)), wave(0.76, 36, 700, 0.1, "bottom", B[4], 22, 80), wave(0.88, 26, 520, 0.5, "bottom", B[2], 28)] },
    tablet: { ...T, layers: [horizon(0.254), art(puzzle(830, 250, 0.95))] },
    phone: { ...P, layers: [horizon(0.36), art(puzzle(340, 220, 0.6))] }
  },

  // Your batch: a crowd as an animator draws one, a melded mass, and a few people in front,
  // two in gold: you, among your batch.
  batch: {
    computer: {
      ...C,
      layers: [
        art(crowdMass(1290, 1640, 830, 1.3, B[1], 4, 50), crowdMass(1300, 1640, 860, 1.5, B[0], 8), crowdMass(-20, 290, 860, 1.3, B[1], 12)),
        art(person(1400, 880, 1.9, GOLD.core), person(1470, 890, 2.1, "#eaf2fd"), person(1545, 880, 1.9, GOLD.core), person(150, 890, 1.7, GOLD.core)),
        wave(0.9, 18, 600, 0.2, "bottom", B[4], 25),
        wave(0.96, 14, 480, 0.6, "bottom", B[2], 30)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art(crowdMass(560, 1010, 360, 0.95, B[0], 5), person(760, 370, 1.3, GOLD.core), person(830, 374, 1.4, "#eaf2fd"))] },
    phone: { ...P, layers: [horizon(0.36), art(crowdMass(230, 430, 330, 0.55, B[0], 6), person(320, 336, 0.8, GOLD.core), person(360, 338, 0.85, "#eaf2fd"))] }
  },

  // Groups: a round table seen from above, people seated all round it, one in gold.
  groups: {
    computer: { ...C, layers: [wave(0.1, 30, 700, 0.6, "top", B[2], 35), art(roundTable(1468, 430, 0.72)), wave(0.82, 34, 640, 0.5, "bottom", B[4], 28), wave(0.92, 26, 520, 0.2, "bottom", B[2], 23)] },
    tablet: { ...T, layers: [horizon(0.254), art(roundTable(830, 230, 0.6))] },
    phone: { ...P, layers: [horizon(0.36), art(roundTable(345, 220, 0.42, 6))] }
  },

  // Messages: speech going back and forth.
  messages: {
    computer: {
      ...C,
      layers: [
        wave(0.14, 26, 1000, 0.5, "top", B[2], 36),
        art(bubble(1300, 300, 300, 110, B[1], "left"), bubble(1430, 470, 260, 100, null, "right"), bubble(1290, 620, 220, 90, B[0], "left"), bubble(140, 520, 180, 80, null, "right")),
        wave(0.78, 30, 1000, 0.1, "bottom", B[4], 30),
        wave(0.9, 22, 820, 0.4, "bottom", B[2], 24, 80)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art(bubble(780, 180, 220, 84, B[0], "left"), bubble(880, 300, 190, 76, null, "right"))] },
    phone: { ...P, layers: [horizon(0.36), art(bubble(320, 170, 150, 60, B[0], "left"), bubble(355, 270, 120, 52, null, "right"))] }
  },

  // Notifications: something reaching you, in rings going out.
  notifications: {
    computer: {
      ...C,
      layers: [
        art({ kind: "ripple", x: 1420, y: 330, r: 70, rings: 4, gap: 56 }, { kind: "orb", x: 1420, y: 330, r: 60 }),
        wave(0.78, 34, 760, 0.3, "bottom", B[4], 26),
        wave(0.9, 24, 560, 0.7, "bottom", B[2], 21, 80)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art({ kind: "ripple", x: 860, y: 230, r: 40, rings: 3, gap: 38 }, { kind: "orb", x: 860, y: 230, r: 36 })] },
    phone: { ...P, layers: [horizon(0.36), art({ kind: "ripple", x: 360, y: 220, r: 24, rings: 3, gap: 24 }, { kind: "orb", x: 360, y: 220, r: 22 })] }
  },

  // Events (mam's choice): a pavilion with lights strung across it, a warm light inside.
  events: {
    computer: { ...C, layers: [art(pavilion(1360, 780, 1), { kind: "lights", x1: -20, x2: 420, y: 150, sag: 70, count: 7 }), wave(0.8, 34, 780, 0.2, "bottom", B[4], 24), wave(0.9, 24, 600, 0.5, "bottom", B[2], 29)] },
    tablet: { ...T, layers: [horizon(0.254), art(pavilion(800, 392, 0.55))] },
    phone: { ...P, layers: [horizon(0.36), art(pavilion(335, 326, 0.26), { kind: "lights", x1: -10, x2: 240, y: 40, sag: 30, count: 6, size: 0.6 })] }
  },

  // The board: notices pinned up.
  board: {
    computer: {
      ...C,
      layers: [
        art(notice(1250, 330, 190, 240, -6, RED[0]), notice(1470, 300, 170, 210, 5, GOLD.core), notice(1360, 590, 200, 230, 3, GREEN[1]), notice(150, 560, 150, 190, -4, GOLD.core)),
        wave(0.84, 30, 700, 0.1, "bottom", B[4], 25),
        wave(0.92, 22, 520, 0.6, "bottom", B[2], 21, 80)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art(notice(760, 200, 130, 160, -6, RED[0]), notice(900, 230, 120, 150, 5, GOLD.core))] },
    phone: { ...P, layers: [horizon(0.36), art(notice(318, 210, 80, 104, -6, RED[0]), notice(385, 230, 72, 96, 6, GOLD.core))] }
  },

  // Ask a senior (mam's choice): a sun in the corner, its light in arcs, and steps rising to it.
  ask: {
    computer: {
      ...C,
      layers: [
        art(
          sunCorner(1600, 240),
          { kind: "block", x: 1150, y: 760, w: 170, h: 46, round: 14, outline: 3, fade: 0.85 },
          { kind: "block", x: 1290, y: 680, w: 170, h: 46, round: 14, outline: 3, fade: 0.7 },
          { kind: "block", x: 1430, y: 600, w: 170, h: 46, round: 14, outline: 3, fade: 0.55 },
          { kind: "stars", x: 60, y: 300, w: 240, h: 300, count: 6, seed: 21 }
        ),
        wave(0.74, 42, 820, 0.4, "bottom", B[4], 27),
        wave(0.86, 30, 640, 0.1, "bottom", B[2], 23)
      ]
    },
    tablet: { ...T, layers: [art(sunCorner(1000, 220)), wave(0.95, 22, 480, 0.3, "bottom", B[4], 27)] },
    phone: { ...P, layers: [art(sunCorner(420, 120))] }
  },

  // A profile: your card, with you on it.
  profile: {
    computer: { ...C, layers: [art(idCard(1462, 400, 0.66)), wave(0.8, 30, 900, 0.6, "bottom", B[4], 26), wave(0.9, 22, 700, 0.2, "bottom", B[2], 32)] },
    tablet: { ...T, layers: [horizon(0.254), art(idCard(820, 230, 0.6))] },
    phone: { ...P, layers: [horizon(0.36), art(idCard(335, 215, 0.36))] }
  },

  // The gallery: photos laid out.
  gallery: {
    computer: {
      ...C,
      layers: [
        art(frame(1280, 330, 240, 180, -7), frame(1480, 420, 220, 170, 6), frame(1330, 590, 230, 170, 3)),
        wave(0.82, 30, 740, 0.3, "bottom", B[4], 26),
        wave(0.92, 22, 560, 0.7, "bottom", B[2], 22)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art(frame(770, 200, 160, 120, -6), frame(905, 250, 150, 115, 6))] },
    phone: { ...P, layers: [horizon(0.36), art(frame(315, 200, 96, 74, -6), frame(385, 240, 86, 68, 6))] }
  },

  // Causes: two hearts turned to each other, a coin between them, and movement around them:
  // giving, and the warmth that comes back.
  causes: {
    computer: {
      ...C,
      layers: [
        art(beatingHeart(1395, 380, 0.62, RED[1], -1), beatingHeart(1530, 380, 0.62, RED[0], 1), coin(1462, 440, 0.7)),
        wave(0.78, 46, 820, 0.2, "bottom", B[4], 25),
        wave(0.9, 32, 620, 0.5, "bottom", B[2], 30)
      ]
    },
    tablet: { ...T, layers: [horizon(0.254), art(beatingHeart(760, 220, 0.6, RED[1], -1), beatingHeart(890, 220, 0.6, RED[0], 1), coin(825, 280, 0.62))] },
    phone: { ...P, layers: [horizon(0.36), art(beatingHeart(300, 205, 0.36, RED[1], -1), beatingHeart(378, 205, 0.36, RED[0], 1), coin(339, 240, 0.38))] }
  },

  // Settings and the desk: a program's window, a gear turning behind it, its switches
  // lifting off it.
  steady: {
    computer: { ...C, layers: [art(settingsWindow(1450, 430, 0.66)), wave(0.84, 16, 1200, 0.2, "bottom", B[4], 34), wave(0.92, 12, 900, 0.1, "bottom", B[2], 26)] },
    tablet: { ...T, layers: [horizon(0.254), art(settingsWindow(800, 240, 0.55))] },
    phone: { ...P, layers: [horizon(0.36), art(settingsWindow(320, 215, 0.34))] }
  }
};

/* ---------- The pattern behind it all ---------- */

/*
 * Behind each picture, a quiet pattern of small line drawings, tiled across the page, as
 * WhatsApp and Telegram do behind a chat: white lines only a little lighter than the blue,
 * so the page never looks bare and never looks busy. Each page's pattern is made of its own
 * things (bubbles for Messages, pins and papers for the board, people for Network).
 */
const ICON: Record<string, string> = {
  person: "M12 3.5a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 0 1 0-6.4Z M5.5 20.5v-3a6.5 6.5 0 0 1 13 0v3Z",
  bubble: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16A2.5 2.5 0 0 1 4 13.5Z",
  star: "M12 3.5l2.4 5 5.4.7-4 3.7 1 5.4L12 15.8l-4.8 2.5 1-5.4-4-3.7 5.4-.7Z",
  heart: "M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20Z",
  calendar: "M5 7h14v12H5Z M5 10.5h14 M8.5 4.5v4 M15.5 4.5v4",
  pin: "M12 21s-6-6-6-10.5a6 6 0 0 1 12 0C18 15 12 21 12 21Z M12 8.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4Z",
  paper: "M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M9.5 12h6 M9.5 15.5h6",
  photo: "M4 6h16v12H4Z M7 15l3.5-4 3 3 2-2 2.5 3",
  bell: "M6.5 16.5h11l-1.5-2.2V10a4 4 0 0 0-8 0v4.3Z M10.5 19a1.6 1.6 0 0 0 3 0",
  cap: "M2.5 9.5L12 5l9.5 4.5L12 14Z M6.5 11.5v4c3 2.2 8 2.2 11 0v-4 M21.5 9.5v5",
  link: "M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1 M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1",
  bulb: "M9 17h6 M10 20h4 M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.1V17h4v-1.4c0-.8.5-1.6 1.2-2.1A5.5 5.5 0 0 0 12 3.5Z",
  toggle: "M3.5 12A4.5 4.5 0 0 1 8 7.5h8a4.5 4.5 0 0 1 0 9H8A4.5 4.5 0 0 1 3.5 12Z M16 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z",
  ring: "M12 5a7 7 0 1 1 0 14a7 7 0 0 1 0-14Z",
  sun: "M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8Z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4",
  briefcase: "M4 8h16v11H4Z M9 8V5.5h6V8 M4 13h16",
  book: "M4 5.5c3-1 5.5-.5 8 1c2.5-1.5 5-2 8-1V19c-3-1-5.5-.5-8 1c-2.5-1.5-5-2-8-1Z M12 6.5V20",
  wave: "M3 12c2-2 4-2 6 0s4 2 6 0s4-2 6 0",
  dot: "M12 10.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z"
};

const PATTERN: Record<SceneName, string[]> = {
  home: ["sun", "bubble", "person", "calendar", "heart", "cap", "star", "wave"],
  people: ["person", "star", "link", "person", "dot", "star"],
  beach: ["star", "dot", "wave", "star", "person"],
  connections: ["person", "link", "person", "bubble", "dot"],
  batch: ["cap", "person", "star", "book", "dot"],
  groups: ["person", "ring", "person", "bubble", "dot"],
  messages: ["bubble", "dot", "bubble", "heart", "person"],
  notifications: ["bell", "dot", "ring", "star"],
  events: ["calendar", "star", "pin", "sun", "dot"],
  board: ["pin", "paper", "briefcase", "bulb", "dot"],
  ask: ["bulb", "bubble", "book", "cap", "star"],
  profile: ["person", "star", "briefcase", "book", "dot"],
  gallery: ["photo", "sun", "heart", "star", "dot"],
  causes: ["heart", "sun", "person", "dot", "heart"],
  steady: ["toggle", "dot", "ring", "toggle", "wave"]
};

/** One tile of a page's pattern, as an SVG image the browser repeats across the page. */
function patternTile(name: SceneName): string {
  const icons = PATTERN[name];
  const rand = seeded(name.length * 97 + icons.length * 13);
  const size = 300;
  const cells = 4;
  const step = size / cells;
  let body = "";
  let n = 0;
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++) {
      const icon = ICON[icons[n++ % icons.length]];
      const x = col * step + step / 2 + (row % 2 ? step / 2 : 0) + (rand() - 0.5) * 14;
      const y = row * step + step / 2 + (rand() - 0.5) * 14;
      const scale = 1.05 + rand() * 0.45;
      const turn = Math.round((rand() - 0.5) * 50);
      body += `<path d="${icon}" transform="translate(${(x % size).toFixed(1)} ${y.toFixed(1)}) rotate(${turn}) scale(${scale.toFixed(2)}) translate(-12 -12)"/>`;
    }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.13">${body}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

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
      return <path d={swell(s.swell, width, height)} fill="none" stroke={s.stroke ?? GOLD.line} strokeWidth={s.width} strokeLinecap="round" opacity={s.fade ?? 0.7} />;
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
      return <path d={s.d} fill={s.fill ?? "none"} stroke={s.stroke ?? "none"} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" opacity={s.fade ?? 1} transform={s.transform} />;
    case "text":
      return (
        <text x={s.x} y={s.y} fontSize={s.size} fontWeight={800} fill={s.fill} textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
          {s.text}
        </text>
      );
    case "sparkle":
      return <path d={`M ${s.x} ${s.y - s.r} Q ${s.x} ${s.y} ${s.x + s.r} ${s.y} Q ${s.x} ${s.y} ${s.x} ${s.y + s.r} Q ${s.x} ${s.y} ${s.x - s.r} ${s.y} Q ${s.x} ${s.y} ${s.x} ${s.y - s.r} Z`} fill={s.fill} opacity={s.fade ?? 1} />;
    case "gear": {
      const tooth = (s.r * 2 * Math.PI) / s.teeth / 2;
      return (
        <g>
          {Array.from({ length: s.teeth }, (_, i) => (
            <rect key={i} x={s.x - tooth / 2} y={s.y - s.r - tooth * 0.75} width={tooth} height={tooth * 1.3} rx={tooth * 0.3} fill={s.fill} transform={`rotate(${(i * 360) / s.teeth} ${s.x} ${s.y})`} />
          ))}
          <circle cx={s.x} cy={s.y} r={s.r} fill={s.fill} />
          <circle cx={s.x} cy={s.y} r={s.r * 0.42} fill={s.hub} />
        </g>
      );
    }
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
    <div className="scene" data-scene={name} style={{ "--pattern": patternTile(name) } as CSSProperties}>
      <div className="scene__pattern" />
      {(["computer", "tablet", "phone"] as const).map((size) => (
        <VersionArt key={size} version={scene[size]} id={`glow-${name}-${size}`} size={size} />
      ))}
    </div>
  );
});
