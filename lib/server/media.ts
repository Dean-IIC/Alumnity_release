import { db } from "./db";
import { randomToken } from "./secrets";
import { storage } from "./storage";

/*
 * What members upload: a photo and a cover for their page (an image, a video or an HTML
 * file), and the photos and videos on posts and stories. Kept in Supabase Storage's
 * private bucket (lib/server/storage.ts), served only to signed-in members by
 * app/media/[id]/route.ts.
 *
 * The browser sends a file straight to Storage (startUpload gives it a one-time link),
 * then asks us to finish: only then is it checked and taken in. Until it is, nothing can
 * show it.
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

export type UploadUse = "photo" | "cover" | "post" | "story";

const DAY = 24 * 60 * 60_000;
/** How much one member may upload in a day: plenty for photos and short videos, not enough to fill the store. */
export const DAILY_BYTES = 200 * 1024 * 1024;
/** A started upload not finished in this long is forgotten. */
const UPLOAD_LIFE = 2 * 60 * 60_000;
const ID = /^[\w-]{1,64}$/;

const tooBig = (kind: MediaKind) =>
  `That’s too big: ${kind === "video" ? "videos" : kind === "html" ? "HTML files" : "images"} can be up to ${LIMITS[kind] / 1024 / 1024} MB.`;

/** Where a started upload's bytes land, before they're checked. */
export const pendingUploadPath = (userId: number, id: string) => `pending/${userId}/${id}`;

type Checked = { ok: true; kind: MediaKind; mime: string; ext: string; data: Uint8Array } | { ok: false; error: string };

/** What a file is, and whether it may be used for `use`: a photo is an image; posts and stories take images and videos; only a cover may be HTML. */
function check(use: UploadUse, bytes: Uint8Array): Checked {
  const found = sniff(bytes);
  if (!found) return { ok: false, error: "That file isn’t one we can use. Photos: JPEG, PNG, WebP or GIF. Videos: MP4 or WebM." };
  if (use === "photo" && found.kind !== "image") return { ok: false, error: "Your photo needs to be an image (JPEG, PNG, WebP or GIF)." };
  if ((use === "post" || use === "story") && found.kind === "html") return { ok: false, error: "Posts and stories take photos and videos." };
  if (bytes.length > LIMITS[found.kind]) return { ok: false, error: tooBig(found.kind) };
  return { ok: true, ...found, data: found.mime === "image/jpeg" ? withoutExif(bytes) : bytes };
}

async function keep(userId: number, id: string, file: Extract<Checked, { ok: true }>): Promise<Media> {
  const path = `${userId}/${id}.${file.ext}`;
  await storage().write(path, file.data, file.mime);
  await db().run(
    "insert into media (id, user_id, kind, mime, size, path, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    id,
    userId,
    file.kind,
    file.mime,
    file.data.length,
    path,
    Date.now()
  );
  return { id, userId, kind: file.kind, mime: file.mime, size: file.data.length, path };
}

/** Checks and keeps an upload whose bytes are already here (the tests; small files). */
export async function saveUpload(userId: number, use: UploadUse, bytes: Uint8Array): Promise<Saved> {
  const file = check(use, bytes);
  if (!file.ok) return file;
  return { ok: true, media: await keep(userId, randomToken(15), file) };
}

/** Bytes uploaded (and on their way) in the last day. */
async function uploadedToday(userId: number): Promise<number> {
  const since = Date.now() - DAY;
  const row = await db().one<{ bytes: number }>(
    "select (select coalesce(sum(size), 0) from media where user_id = ? and created_at > ?) + (select coalesce(sum(size), 0) from uploads where user_id = ? and created_at > ?) as bytes",
    userId,
    since,
    userId,
    since
  );
  return row?.bytes ?? 0;
}

export type Started = { ok: true; id: string; url: string } | { ok: false; error: string; status: number };

/** The first step of an upload: a one-time link the browser sends the file to. */
export async function startUpload(userId: number, use: UploadUse, size: number): Promise<Started> {
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, error: "Choose a file first.", status: 400 };
  if (size > (use === "photo" ? LIMITS.image : LIMITS.video)) {
    return { ok: false, error: use === "photo" ? tooBig("image") : "That’s too big: videos can be up to 25 MB, images 5 MB.", status: 413 };
  }
  if ((await uploadedToday(userId)) + size > DAILY_BYTES) return { ok: false, error: "That's a lot of uploading today. Try again tomorrow.", status: 429 };
  const id = randomToken(15);
  await db().run("delete from uploads where created_at < ?", Date.now() - UPLOAD_LIFE);
  await db().run("insert into uploads (id, user_id, use, size, created_at) values (?, ?, ?, ?, ?)", id, userId, use, size, Date.now());
  return { ok: true, id, url: await storage().uploadUrl(pendingUploadPath(userId, id)) };
}

/** An upload `userId` started that's still waiting for its bytes, or null. */
export async function pendingUpload(userId: number, id: string): Promise<{ size: number } | null> {
  if (!ID.test(id)) return null;
  return (await db().one<{ size: number }>("select size from uploads where id = ? and user_id = ? and created_at > ?", id, userId, Date.now() - UPLOAD_LIFE)) ?? null;
}

/** The last step: the file has arrived. Check it, and take it in (or throw it away). */
export async function finishUpload(userId: number, id: string): Promise<Saved> {
  if (!ID.test(id)) return { ok: false, error: "That upload has expired. Choose the file again." };
  const row = await db().one<{ use: UploadUse }>("select use from uploads where id = ? and user_id = ? and created_at > ?", id, userId, Date.now() - UPLOAD_LIFE);
  if (!row) return { ok: false, error: "That upload has expired. Choose the file again." };
  const path = pendingUploadPath(userId, id);
  const bytes = await storage().read(path);
  await db().run("delete from uploads where id = ?", id);
  if (!bytes) return { ok: false, error: "The file didn’t arrive. Try again." };
  await storage().remove([path]);
  const file = check(row.use, bytes);
  if (!file.ok) return file;
  return { ok: true, media: await keep(userId, id, file) };
}

const toMedia = (row: Record<string, unknown>): Media => ({
  id: String(row.id),
  userId: Number(row.user_id),
  kind: row.kind as MediaKind,
  mime: String(row.mime),
  size: Number(row.size),
  path: String(row.path)
});

export async function mediaById(id: string): Promise<Media | null> {
  if (typeof id !== "string" || !ID.test(id)) return null;
  const row = await db().one("select * from media where id = ?", id);
  return row ? toMedia(row) : null;
}

/** Several uploads at once, by id. */
export async function mediaByIds(ids: string[]): Promise<Map<string, Media>> {
  const wanted = [...new Set(ids)].filter((id) => ID.test(id));
  if (!wanted.length) return new Map();
  const rows = await db().all(`select * from media where id in (${wanted.map(() => "?").join(",")})`, ...wanted);
  return new Map(rows.map((r) => [String(r.id), toMedia(r)]));
}

export const readMedia = (media: Media) => storage().read(media.path);

/** A short-lived direct link to the file, where the store gives those (null: serve it ourselves). */
export const mediaLink = (media: Media, seconds: number) => storage().link(media.path, seconds);

/** Removes an upload the member no longer uses (only their own). */
export async function removeMedia(userId: number, id: string) {
  const media = await mediaById(id);
  if (!media || media.userId !== userId) return;
  await storage().remove([media.path]);
  await db().run("delete from media where id = ?", id);
}
