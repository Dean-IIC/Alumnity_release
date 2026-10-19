import type { User } from "./auth";
import { db } from "./db";
import { audit } from "./desk";
import { sniff } from "./media";
import { isModerator } from "./roles";
import { randomToken } from "./secrets";
import type { Result } from "./social";
import { siteFileUrl, storage, SITE_BUCKET, usingSupabaseStorage } from "./storage";
import { withinLimit } from "./throttle";
import type { Album, AlbumPart, GalleryPhoto, GalleryVideo, Source } from "../gallery";
import { SOURCES } from "../gallery";
import { parseVideoLink } from "../video";

/*
 * The college's showcase: the gallery's albums, in the database's `site` schema (kept
 * apart from members' things in `public`). Anyone may see a published album with photos
 * (/gallery); only the college desk (coordinators and up) may change them, and every change
 * is written to the audit log.
 *
 * A photo's `src` and `thumb` are either a file in the repo ("/assets/gallery/...", the
 * first albums) or a key in the public Storage bucket `site` (photos added from the desk),
 * turned into an address here.
 */

const NO = "Only the college desk can do that.";

export const ALBUM_LIMITS = { title: 120, when: 60, about: 1000, alt: 300, caption: 200 } as const;
/** The biggest photo the desk may send (a camera's JPEG); it's kept at 1600 px. */
export const SITE_PHOTO_BYTES = 20 * 1024 * 1024;
const MAIN_WIDTH = 1600;
const THUMB_WIDTH = 640;
const TOKEN = /^[\w-]{10,64}$/;

type AlbumRow = {
  id: number;
  slug: string;
  title: string;
  about: string;
  happened_on: string;
  when_text: string;
  cover_photo_id: number | null;
  cover_src: string | null;
  cover_sketch: string | null;
  cover_width: number | null;
  cover_height: number | null;
  sort: number;
  published: boolean;
  updated_at: number;
};
type PartRow = { album_id: number; key: string; title: string | null; when_text: string; source: string | null; sort: number };
type PhotoRow = {
  id: number;
  album_id: number;
  part_key: string;
  src: string;
  thumb: string;
  width: number;
  height: number;
  thumb_width: number;
  alt: string;
  caption: string | null;
  sort: number;
};
type VideoRow = { album_id: number; part_key: string; url: string; title: string; poster_src: string | null; poster_width: number | null; poster_height: number | null };

/** A file's address: one in the repo as it is, one in the bucket by its public address. */
export const fileUrl = (src: string) => (src.startsWith("/") ? src : siteFileUrl(src));
const isUploaded = (src: string | null | undefined): src is string => Boolean(src) && !src!.startsWith("/");

const toPhoto = (p: PhotoRow): GalleryPhoto => ({
  src: fileUrl(p.src),
  width: Number(p.width),
  height: Number(p.height),
  thumb: fileUrl(p.thumb),
  thumbWidth: Number(p.thumb_width),
  alt: p.alt,
  ...(p.caption ? { caption: p.caption } : {})
});

function toVideo(v: VideoRow): GalleryVideo | null {
  try {
    return {
      ...parseVideoLink(v.url),
      title: v.title,
      ...(v.poster_src ? { poster: { src: fileUrl(v.poster_src), width: Number(v.poster_width), height: Number(v.poster_height) } } : {})
    };
  } catch {
    return null; // a link we can no longer read: left out, not the whole album
  }
}

const isSource = (s: string | null): s is Source => s !== null && s in SOURCES;

/**
 * An album as the gallery shows it, from its rows: its parts in order (an album without
 * parts is one), each with its photos then its videos; null if it has no photo yet.
 */
