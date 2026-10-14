import manifest from "./gallery-photos.json";
import videoList from "./gallery-videos.json";
import videoPosters from "./gallery-video-posters.json";
import { parseVideoLink, type VideoLink } from "./video";

/*
 * The public gallery: albums of the college's own photographs. An album is one kind of
 * event; when it happened more than once (the alumni meets, the job drives) each time is a
 * part of it. The files and their sizes come from scripts/make-gallery.py (into
 * public/assets/gallery and gallery-photos.json); what everything is, is written here.
 * Videos are links, listed in gallery-videos.json (see lib/video.ts).
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

export type AlbumPart = {
  /** Only albums with more than one part name them. */
  title?: string;
  when: string;
  source: keyof typeof SOURCES;
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
  /** The cover again, at 1000 px with its pencil sketch: it blooms in as the album opens. */
  cover: { src: string; sketch: string; width: number; height: number; alt: string };
};

export const SOURCES = {
  "old-site": "From the college’s old website (a copy saved in 2014).",
  portal: "From the old HKBK alumni website.",
  "college-site": "From the college’s news pages, hkbk.edu.in.",
  socials: "Videos from the college’s own YouTube, Instagram, Facebook and LinkedIn."
} as const;

type PartCopy = Omit<AlbumPart, "photos" | "videos"> & {
  /** One per photo, in order, where we know what each shows. */
  captions?: string[];
};

type AlbumCopy = Pick<Album, "title" | "date" | "when" | "description"> & {
  parts: Record<string, PartCopy>;
};

type Slug = keyof typeof manifest;

const COPY: Record<Slug, AlbumCopy> = {
  "graduation-day-2025": {
    title: "Graduation day",
    date: "2025-09-30",
    when: "September 2025",
    description: "The class of 2025 on their graduation day.",
    parts: { all: { when: "September 2025", source: "portal", captions: ["The class of 2025 throw their caps in the air"] } }
  },
  "swagatha-2025": {
    title: "Swagatha ’25",
    date: "2025-09-29",
    when: "September 2025",
    description: "Engineering orientation day: the college welcomes its new first-year students.",
    parts: { all: { when: "September 2025", source: "portal" } }
  },
  "onam-2025": {
    title: "Onam",
    date: "2025-09-28",
    when: "September 2025",
    description: "Onam on campus: a dance on stage.",
    parts: { all: { when: "September 2025", source: "portal", captions: ["A dancer at the Onam celebration"] } }
  },
  "independence-day-2025": {
    title: "Independence Day",
    date: "2025-08-15",
    when: "15 August 2025",
    description: "The 79th Independence Day: raising the flag, and celebrations on campus.",
    parts: { all: { when: "15 August 2025", source: "portal" } }
  },
  "cyber-security-conclave-2025": {
    title: "Cyber Security Conclave",
    date: "2025-02-06",
    when: "6 February 2025",
    description: "ICSC 2025, the college’s International Cyber Security Conclave at CMA Royal, Bengaluru: talks and panels on keeping computers and data safe.",
    parts: { all: { when: "6 February 2025", source: "portal" } }
  },
  "swachh-bharat-2024": {
    title: "Swachh Bharat",
    date: "2024-12-11",
    when: "11 December 2024",
    description: "57 final-year AIML students cleaned up the grounds of the government school in Nagawara.",
    parts: { all: { when: "11 December 2024", source: "portal", captions: ["AIML students clearing the school grounds"] } }
  },
  "job-drives": {
    title: "Job drives",
    date: "2011-01",
    when: "2010 and 2011",
    description: "The days the Indian Army and the Indian Air Force came to the college to hire students.",
    parts: {
      "indian-air-force-2011": {
        title: "Indian Air Force",
        when: "2011",
        source: "old-site",
        captions: [
          "The college’s welcome sign for the Indian Air Force",
          "Students gathering on the college ground",
          "Students lining up past the college buses",
          "The queue beside the college buses",
          "An interview with the selection panel",
          "Students waiting under the shelter"
        ]
      },
      "indian-army-2010": {
        title: "Indian Army",
        when: "2010",
        source: "old-site",
        captions: [
          "The college’s welcome sign for the Indian Army",
          "In the college office",
          "Army officers in the college office",
          "A full talk in the big tent",
          "Students at the talk",
          "Students waiting their turn",
          "Waiting in the hall",
          "The interview panel"
        ]
      }
    }
  },
  "alumni-meets": {
    title: "Alumni meets",
    date: "2009-01",
    when: "2008 and 2009",
    description: "Former students back at the college to meet each other and today’s students.",
    parts: {
      "2009": { title: "Alumni meet 2009", when: "2009", source: "old-site" },
      "2008": { title: "Alumni meet 2008", when: "2008", source: "old-site" }
    }
  },
  "around-campus-2024-25": {
    title: "Around campus",
    date: "2025-06-21",
    when: "2024 – 2025",
    description: "Yoga Day, a poster competition, mock interviews, a food carnival and a road safety show, and two films about the college.",
    parts: {
      "yoga-day-2025": {
        title: "International Yoga Day",
        when: "21 June 2025",
        source: "college-site",
        captions: ["Students doing yoga on the college ground"]
      },
      "cse-poster-competition-2024": {
        title: "Poster competition, Computer Science",
        when: "5 December 2024",
        source: "college-site",
        captions: ["Winners receiving their certificates"]
      },
      "ece-mock-interviews-2024": {
        title: "Mock interviews, Electronics and Communication",
        when: "23 November 2024",
        source: "college-site",
        captions: ["Final-year ECE students in a practice group discussion"]
      },
      "food-carnival-2024": {
        title: "Food Carnival",
        when: "14 November 2024",
        source: "college-site",
        captions: ["Third-semester students and teachers at the food stalls"]
      },
      "vyom-2024": {
        title: "VYOM 2024, road safety show",
        when: "12 November 2024",
        source: "college-site",
        captions: ["A stunt rider at the road safety show"]
      }
    }
  },
  "sports-day": {
    title: "Sports day",
    date: "",
    when: "Before 2014",
    description: "Games and races on the college ground.",
    parts: { all: { when: "Before 2014", source: "old-site" } }
  },
  "uninor-cup": {
    title: "The Uninor Cup",
    date: "",
    when: "Before 2014",
    description: "The college team in blue, and the prize-giving at the Uninor Cup.",
    parts: { all: { when: "Before 2014", source: "old-site" } }
  }
};

