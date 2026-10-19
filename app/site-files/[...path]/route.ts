import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { siteFolderFile, usingSupabaseStorage } from "../../../lib/server/storage";

/*
 * The showcase's own files (gallery photos added from the college desk), when they're kept
 * in a folder on this computer (data/site-files: tests, working offline). Public, as the
 * gallery is. With Supabase they come from its public bucket `site` instead, and this
 * answers nothing. Only the albums' photos: JPEGs the server made itself.
 */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (usingSupabaseStorage()) return new NextResponse("Not found", { status: 404 });
  const parts = (await params).path;
  if (parts[0] !== "albums" || parts.length !== 3 || !parts.every((p) => /^[\w-]+(\.jpg)?$/.test(p)) || !parts[2].endsWith(".jpg")) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(siteFolderFile(parts.join("/")));
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" }
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
