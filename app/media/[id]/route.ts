import { NextResponse } from "next/server";
import { signedInUser, type User } from "../../../lib/server/auth";
import { db } from "../../../lib/server/db";
import { mediaById, mediaLink, pickSize, readMedia, type Media } from "../../../lib/server/media";
import { blockIds } from "../../../lib/server/people";
import { canSeePostMedia } from "../../../lib/server/posts";
import { isModerator } from "../../../lib/server/roles";
import { canSeeStoryMedia } from "../../../lib/server/stories";

/*
 * A member's upload, for signed-in members only. Each kind is served so it can only be
 * what it is: never sniffed as something else, never run against the site. HTML covers
 * get a sandbox even when opened on their own: an opaque origin, inline scripts and styles
 * only, and no network at all (so nothing can be fetched, sent, or tracked).
 *
 * Photos and videos, once the viewer is allowed, are fetched straight from Storage by a
 * link that works for an hour (so videos stream from there, not through here). HTML is
 * always served from here, so its sandbox goes with it.
 */

/** How long a direct link works; the browser keeps the redirect a little less. */
const LINK_LIFE = 60 * 60;

const HTML_POLICY = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:"
].join("; ");

async function canSeeOwnedMedia(viewer: User, media: Media): Promise<boolean> {
  if (media.userId === viewer.id || isModerator(viewer)) return true;
  const [owner, blocked, cause] = await Promise.all([
    db().one<{ suspended_at: number | null }>("select suspended_at from users where id = ?", media.userId),
    blockIds(viewer.id),
    db().one<{ status: string }>("select status from causes where cover = ? order by status = 'live' desc limit 1", media.id)
  ]);
  if (!owner || owner.suspended_at !== null || blocked.has(media.userId)) return false;
  return !cause || cause.status === "live" || cause.status === "closed";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await signedInUser();
  if (!viewer) return new NextResponse("Log in to see this.", { status: 401 });
  const media = await mediaById((await params).id);
  if (!media) return new NextResponse("Not found.", { status: 404 });
  // A photo on a post or a story is only for those who may see that post or story (the
  // same "not found" either way, so its existence isn't given away).
  const onPost = await canSeePostMedia(viewer, media.id);
  const onStory = onPost === null ? await canSeeStoryMedia(viewer, media.id) : null;
  if (onPost === false || onStory === false) return new NextResponse("Not found.", { status: 404 });
  // Anything else (a profile photo or cover, a cause's cover): not for someone the owner
  // has blocked or who blocked them, not once the owner is suspended, and a cause's cover
  // only once the desk has put the cause up. The desk sees everything (it reviews them).
  if (onPost === null && onStory === null && !(await canSeeOwnedMedia(viewer, media))) return new NextResponse("Not found.", { status: 404 });

  // A smaller copy of a photo, if the page asked for one (?w=…).
  const width = Number(new URL(request.url).searchParams.get("w"));
  const file = media.kind === "image" ? pickSize(media, Number.isFinite(width) && width > 0 ? Math.min(width, 4000) : undefined) : { path: media.path, mime: media.mime };

  const headers: Record<string, string> = {
    "content-type": media.kind === "html" ? "text/html; charset=utf-8" : file.mime,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=86400",
    "referrer-policy": "no-referrer",
    // Only our own pages may frame it. Named outright: in a sandbox the file has no origin of its own, so 'self' would match nothing.
    "content-security-policy": media.kind === "html" ? `${HTML_POLICY}; frame-ancestors ${new URL(request.url).origin}` : "default-src 'none'; sandbox",
    "cross-origin-resource-policy": "same-origin"
  };

  if (media.kind !== "html") {
    const link = await mediaLink(media, LINK_LIFE, file.path);
    if (link) return NextResponse.redirect(link, { status: 302, headers: { "cache-control": `private, max-age=${LINK_LIFE - 600}`, "referrer-policy": "no-referrer" } });
  }

  const bytes = await readMedia(media, file.path);
  if (!bytes) return new NextResponse("Not found.", { status: 404 });
  // Videos are fetched in pieces as they play (and as you skip about).
  const size = bytes.length;
  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (media.kind === "video" && range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new NextResponse(bytes.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) }
    });
  }
  return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "accept-ranges": media.kind === "video" ? "bytes" : "none", "content-length": String(size) } });
}
