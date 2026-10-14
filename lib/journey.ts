/**
 * The intro journey: where each era sits in the "world", how the ink line runs between
 * them, when everything happens, and where the camera is. Pure, so it can be tested.
 */
import { BATCHES, ERAS, LAST_FULL_BATCH, type Era } from "./eras";
import { seededRandom, windowProgress, type Point } from "./ink";
import { passing, settle, smoothstep } from "./motion";

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

/** Era centres along the route, for wide screens (right → left) and tall screens (bottom → top). */
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
    // In from the right edge at the photos' height, out past the left: never across the
    // captions and controls along the bottom of the screen.
    entry: { x: 4950, y: 620 },
    exit: { x: -950, y: 860 }
  },
  // Tall screens climb: 1998 at the bottom, rising through the years — never a fall.
  // Phones set captions larger (globals.css), so eras sit far enough apart that one's
  // caption never runs into the photo below it.
  tall: {
    width: 1500,
    height: 6900,
    centres: [
      { x: 860, y: 6100 },
      { x: 600, y: 4750 },
      { x: 860, y: 3400 },
      { x: 600, y: 2050 },
      { x: 840, y: 700 }
    ],
    entry: { x: 1950, y: 5900 },
    exit: { x: -550, y: 620 }
  }
} as const;

const ROTATIONS = [-1.6, 1.4, -1, 1.8, -1.3];

/**
 * One pen stroke from `a` to `b` that never crosses a caption. Captions sit below each
 * photo, so the stroke leaves `a` sideways at the photo's height and arrives at `b`
 * sideways too. Between, it sweeps around the side away from the text: on wide screens
 * toward the next photo (an S), on tall ones around the side opposite the next photo's
 * caption (a C). A little seeded wobble keeps it hand-drawn.
 */
function strokeBetween(a: Point, b: Point, tall: boolean, edge: boolean, random: () => number): string {
  const wobble = () => (random() - 0.5) * 90;
  let c1: Point;
  let c2: Point;
  if (edge) {
    // In from, or out past, the edge of the screen: nearly level, at the photo's height.
    c1 = { x: a.x + (b.x - a.x) * 0.35, y: a.y + wobble() };
    c2 = { x: b.x + (a.x - b.x) * 0.35, y: b.y + wobble() };
  } else if (tall) {
    // Round the side away from the next photo: its caption hangs below it, toward the middle.
    const side = b.x < TALL_MIDDLE ? 1 : -1;
    c1 = { x: a.x + side * 650, y: a.y + wobble() };
    c2 = { x: b.x + side * 650, y: b.y + wobble() };
  } else {
    const reach = Math.abs(b.x - a.x) * 0.55;
    const toward = Math.sign(b.x - a.x) || -1;
    c1 = { x: a.x + toward * reach, y: a.y + wobble() };
    c2 = { x: b.x - toward * reach, y: b.y + wobble() };
  }
  const f = (n: number) => n.toFixed(1);
  return `M${f(a.x)} ${f(a.y)}C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(b.x)} ${f(b.y)}`;
}

/** Tall-route photos sit either side of this line; their captions hang toward it. */
const TALL_MIDDLE = 730;

/** The area a photo's caption takes up below it, in world units (tests keep the line out). */
export function captionBox(shot: Shot, tall: boolean) {
  const halfWidth = tall ? 380 : 260;
  const top = shot.centre.y + shot.height * 0.46;
  return { left: shot.centre.x - halfWidth, right: shot.centre.x + halfWidth, top, bottom: top + (tall ? 340 : 200) };
}

export function worldLayout(viewport: Viewport): WorldLayout {
  const route = viewport.width / viewport.height < 0.9 ? ROUTES.tall : ROUTES.wide;
  const shots = ERAS.map((era, i) => ({
    era,
    centre: route.centres[i],
    ...SHOT_SIZE[era.photo.orientation],
    rotation: ROTATIONS[i]
  }));
  const tall = route === ROUTES.tall;
  const random = seededRandom(23);
  const points = [route.entry, ...route.centres, route.exit];
  const segments = points
    .slice(1)
    .map((point, i) => strokeBetween(points[i], point, tall, i === 0 || i === points.length - 2, random));
  return { width: route.width, height: route.height, shots, segments };
}

/* ---------- The line as a timeline ---------- */

export type BatchMark = {
  year: number;
  students: number;
  /** The stroke it sits on (stroke i runs from era i − 1 to era i). */
  segment: number;
  /** How far along that stroke, by length: kept to the visible middle, clear of the photos. */
  along: number;
};

