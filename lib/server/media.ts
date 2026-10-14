import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { database } from "./db";
import { randomToken } from "./secrets";

/*
 * What members upload for their page: a photo, and a cover that's an image, a video or an
 * HTML file. Kept in data/uploads (never committed), served only to signed-in members by
 * app/media/[id]/route.ts.
 *
 * A file's type is read from its first bytes, never from its name or what the browser
 * says. JPEG photos lose their EXIF block (which can hold the GPS spot it was taken). HTML
 * is somebody else's code: it's only ever served sandboxed, with no network and no access
 * to the site (see the route), so all it can do is draw itself.
 */

export type MediaKind = "image" | "video" | "html";

export const LIMITS: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  html: 1024 * 1024
};

export type Media = { id: string; userId: number; kind: MediaKind; mime: string; size: number; path: string };

const root = () => process.env.ALUMNITY_UPLOADS || join(process.cwd(), "data", "uploads");

const ensureTable = () =>
  database().exec(`create table if not exists media (
    id text primary key,
    user_id integer not null references users(id) on delete cascade,
    kind text not null,
    mime text not null,
    size integer not null,
    path text not null,
    created_at integer not null
  )`);

const starts = (bytes: Uint8Array, signature: number[], at = 0) => signature.every((b, i) => bytes[at + i] === b);

/** What a file really is, from its first bytes (null if it isn't something we accept). */
export function sniff(bytes: Uint8Array): { kind: MediaKind; mime: string; ext: string } | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg", ext: "jpg" };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image", mime: "image/png", ext: "png" };
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { kind: "image", mime: "image/webp", ext: "webp" };
  if (starts(bytes, [0x47, 0x49, 0x46, 0x38])) return { kind: "image", mime: "image/gif", ext: "gif" };
  if (starts(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return { kind: "video", mime: "video/mp4", ext: "mp4" };
  if (starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", mime: "video/webm", ext: "webm" };
  // HTML: text that starts (after whitespace or a byte-order mark) with a tag.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 512)).replace(/^﻿/, "").trimStart().toLowerCase();
  if (/^<(!doctype html|html|head|body|style|div|svg|canvas|main|section|script)/.test(head)) return { kind: "html", mime: "text/html", ext: "html" };
  return null;
}

/** A JPEG without its EXIF (APP1) blocks: the picture is untouched, the hidden details go. */
export function withoutExif(bytes: Uint8Array): Uint8Array {
  if (!starts(bytes, [0xff, 0xd8])) return bytes;
  const keep: Uint8Array[] = [bytes.slice(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    // Start of scan: the image data follows, to the end.
    if (marker === 0xda) break;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return bytes; // not a JPEG we understand: leave it
    if (marker !== 0xe1) keep.push(bytes.slice(i, i + 2 + length));
    i += 2 + length;
  }
  keep.push(bytes.slice(i));
  const out = new Uint8Array(keep.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of keep) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export type Saved = { ok: true; media: Media } | { ok: false; error: string };

/** Checks and keeps an upload, for `use` (a photo is an image; a cover is an image, a video or HTML). */
export function saveUpload(userId: number, use: "photo" | "cover", bytes: Uint8Array): Saved {
  const found = sniff(bytes);
  if (!found) return { ok: false, error: "That file isn’t one we can use. Photos: JPEG, PNG, WebP or GIF. Covers can also be MP4 or WebM video, or an HTML file." };
  if (use === "photo" && found.kind !== "image") return { ok: false, error: "Your photo needs to be an image (JPEG, PNG, WebP or GIF)." };
  if (bytes.length > LIMITS[found.kind]) {
    return { ok: false, error: `That’s too big: ${found.kind === "video" ? "videos" : found.kind === "html" ? "HTML files" : "images"} can be up to ${LIMITS[found.kind] / 1024 / 1024} MB.` };
  }
  const data = found.mime === "image/jpeg" ? withoutExif(bytes) : bytes;
  ensureTable();
  const id = randomToken(15);
  const path = join(String(userId), `${id}.${found.ext}`);
  const file = join(root(), path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  database()
    .prepare("insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, ?, ?, ?, ?, ?)")
    .run(id, userId, found.kind, found.mime, data.length, path, Date.now());
  return { ok: true, media: { id, userId, kind: found.kind, mime: found.mime, size: data.length, path } };
}

export function mediaById(id: string): Media | null {
  ensureTable();
  const row = database().prepare("select * from media where id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: String(row.id), userId: Number(row.user_id), kind: row.kind as MediaKind, mime: String(row.mime), size: Number(row.size), path: String(row.path) };
}

export const mediaFile = (media: Media) => join(root(), media.path);

export const readMedia = (media: Media, start?: number, end?: number) => {
  const all = readFileSync(mediaFile(media));
  return start === undefined ? all : all.subarray(start, end === undefined ? undefined : end + 1);
};

export const mediaSize = (media: Media) => statSync(mediaFile(media)).size;

/** Removes an upload the member no longer uses (only their own). */
export function removeMedia(userId: number, id: string) {
  const media = mediaById(id);
  if (!media || media.userId !== userId) return;
  rmSync(mediaFile(media), { force: true });
  database().prepare("delete from media where id = ?").run(id);
}
