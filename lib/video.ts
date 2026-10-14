/*
 * Video links for the gallery: paste the address of a YouTube, Instagram, Facebook or
 * LinkedIn video (as copied from the browser or the app's Share button) and this works
 * out which player to load. Nothing from those sites loads until someone presses play.
 */

export type VideoProvider = "youtube" | "instagram" | "facebook" | "linkedin";

/** How the player is shaped: a landscape video, a phone-tall one, or a framed post. */
export type VideoShape = "wide" | "tall" | "post";

export type VideoLink = {
  provider: VideoProvider;
  providerName: string;
  /** The provider's own id for the video or post. */
  id: string;
  /** The link as given: where "Watch on …" goes, and where the tile leads without JavaScript. */
  url: string;
  /** The player to load in the lightbox. */
  embed: string;
  shape: VideoShape;
};

const NAMES: Record<VideoProvider, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn"
};

const link = (provider: VideoProvider, id: string, url: string, embed: string, shape: VideoShape): VideoLink => ({
  provider,
  providerName: NAMES[provider],
  id,
  url,
  embed,
  shape
});

function youtube(url: URL): VideoLink | null {
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id = "";
  let shape: VideoShape = "wide";
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, rest] = url.pathname.split("/");
    if (kind === "watch") id = url.searchParams.get("v") ?? "";
    else if (kind === "shorts" || kind === "live" || kind === "embed") {
      id = rest ?? "";
      if (kind === "shorts") shape = "tall";
    }
  } else return null;
  if (!/^[\w-]{11}$/.test(id)) return null;
  // The no-cookies player: YouTube sets nothing in the visitor's browser until they play.
  return link("youtube", id, url.href, `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`, shape);
}

function instagram(url: URL): VideoLink | null {
  if (!/(^|\.)instagram\.com$/.test(url.hostname)) return null;
  // /p/<code>, /reel/<code>, /reels/<code>, /tv/<code>, optionally after the account's name.
  const m = url.pathname.match(/\/(p|reels?|tv)\/([\w-]+)/);
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  return link("instagram", m[2], url.href, `https://www.instagram.com/${kind}/${m[2]}/embed/`, "post");
}

function facebook(url: URL): VideoLink | null {
  const host = url.hostname.replace(/^(www|m|web)\./, "");
  if (host !== "facebook.com" && host !== "fb.watch") return null;
  const id =
    url.searchParams.get("v") ?? // /watch/?v=<id>
    url.pathname.match(/\/(?:videos|reel)\/(?:[\w.-]+\/)?(\d+)/)?.[1] ?? // /<page>/videos/<id>, /reel/<id>
    url.pathname.match(/\/share\/[vr]\/([\w-]+)/)?.[1] ?? // /share/v/<code>
    (host === "fb.watch" ? url.pathname.slice(1).replace(/\/$/, "") : "");
  if (!id) return null;
  const shape: VideoShape = /\/reel\/|\/share\/r\//.test(url.pathname) ? "tall" : "wide";
  // Facebook's own video player, pointed at the post: it resolves its short links itself.
  const href = /^\d+$/.test(id) ? `https://www.facebook.com/watch/?v=${id}` : url.href;
  return link("facebook", id, url.href, `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&autoplay=true`, shape);
}

function linkedin(url: URL): VideoLink | null {
  if (!/(^|\.)linkedin\.com$/.test(url.hostname)) return null;
  const path = decodeURIComponent(url.pathname);
  // /feed/update/urn:li:activity:<id>, or /posts/<who>_<words>-activity-<id>-<code>
  const m = path.match(/urn:li:(activity|ugcPost|share):(\d+)/) ?? path.match(/-(activity|ugcPost|share)-(\d+)-/);
  if (!m) return null;
  return link("linkedin", m[2], url.href, `https://www.linkedin.com/embed/feed/update/urn:li:${m[1]}:${m[2]}`, "post");
}

/** Reads a pasted video link. Throws if it isn't one we can play, so a typo fails the build. */
export function parseVideoLink(raw: string): VideoLink {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`Not a link: "${raw}"`);
  }
  const found = youtube(url) ?? instagram(url) ?? facebook(url) ?? linkedin(url);
  if (!found) throw new Error(`Not a YouTube, Instagram, Facebook or LinkedIn video link: "${raw}"`);
  return found;
}

/** The shape of a video's tile and player, as width / height. */
export const SHAPE_RATIO: Record<VideoShape, number> = { wide: 16 / 9, tall: 9 / 16, post: 4 / 5 };
