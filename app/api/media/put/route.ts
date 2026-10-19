import { NextResponse } from "next/server";
import { pendingUpload, pendingUploadPath } from "../../../../lib/server/media";
import { fromThisSite, signedIn } from "../../../../lib/server/http";
import { storage, usingSupabaseStorage } from "../../../../lib/server/storage";

/*
 * Where the browser sends an upload's bytes when files are kept in a folder on this
 * computer (tests, working offline). With Supabase Storage they go straight there instead,
 * and this answers nothing.
 */
export async function PUT(request: Request) {
  if (usingSupabaseStorage()) return new NextResponse("Not found", { status: 404 });
  const blocked = fromThisSite(request);
  if (blocked) return blocked;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const id = path.split("/").at(-1) ?? "";
  const pending = await pendingUpload(me.user.id, id);
  // Only to the place the server gave out, for an upload of yours that's still waiting.
  if (!pending || path !== pendingUploadPath(me.user.id, id)) return NextResponse.json({ ok: false, error: "That upload ran out of time. Choose the file again." }, { status: 404 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > pending.size) return NextResponse.json({ ok: false, error: "That isn’t the file you chose." }, { status: 413 });
  await storage().write(path, bytes, "application/octet-stream");
  return NextResponse.json({ ok: true });
}