const BASE = "/assets/gallery";

type VideoEntry = {
  album: string;
  /** A part of the album's photos ("all" when it has one), or a new part just for videos. */
  part: string;
  url: string;
  title: string;
  /** For a part just for videos: its name and when. */
  partTitle?: string;
  when?: string;
};
const POSTERS: Record<string, { src: string; width: number; height: number }> = videoPosters;

/** A video from its entry: the link read, its poster attached if one was saved. */
export const makeVideo = (entry: Pick<VideoEntry, "url" | "title">): GalleryVideo => ({
  ...parseVideoLink(entry.url),
  title: entry.title,
  poster: POSTERS[entry.url]
});

const VIDEOS: VideoEntry[] = videoList.videos;
const file = (slug: string, n: number, suffix = "") => `${BASE}/${slug}/${String(n).padStart(2, "0")}${suffix}.jpg`;

function buildAlbum(slug: Slug): Album {
  const copy = COPY[slug];
  const built = manifest[slug];
  const parts = built.parts.map((part): AlbumPart => {
    const partCopy = copy.parts[part.key];
    if (!partCopy) throw new Error(`${slug}: no words for part "${part.key}"`);
    const { captions, ...rest } = partCopy;
    if (captions && captions.length !== part.photos.length) {
      throw new Error(`${slug}/${part.key}: ${captions.length} captions for ${part.photos.length} photos`);
    }
    const name = rest.title ?? copy.title;
    return {
      ...rest,
      videos: VIDEOS.filter((v) => v.album === slug && v.part === part.key).map(makeVideo),
      photos: part.photos.map((p, i) => ({
        src: file(slug, p.n),
        width: p.w,
        height: p.h,
        thumb: file(slug, p.n, "-thumb"),
        thumbWidth: p.tw,
        alt: captions?.[i] ?? `${name}, ${rest.when}`, // the lightbox gives its place: "3 / 12"
        caption: captions?.[i]
      }))
    };
  });
  // Parts with only videos (a film about the campus, an alumni story) come after the photos.
  const photoKeys = new Set(built.parts.map((part) => part.key));
  const videoOnly = VIDEOS.filter((v) => v.album === slug && !photoKeys.has(v.part));
  for (const key of [...new Set(videoOnly.map((v) => v.part))]) {
    const entries = videoOnly.filter((v) => v.part === key);
    parts.push({
      title: entries[0].partTitle,
      when: entries[0].when ?? "",
      source: "socials",
      photos: [],
      videos: entries.map(makeVideo)
    });
  }
  const photos = parts.flatMap((part) => part.photos);
  const lead = photos[built.cover - 1];
  // The rest of the mosaic: the first photo of each other part, then whatever comes next.
  const others = [...parts.map((part) => part.photos[0]), ...photos].filter((photo, i, all) => photo !== lead && all.indexOf(photo) === i);
  return {
    slug,
    title: copy.title,
    date: copy.date,
    when: copy.when,
    description: copy.description,
    parts,
    photos,
    videos: parts.flatMap((part) => part.videos),
    mosaic: [lead, ...others.slice(0, 2)],
    cover: {
      src: `${BASE}/${slug}/cover.jpg`,
      sketch: `${BASE}/${slug}/cover-sketch.jpg`,
      width: built.coverWidth,
      height: built.coverHeight,
      alt: lead.alt
    }
  };
}

// Every video must name an album that exists, and either one of its parts or a new part
// with a name and a date, so a typo fails the build.
for (const v of VIDEOS) {
  const album = manifest[v.album as Slug];
  if (!album) throw new Error(`gallery-videos.json: no album "${v.album}" for ${v.url}`);
  if (!album.parts.some((part) => part.key === v.part) && !(v.partTitle && v.when)) {
    throw new Error(`gallery-videos.json: "${v.album}" has no part "${v.part}"; a new part needs a partTitle and a when (${v.url})`);
  }
}

export const ALBUMS: Album[] = (Object.keys(COPY) as Slug[]).map(buildAlbum).sort((a, b) => b.date.localeCompare(a.date));

export const albumBySlug = (slug: string) => ALBUMS.find((album) => album.slug === slug);

export const PHOTO_COUNT = ALBUMS.reduce((sum, album) => sum + album.photos.length, 0);

/** "9 photos", "9 photos · 2 videos", "1 video". */
export function countLabel(photos: number, videos: number) {
  const say = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  return [photos && say(photos, "photo"), videos && say(videos, "video")].filter(Boolean).join(" · ");
}

/** Where an album's photos came from: one line per source (the job drives have two). */
export const albumSources = (album: Album) => [...new Set(album.parts.map((part) => SOURCES[part.source]))];
