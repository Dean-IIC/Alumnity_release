import { NextResponse } from "next/server";
import { LIMITS, saveUpload } from "../../../lib/server/media";
import { fromThisSite, signedIn } from "../../../lib/server/http";
import { withinLimit } from "../../../lib/server/throttle";

/*
 * Upload a photo or a cover for your page. Returns the new file's id and kind; your page
 * starts using it when you save it. The file is checked and kept by lib/server/media.ts.
 */
export async function POST(request: Request) {
  const blocked = fromThisSite(request);
  if (blocked) return blocked;
  const me = signedIn(request);
  if (me instanceof NextResponse) return me;
  if (Number(request.headers.get("content-length") ?? 0) > LIMITS.video + 64 * 1024) {
    return NextResponse.json({ ok: false, error: "That’s too big: videos can be up to 25 MB, images 5 MB." }, { status: 413 });
  }
  if (!withinLimit(`upload:${me.user.id}`, 30, 60 * 60_000)) {
    return NextResponse.json({ ok: false, error: "That’s a lot of uploads in an hour. Try again a little later." }, { status: 429 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const use = form?.get("use") === "photo" ? "photo" : "cover";
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, error: "Choose a file first." }, { status: 400 });
  const saved = saveUpload(me.user.id, use, new Uint8Array(await file.arrayBuffer()));
  if (!saved.ok) return NextResponse.json(saved, { status: 400 });
  return NextResponse.json({ ok: true, id: saved.media.id, kind: saved.media.kind });
}