export function buildAlbum(album: AlbumRow, partRows: PartRow[], photoRows: PhotoRow[], videoRows: VideoRow[]): Album | null {
  const defs = partRows.length ? [...partRows].sort((a, b) => a.sort - b.sort) : [{ key: "", title: null, when_text: album.when_text, source: null } as Omit<PartRow, "album_id" | "sort">];
  const known = new Set(defs.map((d) => d.key));
  // With one part, everything is in it; with several, a photo whose part is gone goes last.
  const partOf = (key: string) => (defs.length === 1 ? defs[0].key : known.has(key) ? key : "\u0000more");
  const sortedPhotos = [...photoRows].sort((a, b) => a.sort - b.sort || a.id - b.id);
  const all = [...defs, ...(defs.length > 1 ? [{ key: "\u0000more", title: "More photos", when_text: album.when_text, source: null }] : [])];
  const parts: AlbumPart[] = all
    .map((d) => ({
      ...(d.title ? { title: d.title } : {}),
      when: d.when_text,
      source: isSource(d.source) ? d.source : null,
      photos: sortedPhotos.filter((p) => partOf(p.part_key) === d.key).map(toPhoto),
      videos: videoRows.filter((v) => partOf(v.part_key) === d.key).flatMap((v) => toVideo(v) ?? [])
    }))
    .filter((part) => part.photos.length || part.videos.length);
  const photos = parts.flatMap((part) => part.photos);
  if (!photos.length) return null;
  const coverRow = album.cover_photo_id ? sortedPhotos.find((p) => p.id === album.cover_photo_id) : undefined;
  const lead = (coverRow && photos.find((p) => p.src === fileUrl(coverRow.src))) ?? photos[0];
  // The rest of the mosaic: the first photo of each other part, then whatever comes next.
  const others = [...parts.flatMap((part) => part.photos.slice(0, 1)), ...photos].filter((photo, i, list) => photo !== lead && list.indexOf(photo) === i);
  const cover =
    album.cover_src && album.cover_width && album.cover_height
      ? { src: fileUrl(album.cover_src), sketch: fileUrl(album.cover_sketch ?? album.cover_src), width: Number(album.cover_width), height: Number(album.cover_height), alt: lead.alt }
      : { src: lead.src, sketch: lead.src, width: lead.width, height: lead.height, alt: lead.alt };
  return {
    slug: album.slug,
    title: album.title,
    date: album.happened_on,
    when: album.when_text,
    description: album.about,
    parts,
    photos,
    videos: parts.flatMap((part) => part.videos),
    mosaic: [lead, ...others.slice(0, 2)],
    cover
  };
}

const ALBUM_ORDER = "order by sort, happened_on desc, id";

async function readAlbums(where: string, ...params: unknown[]): Promise<{ row: AlbumRow; album: Album | null }[]> {
  const rows = await db().all<AlbumRow>(`select * from site.albums ${where} ${ALBUM_ORDER}`, ...params);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => "?").join(", ");
  const [parts, photos, videos] = await Promise.all([
    db().all<PartRow>(`select * from site.album_parts where album_id in (${marks})`, ...ids),
    db().all<PhotoRow>(`select * from site.photos where album_id in (${marks}) order by sort, id`, ...ids),
    db().all<VideoRow>(`select * from site.videos where album_id in (${marks}) order by sort, id`, ...ids)
  ]);
  return rows.map((row) => ({
    row,
    album: buildAlbum(
      row,
      parts.filter((p) => p.album_id === row.id),
      photos.filter((p) => p.album_id === row.id),
      videos.filter((v) => v.album_id === row.id)
    )
  }));
}

// The public gallery, kept half a minute (the landing page and Home read it too). A
// change from the desk forgets it at once on this server; others catch up within that.
let kept: { at: number; value: Album[] } | undefined;
const KEEP = 30_000;

/** Forget the kept gallery (after a change, and in the tests). */
export const forgetShowcase = () => void (kept = undefined);

/** The gallery: every published album with at least one photo, newest first. */
export async function galleryAlbums(): Promise<Album[]> {
  if (kept && Date.now() - kept.at < KEEP) return kept.value;
  const value = (await readAlbums("where published")).flatMap((a) => (a.album ? [a.album] : []));
  kept = { at: Date.now(), value };
  return value;
}

