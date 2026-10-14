/**
 * Motion with weight. Closed-form spring curves, so any frame can be computed from time
 * alone (the intro can be frozen, skipped to, or seeked, and always looks the same).
 * Each maps progress u in [0, 1] to 0 → 1, landing exactly on 1 at u = 1.
 */

/**
 * A mass pulled toward its target through drag (a critically damped spring released
 * from rest): it picks up speed quickly, then glides and decelerates into place. Used
 * for the pen, which should feel like it has momentum rather than float along.
 */
export function momentum(u: number, stiffness = 6): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const raw = (t: number) => 1 - (1 + stiffness * t) * Math.exp(-stiffness * t);
  return raw(u) / raw(1);
}

/**
 * An under-damped spring: arrives, overshoots a touch, and settles. Used for the
 * camera, which should feel like something with inertia coming to rest on a photo.
 * `damping` < 1 sets how much it overshoots (0.8 is about 1.5%).
 */
export function settle(u: number, frequency = 9, damping = 0.8): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const raw = (t: number) => {
    const wd = frequency * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * frequency * t) * (Math.cos(wd * t) + ((damping * frequency) / wd) * Math.sin(wd * t));
  };
  // Blend into exactly 1 over the last 15% so the curve lands without a jump.
  const blend = Math.min(1, Math.max(0, (u - 0.85) / 0.15));
  return raw(u) * (1 - blend) + blend;
}

/**
 * Passing through: slow near both ends of a stroke, quick in the middle, but never
 * stopped. The pen takes its time through each photo (where strokes start and end) and
 * hurries between them; because the ends never reach zero speed, one stroke flows into
 * the next without a halt. `slow` is how much it slows at the ends (0 none, 1 a stop).
 */
export function passing(u: number, slow = 0.8): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u - (slow * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);
}

/** Hermite smoothstep: 0 → 1 with gentle ends. */
export function smoothstep(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}
