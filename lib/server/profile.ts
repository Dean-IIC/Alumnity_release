import { db } from "./db";
import type { User } from "./auth";
import { mediaById, removeMedia, type MediaKind } from "./media";
import { SECTION_KINDS, SECTION_LIMITS, SECTIONS, type SectionEntry, type SectionKind } from "../profile-sections";
import { cleanCrop, photoKey, type Crop } from "../photo-crop";

/*
 * A member's page: what they're doing now, a few lines about them, what they're good at,
 * what they're happy to do for others, and where to find them. Every part has its own
 * "who can see this": everyone on Alumnity, their batch (same branch and joining year),
 * or only them. Their email is never shown on it.
 */

export const FIELDS = ["now", "journey", "about", "skills", "happyTo", "links"] as const;
export type Field = (typeof FIELDS)[number];
export type Visibility = "everyone" | "connections" | "batch" | "me";

/** A stop on the way since HKBK: "2006 · Moved to Pune for my first job". */
export type Milestone = { year: number; text: string };

/**
 * An upload in use on a page: its id (served at /media/<id>), what it is, and how its owner
 * framed it (lib/photo-crop.ts; absent: as it comes, centred). A new upload starts unframed.
 */
export type MediaRef = { id: string; kind: MediaKind; crop?: Crop };

export type Profile = {
  /** Their own photo; without one, their ink seal. */
  photo: MediaRef | null;
  /** Their cover: an image, a video or an HTML file; without one, the campus of their year. */
  cover: MediaRef | null;
  /** Without a cover of their own: where they've moved the campus drawing to (null: where it always sits). */
  campusCrop: Crop | null;
  title: string;
  company: string;
  city: string;
  /** The stops between leaving HKBK and now, oldest first. */
  journey: Milestone[];
  about: string;
  skills: string[];
  happyTo: { mentor: boolean; refer: boolean; talk: boolean };
  /** A student's side of it: what they'd like help with (shown with the same "who can see this" as happyTo). */
  seeking: { mentor: boolean; internship: boolean; referral: boolean };
  links: { linkedin: string; website: string };
  visibility: Record<Field, Visibility>;
  /** The extra sections they've added (lib/profile-sections.ts): a kind not added is absent. */
  sections: Partial<Record<SectionKind, SectionEntry[]>>;
  sectionsVisibility: Record<SectionKind, Visibility>;
  /** A post of their own pinned to the top of their page (shown to whoever may see that post). */
  featured: number | null;
};

export const EMPTY_PROFILE: Profile = {
  photo: null,
  cover: null,
  campusCrop: null,
  title: "",
  company: "",
  city: "",
  journey: [],
  about: "",
  skills: [],
  happyTo: { mentor: false, refer: false, talk: false },
  seeking: { mentor: false, internship: false, referral: false },
  links: { linkedin: "", website: "" },
  visibility: { now: "everyone", journey: "everyone", about: "everyone", skills: "everyone", happyTo: "everyone", links: "batch" },
  sections: {},
  sectionsVisibility: { experience: "everyone", education: "everyone", projects: "everyone", certifications: "everyone", organisations: "everyone", honours: "everyone", languages: "everyone" },
  featured: null
};

export const LIMITS = { title: 80, company: 80, city: 60, about: 600, skill: 30, skills: 12, link: 200, stop: 90, stops: 8 } as const;

export async function profileOf(userId: number): Promise<Profile> {
  const row = await db().one<{ data: string }>("select data from profiles where user_id = ?", userId);
  return profileFromData(row?.data ?? null);
}

