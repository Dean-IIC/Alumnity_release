import type { VideoLink } from "./video";

/*
 * The public gallery: albums of the college's own photographs. An album is one kind of
 * event; when it happened more than once (the alumni meets, the job drives) each time is a
 * part of it. The albums live in the database's `site` schema, and the college desk keeps
 * them (lib/server/showcase.ts reads them into these shapes). The first albums' photo
 * files are in the repo (public/assets/gallery, made by scripts/make-gallery.py); photos
 * added from the desk are in the Storage bucket `site`. Videos are links (lib/video.ts).
 */

export type GalleryPhoto = {
  /** 1600 px at most; the old website's photos were 800 px to begin with. */
  src: string;
  width: number;
  height: number;
  /** 640 px wide, for the grid. */
  thumb: string;
  thumbWidth: number;
  alt: string;
  /** Shown on the photo, where we know what it shows. */
  caption?: string;
};

export type GalleryVideo = VideoLink & {
  title: string;
  /** A still for its tile: a YouTube thumbnail saved by scripts/fetch-video-posters.py, or one we were given. */
  poster?: { src: string; width: number; height: number };
};

export const isVideo = (item: GalleryPhoto | GalleryVideo): item is GalleryVideo => "embed" in item;

export const SOURCES = {
  "old-site": "From the college’s old website (a copy saved in 2014).",
  portal: "From the old HKBK alumni website.",
  "college-site": "From the college’s news pages, hkbk.edu.in.",
  socials: "Videos from the college’s own YouTube, Instagram, Facebook and LinkedIn."
} as const;

export type Source = keyof typeof SOURCES;

export type AlbumPart = {
  /** Only albums with more than one part name them. */
  title?: string;
  when: string;
  /** Where its photos came from (none for photos the college added from its desk). */
  source: Source | null;
  photos: GalleryPhoto[];
  /** Shown after the part's photos. */
  videos: GalleryVideo[];
};

export type Album = {
  slug: string;
  title: string;
  /** For putting albums in order, newest first: "2025-09" (undated albums sort last). */
  date: string;
  /** When, in words, as precisely as we know. */
  when: string;
  description: string;
  parts: AlbumPart[];
  /** Every photo, in order, across the parts. */
  photos: GalleryPhoto[];
  videos: GalleryVideo[];
  /** The album's card: its cover large, then two more (from other parts, where it has them). */
  mosaic: GalleryPhoto[];
  /** The cover again, larger, with its pencil sketch: it blooms in as the album opens. */
  cover: { src: string; sketch: string; width: number; height: number; alt: string };
};

/** "9 photos", "9 photos · 2 videos", "1 video". */
export function countLabel(photos: number, videos: number) {
  const say = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  return [photos && say(photos, "photo"), videos && say(videos, "video")].filter(Boolean).join(" · ");
}

/** Where an album's photos came from: one line per source (the job drives have two). */
export const albumSources = (album: Album) => [...new Set(album.parts.flatMap((part) => (part.source ? [SOURCES[part.source]] : [])))];

export const photoCount = (albums: Album[]) => albums.reduce((sum, album) => sum + album.photos.length, 0);