/** One published album by its address, or undefined. */
export async function galleryAlbum(slug: string): Promise<Album | undefined> {
  return (await galleryAlbums()).find((album) => album.slug === slug);
}

// ---------- The desk ----------

export type DeskAlbum = {
  id: number;
  slug: string;
  title: string;
  about: string;
  date: string;
  when: string;
  published: boolean;
  photos: number;
  /** A small photo for its row in the list (its cover, or its first photo). */
  thumb: string | null;
  /** On the public gallery now (published, with a photo). */
  showing: boolean;
};

export type DeskPhoto = { id: number; src: string; thumb: string; alt: string; caption: string; part: string; cover: boolean; width: number; height: number };

export type DeskAlbumDetail = DeskAlbum & { parts: { key: string; title: string }[]; list: DeskPhoto[] };

function toDeskAlbum(row: AlbumRow, photos: PhotoRow[], album: Album | null): DeskAlbum {
  const lead = photos.find((p) => p.id === row.cover_photo_id) ?? photos[0];
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    about: row.about,
    date: row.happened_on,
    when: row.when_text,
    published: Boolean(row.published),
    photos: photos.length,
    thumb: lead ? fileUrl(lead.thumb) : null,
    showing: Boolean(row.published) && album !== null
  };
}

/** Every album, published or not, for the desk. */
export async function deskAlbums(me: User): Promise<DeskAlbum[]> {
  if (!isModerator(me)) return [];
  const list = await readAlbums("");
  const photos = await db().all<PhotoRow>("select id, album_id, thumb, sort from site.photos order by sort, id");
  return list.map(({ row, album }) => toDeskAlbum(row, photos.filter((p) => p.album_id === row.id), album));
}

/** One album with its photos in order, for the desk. */
export async function deskAlbum(me: User, id: number): Promise<DeskAlbumDetail | null> {
  if (!isModerator(me) || !Number.isSafeInteger(id)) return null;
  const [found] = await readAlbums("where id = ?", id);
  if (!found) return null;
  const [photos, parts] = await Promise.all([
    db().all<PhotoRow>("select * from site.photos where album_id = ? order by sort, id", id),
    db().all<PartRow>("select * from site.album_parts where album_id = ? order by sort", id)
  ]);
  const partName = new Map(parts.map((p) => [p.key, p.title ?? p.when_text]));
  return {
    ...toDeskAlbum(found.row, photos, found.album),
    parts: parts.filter((p) => photos.some((ph) => ph.part_key === p.key)).map((p) => ({ key: p.key, title: p.title ?? p.when_text ?? p.key })),
    list: photos.map((p, i) => ({
      id: Number(p.id),
      src: fileUrl(p.src),
      thumb: fileUrl(p.thumb),
      alt: p.alt,
      caption: p.caption ?? "",
      part: parts.length > 1 ? (partName.get(p.part_key) ?? "") : "",
      cover: found.row.cover_photo_id ? Number(found.row.cover_photo_id) === Number(p.id) : i === 0,
      width: Number(p.width),
      height: Number(p.height)
    }))
  };
}

export type AlbumInput = { title: string; date: string; when: string; about: string; published: boolean };

const DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2025-09-30" → "30 September 2025"; "2025-09" → "September 2025"; "2025" → "2025". */
export function whenFromDate(date: string): string {
  const [y, m, d] = date.split("-");
  if (!m) return y ?? "";
  return [d ? String(Number(d)) : "", MONTHS[Number(m) - 1], y].filter(Boolean).join(" ");
}

function checkAlbum(input: AlbumInput): { ok: false; error: string } | { ok: true; value: AlbumInput } {
  const title = input.title.trim().slice(0, ALBUM_LIMITS.title);
  const date = input.date.trim();
  if (!title) return { ok: false, error: "Add a name for the album." };
  if (date && !DATE.test(date)) return { ok: false, error: "Write the date as year-month-day (2025-09-30), year-month (2025-09) or just the year." };
  const when = input.when.trim().slice(0, ALBUM_LIMITS.when) || whenFromDate(date);
  return { ok: true, value: { title, date, when, about: input.about.trim().slice(0, ALBUM_LIMITS.about), published: input.published } };
}

