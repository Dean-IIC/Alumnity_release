import { NextResponse } from "next/server";
import { batchLabel } from "../../../../../lib/format";
import { signedIn } from "../../../../../lib/server/http";
import { reactorsOf } from "../../../../../lib/server/posts";
import { photoIdsOf } from "../../../../../lib/server/profile";

/**
 * Who reacted to a post: for the list a post's reactions open. Only for a signed-in member
 * who may see the post; each person's name, batch, face and reaction (no more of them).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await signedIn();
  if (me instanceof NextResponse) return me;
  const people = await reactorsOf(me.user, Number((await params).id));
  if (!people) return NextResponse.json({ ok: false, error: "This post isn't available." }, { status: 404 });
  const photos = await photoIdsOf(people.map((p) => p.id));
  return NextResponse.json(
    { ok: true, people: people.map((p) => ({ id: p.id, name: p.name, line: batchLabel(p), kind: p.kind, photo: photos.get(p.id) ?? null })) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
