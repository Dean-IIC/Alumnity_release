/** Geometry for the ink-splotch reveal. Pure and seeded, so every visit blooms the same way. */

export type Point = { x: number; y: number };

type Harmonic = { k: number; amplitude: number; phase: number };

export type InkBlob = {
  x: number;
  y: number;
  /** Radius at full growth. */
  radius: number;
  /** Window of the overall progress (0–1) in which this blob grows. */
  start: number;
  end: number;
  harmonics: Harmonic[];
  /** How much the outline "boils" as it spreads. */
  drift: number;
  main: boolean;
};

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Progress of `t` through the window [start, end], clamped to 0–1. */
export function windowProgress(t: number, start: number, end: number): number {
  return clamp01((t - start) / (end - start));
}

/** Largest outward bulge (as a multiple of the radius) the harmonics produce at any angle. */
function maxWobble(list: Harmonic[]): number {
  let max = 1;
  for (let i = 0; i < 180; i += 1) {
    const theta = (i / 180) * Math.PI * 2;
    // Drift shifts the phases as the blob grows; the sum of amplitudes bounds that.
    max = Math.max(max, 1 + list.reduce((sum, h) => sum + h.amplitude * Math.sin(h.k * theta + h.phase), 0));
  }
  return Math.min(max * 1.08, 1 + list.reduce((sum, h) => sum + h.amplitude, 0));
}

function harmonics(random: () => number, strength: number): Harmonic[] {
  return [2, 3, 4, 5, 7, 9, 13, 17].map((k) => ({
    k,
    amplitude: (random() * strength) / Math.sqrt(k - 1),
    phase: random() * Math.PI * 2
  }));
}

export type InkSpread = {
  /** Final radius of the main blot, as a fraction of the surface's longer side. */
  extent: number;
  /** Lobes that push the edge out unevenly. */
  fingers: number;
  /** Separate drops that land near the main blot and spread on their own. */
  drops: number;
  /** Tiny splashes thrown out when the drop lands. */
  spatter: number;
  /** How wobbly the outlines are. */
  roughness: number;
};

export const COLOUR_SPREAD: InkSpread = { extent: 0.5, fingers: 26, drops: 6, spatter: 26, roughness: 0.18 };
export const SKETCH_SPREAD: InkSpread = { extent: 0.54, fingers: 14, drops: 0, spatter: 0, roughness: 0.12 };

/** Furthest any ink may reach from the centre, as a fraction of the side: stays off the edges. */
const REACH = 0.5;

/**
 * Blobs for one reveal, laid out in a `size` × `size` square (the renderer stretches it to
 * the photo's aspect, so the splotch fills a landscape or portrait frame alike).
 * One main blot lands at `origin` and spreads into an irregular shape that stays inside
 * the frame; fingers push its edge out unevenly, the further ones later, so it advances
 * in lumps; a few drops and splashes land around it.
 */
export function makeInkBlobs(size: number, origin: Point, seed: number, spread: InkSpread): InkBlob[] {
  const random = seededRandom(seed);
  const o = { x: origin.x * size, y: origin.y * size };
  const centre = size / 2;
  const reach = REACH * size;
  /** Largest radius a blob at (x, y) can have and still stay inside the reach. */
  const room = (x: number, y: number) => Math.max(0, reach - Math.hypot(x - centre, y - centre));

  const mainHarmonics = harmonics(random, spread.roughness);
  const mainRadius = Math.min(spread.extent * size, room(o.x, o.y) / maxWobble(mainHarmonics));
  const blobs: InkBlob[] = [
    { x: o.x, y: o.y, radius: mainRadius, start: 0, end: 1, harmonics: mainHarmonics, drift: 0.9, main: true }
  ];

  for (let i = 0; i < spread.fingers; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = mainRadius * (0.3 + random() * 0.78);
    const x = o.x + Math.cos(angle) * distance;
    const y = o.y + Math.sin(angle) * distance;
    const fingerHarmonics = harmonics(random, spread.roughness * 1.4);
    const radius = Math.min(mainRadius * (0.12 + random() * 0.26), room(x, y) / maxWobble(fingerHarmonics));
    if (radius <= size * 0.01) continue;
    const start = Math.max(0.03, (distance / mainRadius) * 0.62 - 0.08 + random() * 0.08);
    blobs.push({
      x,
      y,
      radius,
      start,
      end: Math.min(1, start + 0.22 + random() * 0.16),
      harmonics: fingerHarmonics,
      drift: 1.6,
      main: false
    });
  }

  for (let i = 0; i < spread.drops; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = mainRadius * (0.85 + random() * 0.35);
    const x = o.x + Math.cos(angle) * distance;
    const y = o.y + Math.sin(angle) * distance;
    const radius = Math.min(size * (0.02 + random() * 0.035), room(x, y) / 1.5);
    if (radius <= size * 0.006) continue;
    const start = 0.12 + random() * 0.4;
    blobs.push({
      x,
      y,
      radius,
      start,
      end: Math.min(1, start + 0.25 + random() * 0.15),
      harmonics: harmonics(random, 0.4),
      drift: 1.2,
      main: false
    });
  }

  for (let i = 0; i < spread.spatter; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = size * (0.03 + random() ** 1.5 * 0.2);
    const start = random() * 0.06;
    blobs.push({
      x: o.x + Math.cos(angle) * distance,
      y: o.y + Math.sin(angle) * distance,
      radius: size * (0.003 + random() * 0.008),
      start,
      end: start + 0.12 + random() * 0.1,
      harmonics: harmonics(random, 0.25),
      drift: 0.4,
      main: false
    });
  }

  return blobs;
}

/** Radius of a blob at overall progress `p`, before its outline harmonics. */
export function blobRadius(blob: InkBlob, p: number): number {
  const u = windowProgress(p, blob.start, blob.end);
  if (u <= 0) return 0;
  // Ink lands fast, then creeps outward and slows to a stop.
  const grow = blob.main ? 1 - (1 - u) ** 2.4 : 1 - (1 - u) ** 3;
  return blob.radius * grow;
}

/** Outline points of a blob at progress `p`. */
export function blobOutline(blob: InkBlob, p: number, segments = 72): Point[] {
  const radius = blobRadius(blob, p);
  if (radius <= 0) return [];
  const points: Point[] = [];
  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    let wobble = 1;
    for (const h of blob.harmonics) {
      wobble += h.amplitude * Math.sin(h.k * theta + h.phase + blob.drift * p * h.k * 0.35);
    }
    const r = radius * wobble;
    points.push({ x: blob.x + Math.cos(theta) * r, y: blob.y + Math.sin(theta) * r });
  }
  return points;
}

/** A closed, smooth SVG path through outline points (used for the landing blot). */
export function outlineToPath(points: Point[]): string {
  if (points.length < 3) return "";
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const first = mid(points[points.length - 1], points[0]);
  let d = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  points.forEach((point, i) => {
    const next = mid(point, points[(i + 1) % points.length]);
    d += `Q${point.x.toFixed(1)} ${point.y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  });
  return `${d}Z`;
}
