import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { alumniCard, type AlumniCard } from "../alumni-card";
import { readPhotoKey, sharper, squareCut } from "../photo-crop";
import type { User } from "./auth";
import { db } from "./db";
import { mediaById, pickSize, readMedia, withSizes } from "./media";
import { photoIdsOf } from "./profile";

/*
 * The server's side of the alumni card: the member's own card (with the year they joined
 * Alumnity, which their record has and the session's User doesn't), and the pictures the
 * downloadable PNG needs inlined (it's drawn on the server, where there's no browser to
 * fetch /media with the member's cookie).
 */

/** The year of a moment, in India time (a member who joined at 1 a.m. on 1 January joined that year). */
const yearOf = (at: number) => Number(new Date(at).toLocaleString("en-IN", { year: "numeric", timeZone: "Asia/Kolkata" }));

/** The signed-in member's own card. Only ever built for `user` themselves. */
export async function cardFor(user: User, origin: string): Promise<AlumniCard> {
  const [row, photos] = await Promise.all([db().one<{ created_at: number }>("select created_at from users where id = ?", user.id), photoIdsOf([user.id])]);
  return alumniCard(user, { since: row ? yearOf(Number(row.created_at)) : null, photoId: photos.get(user.id) ?? null, origin });
}

/**
 * The site's address as the browser reached it, for the QR code's link. Vercel (and most
 * hosts) say which in X-Forwarded-Host/-Proto; a local server only has Host.
 */
export function originFrom(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * The member's photo as a small square JPEG data URL, for the PNG: only an image upload
 * that is theirs (the photo id comes from their own profile, but it's checked again here),
 * cut to the square they framed (lib/photo-crop.ts; the middle when they haven't) and made
 * small, so the card renders quickly. Cut here, when it's asked for: the upload stays whole.
 */
export async function cardPhoto(photoKey: string | null, ownerId: number): Promise<string | null> {
  if (!photoKey) return null;
  const { id, crop } = readPhotoKey(photoKey);
  try {
    const media = await mediaById(id);
    if (!media || media.userId !== ownerId || media.kind !== "image") return null;
    const file = pickSize(await withSizes(media), 160 * sharper(crop));
    const bytes = await readMedia(media, file.path);
    if (!bytes) return null;
    const sharp = (await import("sharp")).default;
    const options = { failOn: "error", limitInputPixels: 50_000_000 } as const;
    let square = sharp(bytes, options).rotate();
    if (crop) {
      // Turned upright first, so the cut is measured on the photo as it's seen.
      const upright = await square.toBuffer({ resolveWithObject: true });
      square = sharp(upright.data, options).extract(squareCut(upright.info.width, upright.info.height, crop));
    }
    const jpeg = await square.resize(320, 320, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (error) {
    // A photo that won't decode: the card shows their initials instead.
    console.error("cardPhoto:", error);
    return null;
  }
}

let crest: string | null = null;

/**
 * The college crest (public/college/hkbk-logo.png) as a data URL. Read from disk where the
 * site's files are beside the server; otherwise (a host that keeps public files on its
 * CDN only) fetched from the site itself, where it's a public file.
 */
export async function crestImage(origin: string): Promise<string | null> {
  if (crest) return crest;
  try {
    const bytes = await readFile(join(process.cwd(), "public", "college", "hkbk-logo.png"));
    crest = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    try {
      const response = await fetch(`${origin}/college/hkbk-logo.png`);
      if (response.ok && response.headers.get("content-type")?.startsWith("image/png")) {
        crest = `data:image/png;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
      }
    } catch {
      return null;
    }
  }
  return crest;
}
