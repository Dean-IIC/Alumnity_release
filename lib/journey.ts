/**
 * The intro journey: where each era sits in the "world", how the ink line runs between
 * them, when everything happens, and where the camera is. Pure, so it can be tested.
 */
import { ERAS, type Era } from "./eras";
import { easeInOutCubic, seededRandom, windowProgress, type Point } from "./ink";

export const SHOT_SIZE = {
  landscape: { width: 1000, height: 750 },
  portrait: { width: 640, height: 853 }
} as const;

/** World units below a photo taken by its caption. */
const CAPTION_SPACE = 170;

export type Shot = {
  era: Era;
  centre: Point;
  width: number;
  height: number;
  rotation: number;
};

export type WorldLayout = {
  width: number;
  height: number;
  shots: Shot[];
  /** Line segments: entry → first era, between eras, last era → exit. */
  segments: string[];
};

type Viewport = { width: number; height: number };

/** Era centres along the route, for wide screens (right → left) and tall screens (top → bottom). */
const ROUTES = {
  wide: {
    width: 4600,
    height: 2400,
    centres: [
      { x: 3850, y: 700 },
      { x: 2850, y: 1560 },
      { x: 1950, y: 700 },
      { x: 1150, y: 1580 },
      { x: 420, y: 760 }
    ],
    entry: { x: 4700, y: 1700 },
    exit: { x: -700, y: 1700 }
  },
  tall: {
    width: 1500,
    height: 4900,
    centres: [
      { x: 820, y: 560 },
      { x: 560, y: 1480 },
      { x: 860, y: 2400 },
      { x: 520, y: 3330 },
      { x: 880, y: 4250 }
    ],
    entry: { x: 1700, y: 1250 },
    exit: { x: -400, y: 5200 }
  }
} as const;

const ROTATIONS = [-1.6, 1.4, -1, 1.8, -1.3];

/** One S-shaped pen stroke from `a` to `b`, like the animatic's line. */
function strokeBetween(a: Point, b: Point, random: () => number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const bend = (0.2 + random() * 0.14) * (random() > 0.5 ? 1 : -1);
  const c1 = { x: a.x + ux * length * 0.32 - uy * length * bend, y: a.y + uy * length * 0.32 + ux * length * bend };
  const c2 = { x: b.x - ux * length * 0.32 + uy * length * bend * 0.8, y: b.y - uy * length * 0.32 - ux * length * bend * 0.8 };
  const f = (n: number) => n.toFixed(1);
  return `M${f(a.x)} ${f(a.y)}C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(b.x)} ${f(b.y)}`;
}

export function worldLayout(viewport: Viewport): WorldLayout {
  const route = viewport.width / viewport.height < 0.9 ? ROUTES.tall : ROUTES.wide;
  const shots = ERAS.map((era, i) => ({
    era,
    centre: route.centres[i],
    ...SHOT_SIZE[era.photo.orientation],
    rotation: ROTATIONS[i]
  }));
  const random = seededRandom(23);
  const points = [route.entry, ...route.centres, route.exit];
  const segments = points.slice(1).map((point, i) => strokeBetween(points[i], point, random));
  return { width: route.width, height: route.height, shots, segments };
}

/* ---------- Timing ---------- */

export const STOPS = ERAS.length;
/** The pen lands on the first era at this time… */
const FIRST_ARRIVAL = 1300;
/** …and on each following era this much later. */
export const STOP_INTERVAL = 3200;
const CAMERA_TRAVEL = 1000;

export type StopTiming = {
  arrive: number;
  blot: [number, number];
  sketch: [number, number];
  ink: [number, number];
};

export function stopTiming(index: number): StopTiming {
  const arrive = FIRST_ARRIVAL + index * STOP_INTERVAL;
  return {
    arrive,
    blot: [arrive, arrive + 300],
    sketch: [arrive + 150, arrive + 900],
    ink: [arrive + 900, arrive + 2300]
  };
}

/** When segment `index` is drawn. Segment 0 runs in from the edge; segment i ends on stop i. */
export function segmentTiming(index: number): [number, number] {
  if (index === 0) return [300, FIRST_ARRIVAL];
  // The pen leaves an era right after landing and keeps moving while it blooms.
  return [stopTiming(index - 1).arrive + 100, stopTiming(index).arrive];
}