/** A page from its stored JSON (null: an empty page), with every field present. For lists read in one query. */
export function profileFromData(data: string | null): Profile {
  if (!data) return structuredClone(EMPTY_PROFILE);
  const saved = JSON.parse(data) as Partial<Profile>;
  return {
    ...structuredClone(EMPTY_PROFILE),
    ...saved,
    happyTo: { ...EMPTY_PROFILE.happyTo, ...saved.happyTo },
    seeking: { ...EMPTY_PROFILE.seeking, ...saved.seeking },
    links: { ...EMPTY_PROFILE.links, ...saved.links },
    visibility: { ...EMPTY_PROFILE.visibility, ...saved.visibility },
    sections: { ...saved.sections },
    sectionsVisibility: { ...EMPTY_PROFILE.sectionsVisibility, ...saved.sectionsVisibility }
  };
}

const isVisibility = (v: unknown): v is Visibility => v === "everyone" || v === "connections" || v === "batch" || v === "me";

/** The sections the form sent, each entry cleaned, empty ones dropped, newest first; a kind left with none is removed. */
function parseSections(input: unknown): { sections: Profile["sections"] } | { error: string } {
  const sent = (typeof input === "object" && input ? input : {}) as Record<string, unknown>;
  const thisYear = new Date().getFullYear();
  const year = (v: unknown) => {
    const y = Math.round(Number(v));
    return Number.isFinite(y) && y >= 1950 && y <= thisYear + 6 ? y : null;
  };
  const sections: Profile["sections"] = {};
  for (const kind of SECTION_KINDS) {
    const info = SECTIONS[kind];
    const list = Array.isArray(sent[kind]) ? (sent[kind] as Record<string, unknown>[]) : [];
    const entries: SectionEntry[] = [];
    for (const raw of list.slice(0, SECTION_LIMITS.entries)) {
      const title = clean(raw?.title, SECTION_LIMITS.title);
      if (!title) continue;
      let org = clean(raw?.org, SECTION_LIMITS.org);
      if (info.levels && !info.levels.includes(org)) org = info.levels[1];
      if (!info.org) org = "";
      const from = info.years ? year(raw?.from) : null;
      const current = info.years === "range" && raw?.current === true;
      let to = info.years === "range" && !current ? year(raw?.to) : null;
      if (from && to && to < from) to = from;
      const link = info.link ? cleanLink(raw?.link) : "";
      if (link === null) return { error: `A link in ${info.label} doesn't look right. Check it and try again.` };
      const detail = info.detail ? (typeof raw?.detail === "string" ? raw.detail.trim().slice(0, SECTION_LIMITS.detail) : "") : "";
      entries.push({ title, org, from, to, current, link, detail });
    }
    // The newest (and anything still going) first.
    entries.sort((a, b) => Number(b.current) - Number(a.current) || (b.to ?? b.from ?? 0) - (a.to ?? a.from ?? 0));
    if (entries.length) sections[kind] = entries;
  }
  return { sections };
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A link we'll show: only http(s), and LinkedIn links must be LinkedIn's. */
function cleanLink(value: unknown, linkedinOnly = false): string | null {
  const raw = clean(value, LIMITS.link);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (linkedinOnly && !/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Reads what the edit form sent, keeping only what's allowed; says what's wrong if anything is. */
/** An upload the owner may put on their page: theirs, and the right kind (a photo must be an image). */
async function ownMedia(value: unknown, ownerId: number | undefined, imageOnly: boolean): Promise<MediaRef | null | false> {
  const id = typeof value === "object" && value ? (value as { id?: unknown }).id : value;
  if (!id) return null;
  if (typeof id !== "string" || ownerId === undefined) return false;
  const media = await mediaById(id);
  if (!media || media.userId !== ownerId || (imageOnly && media.kind !== "image")) return false;
  // An HTML cover lays itself out to fit: there's nothing to frame.
  const crop = media.kind === "html" ? undefined : cleanCrop((value as { crop?: unknown }).crop);
  return crop ? { id: media.id, kind: media.kind, crop } : { id: media.id, kind: media.kind };
}

export async function parseProfile(input: Record<string, unknown>, ownerId?: number): Promise<{ profile: Profile } | { error: string }> {
  const visibility = { ...EMPTY_PROFILE.visibility };
  const sent = (input.visibility ?? {}) as Record<string, unknown>;
  for (const field of FIELDS) {
    const v = sent[field];
    if (v === "everyone" || v === "connections" || v === "batch" || v === "me") visibility[field] = v;
  }
  const skills = (Array.isArray(input.skills) ? input.skills : String(input.skills ?? "").split(","))
    .map((s) => clean(s, LIMITS.skill))
    .filter(Boolean)
    .filter((s, i, all) => all.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, LIMITS.skills);
  const happy = (input.happyTo ?? {}) as Record<string, unknown>;
  const seek = (input.seeking ?? {}) as Record<string, unknown>;
  const links = (input.links ?? {}) as Record<string, unknown>;
  const linkedin = cleanLink(links.linkedin, true);
  if (linkedin === null) return { error: "Use your LinkedIn link, like linkedin.com/in/your-name." };
  const website = cleanLink(links.website);
  if (website === null) return { error: "Your website link doesn't look right. Check it and try again." };
  const parsed = parseSections(input.sections);
  if ("error" in parsed) return parsed;
  const sentWho = (input.sectionsVisibility ?? {}) as Record<string, unknown>;
  const sectionsVisibility = { ...EMPTY_PROFILE.sectionsVisibility };
  for (const kind of SECTION_KINDS) if (isVisibility(sentWho[kind])) sectionsVisibility[kind] = sentWho[kind] as Visibility;
  const [photo, cover] = await Promise.all([ownMedia(input.photo, ownerId, true), ownMedia(input.cover, ownerId, false)]);
  const featured = await ownPost(input.featured, ownerId);
  if (photo === false || cover === false) return { error: "We couldn't find that file. Please upload it again." };
  const about = typeof input.about === "string" ? input.about.trim().slice(0, LIMITS.about) : "";
  const thisYear = new Date().getFullYear();
  const journey = (Array.isArray(input.journey) ? input.journey : [])
    .map((m) => ({ year: Math.round(Number((m as Milestone)?.year)), text: clean((m as Milestone)?.text, LIMITS.stop) }))
    .filter((m) => m.text && m.year >= 1998 && m.year <= thisYear)
    .sort((a, b) => a.year - b.year)
    .slice(0, LIMITS.stops);
  return {
    profile: {
      photo,
      cover,
      campusCrop: cleanCrop(input.campusCrop) ?? null,
      title: clean(input.title, LIMITS.title),
      company: clean(input.company, LIMITS.company),
      city: clean(input.city, LIMITS.city),
      journey,
      about,
      skills,
      happyTo: { mentor: happy.mentor === true, refer: happy.refer === true, talk: happy.talk === true },
      seeking: { mentor: seek.mentor === true, internship: seek.internship === true, referral: seek.referral === true },
      links: { linkedin, website },
      visibility,
      sections: parsed.sections,
      sectionsVisibility,
      featured
    }
  };
}

/** A post the owner may pin: their own and not taken down; anything else is quietly dropped. */
export async function ownPost(value: unknown, ownerId: number | undefined): Promise<number | null> {
  const id = Number(value);
  if (!ownerId || !Number.isSafeInteger(id) || id <= 0) return null;
  const row = await db().one("select 1 from posts where id = ? and author = ? and removed_at is null", id, ownerId);
  return row ? id : null;
}

/**
 * A page as stored: JSON, with every piece of text made safe for Postgres to read as JSON.
 * A NUL character ("\u0000" in the JSON) or half of an emoji (a lone surrogate) saves as
 * text, but every query that reads the page as jsonb then fails: seen in the security
 * review, one member's page made Home, People and the desk fail for everyone who'd see them,
 * and no Ask could be sent. So those are dropped (or made "�") on the way in.
 */
export const storedProfile = (profile: Profile) =>
  JSON.stringify(profile, (_, value: unknown) => (typeof value === "string" ? value.replace(/\0/g, "").toWellFormed() : value));

export async function saveProfile(userId: number, profile: Profile) {
  // Uploads it no longer uses are deleted, not left lying about.
  const before = await profileOf(userId);
  for (const old of [before.photo, before.cover]) {
    if (old && old.id !== profile.photo?.id && old.id !== profile.cover?.id) await removeMedia(userId, old.id);
  }
  await db().run(
    "insert into profiles (user_id, data, updated_at) values (?, ?, ?) on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at",
    userId,
    storedProfile(profile),
    Date.now()
  );
}

/** Who sees what: the owner sees everything; connections see "connections" and "batch" parts; their batch sees "batch" parts; every member sees "everyone" parts. */
export function canSee(
  viewer: Pick<User, "id" | "branch" | "joined"> | null,
  owner: Pick<User, "id" | "branch" | "joined">,
  visibility: Visibility,
  isConnection = false
) {
  if (viewer?.id === owner.id) return true;
  if (!viewer) return false; // pages are for members only
  if (visibility === "everyone") return true;
  if (visibility === "connections") return isConnection;
  if (visibility === "batch") return isConnection || (viewer.branch === owner.branch && viewer.joined === owner.joined);
  return false;
}

/** The profile as `viewer` may see it: hidden parts are emptied out on the server, never sent. */
export function profileFor(
  viewer: Pick<User, "id" | "branch" | "joined"> | null,
  owner: Pick<User, "id" | "branch" | "joined">,
  profile: Profile,
  isConnection = false
): Profile {
  const show = (field: Field) => canSee(viewer, owner, profile.visibility[field], isConnection);
  return {
    photo: profile.photo,
    cover: profile.cover,
    campusCrop: profile.campusCrop,
    title: show("now") ? profile.title : "",
    company: show("now") ? profile.company : "",
    city: show("now") ? profile.city : "",
    journey: show("journey") ? profile.journey : [],
    about: show("about") ? profile.about : "",
    skills: show("skills") ? profile.skills : [],
    happyTo: show("happyTo") ? profile.happyTo : { mentor: false, refer: false, talk: false },
    seeking: show("happyTo") ? profile.seeking : { mentor: false, internship: false, referral: false },
    links: show("links") ? profile.links : { linkedin: "", website: "" },
    visibility: viewer?.id === owner.id ? profile.visibility : EMPTY_PROFILE.visibility,
    // Each section only if this viewer may see it; who-can-see settings are the owner's alone.
    sections: Object.fromEntries(
      SECTION_KINDS.filter((k) => profile.sections[k]?.length && canSee(viewer, owner, profile.sectionsVisibility[k], isConnection)).map((k) => [k, profile.sections[k]!])
    ),
    sectionsVisibility: viewer?.id === owner.id ? profile.sectionsVisibility : EMPTY_PROFILE.sectionsVisibility,
    // Only an id: the post itself is fetched as this viewer may see it (lib/server/posts.ts postFor).
    featured: profile.featured
  };
}

/**
 * Members' profile photos, for avatars in lists: one query for many people. Each is a photo
 * key (lib/photo-crop.ts): the upload id, with how they framed it when they have, so every
 * face shows as they chose without asking again.
 */
export async function photoIdsOf(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids)].filter(Number.isSafeInteger).slice(0, 2000);
  if (!unique.length) return new Map();
  const rows = await db().all<{ user_id: number; photo: string | null; crop: string | null }>(
    `select user_id, data::jsonb -> 'photo' ->> 'id' as photo, data::jsonb -> 'photo' ->> 'crop' as crop from profiles where user_id in (${unique.map(() => "?").join(",")})`,
    ...unique
  );
  return new Map(rows.filter((r) => r.photo).map((r) => [r.user_id, photoKey(r.photo!, r.crop ? cleanCrop(parseJson(r.crop)) : undefined)]));
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