/**
 * One mark for every batch between the eras, so the line reads as HKBK's timeline. Era
 * years have their photos; the batches in between sit on the strokes joining them, in
 * order, spread over the stretch between the two photos.
 */
export function batchMarks(): BatchMark[] {
  const marks: BatchMark[] = [];
  for (let i = 1; i < ERAS.length; i += 1) {
    const from = ERAS[i - 1].year;
    const to = ERAS[i].year;
    const last = Math.min(to - 1, LAST_FULL_BATCH);
    for (let year = from + 1; year <= last; year += 1) {
      const students = BATCHES[year];
      if (!students) continue;
      marks.push({ year, students, segment: i, along: MARKS_FROM + (MARKS_TO - MARKS_FROM) * ((year - from) / (to - from)) });
    }
  }
  return marks;
}

/** Marks spread over this stretch of each stroke: past the photo it leaves, short of the next. */
export const MARKS_FROM = 0.24;
export const MARKS_TO = 0.8;

/** Where the background years and ink splats sit: on a stroke, then out to one side. */
export type Anchor = { segment: number; along: number; offset: number };

/** The college's founding year, from its crest ("Estd 1997"). */
export const FOUNDED = 1997;

/**
 * The background: every year from the founding on, as many times as will fit, in an even
 * brick-laid grid over the whole world (and its margins, which the slower background
 * layer brings into view). An even grid reads as texture, not clutter.
 */
export function backdropYears(layout: WorldLayout): { year: number; x: number; y: number }[] {
  const tall = layout.height > layout.width;
  const cellX = tall ? 760 : 620;
  const cellY = tall ? 400 : 320;
  const margin = 1600;
  const last = ERAS[ERAS.length - 1].year;
  const span = last - FOUNDED + 1;
  const years: { year: number; x: number; y: number }[] = [];
  let n = 0;
  for (let row = 0, y = -margin; y <= layout.height + margin; row += 1, y += cellY) {
    for (let x = -margin + (row % 2) * (cellX / 2); x <= layout.width + margin; x += cellX) {
      years.push({ year: FOUNDED + (n % span), x, y });
      n += 1;
    }
  }
  return years;
}

/** A few ink spatters flicked off the pen near the line: seeded, so always the same. */
export function inkSplats(): (Anchor & { radius: number; seed: number })[] {
  const random = seededRandom(97);
  const splats: (Anchor & { radius: number; seed: number })[] = [];
  for (let segment = 1; segment < ERAS.length; segment += 1) {
    for (let k = 0; k < 3; k += 1) {
      splats.push({
        segment,
        along: 0.22 + random() * 0.6,
        offset: (random() > 0.5 ? 1 : -1) * (90 + random() * 220),
        radius: 10 + random() * 26,
        seed: Math.floor(random() * 1e6)
      });
    }
  }
  return splats;
}

/** How much slower the background years move than the photos: depth. */
export const BACKDROP_PARALLAX = 0.72;

/** A batch's dot, in world units: area grows with its intake, so growth is visible. */
export const batchDotRadius = (students: number) => 4 + Math.sqrt(students) * 1.05;

/* ---------- Timing ---------- */

export const STOPS = ERAS.length;
/** The pen reaches the first era's photo at this time… */
const FIRST_ARRIVAL = 1600;
/** …and each following era's this much later. */
export const STOP_INTERVAL = 2700;
/** Every photo waits on the paper as a faint black-and-white sketch at this opacity. */
export const GHOST_OPACITY = 0.25;
/** The camera follows the pen this far behind it, so it trails rather than leads. */
const FOLLOW_LAG = 220;

export type StopTiming = {
  /** When the pen passes through the photo's centre. */
  arrive: number;
  blot: [number, number];
  /** The faint sketch firms up to full strength as the pen reaches it… */
  firm: [number, number];
  /** …the ink fills it with colour while the pen passes slowly through… */
  ink: [number, number];
  /** …and the camera frames it until the pen hurries on to the next. */
  framed: [number, number];
};

export function stopTiming(index: number): StopTiming {
  const arrive = FIRST_ARRIVAL + index * STOP_INTERVAL;
  return {
    arrive,
    blot: [arrive - 50, arrive + 250],
    firm: [arrive - 550, arrive + 50],
    ink: [arrive - 200, arrive + 600],
    framed: [arrive - 250, arrive + 950]
  };
}