const LAST_BLOOM = stopTiming(STOPS - 1).ink[1];

/** After the last era: everything at once, then the identity, then the site. */
export const FINALE = {
  /** Camera pulls back to show every era. */
  zoomOut: [LAST_BLOOM + 50, LAST_BLOOM + 1150],
  /** "8,838 students since 1998." */
  total: [LAST_BLOOM + 800, LAST_BLOOM + 1300],
  /** Held for about a second, then every photo shrinks away. */
  shrink: [LAST_BLOOM + 2200, LAST_BLOOM + 3000],
  /** Hand-drawn patterns grow in from both sides. */
  patterns: [LAST_BLOOM + 2800, LAST_BLOOM + 4300],
  /** The Alumnity wordmark arrives on a swoosh… */
  swoosh: [LAST_BLOOM + 3500, LAST_BLOOM + 4500],
  /** …with the college's name beneath. */
  byline: [LAST_BLOOM + 4350, LAST_BLOOM + 4900],
  /** The lockup floats to the top-left corner… */
  float: [LAST_BLOOM + 5500, LAST_BLOOM + 6400],
  /** …while the site is revealed from the centre outwards. */
  reveal: [LAST_BLOOM + 6100, LAST_BLOOM + 7400]
} satisfies Record<string, [number, number]>;

export const INTRO_END = FINALE.reveal[1] + 100;

/* ---------- Camera ---------- */

export type Camera = { x: number; y: number; scale: number };

export function focusOn(shot: Shot, viewport: Viewport): Camera {
  const scale = Math.min((viewport.width * 0.86) / shot.width, (viewport.height - 190) / (shot.height + CAPTION_SPACE * 0.6));
  return { x: shot.centre.x, y: shot.centre.y + CAPTION_SPACE * 0.25, scale };
}

/** A camera that shows every era at once, with room at the bottom for the total. */
export function overview(layout: WorldLayout, viewport: Viewport): Camera {
  const left = Math.min(...layout.shots.map((s) => s.centre.x - s.width / 2));
  const right = Math.max(...layout.shots.map((s) => s.centre.x + s.width / 2));
  const top = Math.min(...layout.shots.map((s) => s.centre.y - s.height / 2));
  const bottom = Math.max(...layout.shots.map((s) => s.centre.y + s.height / 2 + CAPTION_SPACE));
  const scale = Math.min((viewport.width * 0.9) / (right - left), (viewport.height * 0.74) / (bottom - top));
  return { x: (left + right) / 2, y: (top + bottom) / 2 + (viewport.height * 0.06) / scale, scale };
}

const travel = (from: Camera, to: Camera, u: number, dip: number): Camera => {
  const e = easeInOutCubic(u);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    scale: from.scale * (to.scale / from.scale) ** e * (1 - dip * Math.sin(Math.PI * u))
  };
};

/**
 * Where the camera is at time `t`. It holds on an era while it blooms, then travels to
 * the next so it arrives just as the pen lands there, pulling back a little mid-way.
 * After the last era it pulls back to show them all.
 */
export function cameraAt(t: number, layout: WorldLayout, viewport: Viewport): Camera {
  const last = focusOn(layout.shots[STOPS - 1], viewport);
  if (t >= FINALE.zoomOut[0]) return travel(last, overview(layout, viewport), windowProgress(t, ...FINALE.zoomOut), 0);

  const first = focusOn(layout.shots[0], viewport);
  let from: Camera = { x: first.x + 130, y: first.y + 170, scale: first.scale * 0.93 };
  let window: [number, number] = [0, FIRST_ARRIVAL + 150];
  let to = first;
  let dip = 0;

  for (let i = 1; i < STOPS; i += 1) {
    const arrive = stopTiming(i).arrive;
    if (t < arrive - CAMERA_TRAVEL + 150) break;
    from = to;
    to = focusOn(layout.shots[i], viewport);
    window = [arrive - CAMERA_TRAVEL + 150, arrive + 150];
    dip = 0.18;
  }

  return travel(from, to, windowProgress(t, ...window), dip);
}