const slugOf = (title: string, date: string) =>
  [title, date.slice(0, 4)]
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "") || "album";

const changed = () => forgetShowcase();

export async function createAlbum(me: User, input: AlbumInput): Promise<Result & { id?: number }> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const checked = checkAlbum(input);
  if (!checked.ok) return checked;
  const v = checked.value;
  const base = slugOf(v.title, v.date);
  let slug = base;
  for (let n = 2; await db().one("select 1 from site.albums where slug = ?", slug); n++) slug = `${base}-${n}`;
  const now = Date.now();
  const row = await db().one<{ id: number }>(
    "insert into site.albums (slug, title, about, happened_on, when_text, published, created_at, updated_at, updated_by) values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id",
    slug,
    v.title,
    v.about,
    v.date,
    v.when,
    v.published,
    now,
    now,
    me.id
  );
  await audit(me, "made an album", `album ${row!.id}`, v.title);
  changed();
  return { ok: true, id: Number(row!.id) };
}

export async function updateAlbum(me: User, id: number, input: AlbumInput): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const checked = checkAlbum(input);
  if (!checked.ok) return checked;
  const v = checked.value;
  const n = await db().run(
    "update site.albums set title = ?, about = ?, happened_on = ?, when_text = ?, published = ?, updated_at = ?, updated_by = ? where id = ?",
    v.title,
    v.about,
    v.date,
    v.when,
    v.published,
    Date.now(),
    me.id,
    id
  );
  if (!n) return { ok: false, error: "That album is gone." };
  await audit(me, "changed an album", `album ${id}`, `${v.title}${v.published ? "" : " (hidden)"}`);
  changed();
  return { ok: true };
}

/** Files of photos added from the desk (those in the repo stay). */
const filesOf = (photos: Pick<PhotoRow, "src" | "thumb">[]) => photos.flatMap((p) => [p.src, p.thumb]).filter(isUploaded);

export async function deleteAlbum(me: User, id: number): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const album = await db().one<{ title: string }>("select title from site.albums where id = ?", id);
  if (!album) return { ok: false, error: "That album is gone." };
  const photos = await db().all<PhotoRow>("select src, thumb from site.photos where album_id = ?", id);
  await db().run("delete from site.albums where id = ?", id);
  await storage(SITE_BUCKET).remove(filesOf(photos));
  await audit(me, "deleted an album", `album ${id}`, `${album.title} (${photos.length} photo${photos.length === 1 ? "" : "s"})`);
  changed();
  return { ok: true };
}

async function photoOf(id: number) {
  return Number.isSafeInteger(id) ? db().one<PhotoRow>("select * from site.photos where id = ?", id) : undefined;
}

const touch = (albumId: number, me: User) => db().run("update site.albums set updated_at = ?, updated_by = ? where id = ?", Date.now(), me.id, albumId);

export async function updatePhoto(me: User, id: number, input: { alt: string; caption: string }): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const photo = await photoOf(id);
  if (!photo) return { ok: false, error: "That photo is gone." };
  const alt = input.alt.trim().slice(0, ALBUM_LIMITS.alt);
  if (alt.length < 3) return { ok: false, error: "Say what the photo shows, for people who can't see it." };
  const caption = input.caption.trim().slice(0, ALBUM_LIMITS.caption) || null;
  await db().run("update site.photos set alt = ?, caption = ? where id = ?", alt, caption, id);
  await touch(photo.album_id, me);
  await audit(me, "changed a photo's words", `photo ${id}`, caption ?? alt);
  changed();
  return { ok: true };
}

