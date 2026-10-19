import { NextResponse } from "next/server";
import { fromThisSite, signedIn } from "../../../../lib/server/http";
import { isSitePendingPath, SITE_PHOTO_BYTES } from "../../../../lib/server/showcase";
import { storage, usingSupabaseStorage } from "../../../../lib/server/storage";

/*
 * Where the browser sends a gallery photo's bytes from the college desk when files are
 * kept in folders on this computer (tests, working offline). With Supabase Storage they go
 * straight there instead, and this answers nothing. The bytes wait, unchecked, with the
 * members' uploads (never in the showcase's folder) until the desk's next step takes them in.
 */
export async function PUT(request: Request) {
  if (usingSupabaseStorage()) return new NextResponse("Not found", { status: 404 });
  const blocked = fromThisSite(request);
  if (blocked) return blocked;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const path = new URL(request.url).searchParams.get("path") ?? "";
  // Only to the place the server gave out to this member of the desk.
  if (!isSitePendingPath(me.user, path)) return NextResponse.json({ ok: false, error: "That upload has expired." }, { status: 404 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > SITE_PHOTO_BYTES) return NextResponse.json({ ok: false, error: "This photo is too big." }, { status: 413 });
  await storage().write(path, bytes, "application/octet-stream");
  return NextResponse.json({ ok: true });
}
