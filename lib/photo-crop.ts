import type { CSSProperties } from "react";

/*
 * How a member has framed their photo or their cover: kept as numbers beside the upload,
 * never cut into it, so the whole picture stays and they can frame it again later. Every
 * place a photo shows draws it from these with CSS (and the alumni card's PNG cuts the
 * same square in code: lib/server/alumni-card.ts).
 *
 * `zoom`: how much bigger than "just covers the frame" (1, as every photo showed before).
 * `x`, `y`: which point of the picture lines up with the same point of the frame, as
 * fractions (0.5, 0.5: the middle on the middle, as before; 0 is its left or top edge on
 * the frame's). It's CSS's own object-position, so it holds in a frame of any shape: the
 * same numbers suit the cover on a wide screen and on a phone.
 *
 * The campus drawing (a cover without an upload) uses the same three numbers to move and
 * grow the drawing within the cover: 0.5, 0.5 and 1 leave it where it always was.
 */

export type Crop = { x: number; y: number; zoom: number };

/** As every photo showed before framing came: the middle, just covering the frame. */
export const NO_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };

export const ZOOM = { min: 1, max: 4 } as const;

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Whether this framing changes nothing (so it needn't be kept, or drawn). */
export const isPlain = (crop: Crop) => crop.x === NO_CROP.x && crop.y === NO_CROP.y && crop.zoom === NO_CROP.zoom;

/**
 * A framing from anything sent: numbers held to their ranges and rounded (no 17-digit
 * fractions in the profile); undefined for nothing usable, or for one that changes nothing.
 */
export function cleanCrop(value: unknown): Crop | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const num = (n: unknown, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? n : typeof n === "string" && n.trim() && Number.isFinite(Number(n)) ? Number(n) : fallback);
  const crop = {
    x: round(clamp(num(v.x, NO_CROP.x), 0, 1), 3),
    y: round(clamp(num(v.y, NO_CROP.y), 0, 1), 3),
    zoom: round(clamp(num(v.zoom, NO_CROP.zoom), ZOOM.min, ZOOM.max), 2)
  };
  return isPlain(crop) ? undefined : crop;
}

const percent = (n: number) => `${round(n * 100, 1)}%`;

/**
 * How many times wider a copy a framed picture needs, grown as it is: its zoom, rounded up,
 * so the slider asks for a handful of copies, not one for every step.
 */
export const sharper = (crop: Crop | null | undefined) => Math.ceil(crop?.zoom ?? 1);

/**
 * For an <img> or <video> filling its frame with object-fit: cover (the frame clips it):
 * lined up by `x`, `y`, and grown about that same point, so the picture's point (x, y)
 * stays on the frame's. Nothing when unframed: it shows exactly as before.
 */
export function cropStyle(crop: Crop | null | undefined): CSSProperties | undefined {
  if (!crop || isPlain(crop)) return undefined;
  const at = `${percent(crop.x)} ${percent(crop.y)}`;
  return { objectFit: "cover", objectPosition: at, transformOrigin: at, transform: crop.zoom === 1 ? undefined : `scale(${crop.zoom})` };
}

/** How far the campus drawing moves for x or y from 0 to 1, in its own width and height. */
export const CAMPUS_TRAVEL = { x: 1.2, y: 0.5 } as const;

/** For the campus drawing's box on a cover: moved and grown from where it always sits. */
export function campusStyle(crop: Crop | null | undefined): CSSProperties | undefined {
  if (!crop || isPlain(crop)) return undefined;
  const dx = (crop.x - 0.5) * CAMPUS_TRAVEL.x * 100;
  const dy = (crop.y - 0.5) * CAMPUS_TRAVEL.y * 100;
  return { transform: `translate(${round(dx, 1)}%, ${round(dy, 1)}%) scale(${crop.zoom})` };
}

/*
 * A photo travels to every face in a list as one string (lib/server/profile.ts photoIdsOf):
 * its upload id, and when it's framed, the framing after a "~" (an id is base64url, so it
 * never has one): "abc123~0.3,0.42,1.5". No second query, and no new shape for the
 * dozens of places that pass a face along.
 */
export function photoKey(id: string, crop?: Crop | null): string {
  return crop && !isPlain(crop) ? `${id}~${crop.x},${crop.y},${crop.zoom}` : id;
}

/** The upload id and its framing (undefined: unframed) from a photo key. */
export function readPhotoKey(key: string): { id: string; crop?: Crop } {
  const at = key.indexOf("~");
  if (at < 0) return { id: key };
  const [x, y, zoom] = key.slice(at + 1).split(",").map(Number);
  return { id: key.slice(0, at), crop: cleanCrop({ x, y, zoom }) };
}

/**
 * The part of a `width` × `height` picture a square frame shows (the alumni card's photo):
 * in the picture's own pixels, whole and inside it.
 */
export function squareCut(width: number, height: number, crop: Crop | null | undefined): { left: number; top: number; width: number; height: number } {
  const c = crop ?? NO_CROP;
  const side = Math.max(1, Math.min(Math.round(Math.min(width, height) / c.zoom), width, height));
  return {
    left: clamp(Math.round(c.x * (width - side)), 0, width - side),
    top: clamp(Math.round(c.y * (height - side)), 0, height - side),
    width: side,
    height: side
  };
}
