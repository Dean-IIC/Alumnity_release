import { NextResponse } from "next/server";
import { fromThisSite, signedIn } from "../../../../lib/server/http";
import { finishSitePhoto, startSitePhoto } from "../../../../lib/server/showcase";

/*
 * Adding a photo to a gallery album, from the college desk, in two steps (the file itself
 * never passes through here: hosts cap what a request may carry, and cameras' photos are
 * bigger than that):
 *
 *   { step: "start", album, size }        → { token, url }: the browser PUTs the photo to `url`;
 *   { step: "finish", album, token, part } → { id }: the photo is checked, sized and added.
 *
 * Only the desk (coordinators and up): lib/server/showcase.ts checks every time.
 */
export async function POST(request: Request) {
  const blocked = fromThisSite(request);
  if (blocked) return blocked;
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const body = (await request.json().catch(() => null)) as { step?: unknown; album?: unknown; size?: unknown; token?: unknown; part?: unknown } | null;
  if (!body) return NextResponse.json({ ok: false, error: "Choose a photo first." }, { status: 400 });
  const album = Number(body.album);

  if (body.step === "start") {
    const started = await startSitePhoto(me.user, album, Number(body.size));
    if (!started.ok) return NextResponse.json({ ok: false, error: started.error }, { status: started.status });
    return NextResponse.json({ ok: true, token: started.token, url: started.url });
  }

  if (body.step === "finish" && typeof body.token === "string") {
    const part = typeof body.part === "string" ? body.part.slice(0, 100) : "";
    const done = await finishSitePhoto(me.user, album, body.token, part);
    if (!done.ok) return NextResponse.json(done, { status: 400 });
    return NextResponse.json({ ok: true, id: done.id });
  }
  return NextResponse.json({ ok: false, error: "Choose a photo first." }, { status: 400 });
}