/**
 * When segment `index` is drawn: 0 runs in from the side to the first photo, i runs from
 * photo i − 1 to photo i, and the last runs out past the far side. Back to back — the pen
 * never stops, it slows through each photo and hurries between them (`penProgress`).
 */
export function segmentTiming(index: number): [number, number] {
  if (index === 0) return [100, FIRST_ARRIVAL];
  const from = stopTiming(index - 1).arrive;
  return [from, from + STOP_INTERVAL];
}

/** How far along segment `index` the pen is at `t`, 0 → 1. */
export function penProgress(index: number, t: number): number {
  return passing(windowProgress(t, ...segmentTiming(index)));
}

const LAST_HOLD = stopTiming(STOPS - 1).ink[1] + 900;

/** After the last era: everything at once, then the identity, then the site. */
export const FINALE = {
  /** Camera pulls back to show every era. */
  zoomOut: [LAST_HOLD, LAST_HOLD + 900],
  /** "8,838 students since 1998." */
  total: [LAST_HOLD + 500, LAST_HOLD + 1000],
  /** Held for about a second, then every photo shrinks away. */
  shrink: [LAST_HOLD + 1900, LAST_HOLD + 2500],
  /** Hand-drawn patterns grow in from both sides. */
  patterns: [LAST_HOLD + 2300, LAST_HOLD + 3400],
  /** The Alumnity wordmark arrives on a swoosh… */
  swoosh: [LAST_HOLD + 2700, LAST_HOLD + 3500],
  /** …with the college's name beneath. */
  byline: [LAST_HOLD + 3350, LAST_HOLD + 3800],
  /** The lockup floats to the top-left corner… */
  float: [LAST_HOLD + 4200, LAST_HOLD + 4950],
  /** …while the site is revealed from the centre outwards. */
  reveal: [LAST_HOLD + 4550, LAST_HOLD + 5550]
} satisfies Record<string, [number, number]>;

export const INTRO_END = FINALE.reveal[1] + 100;

/* ---------- Camera ---------- */

export type Camera = { x: number; y: number; scale: number };
/** Where the pen's head is at time `t`, in world units. */
export type PenAt = (t: number) => Point;

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

const blend = (a: Camera, b: Camera, w: number): Camera => ({
  x: a.x + (b.x - a.x) * w,
  y: a.y + (b.y - a.y) * w,
  scale: a.scale * (b.scale / a.scale) ** w
});

/**
 * How strongly the camera frames photo `index` at `t`, 0 → 1: it eases in as the pen
 * approaches, holds while the photo colours, and lets go as the pen hurries on. The first
 * photo is framed from the start; the last stays framed until the pull-back.
 */
export function framing(t: number, index: number): number {
  const { arrive, framed } = stopTiming(index);
  // Eases in over the last stretch before the photo, lets go over 450 ms after it; in
  // between (about 400 ms) the camera purely follows the pen along its line.
  const rise = index === 0 ? 1 : smoothstep(windowProgress(t, arrive - 900, framed[0]));
  const fall = index === STOPS - 1 ? 1 : 1 - smoothstep(windowProgress(t, framed[1], framed[1] + 450));
  return Math.min(rise, fall);
}

/**
 * Where the camera is at time `t`. It follows the pen along its line, a little behind
 * and pulled back, and settles on each photo as the pen passes slowly through it. After
 * the last era it pulls back to show them all.
 */
export function cameraAt(t: number, layout: WorldLayout, viewport: Viewport, penAt: PenAt): Camera {
  const last = focusOn(layout.shots[STOPS - 1], viewport);
  if (t >= FINALE.zoomOut[0]) {
    const u = windowProgress(t, ...FINALE.zoomOut);
    return blend(last, overview(layout, viewport), Math.min(1, settle(u)));
  }

  const scales = layout.shots.map((shot) => focusOn(shot, viewport).scale);
  const pen = penAt(t - FOLLOW_LAG);
  const follow: Camera = { x: pen.x, y: pen.y, scale: (scales.reduce((a, b) => a + b, 0) / scales.length) * 0.8 };

  let strongest = 0;
  let weight = 0;
  for (let i = 0; i < STOPS; i += 1) {
    const w = framing(t, i);
    if (w > weight) {
      weight = w;
      strongest = i;
    }
  }
  return weight > 0 ? blend(follow, focusOn(layout.shots[strongest], viewport), weight) : follow;
}