/** Moves a photo one place earlier (-1) or later (1) in its album. */
export async function movePhoto(me: User, id: number, by: -1 | 1): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const photo = await photoOf(id);
  if (!photo) return { ok: false, error: "That photo is gone." };
  await db().tx(async (tx) => {
    const order = (await tx.all<{ id: number }>("select id from site.photos where album_id = ? order by sort, id", photo.album_id)).map((r) => Number(r.id));
    const at = order.indexOf(Number(id));
    const to = at + by;
    if (at < 0 || to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    for (const [i, pid] of order.entries()) await tx.run("update site.photos set sort = ? where id = ?", i, pid);
  });
  await touch(photo.album_id, me);
  await audit(me, by < 0 ? "moved a photo earlier" : "moved a photo later", `photo ${id}`);
  changed();
  return { ok: true };
}

/** Makes a photo its album's cover (it leads the album's card and opens its page). */
export async function setCover(me: User, id: number): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const photo = await photoOf(id);
  if (!photo) return { ok: false, error: "That photo is gone." };
  // The larger cover and sketch made for the first albums belong to their first cover: from
  // now on the cover is the photo itself.
  await db().run(
    "update site.albums set cover_photo_id = ?, cover_src = null, cover_sketch = null, cover_width = null, cover_height = null, updated_at = ?, updated_by = ? where id = ?",
    id,
    Date.now(),
    me.id,
    photo.album_id
  );
  await audit(me, "chose an album's cover", `album ${photo.album_id}`, `photo ${id}`);
  changed();
  return { ok: true };
}

export async function deletePhoto(me: User, id: number): Promise<Result> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const photo = await photoOf(id);
  if (!photo) return { ok: false, error: "That photo is gone." };
  await db().tx(async (tx) => {
    // Was it the cover? Then the album's first photo leads again, without the old larger cover.
    await tx.run(
      "update site.albums set cover_photo_id = null, cover_src = null, cover_sketch = null, cover_width = null, cover_height = null where id = ? and cover_photo_id = ?",
      photo.album_id,
      id
    );
    await tx.run("delete from site.photos where id = ?", id);
  });
  await storage(SITE_BUCKET).remove(filesOf([photo]));
  await touch(photo.album_id, me);
  await audit(me, "deleted a photo", `photo ${id}`, `album ${photo.album_id}`);
  changed();
  return { ok: true };
}

// ---------- Adding photos ----------

/*
 * The browser sends each photo straight to Storage (a host caps what a request to us may
 * carry, and a camera's photo is bigger), into the private members' bucket under
 * site-pending/<who>/<token>: nothing unchecked is ever in the public bucket. Then we read
 * it, check it's a photo, make a 1600 px copy and a 640 px one for the grid (turned the
 * right way up, its hidden details gone), and put those in the public bucket `site`.
 */

export const sitePendingPath = (userId: number, token: string) => `site-pending/${userId}/${token}`;

export type SiteStarted = { ok: true; token: string; url: string } | { ok: false; error: string; status: number };

export async function startSitePhoto(me: User, albumId: number, size: number): Promise<SiteStarted> {
  if (!isModerator(me)) return { ok: false, error: NO, status: 403 };
  if (!Number.isSafeInteger(albumId) || !(await db().one("select 1 from site.albums where id = ?", albumId))) return { ok: false, error: "That album is gone.", status: 404 };
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, error: "Choose a photo first.", status: 400 };
  if (size > SITE_PHOTO_BYTES) return { ok: false, error: `This photo is too big. Photos can be up to ${SITE_PHOTO_BYTES / 1024 / 1024} MB.`, status: 413 };
  if (!(await withinLimit(`site-upload:${me.id}`, 300, 60 * 60_000))) return { ok: false, error: "That's a lot of photos for one hour. Try again later.", status: 429 };
  const token = randomToken(15);
  const path = sitePendingPath(me.id, token);
  // Offline, our own endpoint takes the bytes (app/api/site/put); on Supabase, Storage does.
  const url = usingSupabaseStorage() ? await storage().uploadUrl(path) : `/api/site/put?path=${encodeURIComponent(path)}`;
  return { ok: true, token, url };
}

