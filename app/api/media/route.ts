import { NextResponse } from "next/server";
import { finishUpload, startUpload, type UploadUse } from "../../../lib/server/media";
import { fromThisSite, signedIn } from "../../../lib/server/http";
import { withinLimit } from "../../../lib/server/throttle";

/*
 * Uploading a photo or video, in two steps (the file itself never passes through here:
 * hosts cap what a request may carry, and videos are bigger than that):
 *
 *   { step: "start", use, size } → { id, url }: the browser PUTs the file to `url`;
 *   { step: "finish", id }       → { id, kind }: the file is checked and taken in.
 *
 * lib/client/upload.ts does both. Your page or post starts using it when you save.
 */

const USES: UploadUse[] = ["photo", "cover", "post", "story"];

export async function POST(request: Request) {
  const blocked = fromThisSite(request);
  if (blocked) return blocked;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => null)) as { step?: unknown; use?: unknown; size?: unknown; id?: unknown } | null;
  if (!body) return NextResponse.json({ ok: false, error: "Choose a file first." }, { status: 400 });

  if (body.step === "start") {
    if (!(await withinLimit(`upload:${me.user.id}`, 30, 60 * 60_000))) {
      return NextResponse.json({ ok: false, error: "That’s a lot of uploads in an hour. Try again a little later." }, { status: 429 });
    }
    const use = USES.includes(body.use as UploadUse) ? (body.use as UploadUse) : "cover";
    const started = await startUpload(me.user.id, use, Number(body.size));
    if (!started.ok) return NextResponse.json({ ok: false, error: started.error }, { status: started.status });
    return NextResponse.json({ ok: true, id: started.id, url: started.url });
  }

  if (body.step === "finish" && typeof body.id === "string") {
    const saved = await finishUpload(me.user.id, body.id);
    if (!saved.ok) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ ok: true, id: saved.media.id, kind: saved.media.kind });
  }
  return NextResponse.json({ ok: false, error: "Choose a file first." }, { status: 400 });
}
