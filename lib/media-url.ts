/**
 * Where a member's upload is served. Uploads never change (a new one gets a new id), so
 * browsers keep them a day; the version moves when how they're served changes, so nobody
 * is left with a copy served the old way.
 */
const VERSION = 3; // 3: older photos now get their smaller copies (lib/server/media.ts, withSizes)

/** The sizes kept of each photo (widths in pixels), smallest first. */
export const PHOTO_SIZES = [160, 640, 1280] as const;

/**
 * `width`: about how wide it will show (in CSS pixels); the server sends the smallest copy
 * at least twice that (for sharp screens), or the original if it's smaller. A photo key's
 * framing (lib/photo-crop.ts: "<id>~x,y,zoom") isn't part of where the file is.
 */
export const mediaUrl = (id: string, width?: number) => `/media/${id.split("~")[0]}?v=${VERSION}${width ? `&w=${Math.round(width)}` : ""}`;