/** Whether `path` is where `me` may send a photo's bytes (offline: app/api/site/put). */
export const isSitePendingPath = (me: User, path: string) => {
  const token = path.split("/").at(-1) ?? "";
  return isModerator(me) && TOKEN.test(token) && path === sitePendingPath(me.id, token);
};

type Made = { main: Uint8Array; width: number; height: number; thumb: Uint8Array; thumbWidth: number };

/** A photo made ready for the gallery: the right way up, nothing hidden in it, 1600 px and 640 px JPEGs. */
export async function preparePhoto(bytes: Uint8Array): Promise<Made | null> {
  const found = sniff(bytes);
  if (!found || found.kind !== "image") return null;
  try {
    const sharp = (await import("sharp")).default;
    const base = sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
    const main = await base.clone().resize({ width: MAIN_WIDTH, height: MAIN_WIDTH, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    const thumb = await base.clone().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return { main: new Uint8Array(main.data), width: main.info.width, height: main.info.height, thumb: new Uint8Array(thumb.data), thumbWidth: thumb.info.width };
  } catch (error) {
    console.error("showcase: couldn't read a photo:", error);
    return null;
  }
}

/** Puts a checked photo into an album, last. Exported for the tests (and small files). */
export async function addSitePhoto(me: User, albumId: number, bytes: Uint8Array, partKey = ""): Promise<Result & { id?: number }> {
  if (!isModerator(me)) return { ok: false, error: NO };
  const album = await db().one<{ title: string; when_text: string }>("select title, when_text from site.albums where id = ?", albumId);
  if (!album) return { ok: false, error: "That album is gone." };
  if (bytes.length > SITE_PHOTO_BYTES) return { ok: false, error: `This photo is too big. Photos can be up to ${SITE_PHOTO_BYTES / 1024 / 1024} MB.` };
  const made = await preparePhoto(bytes);
  if (!made) return { ok: false, error: "That file isn't a photo we can use. Use a JPEG, PNG or WebP photo." };
  const parts = await db().all<{ key: string }>("select key from site.album_parts where album_id = ? order by sort", albumId);
  const part = parts.some((p) => p.key === partKey) ? partKey : (parts[0]?.key ?? "");
  const name = randomToken(12);
  const src = `albums/${albumId}/${name}.jpg`;
  const thumb = `albums/${albumId}/${name}-thumb.jpg`;
  await storage(SITE_BUCKET).write(src, made.main, "image/jpeg");
  await storage(SITE_BUCKET).write(thumb, made.thumb, "image/jpeg");
  const alt = `${album.title}${album.when_text ? `, ${album.when_text}` : ""}`.slice(0, ALBUM_LIMITS.alt);
  const row = await db().one<{ id: number }>(
    `insert into site.photos (album_id, part_key, src, thumb, width, height, thumb_width, alt, sort, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, (select coalesce(max(sort), -1) + 1 from site.photos where album_id = ?), ?) returning id`,
    albumId,
    part,
    src,
    thumb,
    made.width,
    made.height,
    made.thumbWidth,
    alt,
    albumId,
    Date.now()
  );
  await touch(albumId, me);
  await audit(me, "added a photo", `photo ${row!.id}`, `album ${albumId}`);
  changed();
  return { ok: true, id: Number(row!.id) };
}

/** The last step: the photo's bytes have arrived. Check them, and put the photo in the album (or throw it away). */
export async function finishSitePhoto(me: User, albumId: number, token: string, partKey = ""): Promise<Result & { id?: number }> {
  if (!isModerator(me)) return { ok: false, error: NO };
  if (!TOKEN.test(token)) return { ok: false, error: "That upload has expired. Choose the photo again." };
  const path = sitePendingPath(me.id, token);
  const bytes = await storage().read(path);
  await storage().remove([path]);
  if (!bytes) return { ok: false, error: "The photo did not upload. Try again." };
  return addSitePhoto(me, albumId, bytes, partKey);
}
