import { NextResponse } from "next/server";
import { LIMITS, saveUpload } from "../../../lib/server/media";
import { fromThisSite, signedIn } from "../../../lib/server/http";
import { database } from "../../../lib/server/db";
import { withinLimit } from "../../../lib/server/throttle";

const DAILY_BYTES = 200 * 1024 * 1024;

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
  const asked = form?.get("use");
  const use = asked === "photo" || asked === "post" || asked === "story" ? asked : "cover";
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, error: "Choose a file first." }, { status: 400 });
  // At most 200 MB a day each: plenty for photos and short videos, not enough to fill the disk.
  const today = database().prepare("select coalesce(sum(size), 0) as bytes from media where user_id = ? and created_at > ?").get(me.user.id, Date.now() - 24 * 60 * 60_000) as { bytes: number };
  if (today.bytes + file.size > DAILY_BYTES) {
    return NextResponse.json({ ok: false, error: "That's a lot of uploading today. Try again tomorrow." }, { status: 429 });
  }
  const saved = saveUpload(me.user.id, use, new Uint8Array(await file.arrayBuffer()));
  if (!saved.ok) return NextResponse.json(saved, { status: 400 });
  return NextResponse.json({ ok: true, id: saved.media.id, kind: saved.media.kind });
}
