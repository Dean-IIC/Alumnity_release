import { NextResponse } from "next/server";
import { userForSession } from "../../../lib/server/auth";
import { mediaById, mediaSize, readMedia } from "../../../lib/server/media";
import { sessionToken } from "../../../lib/server/http";

/*
 * A member's upload, for signed-in members only. Each kind is served so it can only be
 * what it is: never sniffed as something else, never run against the site. HTML covers
 * get a sandbox even when opened on their own: an opaque origin, inline scripts and styles
 * only, and no network at all (so nothing can be fetched, sent, or tracked).
 */

const HTML_POLICY = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:"
].join("; ");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!userForSession(sessionToken(request))) return new NextResponse("Log in to see this.", { status: 401 });
  const media = mediaById((await params).id);
  if (!media) return new NextResponse("Not found.", { status: 404 });

  const headers: Record<string, string> = {
    "content-type": media.kind === "html" ? "text/html; charset=utf-8" : media.mime,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=86400",
    "referrer-policy": "no-referrer",
    // Only our own pages may frame it. Named outright: in a sandbox the file has no origin of its own, so 'self' would match nothing.
    "content-security-policy": media.kind === "html" ? `${HTML_POLICY}; frame-ancestors ${new URL(request.url).origin}` : "default-src 'none'; sandbox",
    "cross-origin-resource-policy": "same-origin"
  };

  // Videos are fetched in pieces as they play (and as you skip about).
  const size = mediaSize(media);
  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (media.kind === "video" && range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new NextResponse(new Uint8Array(readMedia(media, start, end)), {
      status: 206,
      headers: { ...headers, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) }
    });
  }
  return new NextResponse(new Uint8Array(readMedia(media)), { headers: { ...headers, "accept-ranges": media.kind === "video" ? "bytes" : "none", "content-length": String(size) } });
}
